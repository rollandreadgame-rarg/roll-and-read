import { describe, expect, test } from "vitest";
import { LEVEL_UP_ACCURACY, LEVEL_UP_MIN_BOARDS } from "@/lib/game/boardGenerator";
import { LEVEL_SEQUENCE } from "@/lib/levels";
import {
  METRICS,
  METRIC_BY_ID,
  ON_TRACK_ACCURACY_PCT,
  TOUR_ADD_READER,
  TOUR_CLOSING,
  TOUR_OVERVIEW,
  TOUR_WELCOME,
} from "./metrics";

describe("teacher explainer copy", () => {
  test("on-track percentage follows the real level-up rule", () => {
    expect(ON_TRACK_ACCURACY_PCT).toBe(Math.round(LEVEL_UP_ACCURACY * 100));
    expect(METRIC_BY_ID.accuracy.goodSignal).toContain(`${ON_TRACK_ACCURACY_PCT}%`);
    expect(METRIC_BY_ID["level-progress"].goodSignal).toContain(`${LEVEL_UP_MIN_BOARDS} boards`);
    expect(METRIC_BY_ID["level-progress"].goodSignal).toContain(`${ON_TRACK_ACCURACY_PCT}%`);
  });

  test("level range in the copy matches the curriculum", () => {
    const first = LEVEL_SEQUENCE[0];
    const last = LEVEL_SEQUENCE[LEVEL_SEQUENCE.length - 1];
    expect(METRIC_BY_ID["level-progress"].what).toContain(`${first} to ${last}`);
  });

  test("ids and tour anchors are unique, and the lookup covers every metric", () => {
    const ids = METRICS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    const anchors = [...METRICS.map((m) => m.anchorId), TOUR_OVERVIEW.anchorId, TOUR_ADD_READER.anchorId, TOUR_CLOSING.anchorId];
    expect(new Set(anchors).size).toBe(anchors.length);
    for (const m of METRICS) expect(METRIC_BY_ID[m.id]).toBe(m);
  });

  test("every text field is filled in", () => {
    for (const m of METRICS) {
      for (const field of [m.title, m.what, m.goodSignal, m.watchSignal]) {
        expect(field.trim().length).toBeGreaterThan(10);
        expect(field).not.toMatch(/undefined|NaN|\$\{/);
      }
    }
    for (const t of [TOUR_WELCOME.bodyWithPin, TOUR_WELCOME.bodyNoPin, TOUR_OVERVIEW.body, TOUR_ADD_READER.body, TOUR_CLOSING.body]) {
      expect(t.length).toBeGreaterThan(20);
      expect(t).not.toMatch(/ {2}/); // string concatenation never leaves double spaces
    }
  });
});
