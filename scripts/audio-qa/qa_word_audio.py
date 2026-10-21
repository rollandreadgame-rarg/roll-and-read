#!/usr/bin/env python3
"""
Automated QA for the word pronunciation MP3s in public/audio/words/.

Every word is checked by two independent listeners:
  1. Whisper (openai/whisper-large-v3-turbo) transcribes the clip. A clip passes
     outright if the transcript is the word, or a homophone of it (same IPA).
  2. A phoneme recognizer (vitouphy/wav2vec2-xls-r-300m-timit-phoneme) outputs the
     sounds it heard, compared against espeak-ng's pronunciation of the
     spelling. This is what makes nonsense words ("zat", "chelt") checkable —
     Whisper can't spell a word that doesn't exist, but the sounds still match.

A clip is scored by its closest phonetic distance (0 = identical) from either
listener, plus basic signal checks (silence, clipping, too long/short).

Usage:
  python3 scripts/audio-qa/qa_word_audio.py [--words lap,zat] [--audio-dir DIR] [--out DIR]
Outputs <out>/report.json and <out>/report.csv (default out: scripts/audio-qa/out).
Requires: ffmpeg, espeak-ng (brew install espeak-ng), torch, transformers, numpy.
"""

import argparse, csv, json, os, re, subprocess, sys, time
from functools import lru_cache

import numpy as np

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
WORD_FILES = [
    "convex/seedWordLists.ts",
    "convex/wordData/level1.ts",
    "convex/wordData/level2.ts",
    "convex/wordData/level3.ts",
    "convex/wordData/level4.ts",
    "convex/wordData/level5.ts",
]
SR = 16000
PASS_MAX = 0.20   # phonetic distance at or below this → pass
FAIL_MIN = 0.40   # above this → fail; in between → review

ENTRY_RE = re.compile(
    r'\{\s*word:\s*"([^"]+)",\s*isNonsense:\s*(true|false),\s*level:\s*"([^"]+)".*?phonicPattern:\s*"([^"]*)"'
)


def load_words():
    """All unique words with their sublevels, nonsense flag and phonic pattern."""
    words = {}
    for rel in WORD_FILES:
        with open(os.path.join(ROOT, rel)) as f:
            for word, nonsense, level, pattern in ENTRY_RE.findall(f.read()):
                e = words.setdefault(word, {"word": word, "levels": [], "isNonsense": nonsense == "true", "pattern": pattern})
                e["levels"].append(level)
    return words


def decode(path):
    """MP3 → mono float32 at 16 kHz via ffmpeg."""
    raw = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", path, "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"],
        check=True, capture_output=True,
    ).stdout
    return np.frombuffer(raw, dtype=np.float32).copy()


def signal_stats(a):
    """Duration, loudness, and how much of the clip is actual sound."""
    if a.size == 0:
        return {"duration": 0.0, "voiced": 0.0, "peak": 0.0, "clipped": 0}
    frame = SR // 50  # 20 ms
    n = a.size // frame
    rms = np.sqrt((a[: n * frame].reshape(n, frame) ** 2).mean(axis=1)) if n else np.array([0.0])
    voiced = rms > max(0.01, rms.max() * 0.05)
    return {
        "duration": round(a.size / SR, 3),
        "voiced": round(float(voiced.sum()) * 0.02, 3),
        "peak": round(float(np.abs(a).max()), 3),
        "clipped": int((np.abs(a) >= 0.999).sum()),
    }


# ── Phonetics ────────────────────────────────────────────────────────────────

# Multi-character phonemes collapsed to one symbol so edit distance counts
# each sound once. Longest first.
COLLAPSE = [
    ("tʃ", "C"), ("dʒ", "J"), ("oʊ", "O"), ("əʊ", "O"), ("eɪ", "E"), ("aɪ", "I"),
    ("aʊ", "W"), ("ɔɪ", "Y"), ("ɚ", "əɹ"), ("ɝ", "ɜɹ"),
]
DROP = "ˈˌːˑ̃ʔ.‿-|_ "
SIMILAR = {  # near-identical vowel pairs (accent/reduction), cheaper substitution
    frozenset("ɑɔ"): 0.3, frozenset("əʌ"): 0.3, frozenset("əɪ"): 0.5, frozenset("ɜə"): 0.3,
    frozenset("ʊu"): 0.5, frozenset("ɪi"): 0.5, frozenset("ɐə"): 0.1, frozenset("ɐʌ"): 0.3,
    frozenset("ɑa"): 0.2, frozenset("ɾt"): 0.3, frozenset("ɾd"): 0.3, frozenset("ɛe"): 0.3,
    # Voicing of stops/fricatives: ElevenLabs often under-releases final stops.
    frozenset("pb"): 0.5, frozenset("td"): 0.5, frozenset("kg"): 0.5, frozenset("sz"): 0.5,
    frozenset("fv"): 0.5, frozenset("θð"): 0.3,
}


def norm_ipa(s):
    s = s.replace("ɡ", "g").replace("r", "ɹ").replace("ᵻ", "ɪ").replace("ɫ", "l").replace("ʲ", "")
    s = s.replace("ʧ", "tʃ").replace("ʤ", "dʒ").replace("ɝ", "ɜɹ").replace("ɨ", "ɪ").replace("ʉ", "u")
    for ch in DROP:
        s = s.replace(ch, "")
    for a, b in COLLAPSE:
        s = s.replace(a, b)
    return s


@lru_cache(maxsize=None)
def g2p(text):
    """espeak-ng pronunciation (US English) of a spelling, normalized."""
    out = subprocess.run(
        ["espeak-ng", "-q", "--ipa=1", "-v", "en-us", text], capture_output=True, text=True
    ).stdout
    return norm_ipa(out.strip())


# espeak guesses nonsense words from English spelling rules, which is ambiguous
# for some vowel teams. Each phonic pattern lists respellings of the intended
# sound(s); a clip matching ANY accepted reading is correct.
PATTERN_RESPELL = {
    "vowel-team-igh": [("igh", "ie")],
    "vowel-team-ew": [("ew", "oo")],
    "vowel-team-ui": [("ui", "oo")],
    "vowel-team-ue": [("ue", "oo")],
    "vowel-team-ei": [("ei", "ee"), ("ei", "ay")],
    "vowel-team-ey": [("ey", "ee"), ("ey", "ay")],
    "vowel-team-ow-long": [("ow", "oe")],
    "ea-short": [("ea", "e")],
    "silent-l": [("alm", "ahm"), ("alk", "awk")],
    "greek-gue": [("ogue", "ohg")],
    "y-vowel": [(r"y$", "ie"), (r"y$", "ee")],
}


def expected_readings(word, pattern=""):
    """All accepted normalized pronunciations of a word."""
    readings = {g2p(word)}
    for pat, rep in PATTERN_RESPELL.get(pattern, []):
        alt = re.sub(pat, rep, word)
        if alt != word:
            readings.add(g2p(alt))
    if pattern == "vowel-team-oo":  # food vs book
        readings |= {r.replace("u", "ʊ") for r in readings} | {r.replace("ʊ", "u") for r in readings}
    return sorted(readings)


def phon_dist(heard, expected):
    """Weighted Levenshtein distance / len(expected)."""
    if not expected:
        return 1.0
    m, n = len(heard), len(expected)
    prev = list(range(n + 1))
    for i in range(1, m + 1):
        cur = [i] + [0] * n
        for j in range(1, n + 1):
            a, b = heard[i - 1], expected[j - 1]
            sub = 0 if a == b else SIMILAR.get(frozenset((a, b)), 1)
            cur[j] = min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + sub)
        prev = cur
    return round(prev[n] / n, 3)


def clean_text(t):
    return re.sub(r"[^a-z' ]", "", t.lower()).strip()


# ── Models ───────────────────────────────────────────────────────────────────

def load_models():
    import torch
    from transformers import AutoModelForSpeechSeq2Seq, AutoProcessor, Wav2Vec2ForCTC
    dev = "mps" if torch.backends.mps.is_available() else "cpu"
    # float32: Whisper in float16 on Apple GPUs emits "!!!!" / hallucinations.
    wid = "openai/whisper-large-v3-turbo"
    wproc = AutoProcessor.from_pretrained(wid)
    wmodel = AutoModelForSpeechSeq2Seq.from_pretrained(wid, torch_dtype=torch.float32).to(dev).eval()
    # Trained on TIMIT (American English), so it keeps /æ/ vs /ɑ/ (lap vs lop)
    # apart — multilingual phoneme models blur them into /a/.
    pid = "vitouphy/wav2vec2-xls-r-300m-timit-phoneme"
    pproc = AutoProcessor.from_pretrained(pid)
    pmodel = Wav2Vec2ForCTC.from_pretrained(pid).to(dev).eval()
    return torch, dev, (wproc, wmodel), (pproc, pmodel)


def transcribe(torch, dev, whisper, clips):
    proc, model = whisper
    feats = proc(clips, sampling_rate=SR, return_tensors="pt").input_features.to(dev, dtype=model.dtype)
    with torch.no_grad():
        ids = model.generate(feats, language="en", task="transcribe", max_new_tokens=16)
    return [t.strip() for t in proc.batch_decode(ids, skip_special_tokens=True)]


def phonemes(torch, dev, phon, clips):
    proc, model = phon
    out = []
    for clip in clips:  # one at a time: padding shifts this model's CTC output
        inp = proc(clip, sampling_rate=SR, return_tensors="pt")
        with torch.no_grad():
            ids = model(inp.input_values.to(dev)).logits.argmax(-1).cpu()
        out.append(norm_ipa(proc.batch_decode(ids)[0]))
    return out


# ── Verdict ──────────────────────────────────────────────────────────────────

def judge(entry, text, heard_ipa, stats):
    word = entry["word"]
    readings = expected_readings(word, entry.get("pattern", ""))
    said = clean_text(text)
    said_ipa = g2p(said) if said else ""
    d_whisper = min(phon_dist(said_ipa, e) for e in readings) if said else 1.0
    d_phoneme = min(phon_dist(heard_ipa, e) for e in readings)
    expected = min(readings, key=lambda e: phon_dist(heard_ipa, e))
    exact = said.replace(" ", "") == word.lower()
    homophone = bool(said) and said_ipa in readings
    best = 0.0 if (exact or homophone) else min(d_whisper, d_phoneme)

    flags = []
    if stats["peak"] < 0.01 or stats["voiced"] < 0.1:
        flags.append("mostly_silent")
    elif stats["voiced"] < 0.15:
        flags.append("very_short")
    if stats["duration"] > 2.5:
        flags.append("too_long")
    if stats["clipped"] > 50:
        flags.append("clipping")
    if stats["peak"] < 0.1:
        flags.append("very_quiet")
    if said and len(said.split()) > 1 and not exact:
        flags.append("multiple_words_heard")

    if best <= PASS_MAX and not {"mostly_silent"} & set(flags):
        verdict = "pass"
    elif best > FAIL_MIN or "mostly_silent" in flags:
        verdict = "fail"
    else:
        verdict = "review"
    return {
        "word": word, "levels": entry["levels"], "isNonsense": entry["isNonsense"],
        "verdict": verdict, "score": round(best, 3),
        "whisper": text, "whisper_dist": d_whisper, "exact": exact, "homophone": homophone,
        "expected_ipa": expected, "heard_ipa": heard_ipa, "phoneme_dist": d_phoneme,
        "flags": flags, **stats,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--words", help="comma-separated subset to check")
    ap.add_argument("--audio-dir", default=os.path.join(ROOT, "public/audio/words"))
    ap.add_argument("--out", default=os.path.join(os.path.dirname(__file__), "out"))
    ap.add_argument("--batch", type=int, default=16)
    args = ap.parse_args()

    words = load_words()
    if args.words:
        want = set(args.words.split(","))
        words = {k: words.get(k, {"word": k, "levels": [], "isNonsense": False, "pattern": ""}) for k in want}
    os.makedirs(args.out, exist_ok=True)

    missing = [w for w in words if not os.path.exists(os.path.join(args.audio_dir, f"{w}.mp3"))]
    todo = [w for w in sorted(words) if w not in missing]
    print(f"{len(words)} words · {len(missing)} missing audio · checking {len(todo)}", flush=True)

    torch, dev, whisper, phon = load_models()
    results, t0 = [], time.time()
    for i in range(0, len(todo), args.batch):
        batch = todo[i : i + args.batch]
        clips, stats = [], []
        for w in batch:
            a = decode(os.path.join(args.audio_dir, f"{w}.mp3"))
            stats.append(signal_stats(a))
            pad = np.zeros(SR // 4, dtype=np.float32)
            clips.append(np.concatenate([pad, a, pad]))
        texts = transcribe(torch, dev, whisper, clips)
        heard = phonemes(torch, dev, phon, clips)
        for w, t, h, s in zip(batch, texts, heard, stats):
            results.append(judge(words[w], t, h, s))
        print(f"  {min(i + args.batch, len(todo))}/{len(todo)}  {time.time() - t0:.0f}s", flush=True)

    for w in missing:
        results.append({"word": w, "levels": words[w]["levels"], "isNonsense": words[w]["isNonsense"], "verdict": "missing", "score": 1.0, "flags": ["missing_file"]})

    results.sort(key=lambda r: (-r["score"], r["word"]))
    with open(os.path.join(args.out, "report.json"), "w") as f:
        json.dump(results, f, indent=1, ensure_ascii=False)
    cols = ["word", "verdict", "score", "isNonsense", "levels", "whisper", "expected_ipa", "heard_ipa", "whisper_dist", "phoneme_dist", "flags", "duration", "voiced", "peak"]
    with open(os.path.join(args.out, "report.csv"), "w", newline="") as f:
        wr = csv.DictWriter(f, fieldnames=cols, extrasaction="ignore")
        wr.writeheader()
        for r in results:
            wr.writerow({**r, "levels": " ".join(r.get("levels", [])), "flags": " ".join(r.get("flags", []))})
    counts = {}
    for r in results:
        counts[r["verdict"]] = counts.get(r["verdict"], 0) + 1
    print("verdicts:", counts)


if __name__ == "__main__":
    sys.exit(main())
