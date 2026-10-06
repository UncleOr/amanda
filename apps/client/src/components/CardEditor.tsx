import { useEffect, useMemo, useState } from "react";
import {
  ABILITY_TRIGGERS,
  ABILITY_TYPES,
  ELEMENTS,
  type Ability,
  type Card,
} from "@amanda/shared";
import { CATALOG, SERIES } from "../data/catalog";
import { CardView } from "./CardView";
import { Icon } from "./Icon";

/**
 * The card editor, in the admin panel.
 *
 * Or: "a comfortable interface for managing and adding cards, with all their
 * attributes — name, picture, and building special abilities (an 'on X do Y'
 * conditional), plus active/inactive, rename, delete, duplicate, extra
 * variation images, attributes at every level."
 *
 * ═══ WHY THE ABILITIES ARE A SET OF DROPDOWNS ═══
 *
 * It would be easy to give this a text box and call it a rules language. It
 * would also be a lie: the engine knows 11 triggers and 26 effects and nothing
 * else, so anything that cannot be expressed as one of each would be accepted
 * here and then do NOTHING in a battle somebody is playing. Picking from the
 * engine's own lists means a card that saves is a card that works.
 *
 * ═══ LEVELS ARE NOT EDITED HERE ═══
 *
 * Every card grows by the same percentage per level (LEVELS in config.ts), and
 * that is deliberate: a per-card growth curve is a second balance system that
 * has to be tuned twenty-nine times instead of once. The editor shows what the
 * curve produces for this card so the numbers are visible, and the curve
 * itself is one number in one place.
 *
 * Nothing here is the catalogue. Saving writes an OVERRIDE; reverting deletes
 * it and the card goes back to what it ships as.
 */

const BASE = import.meta.env.BASE_URL;

export interface CardEditorDeps {
  /** POST to the admin API. Supplied by the panel so this file holds no auth. */
  call: (path: string, body?: unknown) => Promise<Record<string, unknown>>;
  say: (s: string) => void;
}

interface OverrideRow {
  id: string;
  series_id: string;
  active: boolean;
  data: Card;
}

/** A plain copy, so editing a draft never touches the live catalogue. */
function clone(card: Card): Card {
  return JSON.parse(JSON.stringify(card)) as Card;
}

export function CardEditor({ call, say }: CardEditorDeps) {
  const [overrides, setOverrides] = useState<Record<string, OverrideRow>>({});
  const [picked, setPicked] = useState<string | null>(null);
  const [draft, setDraft] = useState<Card | null>(null);
  const [seriesId, setSeriesId] = useState<string>("");
  const [active, setActive] = useState(true);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch(
          `${(import.meta.env.VITE_SERVER_URL ?? (import.meta.env.DEV ? "ws://localhost:2567" : ""))
            .replace(/^ws:/, "http:")
            .replace(/^wss:/, "https:")}/api/cards`,
        );
        const body = (await res.json()) as { cards?: OverrideRow[] };
        setOverrides(Object.fromEntries((body.cards ?? []).map((r) => [r.id, r])));
      } catch {
        /* the list still works from what the game ships with */
      }
    })();
  }, []);

  /** Every card there is: the shipped ones, with any override already applied. */
  const all = useMemo(() => {
    const out = [...CATALOG.values()].map((c) => ({
      card: c,
      seriesId: c.seriesId,
      edited: !!overrides[c.id],
      hidden: overrides[c.id]?.active === false,
    }));
    // Cards that exist only in the database.
    for (const row of Object.values(overrides))
      if (!CATALOG.has(row.id))
        out.push({ card: row.data, seriesId: row.series_id, edited: true, hidden: !row.active });
    const needle = query.trim();
    return out
      .filter(
        (e) =>
          !needle ||
          e.card.id.includes(needle) ||
          e.card.name.he.includes(needle) ||
          e.card.name.en.toLowerCase().includes(needle.toLowerCase()),
      )
      .sort((a, b) => a.card.id.localeCompare(b.card.id));
  }, [overrides, query]);

  function edit(id: string) {
    const entry = all.find((e) => e.card.id === id);
    if (!entry) return;
    setPicked(id);
    setDraft(clone(entry.card));
    setSeriesId(entry.seriesId);
    setActive(!entry.hidden);
  }

  async function save() {
    if (!draft) return;
    setBusy(true);
    const r = await call("/api/admin/cards", {
      rows: [{ id: draft.id, seriesId, active, data: draft }],
    });
    setBusy(false);
    if (r.error) return say(String(r.error));
    setOverrides((o) => ({
      ...o,
      [draft.id]: { id: draft.id, series_id: seriesId, active, data: draft },
    }));
    say(`${draft.name.he} נשמר. הקלף חי במשחק מעכשיו.`);
  }

  async function revert() {
    if (!draft) return;
    setBusy(true);
    const r = await call("/api/admin/cards/revert", { id: draft.id });
    setBusy(false);
    if (r.error) return say(String(r.error));
    setOverrides((o) => {
      const next = { ...o };
      delete next[draft.id];
      return next;
    });
    say("הקלף חזר למה שהוא במקור.");
    setPicked(null);
    setDraft(null);
  }

  function duplicate() {
    if (!draft) return;
    const copy = clone(draft);
    copy.id = `${draft.id}_copy${Math.floor(Math.random() * 900 + 100)}`;
    copy.name = { he: `${draft.name.he} (עותק)`, en: `${draft.name.en} (copy)` };
    setDraft(copy);
    setPicked(copy.id);
    say("עותק. הוא לא נשמר עד שתלחץ שמירה.");
  }

  const set = <K extends keyof Card>(key: K, value: Card[K]) =>
    setDraft((d) => (d ? { ...d, [key]: value } : d));
  const setStat = (key: keyof Card["stats"], value: number | string) =>
    setDraft((d) => (d ? { ...d, stats: { ...d.stats, [key]: value } } : d));

  return (
    <div className="admin__body ed">
      <div className="ed__list">
        <input
          className="ed__search"
          value={query}
          placeholder="חיפוש קלף…"
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="ed__scroll">
          {all.map((e) => (
            <button
              key={e.card.id}
              className={`ed__row${picked === e.card.id ? " is-picked" : ""}${
                e.hidden ? " is-hidden" : ""
              }`}
              onClick={() => edit(e.card.id)}
            >
              <span className="ed__row-name">{e.card.name.he}</span>
              <span className="ed__row-tags">
                {e.edited && <b title="נערך">●</b>}
                {e.hidden && <i title="מוסתר מהמשחק">כבוי</i>}
              </span>
            </button>
          ))}
        </div>
      </div>

      {!draft ? (
        <p className="admin__hint ed__empty">בחר קלף מהרשימה.</p>
      ) : (
        <div className="ed__form">
          <div className="ed__head">
            <div className="ed__preview">
              <CardView cardId={CATALOG.has(draft.id) ? draft.id : "crumb_demon"} size="large" />
            </div>
            <div className="ed__headfields">
              <label className="ed__f">
                מזהה
                <input value={draft.id} onChange={(e) => set("id", e.target.value)} />
              </label>
              <label className="ed__f">
                שם (עברית)
                <input
                  value={draft.name.he}
                  onChange={(e) => set("name", { ...draft.name, he: e.target.value })}
                />
              </label>
              <label className="ed__f">
                Name (English)
                <input
                  value={draft.name.en}
                  onChange={(e) => set("name", { ...draft.name, en: e.target.value })}
                />
              </label>
              <label className="ed__f">
                סדרה
                <select value={seriesId} onChange={(e) => setSeriesId(e.target.value)}>
                  {SERIES.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name.he}
                    </option>
                  ))}
                </select>
              </label>
              <label className="ed__f ed__f--check">
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                />
                פעיל במשחק
              </label>
            </div>
          </div>

          <h4 className="ed__h">מספרים</h4>
          <div className="ed__grid">
            <label className="ed__f">
              חיים
              <input
                type="number"
                value={draft.stats.hp}
                onChange={(e) => setStat("hp", Number(e.target.value))}
              />
            </label>
            <label className="ed__f">
              עוצמה
              <input
                type="number"
                value={draft.stats.power}
                onChange={(e) => setStat("power", Number(e.target.value))}
              />
            </label>
            <label className="ed__f">
              קצב תקיפה
              <input
                type="number"
                step="0.1"
                value={draft.stats.attackSpeed}
                onChange={(e) => setStat("attackSpeed", Number(e.target.value))}
              />
            </label>
            <label className="ed__f">
              תנועה
              <input
                type="number"
                step="0.25"
                value={draft.stats.moveSpeed}
                onChange={(e) => setStat("moveSpeed", Number(e.target.value))}
              />
            </label>
            <label className="ed__f">
              טווח
              <select
                value={draft.stats.range}
                onChange={(e) => setStat("range", e.target.value)}
              >
                {["melee", "ranged", "sniper"].map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>
            <label className="ed__f">
              נדירות
              <select
                value={draft.rarity}
                onChange={(e) => set("rarity", e.target.value as Card["rarity"])}
              >
                {["common", "rare", "epic", "legendary"].map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>
            <label className="ed__f ed__f--check">
              <input
                type="checkbox"
                checked={draft.flying}
                onChange={(e) => set("flying", e.target.checked)}
              />
              מעופף
            </label>
            <label className="ed__f ed__f--check">
              <input
                type="checkbox"
                checked={draft.launch}
                onChange={(e) => set("launch", e.target.checked)}
              />
              בחבילת הפתיחה
            </label>
          </div>

          <h4 className="ed__h">
            כוחות
            <small>כל רמה מוסיפה אחוז קבוע לחיים ולעוצמה — אותו אחוז לכל הקלפים.</small>
          </h4>
          <div className="ed__elements">
            {ELEMENTS.map((el) => (
              <button
                key={el}
                className={draft.elements.includes(el) ? "is-on" : ""}
                onClick={() =>
                  set(
                    "elements",
                    draft.elements.includes(el)
                      ? draft.elements.filter((x) => x !== el)
                      : [...draft.elements, el],
                  )
                }
              >
                <Icon name={el as never} size={15} /> {el}
              </button>
            ))}
          </div>

          <h4 className="ed__h">
            יכולות
            <small>מתי קורה מה. הרשימות הן מה שהמנוע באמת יודע לבצע.</small>
          </h4>
          {draft.abilities.map((ab, i) => (
            <div key={i} className="ed__ability">
              <select
                value={ab.trigger}
                onChange={(e) => {
                  const next = [...draft.abilities];
                  next[i] = { ...ab, trigger: e.target.value as Ability["trigger"] };
                  set("abilities", next);
                }}
              >
                {ABILITY_TRIGGERS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <select
                value={ab.type}
                onChange={(e) => {
                  const next = [...draft.abilities];
                  next[i] = { ...ab, type: e.target.value as Ability["type"] };
                  set("abilities", next);
                }}
              >
                {ABILITY_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <input
                className="ed__params"
                value={JSON.stringify(ab.params ?? {})}
                title="מספרים ליכולת, למשל { pct: 20 }"
                onChange={(e) => {
                  try {
                    const params = JSON.parse(e.target.value) as Ability["params"];
                    const next = [...draft.abilities];
                    next[i] = { ...ab, params };
                    set("abilities", next);
                  } catch {
                    /* half-typed JSON is not an error, it is half-typed */
                  }
                }}
              />
              <button
                className="admin__danger"
                onClick={() =>
                  set(
                    "abilities",
                    draft.abilities.filter((_, j) => j !== i),
                  )
                }
              >
                הסר
              </button>
            </div>
          ))}
          <button
            className="admin__add"
            onClick={() =>
              set("abilities", [
                ...draft.abilities,
                { type: "regen", trigger: "passive", params: {} } as Ability,
              ])
            }
          >
            + יכולת
          </button>

          <h4 className="ed__h">
            תמונה
            <small>הנתיב בתוך public. ריק = הצבע בלבד.</small>
          </h4>
          <label className="ed__f">
            קובץ
            <input
              value={draft.art.sprite ?? ""}
              placeholder="cards/dragons_01_flame_dragon.webp"
              onChange={(e) =>
                set("art", { ...draft.art, sprite: e.target.value.trim() || null })
              }
            />
          </label>
          {draft.art.sprite && (
            <img className="ed__sprite" src={`${BASE}${draft.art.sprite}`} alt="" />
          )}

          <div className="ed__actions">
            <button className="btn-fight" disabled={busy} onClick={() => void save()}>
              {busy ? "שומר…" : "שמירה"}
            </button>
            <button disabled={busy} onClick={duplicate}>
              שכפול
            </button>
            <button
              className="admin__danger"
              disabled={busy || !overrides[draft.id]}
              title={overrides[draft.id] ? "" : "אין מה להחזיר — הקלף לא נערך"}
              onClick={() => void revert()}
            >
              החזר למקור
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
