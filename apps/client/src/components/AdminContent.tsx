import { useCallback, useEffect, useState } from "react";
import { CATCHPHRASES, STYLES, type Catchphrase, type PhraseStyle } from "@amanda/shared";
import { SERIES } from "../data/catalog";
import { Plaque } from "./Plaque";

/**
 * Three things Or asked to be able to change without me: the phrases, the
 * shelves in the album, and the numbers the game runs on.
 *
 * *"In the admin interface I need to be able to manage everything: items in
 * the shop including prices, and to add new ones and delete and temporarily
 * take down from the shop, cards, series, sales, phrases, including assigning
 * and giving things to users. Think what else needs managing and add it."*
 *
 * The cards and the shop already had screens. These are the rest, and the
 * last one is the "what else".
 *
 * ═══ ALL THREE SHOW THE SHIPPED LIST, NOT THE OVERRIDES ═══
 *
 * The obvious screen here is a table of rows in `phrase_overrides`, which on
 * a fresh database is empty — so the screen for managing the phrases would
 * open showing no phrases. What Or wants to see is the game: every line that
 * exists, with the ones he has changed marked as changed. So each tab lists
 * what the build ships with (CATCHPHRASES, SERIES) and the row, where there
 * is one, is an edit sitting on top of it.
 */

type Call = (path: string, body?: unknown) => Promise<Record<string, unknown>>;
type Say = (s: string) => void;

/* ════════════════════ the phrases ════════════════════ */

interface PhraseRow {
  id: string;
  active: boolean;
  data: Catchphrase;
}

const TONES: Array<{ id: Catchphrase["tone"]; he: string }> = [
  { id: "taunt", he: "מתגרה" },
  { id: "kind", he: "מעודד" },
];

const BLANK: Catchphrase = { id: "", tone: "taunt", he: "", style: "plain" };

export function PhrasesTab({ call, say }: { call: Call; say: Say }) {
  const [rows, setRows] = useState<PhraseRow[]>([]);
  const [draft, setDraft] = useState<Catchphrase>(BLANK);
  const [editing, setEditing] = useState(false);

  const refresh = useCallback(async () => {
    const r = await call("/api/admin/phrases");
    setRows(((r.rows as PhraseRow[]) ?? []).filter((x) => x.data));
  }, [call]);
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const overridden = new Map(rows.map((r) => [r.id, r]));

  /*
   * Every line in the game: the ones the build ships with, plus any Or has
   * INVENTED (a row with an id the build has never heard of). The second half
   * is the reason this is not simply CATCHPHRASES — a new line he wrote this
   * evening has no shipped version to sit on top of.
   */
  const all: Array<{ phrase: Catchphrase; row?: PhraseRow; shipped: boolean }> = [
    ...CATCHPHRASES.map((p) => ({
      phrase: overridden.get(p.id)?.data ?? p,
      row: overridden.get(p.id),
      shipped: true,
    })),
    ...rows
      .filter((r) => !CATCHPHRASES.some((p) => p.id === r.id))
      .map((r) => ({ phrase: r.data, row: r, shipped: false })),
  ];

  async function save(phrase: Catchphrase, active = true) {
    if (!phrase.id.trim()) return say("צריך מזהה, באנגלית");
    if (!phrase.he.trim()) return say("צריך לכתוב משפט");
    const r = await call("/api/admin/phrases/save", { data: phrase, active });
    if (r.error) return say(String(r.error));
    say("נשמר. המשחק כבר יודע.");
    setDraft(BLANK);
    setEditing(false);
    await refresh();
  }

  /** Forget the row, which puts whatever the build ships with back. */
  async function revert(id: string, shipped: boolean) {
    const what = shipped ? "לחזור למשפט המקורי?" : "למחוק את המשפט הזה לגמרי?";
    if (!window.confirm(what)) return;
    const r = await call("/api/admin/phrases/revert", { id });
    if (r.error) return say(String(r.error));
    await refresh();
  }

  return (
    <div className="gifts">
      <section className="gifts__make">
        <h2>{editing ? "לערוך משפט" : "משפט חדש"}</h2>

        <div className="gifts__gives">
          <label className="fld fld--narrow">
            <span>מזהה</span>
            <input
              value={draft.id}
              onChange={(e) => setDraft({ ...draft, id: e.target.value })}
              placeholder="phrase.thunder"
              dir="ltr"
              disabled={editing}
            />
          </label>
          <label className="fld">
            <span>המשפט</span>
            <input
              value={draft.he}
              onChange={(e) => setDraft({ ...draft, he: e.target.value })}
              placeholder="בוא ילד, נראה מה אתה שווה"
            />
          </label>
        </div>

        {/*
          The feminine line. Hebrew forces a choice on anything said TO the
          opponent, and the game already knows their gender — so this is a
          string rather than a change. Empty means the line above is used for
          everybody, which is right for most of them.
        */}
        <label className="fld">
          <span>איך זה נשמע כשאומרים את זה לבת (לא חובה)</span>
          <input
            value={draft.heF ?? ""}
            onChange={(e) => setDraft({ ...draft, heF: e.target.value || undefined })}
            placeholder="בואי ילדה, נראה מה את שווה"
          />
        </label>

        <div className="gifts__gives">
          <label className="fld fld--narrow">
            <span>סוג</span>
            <select
              value={draft.tone}
              onChange={(e) => setDraft({ ...draft, tone: e.target.value as Catchphrase["tone"] })}
            >
              {TONES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.he}
                </option>
              ))}
            </select>
          </label>
          <label className="fld fld--narrow">
            <span>עיצוב</span>
            <select
              value={draft.style}
              onChange={(e) => setDraft({ ...draft, style: e.target.value as PhraseStyle })}
            >
              {STYLES.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </label>
          <label className="fld fld--check">
            <input
              type="checkbox"
              checked={draft.free === true}
              onChange={(e) => setDraft({ ...draft, free: e.target.checked || undefined })}
            />
            <span>לכולם מההתחלה</span>
          </label>
        </div>

        {/*
          What it will actually look like, in the thing it will appear on.
          Or's rule for the phrases from the start: what is being sold is how
          a line ARRIVES, so a form that shows the words and not the treatment
          is a form for choosing blind.
        */}
        {draft.he.trim() && (
          <div className="admin__preview">
            <Plaque phrase={draft} size="big" />
          </div>
        )}

        {/*
          The shop item that hands it over. Not a dropdown of shop rows on
          purpose — the shop tab is where an item is made, and a line that
          names an item which does not exist yet is a perfectly ordinary
          half-finished thing to have on a Tuesday.
        */}
        {draft.free !== true && (
          <label className="fld">
            <span>איזה פריט בחנות נותן אותו (ריק = אי אפשר להשיג)</span>
            <input
              value={draft.item ?? ""}
              onChange={(e) => setDraft({ ...draft, item: e.target.value || undefined })}
              placeholder="phrase.thunder"
              dir="ltr"
            />
          </label>
        )}

        <div className="gifts__actions">
          <button className="btn-fight" onClick={() => void save(draft)}>
            שמירה
          </button>
          <button
            className="btn-fight btn-ghost"
            onClick={() => {
              setDraft(BLANK);
              setEditing(false);
            }}
          >
            חדש
          </button>
        </div>
      </section>

      <section className="gifts__list">
        <h2>כל המשפטים במשחק</h2>
        <table className="admin__table">
          <thead>
            <tr>
              <th>המשפט</th>
              <th>סוג</th>
              <th>איך משיגים</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {all.map(({ phrase, row, shipped }) => (
              <tr key={phrase.id}>
                <td>
                  <Plaque phrase={phrase} />
                  <br />
                  <small className="dim" dir="ltr">
                    {phrase.id}
                  </small>
                  {row && <small className="admin__badge">שונה</small>}
                  {!shipped && <small className="admin__badge">חדש</small>}
                </td>
                <td className="dim">{TONES.find((t) => t.id === phrase.tone)?.he}</td>
                <td className="dim">
                  {phrase.free ? "לכולם" : (phrase.item ?? "—")}
                </td>
                <td className="admin__row-actions">
                  <button
                    onClick={() => {
                      setDraft(phrase);
                      setEditing(true);
                    }}
                  >
                    עריכה
                  </button>
                  {/* Taking a line out of the game, without losing it: the
                      row stays and simply stops being applied. A line that
                      ships in the build cannot be deleted. */}
                  <button onClick={() => void save(phrase, false)}>להוריד</button>
                  {row && (
                    <button className="danger" onClick={() => void revert(phrase.id, shipped)}>
                      {shipped ? "לבטל שינוי" : "מחיקה"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

/* ════════════════════ the series ════════════════════ */

interface SeriesRow {
  id: string;
  active: boolean;
  data: { name?: { he?: string; en?: string } };
  sort: number | null;
}

/**
 * The shelves in the album: what each one is called, where it sits, and
 * whether it is on show.
 *
 * Deliberately NOT which cards are on it. A card already says which series it
 * belongs to (the card editor, `series_id`), and asking the question in two
 * places would make two answers to it.
 */
export function SeriesTab({ call, say }: { call: Call; say: Say }) {
  const [rows, setRows] = useState<SeriesRow[]>([]);

  const refresh = useCallback(async () => {
    const r = await call("/api/admin/series");
    setRows((r.rows as SeriesRow[]) ?? []);
  }, [call]);
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const by = new Map(rows.map((r) => [r.id, r]));

  async function save(id: string, patch: Partial<SeriesRow>) {
    const now = by.get(id);
    const r = await call("/api/admin/series/save", {
      id,
      active: patch.active ?? now?.active ?? true,
      data: patch.data ?? now?.data ?? {},
      sort: patch.sort !== undefined ? patch.sort : (now?.sort ?? null),
    });
    if (r.error) return say(String(r.error));
    say("נשמר.");
    await refresh();
  }

  async function revert(id: string) {
    if (!window.confirm("לחזור למה שהמשחק נולד איתו?")) return;
    await call("/api/admin/series/revert", { id });
    await refresh();
  }

  return (
    <div className="gifts">
      <section className="gifts__list">
        <h2>הסדרות באלבום</h2>
        <table className="admin__table">
          <thead>
            <tr>
              <th>שם</th>
              <th>קלפים</th>
              <th>סדר</th>
              <th>באלבום</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {SERIES.map((s, i) => {
              const row = by.get(s.id);
              const name = row?.data?.name?.he ?? s.name.he;
              return (
                <tr key={s.id}>
                  <td>
                    <input
                      defaultValue={name}
                      onBlur={(e) => {
                        if (e.target.value.trim() && e.target.value !== name)
                          void save(s.id, { data: { name: { he: e.target.value.trim() } } });
                      }}
                    />
                    <br />
                    <small className="dim" dir="ltr">
                      {s.id}
                    </small>
                    {row && <small className="admin__badge">שונה</small>}
                  </td>
                  <td className="dim">{s.cards.length}</td>
                  <td>
                    {/* Blank keeps the order the files give it, which is why
                        the placeholder shows that number rather than being
                        empty: "no opinion" and "position 3" look the same in
                        an empty box otherwise. */}
                    <input
                      className="admin__num"
                      type="number"
                      defaultValue={row?.sort ?? ""}
                      placeholder={String(i)}
                      onBlur={(e) =>
                        void save(s.id, {
                          sort: e.target.value === "" ? null : Number(e.target.value),
                        })
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      checked={row?.active !== false}
                      onChange={(e) => void save(s.id, { active: e.target.checked })}
                    />
                  </td>
                  <td className="admin__row-actions">
                    {row && (
                      <button className="danger" onClick={() => void revert(s.id)}>
                        לבטל שינוי
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}

/* ════════════════════ the numbers ════════════════════ */

interface Dial {
  id: string;
  he: string;
  note: string;
  min: number;
  max: number;
  step: number;
  value: number;
}

/**
 * The numbers the game runs on — what a win is worth, how long a phase lasts.
 *
 * Or asked me to think of what else needs managing, and this is the first
 * answer: a balance change is the most common thing a live game does and the
 * one it most needs to do on a Sunday evening, after watching a seven-year-old
 * play. "He got bored before the chest" is a number, not a deploy.
 *
 * ═══ THE LIST IS SHORT AND IT IS NOT AN OVERSIGHT ═══
 *
 * packages/shared/src/tunables.ts explains it at length: the board being 4x4
 * is baked into the engine, and the King's health would make a browser replay
 * a battle differently from the server that decided it — one of those breaks
 * the game and the other makes it LIE about who won. Only pacing and reward
 * are safe to turn from a row, so only pacing and reward are here.
 *
 * Every dial carries its own warning, from the same file, because the ones
 * that need explaining are exactly the ones that get turned by accident.
 */
export function DialsTab({ call, say }: { call: Call; say: Say }) {
  const [dials, setDials] = useState<Dial[]>([]);
  const [edited, setEdited] = useState<Record<string, number>>({});

  const refresh = useCallback(async () => {
    const r = await call("/api/admin/tunables");
    setDials((r.dials as Dial[]) ?? []);
    setEdited({});
  }, [call]);
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const dirty = Object.keys(edited).length;

  async function save() {
    const rows = Object.entries(edited).map(([id, value]) => ({ id, value }));
    if (!rows.length) return;
    const r = await call("/api/admin/tunables/save", { rows });
    if (r.error) return say(String(r.error));
    say(`נשמרו ${String(r.saved ?? rows.length)} מספרים. השרת כבר משחק לפיהם.`);
    await refresh();
  }

  return (
    <div className="gifts">
      <section className="gifts__make">
        <h2>המספרים של המשחק</h2>
        {dials.map((d) => {
          const value = edited[d.id] ?? d.value;
          return (
            <label className="fld admin__dial" key={d.id}>
              <span>
                {d.he} <b className="admin__dial-now">{value}</b>
              </span>
              <input
                type="range"
                min={d.min}
                max={d.max}
                step={d.step}
                value={value}
                onChange={(e) => setEdited({ ...edited, [d.id]: Number(e.target.value) })}
              />
              <small className="dim">{d.note}</small>
            </label>
          );
        })}
        <div className="gifts__actions">
          <button className="btn-fight" disabled={!dirty} onClick={() => void save()}>
            {dirty ? `לשמור ${dirty}` : "אין שינויים"}
          </button>
          <button className="btn-fight btn-ghost" onClick={() => setEdited({})}>
            לבטל
          </button>
        </div>
        {/*
          A player with the game already open keeps the numbers it loaded
          until they reload — the browser reads them once at boot and nothing
          polls. Said plainly because the alternative is Or changing a number,
          looking at his phone and concluding it did not work.
        */}
        <p className="gifts__hint">
          השרת מתעדכן מיד. מי שהמשחק כבר פתוח אצלו יקבל את המספרים החדשים ברענון הבא.
        </p>
      </section>
    </div>
  );
}
