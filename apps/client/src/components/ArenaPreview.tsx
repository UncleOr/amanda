import { useMemo, useState } from "react";
import { runBattle, type BoardInput, type Placement } from "@amanda/engine";
import { CATALOG, SERIES, SYNERGIES, cardPool } from "../data/catalog";
import { Arena } from "./Arena";
import { line as t } from "../game/copy";

/**
 * Battle-FX workbench (open the game with ?arena).
 *
 * Replays one deterministic battle on demand so the attack, hit, death and aura
 * animations — and the painted battlefield under them — can be judged without
 * playing a whole match first. Pick a series to field a full family of one kind
 * and watch just that family's attacks.
 */
/**
 * Every family in the game, plus "" for a mixed board.
 *
 * ⚠ It was a hand-written list of five, which quietly stopped being every
 * family the day a sixth was added — so the one workbench for judging battle
 * animations could not show the three newest families at all, which is
 * exactly when a workbench is needed. Derived now, like everything else: a
 * family drawn tomorrow is in this menu tomorrow.
 */
const SERIES_IDS: readonly string[] = ["", ...SERIES.map((s) => s.id)];

function pick(seriesId: string, count: number, offset: number): string[] {
  const pool = cardPool().filter((id) => !seriesId || CATALOG.get(id)?.seriesId === seriesId);
  if (!pool.length) return [];
  return Array.from({ length: count }, (_, i) => pool[(i + offset) % pool.length]!);
}

function board(owner: "A" | "B", seriesId: string, offset: number): BoardInput {
  const ids = pick(seriesId, 9, offset);
  const placements: Placement[] = [{ cardId: ids[0]!, x: 1, y: 1, king: true }];
  // every perimeter cell of the 4×4 board, skipping the 2×2 King block
  let n = 1;
  for (let y = 0; y < 4; y++)
    for (let x = 0; x < 4; x++) {
      if (x >= 1 && x <= 2 && y >= 1 && y <= 2) continue;
      placements.push({ cardId: ids[n % ids.length]!, x, y });
      n++;
    }
  return { owner, placements };
}

export function ArenaPreview() {
  const [left, setLeft] = useState<string>("dragons");
  const [right, setRight] = useState<string>("giants");
  const [run, setRun] = useState(0);

  const result = useMemo(
    () =>
      runBattle({
        seed: 1234 + run,
        catalog: CATALOG,
        synergies: SYNERGIES,
        a: board("A", left, run),
        b: board("B", right, run + 3),
        recordFrames: true,
      }),
    [left, right, run],
  );

  return (
    <div className="gallery">
      <header className="gallery__bar">
        <h2>{t("sd2e39c8", "מעבדת קרב")}</h2>
        <label>
          {t("se4ac52e", "שמאל")}:{" "}
          <select value={left} onChange={(e) => setLeft(e.target.value)}>
            {SERIES_IDS.map((s) => (
              <option key={s} value={s}>
                {s || t("se019310", "מעורב")}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t("sef32a80", "ימין")}:{" "}
          <select value={right} onChange={(e) => setRight(e.target.value)}>
            {SERIES_IDS.map((s) => (
              <option key={s} value={s}>
                {s || t("s3962d65", "מעורב")}
              </option>
            ))}
          </select>
        </label>
        <button onClick={() => setRun((r) => r + 1)}>{t("s1e70355", "▶ הרץ שוב")}</button>
      </header>
      <Arena key={run} result={result} onFinish={() => {}} />
    </div>
  );
}
