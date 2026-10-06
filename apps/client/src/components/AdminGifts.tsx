import { useCallback, useEffect, useState } from "react";
import {
  ARENAS,
  FILTER_LABELS,
  PROMO_IDEAS,
  describeGives,
  givesSomething,
  type GrantFilters,
  type GrantGives,
} from "@amanda/shared";
import { CATALOG } from "../data/catalog";

/**
 * Gifts and promotions.
 *
 * Or: "give me an option to release a new card and hand it out free to all
 * users, or to everyone above/below a certain level, or by any filter I want,
 * including scheduling it — say if it is a present for a certain holiday."
 *
 * ═══ THE TWO THINGS THIS SCREEN IS CAREFUL ABOUT ═══
 *
 * THE COUNT IS REAL. "How many will get this" is answered by the same server
 * function that does the sending (`audienceOf`), not by a query written here.
 * A preview computed separately is a preview that will one day be wrong about
 * the single thing it exists to be right about.
 *
 * THE BUTTON IS SAFE TO PRESS TWICE. Delivery writes a receipt per person and
 * reads the receipts first, so a second press hands out nothing and says so.
 * That is not a nicety: "everybody gets a free legendary" happening twice is
 * not a mistake that can be taken back.
 *
 * There is no free-text filter and no SQL box. The reasoning is in
 * packages/shared/src/grants.ts; the short version is that one typo in such a
 * box gives ten thousand children a card, with no undo.
 */
interface Grant {
  id: string;
  name: string;
  gives: GrantGives;
  filters: GrantFilters;
  scheduled_at: string | null;
  executed_at: string | null;
  recipients: number | null;
  active: boolean;
  note: string | null;
  created_at: string;
}

type Call = (path: string, body?: unknown) => Promise<Record<string, unknown>>;

const EMPTY: Grant = {
  id: "",
  name: "",
  gives: {},
  filters: {},
  scheduled_at: null,
  executed_at: null,
  recipients: null,
  active: true,
  note: null,
  created_at: "",
};

/** `datetime-local` wants "YYYY-MM-DDTHH:mm" and gives it back the same way. */
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function GiftsTab({ call, say }: { call: Call; say: (s: string) => void }) {
  const [list, setList] = useState<Grant[]>([]);
  const [draft, setDraft] = useState<Grant>(EMPTY);
  const [count, setCount] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const r = await call("/api/admin/grants");
    setList((r.grants as Grant[]) ?? []);
  }, [call]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  /*
   * Re-count whenever the filters change, because a filter whose effect you
   * cannot see is a filter you set wrong. Debounced so typing "1500" does not
   * ask four times.
   */
  useEffect(() => {
    setCount(null);
    const t = window.setTimeout(async () => {
      const r = await call("/api/admin/grants/preview", { filters: draft.filters });
      setCount(typeof r.count === "number" ? r.count : null);
    }, 400);
    return () => window.clearTimeout(t);
  }, [draft.filters, call]);

  const setFilter = (k: keyof GrantFilters, v: unknown) =>
    setDraft((d) => {
      const filters = { ...d.filters };
      if (v === "" || v === undefined || v === null || v === false) delete filters[k];
      else (filters as Record<string, unknown>)[k] = v;
      return { ...d, filters };
    });

  async function save() {
    if (!draft.name.trim()) return say("צריך שם למתנה");
    if (!givesSomething(draft.gives)) return say("המתנה ריקה — מה היא נותנת?");
    setBusy(true);
    const r = await call("/api/admin/grants/save", {
      id: draft.id || undefined,
      name: draft.name,
      gives: draft.gives,
      filters: draft.filters,
      scheduledAt: draft.scheduled_at,
      note: draft.note,
      active: draft.active,
    });
    setBusy(false);
    if (r.error) return say(String(r.error));
    say(draft.scheduled_at ? "נשמר. תצא לדרך בזמן שקבעת." : "נשמר.");
    setDraft(EMPTY);
    await refresh();
  }

  async function send(g: Grant) {
    const who = g.filters && Object.keys(g.filters).length ? "לפי הסינון" : "לכולם";
    if (!window.confirm(`לשלוח עכשיו "${g.name}" ${who}?\n\n${describeGives(g.gives)}`)) return;
    setBusy(true);
    const r = await call("/api/admin/grants/send", { id: g.id });
    setBusy(false);
    if (r.error) return say(String(r.error));
    say(
      `נשלח ל-${r.sent}` +
        (Number(r.skipped) > 0 ? ` · ${r.skipped} כבר קיבלו קודם, אז לא קיבלו שוב` : ""),
    );
    await refresh();
  }

  async function drop(g: Grant) {
    if (!window.confirm(`למחוק את "${g.name}"?`)) return;
    await call("/api/admin/grants/delete", { id: g.id });
    await refresh();
  }

  const cards = [...CATALOG.values()].filter((c) => c.id !== "crumb_demon");

  return (
    <div className="admin__pane gifts">
      <section className="gifts__editor">
        <h2>{draft.id ? "עריכת מתנה" : "מתנה חדשה"}</h2>

        <label className="fld">
          <span>שם (רק בשבילך)</span>
          <input
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            placeholder="מתנה לחנוכה"
          />
        </label>

        <h3>מה נותנים</h3>
        <div className="gifts__gives">
          <label className="fld">
            <span>קלף</span>
            <select
              value={draft.gives.cards?.[0]?.cardId ?? ""}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  gives: {
                    ...draft.gives,
                    cards: e.target.value
                      ? [{ cardId: e.target.value, copies: draft.gives.cards?.[0]?.copies ?? 1 }]
                      : undefined,
                  },
                })
              }
            >
              <option value="">— בלי —</option>
              {cards.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name.he}
                </option>
              ))}
            </select>
          </label>
          <label className="fld fld--narrow">
            <span>עותקים</span>
            <input
              type="number"
              min={1}
              value={draft.gives.cards?.[0]?.copies ?? 1}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  gives: draft.gives.cards?.[0]
                    ? {
                        ...draft.gives,
                        cards: [
                          { cardId: draft.gives.cards[0].cardId, copies: Number(e.target.value) || 1 },
                        ],
                      }
                    : draft.gives,
                })
              }
            />
          </label>
          <label className="fld fld--narrow">
            <span>יהלומים</span>
            <input
              type="number"
              min={0}
              value={draft.gives.diamonds ?? 0}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  gives: { ...draft.gives, diamonds: Number(e.target.value) || undefined },
                })
              }
            />
          </label>
          <label className="fld fld--narrow">
            <span>תיבה</span>
            <select
              value={draft.gives.chest ?? ""}
              onChange={(e) =>
                setDraft({ ...draft, gives: { ...draft.gives, chest: e.target.value || undefined } })
              }
            >
              <option value="">— בלי —</option>
              <option value="wood">עץ</option>
              <option value="silver">כסף</option>
              <option value="gold">זהב</option>
            </select>
          </label>
        </div>

        <h3>למי</h3>
        <p className="gifts__hint">
          בלי סינון בכלל — לכולם. כל סינון שמוסיפים מצמצם עוד.
        </p>
        <div className="gifts__filters">
          <label className="fld fld--narrow">
            <span>{FILTER_LABELS.minTrophies.he}</span>
            <input
              type="number"
              min={0}
              value={draft.filters.minTrophies ?? ""}
              onChange={(e) => setFilter("minTrophies", e.target.value ? Number(e.target.value) : "")}
            />
          </label>
          <label className="fld fld--narrow">
            <span>{FILTER_LABELS.maxTrophies.he}</span>
            <input
              type="number"
              min={0}
              value={draft.filters.maxTrophies ?? ""}
              onChange={(e) => setFilter("maxTrophies", e.target.value ? Number(e.target.value) : "")}
            />
          </label>
          <label className="fld">
            <span>{FILTER_LABELS.arenaId.he}</span>
            <select
              value={draft.filters.arenaId ?? ""}
              onChange={(e) => setFilter("arenaId", e.target.value)}
            >
              <option value="">— כל הארנות —</option>
              {ARENAS.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name.he}
                </option>
              ))}
            </select>
          </label>
          <label className="fld fld--narrow">
            <span>{FILTER_LABELS.activeWithinDays.he}</span>
            <input
              type="number"
              min={1}
              value={draft.filters.activeWithinDays ?? ""}
              onChange={(e) =>
                setFilter("activeWithinDays", e.target.value ? Number(e.target.value) : "")
              }
            />
          </label>
          <label className="fld">
            <span>{FILTER_LABELS.joinedBefore.he}</span>
            <input
              type="date"
              value={draft.filters.joinedBefore?.slice(0, 10) ?? ""}
              onChange={(e) =>
                setFilter("joinedBefore", e.target.value ? `${e.target.value}T00:00:00Z` : "")
              }
            />
          </label>
          <label className="fld">
            <span>{FILTER_LABELS.missingCardId.he}</span>
            <select
              value={draft.filters.missingCardId ?? ""}
              onChange={(e) => setFilter("missingCardId", e.target.value)}
            >
              <option value="">— לא משנה —</option>
              {cards.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name.he}
                </option>
              ))}
            </select>
          </label>
        </div>

        <h3>מתי</h3>
        <label className="fld">
          <span>תאריך ושעה (ריק = כשתלחץ "שלח")</span>
          <input
            type="datetime-local"
            value={toLocalInput(draft.scheduled_at)}
            onChange={(e) =>
              setDraft({
                ...draft,
                scheduled_at: e.target.value ? new Date(e.target.value).toISOString() : null,
              })
            }
          />
        </label>

        {/* The number that matters, from the same code that does the sending. */}
        <p className="gifts__count">
          {count === null ? "סופר…" : <b>{count}</b>} שחקנים יקבלו את זה
        </p>

        <div className="gifts__actions">
          <button className="btn-fight" disabled={busy} onClick={() => void save()}>
            שמירה
          </button>
          {draft.id && (
            <button className="btn-fight btn-ghost" onClick={() => setDraft(EMPTY)}>
              ביטול
            </button>
          )}
        </div>
      </section>

      <section className="gifts__list">
        <h2>מתנות</h2>
        {list.length === 0 ? (
          <p className="gifts__hint">עוד לא יצרת אף מתנה.</p>
        ) : (
          <table className="admin__table">
            <thead>
              <tr>
                <th>שם</th>
                <th>מה</th>
                <th>מתי</th>
                <th>יצא</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {list.map((g) => (
                <tr key={g.id}>
                  <td>{g.name}</td>
                  <td className="dim">{describeGives(g.gives)}</td>
                  <td className="dim">
                    {g.scheduled_at ? new Date(g.scheduled_at).toLocaleString("he-IL") : "ידני"}
                  </td>
                  <td className="dim">
                    {g.executed_at
                      ? `${g.recipients ?? 0} שחקנים · ${new Date(g.executed_at).toLocaleDateString("he-IL")}`
                      : "—"}
                  </td>
                  <td className="admin__row-actions">
                    <button onClick={() => setDraft(g)}>עריכה</button>
                    <button onClick={() => void send(g)} disabled={busy}>
                      שלח עכשיו
                    </button>
                    <button className="danger" onClick={() => void drop(g)}>
                      מחיקה
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/*
         * Or asked me to think of more promotion shapes. These are written
         * down rather than built — the point of listing them here is that
         * every one of them is a row in this table plus a trigger, and none
         * of them needs a new table.
         */}
        <details className="gifts__ideas">
          <summary>עוד רעיונות קידום שהמבנה כבר תומך בהם</summary>
          <ul>
            {PROMO_IDEAS.map((idea) => (
              <li key={idea}>{idea}</li>
            ))}
          </ul>
        </details>
      </section>
    </div>
  );
}
