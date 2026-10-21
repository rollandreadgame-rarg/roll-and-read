#!/usr/bin/env python3
"""
Regenerate word MP3s that failed qa_word_audio.py, keeping only takes that the
same two listeners (Whisper + phoneme recognizer) confirm are better.

For each flagged word, several ElevenLabs takes are generated with the
production voice (Jessica):
  plain    turbo_v2_5, same settings as the original batch (fresh random take)
  steady   turbo_v2_5, higher stability / lower style (clearer, flatter)
  period   turbo_v2_5, text "word." (often gives a cleaner final consonant)
(An IPA <phoneme>-tag take was tried and dropped: with this voice it produced
garbled audio for every word tested.)

Each take is scored by BOTH listeners combined (Whisper distance + phoneme
distance). The best take replaces the original only if it passes, beats the
original's combined score by at least --margin, and — for real words — Whisper
actually hears the word (or a homophone). Originals are backed up.

Usage:
  python3 scripts/audio-qa/regenerate_flagged.py --report out/report.json [--verdicts fail,review,missing] [--dry-run]
"""

import argparse, functools, json, os, re, shutil, sys, time, urllib.error, urllib.request

sys.path.insert(0, os.path.dirname(__file__))
import qa_word_audio as qa  # noqa: E402

@functools.lru_cache(maxsize=None)
def _api_key():
    """ELEVENLABS_API_KEY from the environment, else from .env.local (never source)."""
    if os.environ.get("ELEVENLABS_API_KEY"):
        return os.environ["ELEVENLABS_API_KEY"]
    try:
        with open(os.path.join(qa.ROOT, ".env.local")) as f:
            for line in f:
                if line.startswith("ELEVENLABS_API_KEY="):
                    return line.split("=", 1)[1].strip()
    except FileNotFoundError:
        pass
    sys.exit("Set ELEVENLABS_API_KEY (or add it to .env.local)")
VOICE_ID = "cgSgspJ2msm6clMCkdW9"  # Jessica
BASE_SETTINGS = {"stability": 0.45, "similarity_boost": 0.8, "style": 0.65, "use_speaker_boost": True}
STEADY_SETTINGS = {"stability": 0.75, "similarity_boost": 0.8, "style": 0.2, "use_speaker_boost": True}


CALM_SETTINGS = {"stability": 0.9, "similarity_boost": 0.85, "style": 0.0, "use_speaker_boost": True}

# Round 1 stays on the production model; round 2 (for words round 1 couldn't
# fix) tries other models with the same voice and different deliveries.
ROUNDS = {
    1: [
        ("plain", "eleven_turbo_v2_5", "{w}", BASE_SETTINGS),
        ("steady", "eleven_turbo_v2_5", "{w}", STEADY_SETTINGS),
        ("period", "eleven_turbo_v2_5", "{w}.", BASE_SETTINGS),
    ],
    2: [
        ("mlv2", "eleven_multilingual_v2", "{w}", BASE_SETTINGS),
        ("flash", "eleven_flash_v2_5", "{w}", BASE_SETTINGS),
        ("exclaim", "eleven_turbo_v2_5", "{w}!", STEADY_SETTINGS),
        ("calm", "eleven_turbo_v2_5", "{w}", CALM_SETTINGS),
    ],
}
VARIANT_ORDER = [v[0] for r in sorted(ROUNDS) for v in ROUNDS[r]]


def variants(word, rounds):
    return [(n, m, t.format(w=word), st) for r in rounds for (n, m, t, st) in ROUNDS[r]]


SPELLED_OUT = re.compile(r"^(?:[A-Za-z]\.\s?){2,}$")  # "S.N.E.V." = letters read aloud


def combined(r):
    """Both listeners' distances summed (Whisper counts 0 on exact/homophone)."""
    w = 0.0 if (r.get("exact") or r.get("homophone")) else r.get("whisper_dist", 1.0)
    return round(w + r.get("phoneme_dist", 1.0), 3), w


def tts(text, model, settings):
    req = urllib.request.Request(
        f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE_ID}?output_format=mp3_44100_128",
        data=json.dumps({"text": text, "model_id": model, "voice_settings": settings}).encode(),
        headers={"xi-api-key": _api_key(), "Content-Type": "application/json", "Accept": "audio/mpeg"},
    )
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            body = e.read().decode(errors="replace")[:200]
            if e.code == 429 and attempt < 3:
                time.sleep(5 * (attempt + 1))
                continue
            raise RuntimeError(f"HTTP {e.code}: {body}")


def score_files(paths_by_key, entries_by_key, models):
    """Score arbitrary MP3s with the QA listeners. Returns {key: result}."""
    torch, dev, whisper, phon = models
    keys = list(paths_by_key)
    out = {}
    for i in range(0, len(keys), 16):
        batch = keys[i : i + 16]
        clips, stats = [], []
        for k in batch:
            a = qa.decode(paths_by_key[k])
            stats.append(qa.signal_stats(a))
            pad = qa.np.zeros(qa.SR // 4, dtype=qa.np.float32)
            clips.append(qa.np.concatenate([pad, a, pad]))
        texts = qa.transcribe(torch, dev, whisper, clips)
        heard = qa.phonemes(torch, dev, phon, clips)
        for k, t, h, s in zip(batch, texts, heard, stats):
            out[k] = qa.judge(entries_by_key[k], t, h, s)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--report", required=True)
    ap.add_argument("--verdicts", default="fail,review,missing")
    ap.add_argument("--words", help="comma-separated override list")
    ap.add_argument("--audio-dir", default=os.path.join(qa.ROOT, "public/audio/words"))
    ap.add_argument("--work", default=os.path.join(os.path.dirname(__file__), "out", "candidates"))
    ap.add_argument("--margin", type=float, default=0.2)
    ap.add_argument("--rounds", default="1", help="take sets to generate, e.g. 1 or 1,2")
    ap.add_argument("--dry-run", action="store_true", help="generate + score, don't replace")
    args = ap.parse_args()
    args.rounds = [int(r) for r in args.rounds.split(",")]

    report = {r["word"]: r for r in json.load(open(args.report))}
    catalog = qa.load_words()
    if args.words:
        targets = args.words.split(",")
    else:
        want = set(args.verdicts.split(","))
        targets = [w for w, r in report.items() if r["verdict"] in want]
    print(f"{len(targets)} words to regenerate", flush=True)
    os.makedirs(args.work, exist_ok=True)
    backup = os.path.join(os.path.dirname(args.work), "originals")
    os.makedirs(backup, exist_ok=True)

    paths, entries = {}, {}
    for w in targets:
        entry = catalog.get(w, {"word": w, "levels": [], "isNonsense": False, "pattern": ""})
        for name, model, text, settings in variants(w, args.rounds):
            key = f"{w}|{name}"
            path = os.path.join(args.work, f"{w}__{name}.mp3")
            if not os.path.exists(path):
                try:
                    with open(path, "wb") as f:
                        f.write(tts(text, model, settings))
                except RuntimeError as e:
                    print(f"  {key}: {e}", flush=True)
                    if os.path.exists(path):
                        os.remove(path)
                    continue
            paths[key], entries[key] = path, entry
    print(f"generated/scored candidates: {len(paths)}", flush=True)

    models = qa.load_models()
    scores = score_files(paths, entries, models)

    decisions = []
    for w in targets:
        cands = sorted(
            [(combined(scores[k])[0], k.split("|")[1], k) for k in scores
             if k.startswith(w + "|") and k.split("|")[1] in VARIANT_ORDER
             and not SPELLED_OUT.match(scores[k]["whisper"].strip())],
            key=lambda c: (c[0], VARIANT_ORDER.index(c[1])),
        )
        orig_r = report.get(w, {})
        orig = combined(orig_r)[0] if orig_r.get("verdict") != "missing" else 2.0
        if not cands:
            decisions.append({"word": w, "action": "no_candidates", "orig_combined": orig})
            continue
        best_score, best_name, best_key = cands[0]
        best = scores[best_key]
        whisper_part = combined(best)[1]
        heard_ok = entries[best_key]["isNonsense"] or whisper_part == 0.0
        # A real word Whisper now hears exactly (where it misheard the original)
        # is a fix even if the phoneme model is noisy on it.
        fixed_real_word = (
            not entries[best_key]["isNonsense"] and whisper_part == 0.0
            and not (orig_r.get("exact") or orig_r.get("homophone"))
        )
        replace = (
            best["verdict"] == "pass" and heard_ok
            and best_score <= orig - args.margin
            and (best_score <= 0.5 or fixed_real_word)
            and "mostly_silent" not in best["flags"]
        )
        decisions.append({
            "word": w, "action": "replace" if replace else "keep", "orig_combined": orig,
            "orig_whisper": orig_r.get("whisper"), "best_variant": best_name,
            "best_combined": best_score, "best_whisper": best["whisper"], "best_heard": best["heard_ipa"],
            "expected": best["expected_ipa"], "all": {c[1]: c[0] for c in cands},
        })
        if replace and not args.dry_run:
            dst = os.path.join(args.audio_dir, f"{w}.mp3")
            if os.path.exists(dst) and not os.path.exists(os.path.join(backup, f"{w}.mp3")):
                shutil.copy2(dst, os.path.join(backup, f"{w}.mp3"))
            shutil.copy2(paths[best_key], dst)

    out = os.path.join(os.path.dirname(args.work), "regeneration.json")
    json.dump(decisions, open(out, "w"), indent=1, ensure_ascii=False)
    n = sum(d["action"] == "replace" for d in decisions)
    print(f"replace: {n} · keep: {len(decisions) - n}{' (dry run)' if args.dry_run else ''} → {out}")


if __name__ == "__main__":
    sys.exit(main())
