# Sticker Pick & Reveal Polish — Design Spec

**Date:** 2026-06-11
**Status:** Design captured — awaiting kickoff (user wants to start fresh next session)
**Author:** Claude + Nadir

---

## 1. Summary

Polish the two phases of `components/celebrations/PickCategoryModal.tsx` — the
pack-pick screen and the sticker reveal — so the reward moment feels exciting
instead of muted. Make both **bigger**, add **staged animations**, and add
**custom rarity-aware sound**. Reveal intensity (sound + visual) **scales with
rarity**. No new heavy libraries: Framer Motion, `canvas-confetti`, and the
existing `components/ui/sparkles` are already in the project. Nothing else in the
game changes.

**Why:** the modal currently plays NO sound during picking/reveal and uses a
small `max-w-sm` layout with a basic spring — the headline reward feels flat.

**Confirmed decisions:**
- Sounds: **generate new custom SFX** via ElevenLabs (project is already set up).
- Reveal: **tier it by rarity** (common = quick/pleasant, legendary = grand event).

---

## 2. Size & layout (bigger)

- Modal grows from `max-w-sm` → ~`max-w-lg`; near-full-width on phones with comfy margins.
- **Pick screen:** the 3 category packs become larger tap targets with bigger
  preview art + category name (kid-friendly finger targets).
- **Reveal screen:** the sticker roughly doubles (~180–220px), centered, with a
  rarity-colored glow halo, name, and a rarity badge.

```
PICK SCREEN                          REVEAL SCREEN
┌───────────────────────────┐        ┌───────────────────────────┐
│      🎉 Pick a pack!       │        │       ✨ You got! ✨        │
│   (1 of 3 rewards)         │        │      ╔═══════════╗         │
│  ┌──────┐┌──────┐┌──────┐  │   →    │      ║  sticker  ║ ~200px  │
│  │ 🐾   ││ 👑   ││ 🚗   │  │        │      ║   image   ║  glow   │
│  │Animals││Princ.││Vehic.│ │        │      ╚═══════════╝         │
│  └──────┘└──────┘└──────┘  │        │   Rescue Helicopter        │
└───────────────────────────┘        │       ● RARE ●  [Next 🎁]  │
                                      └───────────────────────────┘
```

---

## 3. Animations (nice, not crazy — Framer Motion + confetti)

**Pick screen:** backdrop fades → title drops in → the 3 packs **stagger in**
(pop + spring, ~80ms apart) with a gentle idle float → press lifts/scales a card
→ on pick, the chosen card scales up while the other two slide/fade away, then
transition to the reveal.

**Reveal:** a short **anticipation beat** (~0.6–0.8s shimmer/sweep) → sticker
**pops in** (scale 0 → overshoot → settle, spring) with a glow pulse + sparkles →
name and rarity badge rise up.

---

## 4. Rarity-tiered reveal payoff

| Rarity | Visual | Sound |
|---|---|---|
| Common | quick pop + light sparkle | soft pop + chime (`reveal-common`) |
| Uncommon | pop + sparkle + soft glow | shares `reveal-common` |
| Rare | confetti burst (purple) + bigger pop | bigger chime/burst (`reveal-rare`) |
| Legendary | gold confetti explosion + radial rays + screen-edge glow | grand fanfare (`reveal-legendary`) |

Confetti via `canvas-confetti` (already a dependency), colored per rarity.

---

## 5. Custom sounds (ElevenLabs, ~6 short MP3s)

Generate via a new re-runnable script mirroring `scripts/generate-row-complete-previews.py`,
output to `public/audio/`, register keys in `lib/audio/soundManager.ts`
(`initAudio` audioFiles map). All respect the existing mute/volume
(`setMasterVolume`/`setMuted` already exist).

| Key | Moment | Feel |
|---|---|---|
| `packAppear` | 3 packs slide in | soft magical whoosh + chime |
| `packPick` | a pack is tapped | satisfying pop/tap |
| `revealBuild` | anticipation beat (~0.7s) | short build/shimmer |
| `revealCommon` | common/uncommon reveal | pleasant pop + chime |
| `revealRare` | rare reveal | bigger burst/chime |
| `revealLegendary` | legendary reveal | grand celebratory fanfare |

---

## 6. Guardrails

- Whole pick→reveal stays under ~2–3s so kids aren't waiting.
- Honor `prefers-reduced-motion` (tone animations down) — fits the app's
  accessibility focus (OpenDyslexic, high-contrast theme).
- All effects scoped inside `PickCategoryModal`; extract the reveal into a small
  `StickerReveal` sub-component to keep the file focused.

---

## 7. Implementation notes (for the plan)

- **Files likely touched:** `components/celebrations/PickCategoryModal.tsx`
  (split out `StickerReveal`), `lib/audio/soundManager.ts` (new keys), new
  `scripts/generate-pick-reveal-sfx.py`, new MP3s in `public/audio/`.
- **No new deps.** Framer Motion + canvas-confetti + Sparkles already present.
- **Depends on:** the Plan 2 pick flow being in place — it is, on branch
  `feature/real-sticker-catalog` (the modal exists and works, just needs polish).

---

## 8. Out of scope
- Lottie animations (user said "nothing too crazy" — Framer + confetti is enough).
- Changes to the board-complete modal, shop, or sticker book.
- The reward logic / category leans / catalog (already built).
