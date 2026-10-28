import { useCallback, useEffect, useMemo, useState } from "react";
import { ARENAS, applyArenaOverrides, atArena, type Arena } from "@amanda/shared";
import { SERIES, sortSeriesByAppearance } from "../data/catalog";

/**
 * Editing the rungs of the ladder.
 *
 * Or: *"give me an arena editor in the admin panel too — which pack opens in
 * them (packs that are already in another arena are blocked), and a name and
 * text in Hebrew and English."*
 *
 * Three of the four things on this screen are his writing — the name, the
 * tease on the locked card, and the story you are told once you have arrived
 * — and until now every word of them was a deploy. He is the copywriter.
 *
 * ═══ THE FOURTH THING IS NOT COPY, AND IT IS THE ONE WITH TEETH ═══
 *
 * "Which pack opens here" is `introduces`, and it is the spine of the whole
 * progression: it decides when a family first appears in the album, whether
 * a chest may contain one of its cards, and where its shelf sits. Moving it
 * moves all three at once. So his parenthesis — *"packs already in another
 * arena are blocked"* — is drawn here as a disabled option AND enforced in
 * two more places that a second browser tab cannot get around: the server
 * refuses a clash, and applyArenaOverrides resolves the whole set at once.
 *
 * ═══ WHAT IS NOT HERE ═══
 *
 * The trophy count a rung begins at. Those seven numbers are his own
 * (0 · 150 · 450 · 1,200 · 2,400 · 4,500 · 8,000 — about a year and a half)
 * and they are the one field in an arena that the arenas AROUND it depend
 * on; a typo at midnight would put two rungs out of order for the players
 * who had already climbed past them. It is a one-line change in arenas.ts
 * when he wants it, with the ladder test watching.
 */
type Call = (path: string, body?: Record<string, unknown>) => Promise<Record<string, unknown>>;
type Say = (message: string) => void;

interface Row {
  id: string;
  data: Record<string, unknown>;
  updated_at?: string;
}

/** The three pieces of writing an arena carries, in the order they reach a player. */
const WORDS = [
  { key: "name", he: "שם", long: false },
  { key: "tease", he: "שורת הנעילה", long: false },
  { key: "story", he: "הסיפור", long: true },
] as const;

type WordKey = (typeof WORDS)[number]["key"];

/** What an arena currently says, as the draft starts out. */
function draftOf(arena: Arena) {
  return {
    name: { ...arena.name },
    tease: { ...arena.tease },
    story: { ...arena.story },
    introduces: arena.introduces ?? "",
  };
}

type Draft = ReturnType<typeof draftOf>;

export function ArenasTab({ call, say }: { call: Call; say: Say }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() =>
    Object.fromEntries(ARENAS.map((a) => [a.id, draftOf(a)])),
  );

  const refresh = useCallback(async () => {
    const r = await call("/api/admin/arenas");
    setRows((r.rows as Row[]) ?? []);
  }, [call]);
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const edited = useMemo(() => new Set(rows.map((r) => r.id)), [rows]);

  /**
   * Which family each arena has claimed, as the ladder stands right now.
   *
   * Read off ARENAS rather than off the drafts: a family is taken when an
   * arena has actually SAVED it, and greying out a family because it is
   * half-typed in a box further down the page would be a lie about the game.
   */
  const claimedBy = useMemo(() => {
    const out = new Map<string, string>();
    for (const a of ARENAS) if (a.introduces) out.set(a.introduces, a.id);
    return out;
  }, [rows]);

  const set = (id: string, patch: Partial<Draft>) =>
    setDrafts((d) => ({ ...d, [id]: { ...d[id]!, ...patch } }));

  const setWord = (id: string, key: WordKey, lang: "he" | "en", text: string) =>
    setDrafts((d) => ({ ...d, [id]: { ...d[id]!, [key]: { ...d[id]![key], [lang]: text } } }));

  function dirty(arena: Arena): boolean {
    return JSON.stringify(drafts[arena.id]) !== JSON.stringify(draftOf(arena));
  }

  async function save(arena: Arena) {
    const draft = drafts[arena.id]!;
    for (const w of WORDS)
      if (!draft[w.key].he.trim()) return say(`${w.he} בעברית לא יכול להישאר ריק.`);
    const r = await call("/api/admin/arenas/save", { id: arena.id, data: draft });
    if (r.error) return say(String(r.error));
    /*
     * Applied to this browser's own ladder straight away, rather than waiting
     * for a reload: the panel reads ARENAS to decide which families are
     * taken, so a save that is only in the database would leave the next row
     * down offering a family that has just been claimed.
     */
    applyArenaOverrides([{ id: arena.id, data: draft }]);
    sortSeriesByAppearance();
    await refresh();
    say(`${arena.name.he} נשמרה. המשחק כבר אומר את זה.`);
  }

  async function revert(arena: Arena) {
    const r = await call("/api/admin/arenas/revert", { id: arena.id });
    if (r.error) return say(String(r.error));
    await refresh();
    say("חזרה למקור. רענן את הדף כדי לראות את המילים המקוריות.");
  }

  return (
    /*
     * Its own wrapper rather than the gifts grid every other tab borrows:
     * that grid is 380px plus the rest, which squeezes a five-line story
     * into a 153px box showing a third of it. The stories are the point of
     * this screen.
     */
    <div className="arenas">
      <section>
        <h2>הארנות</h2>
        {/* The admin panel is the one screen allowed to explain itself. */}
        <p className="arenas__hint">
          סדר הגביעים קבוע ולא נערך כאן. החבילה שנפתחת בארנה קובעת מתי הסדרה
          מופיעה באלבום ומתי תיבה יכולה לתת ממנה קלף — ולכן סדרה שכבר נפתחת
          בארנה אחרת חסומה.
        </p>

        <div className="arenas__list">
          {ARENAS.map((arena) => {
            const draft = drafts[arena.id]!;
            return (
              <article className="arn" key={arena.id}>
                <header className="arn__head">
                  <b className="arn__name">{arena.name.he}</b>
                  <span className="arn__from">{arena.from} גביעים</span>
                  {edited.has(arena.id) && <b className="admin__badge">נערך</b>}
                  {arena.locked && <b className="admin__badge">נעולה</b>}
                </header>

                <label className="fld arn__fld">
                  <span>החבילה שנפתחת כאן</span>
                  <select
                    value={draft.introduces}
                    onChange={(e) => set(arena.id, { introduces: e.target.value })}
                  >
                    <option value="">— לא נפתחת חבילה —</option>
                    {SERIES.map((s) => {
                      const takenBy = claimedBy.get(s.id);
                      const blocked = takenBy !== undefined && takenBy !== arena.id;
                      const where = ARENAS.find((a) => a.id === takenBy);
                      return (
                        <option key={s.id} value={s.id} disabled={blocked}>
                          {s.name.he}
                          {/*
                            `atArena`, not "ב" + the name: ב and ה collapse in
                            Hebrew, and writing them both gives "כבר בהמוסך".
                            Or caught exactly this on the home screen once —
                            *"עוד 150 להמגרש"* — correct code, broken language.
                          */}
                          {blocked && where ? ` — כבר ${atArena(where.name.he)}` : ""}
                        </option>
                      );
                    })}
                  </select>
                </label>

                {WORDS.map((w) => (
                  <div className="arn__pair" key={w.key}>
                    <label className="fld arn__fld">
                      <span>{w.he} — עברית</span>
                      {w.long ? (
                        <textarea
                          className="admin__preview"
                          rows={5}
                          value={draft[w.key].he}
                          onChange={(e) => setWord(arena.id, w.key, "he", e.target.value)}
                        />
                      ) : (
                        <input
                          value={draft[w.key].he}
                          onChange={(e) => setWord(arena.id, w.key, "he", e.target.value)}
                        />
                      )}
                    </label>
                    <label className="fld arn__fld" dir="ltr">
                      <span>{w.he} — English</span>
                      {w.long ? (
                        <textarea
                          className="admin__preview"
                          rows={5}
                          value={draft[w.key].en}
                          onChange={(e) => setWord(arena.id, w.key, "en", e.target.value)}
                        />
                      ) : (
                        <input
                          value={draft[w.key].en}
                          onChange={(e) => setWord(arena.id, w.key, "en", e.target.value)}
                        />
                      )}
                    </label>
                  </div>
                ))}

                <div className="admin__row-actions">
                  <button
                    className="btn-fight btn-small"
                    disabled={!dirty(arena)}
                    onClick={() => void save(arena)}
                  >
                    שמור
                  </button>
                  {edited.has(arena.id) && (
                    <button
                      className="btn-fight btn-small btn-ghost"
                      onClick={() => void revert(arena)}
                    >
                      החזר מקור
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
