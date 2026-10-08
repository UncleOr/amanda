import { useCallback, useEffect, useState } from "react";
import { TUTORIAL_LINES, shippedLine } from "../data/tutorialLines";

/**
 * Editing what Amanda says while she teaches.
 *
 * Or: *"by the way, in the admin panel give me an option to edit it too."*
 *
 * Every line the build ships with is listed with its own box. Typing in one
 * and saving writes a row that REPLACES that line; "החזר מקור" deletes the row
 * and the shipped words come back. There is no "add a line" here, and that is
 * the difference from the catchphrases tab: a catchphrase is content, and a
 * new one is just another thing to buy, but a tutorial line is tied to a
 * moment in the walkthrough that only the code can decide has arrived. A row
 * with an id nothing says would never be shown.
 *
 * ═══ THE BRACES ═══
 *
 * `{card}` is filled in from the card actually in hand. Each line lists the
 * slots it may use, because the hand is random and a line that hard-codes
 * "דרקון" will one day say it about a cactus. A brace that is deleted is a
 * shorter sentence, not an error — so this warns about an UNKNOWN slot, which
 * is the one that silently disappears.
 */
type Call = (
  path: string,
  body?: Record<string, unknown>,
) => Promise<Record<string, unknown>>;
type Say = (message: string) => void;

interface Row {
  id: string;
  he: string;
  active: boolean;
  updated_at?: string;
}

const SLOTS = /\{(\w+)\}/g;

export function TutorialTab({ call, say }: { call: Call; say: Say }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const refresh = useCallback(async () => {
    const r = await call("/api/admin/tutorial");
    setRows((r.rows as Row[]) ?? []);
  }, [call]);
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const byId = new Map(rows.map((r) => [r.id, r]));

  async function save(id: string, allowed: readonly string[]) {
    const he = (drafts[id] ?? byId.get(id)?.he ?? shippedLine(id)).trim();
    if (!he) return say("צריך טקסט. כדי להחזיר את המקור — החזר מקור.");
    const unknown = [...he.matchAll(SLOTS)]
      .map((m) => m[1]!)
      .filter((k) => !allowed.includes(k));
    if (unknown.length)
      return say(`אין כזה משתנה: {${unknown[0]}}. יישאר ריק במשחק.`);
    const r = await call("/api/admin/tutorial/save", { id, he });
    if (r.error) return say(String(r.error));
    say("נשמר. הטוטוריאל כבר אומר את זה.");
    setDrafts((d) => {
      const { [id]: _gone, ...rest } = d;
      return rest;
    });
    await refresh();
  }

  async function revert(id: string) {
    const r = await call("/api/admin/tutorial/revert", { id });
    if (r.error) return say(String(r.error));
    say("חזר למקור.");
    setDrafts((d) => {
      const { [id]: _gone, ...rest } = d;
      return rest;
    });
    await refresh();
  }

  return (
    <div className="gifts">
      <section className="gifts__make">
        <h2>הטוטוריאל</h2>
        {/* The admin panel is the one screen allowed to explain itself — it is a
          tool for one adult, where a wrong value has consequences. */}
        <p className="gifts__hint">
          כל שורה שאמנדה אומרת כשהיא מלמדת. מה שבסוגריים מתמלא מהקלף שביד בפועל
          — אל תכתוב שם של קלף ישירות, הוא לא תמיד יהיה שם.
        </p>

        <div className="gifts__list">
          {TUTORIAL_LINES.map((lineDef) => {
            const row = byId.get(lineDef.id);
            const value = drafts[lineDef.id] ?? row?.he ?? lineDef.he;
            const changed = value !== (row?.he ?? lineDef.he);
            return (
              <label className="fld admin__dial" key={lineDef.id}>
                <span>
                  {lineDef.when} <b className="admin__dial-now">{lineDef.id}</b>
                  {row && <b className="admin__badge">נערך</b>}
                </span>
                <textarea
                  className="admin__preview"
                  rows={2}
                  value={value}
                  onChange={(e) =>
                    setDrafts((d) => ({ ...d, [lineDef.id]: e.target.value }))
                  }
                />
                {lineDef.vars.length > 0 && (
                  <small className="dim">
                    משתנים: {lineDef.vars.map((v) => `{${v}}`).join(" · ")}
                  </small>
                )}
                {/* The shipped words, so there is something to compare against
                  and something to type back. */}
                {row && <small className="dim">במקור: {lineDef.he}</small>}
                <div className="admin__row-actions">
                  <button
                    className="btn-fight btn-small"
                    disabled={!changed}
                    onClick={() => void save(lineDef.id, lineDef.vars)}
                  >
                    שמור
                  </button>
                  {row && (
                    <button
                      className="btn-fight btn-small btn-ghost"
                      onClick={() => void revert(lineDef.id)}
                    >
                      החזר מקור
                    </button>
                  )}
                </div>
              </label>
            );
          })}
        </div>
      </section>
    </div>
  );
}
