import { useEffect, useMemo, useRef, useState } from "react";
import {
  ABILITY_TRIGGERS,
  ABILITY_TYPES,
  ELEMENTS,
  STARTER_ALBUM,
  type Ability,
  type Card,
} from "@amanda/shared";
import { CATALOG, SERIES } from "../data/catalog";
import { artUrl } from "../game/skins";
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

export interface CardEditorDeps {
  /** POST to the admin API. Supplied by the panel so this file holds no auth. */
  call: (path: string, body?: unknown) => Promise<Record<string, unknown>>;
  say: (s: string) => void;
  /** Put a picture in the bucket. Also the panel's, for the same reason. */
  upload: (file: Blob, cardId: string) => Promise<{ url?: string; error?: string }>;
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

/* ───────────────────────── how a card gets about ───────────────────────── */

/**
 * ═══ STILL, WALKING OR FLYING — ONE CHOICE, NOT TWO CHECKBOXES ═══
 *
 * Or: *"each one needs a choice of still, walking or flying, and a pace."*
 *
 * It WAS two fields that did not know about each other: a `flying` tick and a
 * `moveSpeed` number. Which admits a card that is flying and has a move speed
 * of zero — and the engine gives that card no flight at all, because the only
 * thing `flying` does is let a unit pass over whatever is in front of it while
 * it advances (see flying.test.ts: two `if (!u.flying)` lines, both about
 * movement). A hovering statue and a standing statue are the same card.
 *
 * So the three of them are one question with three answers, and the pace is a
 * second question that only exists once the answer is not "still".
 */
const MOVES = [
  { id: "still", he: "נייח", note: "לא זז מהמשבצת" },
  { id: "walks", he: "הולך", note: "מתקדם קדימה, נעצר מאחורי מי שחוסם" },
  { id: "flies", he: "מעופף", note: "מתקדם וחולף מעל מי שחוסם" },
] as const;

type Move = (typeof MOVES)[number]["id"];

function moveOf(card: Card): Move {
  if (card.flying) return "flies";
  return card.stats.moveSpeed > 0 ? "walks" : "still";
}

/** The pace a card gets when it starts moving and has never had one. */
const DEFAULT_PACE = { walks: 1, flies: 1.5 } as const;

/* ───────────────────────── the picture ───────────────────────── */

/**
 * Shrink and re-encode whatever Or picked, before it goes anywhere.
 *
 * The bucket refuses anything over 2MB, and the pictures he will have to hand
 * are phone photos and exports — four thousand pixels wide and eight
 * megabytes. Refusing those would be technically correct and useless, so they
 * are made to fit here instead: 768px on the long side is twice the size a
 * card is ever drawn at, and webp at 0.9 brings a photo down to tens of
 * kilobytes.
 */
async function toCardArt(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 768 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("לא הצלחתי לקרוא את הקובץ"))), "image/webp", 0.9),
  );
}

export function CardEditor({ call, say, upload }: CardEditorDeps) {
  const [overrides, setOverrides] = useState<Record<string, OverrideRow>>({});
  const [picked, setPicked] = useState<string | null>(null);
  const [draft, setDraft] = useState<Card | null>(null);
  const [seriesId, setSeriesId] = useState<string>("");
  const [active, setActive] = useState(true);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [shut, setShut] = useState<Record<string, boolean>>({});
  const file = useRef<HTMLInputElement>(null);
  /*
   * The pace this card had before it was made still.
   *
   * ⚠ Without it, "still" is a one-way door that nobody can see closing:
   * tapping נייח to find out what it means and tapping מעופף back puts a
   * dragon that flew at 1.5 onto 1, which is a third slower, with nothing
   * on the screen saying so. A balance change by misclick is the worst kind,
   * because the next person to look at the card believes the number.
   */
  const pace = useRef(0);

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
    return out.filter(
      (e) =>
        !needle ||
        e.card.id.includes(needle) ||
        e.card.name.he.includes(needle) ||
        e.card.name.en.toLowerCase().includes(needle.toLowerCase()),
    );
  }, [overrides, query]);

  /**
   * ═══ THE LIST IS THE ALBUM, NOT AN ALPHABET ═══
   *
   * Or: *"I need the cards in the admin panel to be divided by series."*
   *
   * It was one flat list of seventy-four ids sorted as text, which put
   * `demons_01_alley_king` between `crumb_demon` and `dragons_01` and made
   * "show me the Machines" a scroll-and-squint. A family is how Or thinks
   * about these cards — he writes them a family at a time, balances them a
   * family at a time, and asked for the Machines and the Sea Dwellers in one
   * message.
   *
   * SERIES order, which since the album rework is the order a player MEETS
   * the families, so the panel and the album read the same way down the page.
   * Inside a shelf, by number in the series: the order he wrote them in.
   */
  const shelves = useMemo(() => {
    const byId = new Map<string, typeof all>();
    for (const e of all) {
      const key = SERIES.some((s) => s.id === e.seriesId) ? e.seriesId : "";
      const list = byId.get(key) ?? [];
      list.push(e);
      byId.set(key, list);
    }
    const out = SERIES.filter((s) => byId.has(s.id)).map((s) => ({
      id: s.id,
      name: s.name.he,
      cards: byId.get(s.id)!,
    }));
    // Anything whose family the build does not know: invented in the panel,
    // or left behind by a family that has been renamed. Last, and named for
    // what it is rather than hidden.
    const loose = byId.get("");
    if (loose) out.push({ id: "", name: "בלי סדרה", cards: loose });
    for (const shelf of out)
      shelf.cards.sort((a, b) => a.card.numberInSeries - b.card.numberInSeries);
    return out;
  }, [all]);

  function edit(id: string) {
    const entry = all.find((e) => e.card.id === id);
    if (!entry) return;
    setPicked(id);
    pace.current = entry.card.stats.moveSpeed;
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

  /** One choice for how a card gets about, written into the two fields it takes. */
  function setMove(to: Move) {
    setDraft((d) => {
      if (!d) return d;
      if (d.stats.moveSpeed > 0) pace.current = d.stats.moveSpeed;
      const speed = pace.current || DEFAULT_PACE[to === "flies" ? "flies" : "walks"];
      return {
        ...d,
        flying: to === "flies",
        stats: { ...d.stats, moveSpeed: to === "still" ? 0 : speed },
      };
    });
  }

  async function replaceArt(chosen: File) {
    if (!draft) return;
    setBusy(true);
    try {
      const art = await toCardArt(chosen);
      const r = await upload(art, draft.id);
      if (r.error || !r.url) return say(r.error ?? "ההעלאה נכשלה");
      set("art", { ...draft.art, sprite: r.url });
      say("התמונה הועלתה. לחץ שמירה כדי שהיא תיכנס למשחק.");
    } catch (err) {
      say((err as Error).message);
    } finally {
      setBusy(false);
      if (file.current) file.current.value = "";
    }
  }

  const move = draft ? moveOf(draft) : "still";
  const inStarter = !!draft && (STARTER_ALBUM as readonly string[]).includes(draft.id);

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
          {shelves.map((shelf) => (
            <section className="ed__shelf" key={shelf.id || "none"}>
              <button
                className="ed__shelf-head"
                onClick={() => setShut((s) => ({ ...s, [shelf.id]: !s[shelf.id] }))}
              >
                <span>{shelf.name}</span>
                <i>{shelf.cards.length}</i>
              </button>
              {!shut[shelf.id] &&
                shelf.cards.map((e) => (
                  <button
                    key={e.card.id}
                    className={`ed__row${picked === e.card.id ? " is-picked" : ""}${
                      e.hidden ? " is-hidden" : ""
                    }`}
                    onClick={() => edit(e.card.id)}
                  >
                    {/* The picture, because a list of seventy-four Hebrew names
                      is a list you read and a list of seventy-four faces is a
                      list you recognise. */}
                    {e.card.art.sprite ? (
                      <img className="ed__thumb" src={artUrl(e.card.art.sprite)} alt="" />
                    ) : (
                      <span
                        className="ed__thumb ed__thumb--blank"
                        style={{ background: e.card.art.placeholderColor }}
                      />
                    )}
                    <span className="ed__row-name">{e.card.name.he}</span>
                    <span className="ed__row-tags">
                      {e.edited && <b title="נערך">●</b>}
                      {e.hidden && <i title="מוסתר מהמשחק">כבוי</i>}
                    </span>
                  </button>
                ))}
            </section>
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
                קיים במשחק
              </label>
            </div>
          </div>

          <h4 className="ed__h">
            תנועה
            <small>איך הקלף מתקדם על הלוח, ובאיזה קצב.</small>
          </h4>
          <div className="ed__moves">
            {MOVES.map((m) => (
              <button
                key={m.id}
                className={move === m.id ? "is-on" : ""}
                title={m.note}
                onClick={() => setMove(m.id)}
              >
                {m.he}
              </button>
            ))}
          </div>
          {move === "still" ? (
            <small className="dim">{MOVES[0].note}.</small>
          ) : (
            <label className="ed__f ed__pace">
              קצב — {draft.stats.moveSpeed} משבצות בשנייה
              <input
                type="range"
                min={0.25}
                max={3}
                step={0.25}
                value={draft.stats.moveSpeed}
                onChange={(e) => setStat("moveSpeed", Number(e.target.value))}
              />
            </label>
          )}

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
            {/*
              ⚠ The label used to say only "attack rate", and the number is
              SECONDS BETWEEN BLOWS — so raising it makes a card slower, which
              is the opposite of what "rate" reads as. A dial that does the
              reverse of what it is called is how a card gets nerfed by
              somebody trying to buff it.
            */}
            <label className="ed__f">
              קצב תקיפה — שניות בין מכות
              <input
                type="number"
                step="0.1"
                value={draft.stats.attackSpeed}
                onChange={(e) => setStat("attackSpeed", Number(e.target.value))}
              />
            </label>
            <label className="ed__f">
              טווח
              <select value={draft.stats.range} onChange={(e) => setStat("range", e.target.value)}>
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
            <label className="ed__f">
              על מי הולך
              <select
                value={draft.targeting}
                onChange={(e) => set("targeting", e.target.value as Card["targeting"])}
              >
                <option value="lane">מי שמולו</option>
                <option value="king">המלך</option>
              </select>
            </label>
            <label className="ed__f ed__f--check">
              <input
                type="checkbox"
                checked={draft.midBoss}
                onChange={(e) => set("midBoss", e.target.checked)}
              />
              מתאים למלך
            </label>
            {/*
              ⚠ THE LABEL ON THIS ONE WAS SIMPLY WRONG, AND OR CAUGHT IT.
              He: *"in the starter pack — why is the Leviathan ticked?"* It
              said "in the starter pack" and the field is `launch`, which is
              the curated roster — every card the game actually deals. The
              Leviathan is ticked because it is in the game, not because a
              seven-year-old opens with a sea monster the size of the board.
              The starter pack is the eight cards below, and it is not a
              per-card tick at all.
            */}
            <label className="ed__f ed__f--check">
              <input
                type="checkbox"
                checked={draft.launch}
                onChange={(e) => set("launch", e.target.checked)}
              />
              מחולק במשחק
            </label>
          </div>
          <small className="dim">
            &quot;מחולק במשחק&quot; — הקלף מגיע לדקים, לתיבות ולבוטים. קלף בלי הסימון נשאר בנתונים
            ולא מגיע לאף אחד.
          </small>
          <small className="dim">
            חבילת הפתיחה של שחקן חדש: {inStarter ? "הקלף הזה בפנים" : "הקלף הזה לא בפנים"}. זו רשימה
            קבועה של {STARTER_ALBUM.length} קלפים (decks.ts) ולא תכונה של קלף — תקציב הדק של מתחיל
            תלוי בה, ולכן היא לא נערכת כאן.
          </small>

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
            <small>קובץ מהמחשב. מוקטן ל־768 פיקסל ונשמר כ־webp.</small>
          </h4>
          <div className="ed__art">
            {draft.art.sprite ? (
              <img className="ed__sprite" src={artUrl(draft.art.sprite)} alt="" />
            ) : (
              <span
                className="ed__sprite ed__sprite--blank"
                style={{ background: draft.art.placeholderColor }}
              />
            )}
            <div className="ed__art-side">
              <input
                ref={file}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  const chosen = e.target.files?.[0];
                  if (chosen) void replaceArt(chosen);
                }}
              />
              <button disabled={busy} onClick={() => file.current?.click()}>
                {busy ? "מעלה…" : draft.art.sprite ? "החלף תמונה" : "העלה תמונה"}
              </button>
              {draft.art.sprite && (
                <button
                  className="admin__danger"
                  onClick={() => set("art", { ...draft.art, sprite: null })}
                >
                  הסר תמונה
                </button>
              )}
              <label className="ed__f">
                נתיב
                <input
                  value={draft.art.sprite ?? ""}
                  placeholder="cards/dragons_01_flame_dragon.webp"
                  onChange={(e) => set("art", { ...draft.art, sprite: e.target.value.trim() || null })}
                />
              </label>
              <label className="ed__f">
                צבע בלי תמונה
                <input
                  type="color"
                  value={draft.art.placeholderColor}
                  onChange={(e) => set("art", { ...draft.art, placeholderColor: e.target.value })}
                />
              </label>
            </div>
          </div>

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
