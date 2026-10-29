import { useEffect, useMemo, useRef, useState } from "react";
import {
  ABILITY_TRIGGERS,
  ABILITY_TYPES,
  CARRY_STYLES,
  DRAG_FX,
  DRAG_SOUNDS,
  ELEMENTS,
  RANGES,
  RARITIES,
  STARTER_ALBUM,
  type Ability,
  type AbilityType,
  type Card,
} from "@amanda/shared";
import { CATALOG, SERIES } from "../data/catalog";
import { artUrl } from "../game/skins";
import { DRAG_SOUND_CLIP, dragMixOf, voiceFor } from "../game/cardSound";
import { styleFor } from "../game/carry";
import { FX_FOR_STYLE } from "../game/dragFx";
import { setPreviewCard } from "../game/preview";
import {
  CARRY_HE,
  EFFECT_HE,
  ELEMENT_HE,
  FX_HE,
  RANGE_HE,
  RARITY_HE,
  SOUND_HE,
  TRIGGER_HE,
} from "../game/vocab";
import { sfx } from "../game/sfx";
import { useDrag } from "../game/useDrag";
import { CardView } from "./CardView";
import { DragGhost } from "./DragGhost";
import { FixBox, notesFor, type FixNote } from "./FixBox";
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
  /** Every fix note in the panel; this editor picks out the ones about cards. */
  notes: readonly FixNote[];
  reloadNotes: () => void | Promise<void>;
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

/* ───────────────────────── the card in your hand ───────────────────────── */

/** clip → the name Or picked it by, for describing a mix he did not choose. */
const CLIP_HE = new Map(
  Object.entries(DRAG_SOUND_CLIP)
    .filter(([, clip]) => clip)
    .map(([id, clip]) => [clip!, SOUND_HE[id as keyof typeof SOUND_HE].he]),
);

/**
 * The numbers an effect reads, as a line under the row.
 *
 * Taken out of the engine's own handlers (see vocab.ts). "No numbers" is
 * worth saying too: an empty params box on an effect that takes none is
 * finished, and an empty one on `knockback` is a card that pushes nobody.
 */
function paramHint(type: AbilityType): string {
  const p = EFFECT_HE[type].params;
  return p ? `מספרים: ${p}` : "בלי מספרים";
}

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

export function CardEditor({ call, say, upload, notes, reloadNotes }: CardEditorDeps) {
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
   * The same carry the game uses, with nowhere to drop.
   *
   * `useDrag` reports a target by hit-testing `[data-drop]` under the
   * pointer, and the panel has none — so every drag here ends in a release
   * with nothing to do, which is exactly the right behaviour for a stage.
   * Nothing is placed, nothing is saved, and the card springs back.
   */
  const { drag, start: startDrag } = useDrag(() => {});
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

  /*
   * ⚠ THE SCHEMA WILL REFUSE HALF A STORY. `story` is a LocalizedString and
   * both halves are `min(1)`, so a card with a Hebrew line and an empty
   * English one fails validation on save — which would read as "the panel
   * will not save my card" rather than as "you left a field empty". Typing
   * in one box fills the other with the same words until it is overwritten,
   * and clearing both drops the field entirely.
   */
  const setStory = (lang: "he" | "en", value: string) =>
    setDraft((d) => {
      if (!d) return d;
      const other = lang === "he" ? "en" : "he";
      const kept = d.story?.[other] ?? "";
      const text = value.trim();
      if (!text && !kept.trim()) {
        const { story: _gone, ...rest } = d;
        return rest as Card;
      }
      return { ...d, story: { he: "", en: "", ...d.story, [lang]: value, [other]: kept || value } };
    });

  /**
   * One of the three choices about the card in your hand.
   *
   * ⚠ "Automatic" is the ABSENCE of the field, not a value in it. An empty
   * string writes nothing and an all-empty object removes `drag` entirely —
   * otherwise a card Or opened, looked at and left alone saves as edited,
   * and `{ drag: {} }` and no drag at all become two states that mean the
   * same thing and compare as different.
   */
  const setDrag = (key: "move" | "fx" | "sound", value: string) =>
    setDraft((d) => {
      if (!d) return d;
      const next: Record<string, string> = { ...d.drag };
      if (value) next[key] = value;
      else delete next[key];
      if (!Object.keys(next).length) {
        const { drag: _gone, ...rest } = d;
        return rest as Card;
      }
      return { ...d, drag: next as Card["drag"] };
    });

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

  /*
   * The stage shows the DRAFT, not the shipped card.
   *
   * <CardView>, <DragGhost>, the spring and the sounds all look a card up by
   * id, and without this they would look up what the build shipped with —
   * so a movement Or had just chosen would do nothing until he saved,
   * reloaded the panel and came back. See game/preview.ts; nothing in the
   * game ever sets this.
   */
  useEffect(() => {
    setPreviewCard(draft);
    return () => setPreviewCard(null);
  }, [draft]);

  const move = draft ? moveOf(draft) : "still";
  const inStarter = !!draft && (STARTER_ALBUM as readonly string[]).includes(draft.id);
  const speaks = draft ? voiceFor(draft.id).name : undefined;

  /*
   * What the three "automatic"s would answer for this card as it stands, and
   * what it actually comes out as. Read off the DRAFT rather than through
   * the preview seam, which is one render behind it — change an element and
   * the sound line has to say so on the same keystroke, or it is describing
   * the card you had a moment ago.
   */
  const autoMove = draft ? styleFor(draft) : "steady";
  const nowMove = draft?.drag?.move ?? autoMove;
  const autoFx = FX_FOR_STYLE[nowMove];
  const nowFx = draft?.drag?.fx ?? autoFx;
  const nowSound = draft
    ? dragMixOf(draft)
        .map((layer) => CLIP_HE.get(layer.clip) ?? layer.clip)
        .join(" + ") || SOUND_HE.none.he
    : "";

  return (
    <div className="admin__body ed">
      <DragGhost drag={drag} />
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
                      {/* A note waiting on this card. The whole reason the
                        panel holds every note at once: without it, "which
                        cards did I leave something on" is a screen of its
                        own that nobody opens. */}
                      {notesFor(notes, "card", e.card.id).open && (
                        <b className="ed__row-fix" title="יש תיקון שממתין">
                          ✎
                        </b>
                      )}
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
          {/*
            Or: *"let me also see the card in the panel and hear its voice,
            and maybe drag it and see how it looks."* Three different
            questions about one card, and none of them is answerable from a
            form: what it LOOKS like, what it SOUNDS like, and how it behaves
            in a hand — which is a spring, a tilt and whatever it throws off
            while it moves.

            ⚠ All three are the game's own code, not a drawing of it. The
            card is <CardView>, the carry is <DragGhost> — the same component
            App.tsx renders over the board — and the voice is the same clip
            the same way. A preview that is written separately is a preview
            that disagrees with the game, and it disagrees quietly.

            ⚠ AND IT STAYS ON THE SCREEN NOW. Or: *"tidy it into a sensible,
            comfortable order so I can go over them with Hod."* The form is
            long and the card scrolled off the top of it, so by the time you
            reached the numbers the thing you were talking about was the one
            thing not on the screen. It is a sticky column: every section
            below is read beside the card it is about.
          */}
          <div className="ed__preview">
            <div
              className="ed__stage"
              onPointerDown={(e) => {
                if (!CATALOG.has(draft.id)) return;
                /*
                 * Idempotent, and here as well as in the panel's own
                 * first-gesture listener because this component is also
                 * rendered on its own in a harness. Decoding is not
                 * instant, so the press that unlocks is not the press
                 * that is heard — which is why the panel unlocks on its
                 * first press and not on this one.
                 */
                sfx.unlock();
                sfx.voice(voiceFor(draft.id).name);
                startDrag(draft.id, e);
              }}
            >
              <CardView cardId={CATALOG.has(draft.id) ? draft.id : "crumb_demon"} size="large" />
            </div>
            {/*
              ⚠ AND NO "PLAY THE NAME" BUTTON. There was one for an hour.
              Or: *"I do not need the play-the-name button, I am supposed
              to hear it when I drag."* He is right twice over — the press
              that starts a carry is the one gesture that says a card's
              name in the game (App.tsx), so a button beside it would be a
              second way to hear a thing that the panel is supposed to be
              showing AS IT IS.

              What the button did carry and a drag cannot is the silence:
              nine of the sixteen names have no recording yet, and a card
              that says nothing looks exactly like a card whose sound is
              broken. So that one fact stays, as a line rather than a
              control.
            */}
            <small className="ed__stage-hint">
              {speaks
                ? "גרור את הקלף כדי לראות ולשמוע אותו."
                : "גרור כדי לראות איך הוא בא ליד. לשם שלו אין עדיין הקלטה."}
            </small>
          </div>

          <div className="ed__fields">
            {/* ───────────── 1. מי זה ───────────── */}
            <div className="ed__headfields">
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
                  dir="ltr"
                  value={draft.name.en}
                  onChange={(e) => set("name", { ...draft.name, en: e.target.value })}
                />
              </label>
              {/*
                Or: *"add me an option to give every monster a 'story' too.
                Not all of them will have one, but some — mainly the ones
                with the name."* Beside the names, because that is what it
                belongs to: it is read under the name on the card and
                nowhere else.

                Empty is a real answer here and the commonest one, so there
                is nothing to switch on — a card with no story shows none.
              */}
              <label className="ed__f">
                סיפור (עברית)
                <input
                  value={draft.story?.he ?? ""}
                  placeholder="החבר הנאמן שתמיד איתך"
                  onChange={(e) => setStory("he", e.target.value)}
                />
              </label>
              <label className="ed__f">
                Story (English)
                <input
                  dir="ltr"
                  value={draft.story?.en ?? ""}
                  onChange={(e) => setStory("en", e.target.value)}
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
              {/*
                Last, and small. It is the card's address — the name the
                save, the picture and every other table use for it — and it
                is the one field on this screen that is not for reading with
                a seven-year-old.
              */}
              <label className="ed__f">
                מזהה — באנגלית, בלי רווחים
                <input dir="ltr" value={draft.id} onChange={(e) => set("id", e.target.value)} />
              </label>
            </div>

            {/* ───────────── 2. תמונה ───────────── */}
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
                    dir="ltr"
                    value={draft.art.sprite ?? ""}
                    placeholder="cards/dragons_01_flame_dragon.webp"
                    onChange={(e) =>
                      set("art", { ...draft.art, sprite: e.target.value.trim() || null })
                    }
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

            {/* ───────────── 3. יסודות ───────────── */}
            {/*
              ⚠ THIS HEADING SAID "POWERS" AND EXPLAINED LEVELS. Two
              mistakes in one line: these are the ELEMENTS, and the sentence
              under them was about what a level-up adds — which is a fact
              about the numbers, and has now gone to sit over the numbers.
            */}
            <h4 className="ed__h">
              יסודות
              <small>ממה הוא עשוי. הראשון הוא זה שקובע חזק או חלש מול יסודות אחרים.</small>
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
                  <Icon name={el as never} size={15} /> {ELEMENT_HE[el]}
                </button>
              ))}
            </div>

            {/* ───────────── 4. יכולות ───────────── */}
            {/*
              Or: *"give the behaviours normal names so I understand what is
              going on there, preferably in Hebrew."* He was reading
              `sideKnockback` and `onCollision` off a dropdown. The engine's
              names are what gets saved and matched, so they are still the
              values — only what is PRINTED changed (game/vocab.ts), and the
              line under each row says which numbers that effect reads,
              because a JSON box with no idea what goes in it is a box you
              type `{}` into forever.
            */}
            <h4 className="ed__h">
              יכולות
              <small>מתי קורה מה. הרשימות הן בדיוק מה שהמנוע יודע לבצע.</small>
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
                      {TRIGGER_HE[t].he}
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
                      {EFFECT_HE[t].he}
                    </option>
                  ))}
                </select>
                <input
                  className="ed__params"
                  dir="ltr"
                  value={JSON.stringify(ab.params ?? {})}
                  title={paramHint(ab.type)}
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
                <small className="ed__ability-note">
                  {EFFECT_HE[ab.type].note ? `${EFFECT_HE[ab.type].note}. ` : ""}
                  {paramHint(ab.type)}
                  {EFFECT_HE[ab.type].dead ? " ⚠ המנוע עדיין לא מבצע את היכולת הזאת." : ""}
                </small>
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

            {/* ───────────── 5. מספרים ───────────── */}
            <h4 className="ed__h">
              מספרים
              <small>אלה מספרי רמה 1. כל רמה מוסיפה אותו אחוז לחיים ולעוצמה, לכל הקלפים.</small>
            </h4>
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
                SECONDS BETWEEN BLOWS — so raising it makes a card slower,
                which is the opposite of what "rate" reads as. A dial that
                does the reverse of what it is called is how a card gets
                nerfed by somebody trying to buff it.
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
                <select
                  value={draft.stats.range}
                  onChange={(e) => setStat("range", e.target.value)}
                >
                  {RANGES.map((r) => (
                    <option key={r} value={r}>
                      {RANGE_HE[r].he}
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
                  {RARITIES.map((r) => (
                    <option key={r} value={r}>
                      {RARITY_HE[r]}
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
            </div>

            {/* ───────────── 6. תנועה בקרב ───────────── */}
            <h4 className="ed__h">
              תנועה בקרב
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

            {/* ───────────── 7. ביד ───────────── */}
            {/*
              Or: *"let me choose, for every monster: a drag movement out of
              a list of movements, a drag sound out of a list of sounds, a
              drag animation out of a list of animations."*

              ⚠ EMPTY IS THE NORMAL STATE AND IT IS NOT A BLANK. Every one of
              these is worked out from the card itself, and that has to keep
              being true — a card invented in this panel tomorrow must behave
              like something without anybody choosing for it. So "automatic"
              is an option with the DERIVED answer printed in it, and
              choosing it again removes the field (schemas/drag.ts).
            */}
            <h4 className="ed__h">
              ביד
              <small>מה קורה כשמרימים את הקלף. גרור את הקלף שלמעלה כדי לבדוק.</small>
            </h4>
            <div className="ed__grid">
              <label className="ed__f">
                תנועה בגרירה
                <select
                  value={draft.drag?.move ?? ""}
                  onChange={(e) => setDrag("move", e.target.value)}
                >
                  <option value="">אוטומטי — {CARRY_HE[autoMove].he}</option>
                  {CARRY_STYLES.map((id) => (
                    <option key={id} value={id}>
                      {CARRY_HE[id].he}
                    </option>
                  ))}
                </select>
              </label>
              <label className="ed__f">
                אנימציה בגרירה
                <select value={draft.drag?.fx ?? ""} onChange={(e) => setDrag("fx", e.target.value)}>
                  <option value="">אוטומטי — {FX_HE[autoFx].he}</option>
                  {DRAG_FX.map((id) => (
                    <option key={id} value={id}>
                      {FX_HE[id].he}
                    </option>
                  ))}
                </select>
              </label>
              <label className="ed__f">
                צליל בגרירה
                <select
                  value={draft.drag?.sound ?? ""}
                  onChange={(e) => setDrag("sound", e.target.value)}
                >
                  <option value="">אוטומטי — תערובת</option>
                  {DRAG_SOUNDS.map((id) => (
                    <option key={id} value={id}>
                      {SOUND_HE[id].he}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {/*
              What the three of them come out as, in words, for the card as it
              is right now — including the automatic ones. A dropdown that
              says "automatic" and nothing else is a dropdown you have to
              drag the card to understand.
            */}
            <small className="dim">תנועה — {CARRY_HE[nowMove].he}: {CARRY_HE[nowMove].note}</small>
            <small className="dim">אנימציה — {FX_HE[nowFx].he}: {FX_HE[nowFx].note}</small>
            <small className="dim">צליל — {nowSound}</small>

            {/* ───────────── 8. במשחק ───────────── */}
            <h4 className="ed__h">
              במשחק
              <small>האם הקלף קיים, ולמי הוא מגיע.</small>
            </h4>
            <div className="ed__grid">
              <label className="ed__f ed__f--check">
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                />
                קיים במשחק
              </label>
              {/*
                ⚠ THE LABEL ON THIS ONE WAS SIMPLY WRONG, AND OR CAUGHT IT.
                He: *"in the starter pack — why is the Leviathan ticked?"* It
                said "in the starter pack" and the field is `launch`, which is
                the curated roster — every card the game actually deals. The
                Leviathan is ticked because it is in the game, not because a
                seven-year-old opens with a sea monster the size of the board.
                The starter pack is a fixed list, and it is not a per-card
                tick at all.
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
              חבילת הפתיחה של שחקן חדש: {inStarter ? "הקלף הזה בפנים" : "הקלף הזה לא בפנים"}. זו
              רשימה קבועה של {STARTER_ALBUM.length} קלפים (decks.ts) ולא תכונה של קלף — תקציב הדק של
              מתחיל תלוי בה, ולכן היא לא נערכת כאן.
            </small>

            <FixBox
              scope="card"
              target={draft.id}
              notes={notes}
              call={call}
              say={say}
              reload={reloadNotes}
            />

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
        </div>
      )}
    </div>
  );
}
