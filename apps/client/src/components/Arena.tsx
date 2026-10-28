import { useEffect, useRef, useState } from "react";
import { spriteFor } from "../game/skins";
import { looksLikeAMovedBuild, markStale } from "../game/staleBuild";
import { Application, Assets, Container, Graphics, Sprite, Text, Texture } from "pixi.js";
import { ARENA, PHASES, SIMULATION, type PlayerCard } from "@amanda/shared";
import type { BattleResult, EndedBy, FrameUnit, Owner } from "@amanda/engine";
import { cardColor, CATALOG } from "../data/catalog";
import { seriesColor } from "../data/cardMeta";
import { sfx } from "../game/sfx";
import { voiceFor } from "../game/cardSound";
import { combatLook, drawAura, drawProjectile, type CombatLook } from "./arenaFx";
import { line as t, lineF as tf } from "../game/copy";
import { lang, say } from "../game/lang";

const CELL = 72;
/** Header band above the lanes, so the identity banners never cover a unit. */
const HEAD = 26;
const W = ARENA.width * CELL;
/** Four lanes is the ordinary arena; Amanda mode is eight. Per battle. */
const laneCount = (result: { lanes?: number }) => result.lanes ?? ARENA.lanes;
const heightFor = (lanes: number) => lanes * CELL + HEAD;
const OWNER_TINT = { A: 0x4aa3ff, B: 0xff5a5a } as const;
/**
 * The battlefield when nobody has said which.
 *
 * Normally the arena comes from the player's trophies — it IS the progression
 * (packages/shared/src/arenas.ts) — but a replay with no account behind it,
 * and the arena workbench, still have to fight somewhere.
 */
const BACKDROP = "playroom";

/** Series tint as a Pixi colour, so same-family units read as a group. */
function seriesTint(cardId: string): number {
  const id = CATALOG.get(cardId)?.seriesId ?? "";
  return Number.parseInt(seriesColor(id).replace("#", ""), 16);
}

/** Public URL of a card's artwork, or null when it has none yet. */
function artUrlOf(cardId: string): string | null {
  const base = CATALOG.get(cardId)?.art.sprite;
  const sprite = base ? spriteFor(cardId, base) : undefined;
  return sprite ? `${import.meta.env.BASE_URL}${sprite}` : null;
}
const FINALE_MS = 1700;
/**
 * How long we wait for card artwork before starting the battle without it.
 *
 * Every texture used to be downloaded BEFORE the canvas was attached, so on a
 * slow phone the screen stayed empty — and, far worse, the timers that END a
 * battle are scheduled after that load, so a slow connection produced a battle
 * that could never finish. A unit with no texture already falls back to a
 * coloured box, so waiting was never worth a match.
 */
const ART_WAIT_MS = 7000;
/**
 * How long the battle gets to put something on screen before we give up on it.
 * Comfortably more than ART_WAIT_MS, so a slow download is never mistaken for
 * a failure: a false alarm costs the player their replay.
 */
const STARTUP_GRACE_MS = 15000;
/** How long the "could not draw it" message stays before moving on by itself. */
const SKIP_AFTER_MS = 3500;
/** Seconds left at which the clock starts warning. */
const WARN_AT = 5;
/**
 * ═══ HEBREW IN A CANVAS DOES NOT LAY ITSELF OUT ═══
 *
 * Or: *"it said THE KING IS DEAD and the exclamation mark was at the
 * beginning. Do not forget RTL in Hebrew."*
 *
 * He is right and it is not a Pixi bug. A canvas lays text out with the
 * Unicode bidi algorithm, and that algorithm needs to be told which
 * direction the PARAGRAPH runs. The default is left-to-right, and under
 * left-to-right rules a trailing "!" is a neutral character at the end of
 * the line — which in a line that reads right-to-left puts it on the left,
 * and the left is where a Hebrew sentence STARTS.
 *
 * The DOM never shows this because the whole app is `dir="rtl"`. A canvas
 * inherits none of that.
 *
 * U+2067 opens a right-to-left isolate and U+2069 closes it: inside, the
 * paragraph runs the way the words do, and the mark and the punctuation land
 * on the ends they belong to. An isolate rather than an embedding, so a
 * string with a Latin word or a number in it cannot leak its direction out
 * into whatever is drawn beside it.
 *
 * Everything drawn into the arena goes through here, because the next
 * Hebrew string somebody adds to a canvas will have the same problem and no
 * reason to suspect it.
 */
const RTL_ISOLATE = "\u2067";
/**
 * The other one, and the reason this function is no longer called `rtl`.
 *
 * ═══ IT FORCED RIGHT-TO-LEFT ON ENGLISH TOO ═══
 *
 * Or: *"'the king is dead' in English is on RTL. Make sure all the English
 * is LTR."*
 *
 * He is exactly right, and it is this line. The isolate above was written
 * when every word on the canvas was Hebrew, and it does not ask what it is
 * wrapping — so when the game went into English, "King down!" was laid out
 * in a right-to-left paragraph and its exclamation mark came out on the
 * LEFT, which is where a right-to-left line ends.
 *
 * The paragraph direction follows the GAME now, exactly as the DOM's `dir`
 * does (lang.ts). Not the first-strong isolate U+2068, which was the
 * tempting answer: that reads the direction off the text itself, and a
 * Hebrew sentence that happens to open with a card's Latin name — "Choopy
 * הורג את…" — would be laid out left-to-right by it. The language is the
 * honest answer because it is the same one every other screen uses.
 */
const LTR_ISOLATE = "\u2066";
const POP_ISOLATE = "\u2069";

/**
 * A string, in a paragraph that runs the way this game's words run.
 *
 * An ISOLATE rather than an embedding, so a Latin word inside a Hebrew line
 * — or a Hebrew nickname inside an English one — cannot leak its direction
 * out into whatever is drawn beside it.
 */
function bidi(text: string): string {
  return (lang() === "en" ? LTR_ISOLATE : RTL_ISOLATE) + text + POP_ISOLATE;
}

/**
 * **Why the battle stopped, in big letters, before it stops.**
 *
 * Or: *"a match ends if you brought the king down or if the time ran out.
 * And if you reach a dead end where no card can move, the clock is cut
 * short. I want some indication of that — 'time up', 'the king is dead' or
 * 'dead end' — in big letters in the middle of the screen, like the ones at
 * the start of a battle."*
 *
 * ═══ THERE WERE TWO ENDINGS AND ONE OF THEM WAS A LIE ═══
 *
 * This said "⏱ נגמר הזמן!" whenever `winReason !== "kingDown"` — so a battle
 * that stopped because nothing could move any more announced that the clock
 * had run out, with a minute still on it. And a king going down, which is
 * the ending the whole game is about, was announced not at all: the board
 * simply collapsed.
 *
 * `result.endedBy` is the engine's answer to the actual question (types.ts).
 * Three endings, three things to say, each one true.
 */
const END_WORDS: Record<EndedBy, () => string> = {
  king: () => t("s687e265", "המלך מת!"),
  time: () => t("sb67b6fd", "נגמר הזמן!"),
  deadEnd: () => t("s683d48d", "דד אנד!"),
};

/*
 * ═══ THERE USED TO BE A GLYPH BESIDE THE WORDS ═══
 *
 * ♛ for the king, ⏱ for the clock, ✖ for a dead end. Or, looking at it:
 * *"the old-fashioned crown. The serif font. The gold. None of that has
 * anything to do with us."*
 *
 * All three are the same mistake. A character like ♛ is not drawn by the
 * font the rest of the line is set in — nothing in a UI stack has it — so
 * the browser goes looking and lands on whatever symbol font the machine
 * keeps for such things, which on Windows is a serif chess piece from the
 * nineteen-nineties. That is where the serif came from, and it could not
 * have come from anywhere else: we never chose it, we only chose a
 * character that forced somebody else to.
 *
 * It is not replaced with the game's own crown. The words are the message
 * and they are enough; a mark beside them is a second thing to read at the
 * one moment there is no time to read twice.
 */

/**
 * How long the ending's two words are on screen, start to finish.
 *
 * Or: *"the banner that comes up saying 'the king is dead' is huge, it
 * hides all the explosions on the board, and it is not in the brand's
 * design language at all. Do it without the background, coming up like
 * that for a second (there is a detailed summary afterwards anyway)."*
 *
 * Every part of that is one mistake: it was a PANEL. A dark rounded box
 * with a gold outline drawn across the middle of the board, holding the
 * ending words AND a sentence of explanation — and it never faded, so it
 * was still sitting there, opaque, while the losing board blew up behind
 * it. The one moment the game has built up to for three minutes, covered
 * by a caption of itself.
 *
 * The sentence it held is `verdictText()`, which the result screen shows a
 * few seconds later in full. That is the "detailed summary afterwards": the
 * banner was not adding anything, it was repeating the next screen early
 * and charging the finale for it.
 *
 * So: the words alone, no box, in the brand's accent rather than a gold
 * invented here, and gone before the explosions start.
 */
const ANNOUNCE_MS = 1200;

/** The pause between the words clearing and the board coming down. */
const VERDICT_MS = 1500;

const cx = (col: number): number => (col + 0.5) * CELL;
const cy = (lane: number): number => HEAD + (lane + 0.5) * CELL;
const laneCenter = (lanes: number[]): number => lanes.reduce((s, l) => s + l, 0) / lanes.length;

interface UnitGfx {
  /**
   * Which card this is currently drawn as.
   *
   * Not always the card it started as: a delayed transform changes a unit's
   * `cardId` mid-battle and the frames carry the new one from that tick on.
   * See `reskin`.
   */
  cardId: string;
  /** Positioned from the replay frame — never touched by the effects. */
  container: Container;
  /** Everything visible. Carries the lunge, recoil and shake offsets. */
  art: Container;
  hp: Graphics;
  /** White overlay that pops when the unit is struck. */
  flash: Graphics;
  /** Ground ring for units that project an aura. */
  aura: Graphics | null;
  /**
   * The shadow on the floor.
   *
   * Nothing in this battle touched the ground before it: every monster
   * floated on the painting, which is the difference between a board of
   * pieces and a place with things standing in it. It lies under the art and
   * outside it, so the lunge and the shake do not drag it around.
   */
  shadow: Graphics;
  /** Frost ring + orbiting shards while the unit is frozen. */
  stun: Graphics;
  look: CombatLook;
  targetAlpha: number;
  pulse: number;
  flashAmt: number;
  shake: number;
  /** Current displacement from a lunge or a recoil, springing back to zero. */
  offX: number;
  offY: number;
  /** Replay time (ms) until which the unit shows as frozen. */
  stunnedUntilMs: number;
  exploding: boolean;
  /** 0 to 1 through its death, so the body can go its own way out. */
  deathT: number;
  dead: boolean;
  /** Where the replay wants it; the body glides toward this. */
  toX: number;
  toY: number;
  /**
   * Phase of the walk cycle, advanced only while it is actually moving —
   * and the idle hover of a flier, which never stops. It replaced `bob`,
   * which did the second job and only that.
   */
  step: number;
  /** How fast it is travelling right now, in px per second. */
  speed: number;
  half: number;
  owner: Owner;
  /** 0 to 1: how much health is left, for the body to show it. */
  life: number;
  /**
   * Health last frame, and whether a blow explains the difference.
   *
   * ═══ THE ONE WAY TO SEE AN ABILITY WORK ═══
   *
   * Or: *"yes, let's do the abilities."* Most of them never reached the
   * screen at all: a card being healed, a card burning from poison and a
   * card whose armour ate the blow all looked like nothing happening.
   *
   * Healing is the clearest case and the one that needed no engine change.
   * It arrives a THIRTIETH of a point at a time — `hp + hpPerSecond / TPS`,
   * every tick, from regen, from an aura and from the family bonus — so
   * there is nothing to emit an event for without emitting thirty a second.
   * But the frames carry health, and health going UP has exactly one cause.
   * So the renderer watches the number instead of being told about it, and
   * gets every source of healing for free, including the ones nobody has
   * written yet.
   *
   * Health going DOWN with no blow to explain it is the other half: that is
   * poison, or a lane that burns.
   */
  wasHp: number;
  /** Health gained since the last frame, waiting to be shown. */
  healed: number;
  /** Health lost with no blow behind it: poison. */
  burned: number;
  /** The King is the match; it is shown as hurt sooner. */
  isKing: boolean;
  /**
   * The health this unit started with, kept so a blow can be weighed against
   * what it would take to kill it. 300 damage is a scratch on a King and most
   * of a Crumb Demon, and until now both looked exactly the same.
   */
  maxHp: number;
}
interface Floater {
  text: Text;
  life: number;
}
/** A shot in flight, carrying the damage reaction it will trigger on arrival. */
interface Projectile {
  g: Graphics;
  x0: number;
  y0: number;
  targetUid: string;
  look: CombatLook;
  t: number;
  /** Total flight time in ms. */
  dur: number;
  /** Lob height in px — 0 for flat shots. */
  arc: number;
  damage: number;
  /** The element matchup this shot will land on: 1.5, 1 or 0.75. */
  edge: number;
  phase: number;
  /** How big it is drawn, from what it is about to do. */
  size: number;
  /** Tumble, for the things that tumble. */
  spin: number;
  /** Counts down to the next puff of trail behind it. */
  trail: number;
}
interface Particle {
  g: Graphics;
  vx: number;
  vy: number;
  life: number;
  gravity: number;
}
/** An expanding ring: impacts, deaths, splits and revealed cards all use one. */
interface Ring {
  g: Graphics;
  life: number;
  color: number;
  from: number;
  to: number;
  width: number;
  /** How long it takes to travel. 380ms unless something says otherwise. */
  ms: number;
}

export function Arena({
  result,
  onFinish,
  flip = false,
  backdrop = BACKDROP,
  me,
  them,
}: {
  result: BattleResult;
  onFinish: () => void;
  /** You, and whoever is on the other side — for the two header banners. */
  me?: PlayerCard | null;
  them?: PlayerCard | null;
  /** Which arena to fight in. The caller knows the player's trophies; this does not. */
  backdrop?: string;
  /** Mirror horizontally so the local player (B) still sees themselves on the left. */
  flip?: boolean;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const finishedRef = useRef(false);
  /**
   * True when the battle could not be drawn at all.
   *
   * Everything below runs inside a promise. If WebGL refuses to start, that
   * promise rejects, the canvas is never attached and — the part that actually
   * hurt — none of the timers that end the battle are ever scheduled. The
   * player was left on an empty screen, in a match that could not finish, with
   * nothing to press. An ErrorBoundary does not help: it catches errors thrown
   * while rendering, not a rejected promise.
   */
  const [failed, setFailed] = useState(false);
  /**
   * WHY it failed, in a few words.
   *
   * Or hit this on his phone — "it told me it couldn't show me the battle and
   * jumped straight to the result" — and there was nothing to go on, because
   * the catch below threw the reason away. A player does not need a stack
   * trace, but somebody has to be able to ask "what did it say" and get an
   * answer that narrows it down.
   */
  const [why, setWhy] = useState<string | null>(null);
  const LANES = laneCount(result);
  const H = heightFor(LANES);

  useEffect(() => {
    finishedRef.current = false;
    let disposed = false;
    let initialized = false;
    let finaleStarted = false;
    let timeUp = false;
    /** Last whole second announced by the battle clock, so each ticks once. */
    let lastTick = -1;
    let clock = 0; // replay time in ms, shared by every effect
    /*
     * Hit-stop: milliseconds the REPLAY is held still for, and when the last
     * one was. The effects layer keeps running through it — that is the
     * difference between a hit landing and the game stuttering.
     */
    let freezeMs = 0;
    let lastFreezeAt = -9999;
    /**
     * The camera.
     *
     * There was no screen shake in this game — only a per-unit jitter, which
     * says "this card was hit" and never "that landed". The whole field moves
     * now, for the blows big enough to deserve it and for the King's death.
     */
    let quake = 0;
    /*
     * ═══ ONE SOUND AT A TIME, PER KIND ═══
     *
     * A frame can hold twenty blows. Twenty impact sounds on top of each
     * other is not twenty times as loud, it is mud — so each kind of sound
     * has a floor under how often it may be heard, and the loudest thing in
     * any given moment is the one that gets through.
     */
    const lastSound: Record<string, number> = {};
    function hear(name: "hit" | "shoot" | "die", everyMs: number): void {
      if (clock - (lastSound[name] ?? -9999) < everyMs) return;
      lastSound[name] = clock;
      sfx.play(name);
    }

    /** The losing board, falling one rank at a time. See triggerFinale. */
    const collapse: Array<{ at: number; g: UnitGfx; king: boolean }> = [];
    const timers: number[] = [];
    const app = new Application();
    const gfxByUid = new Map<string, UnitGfx>();
    const uidByGfx = new Map<UnitGfx, string>();
    const floaters: Floater[] = [];
    const shots: Projectile[] = [];
    const particles: Particle[] = [];
    const rings: Ring[] = [];
    // Layers, so projectiles and debris always draw over the units.
    const bgLayer = new Container();
    const unitLayer = new Container();
    const fxLayer = new Container();
    const uiLayer = new Container();
    // When flipped, mirror horizontally so the local player is on the left.
    const fx = (col: number): number => (flip ? W - cx(col) : cx(col));
    const localTint = flip ? OWNER_TINT.B : OWNER_TINT.A;
    const oppTint = flip ? OWNER_TINT.A : OWNER_TINT.B;

    function drawUnit(fu: FrameUnit): UnitGfx {
      const container = new Container();
      const art = new Container();
      const look = combatLook(fu.cardId);
      /*
       * === A PIECE IS DRAWN AS A PIECE ===
       *
       * Or: *"there is some monster that splits into 4 small monsters —
       * they look like little squares and they just move, with no motion
       * of their own. Fix that."*
       *
       * Both halves had one cause. They were spawned with the card id
       * "__spawn__", so there was no card behind them: no artwork, no
       * element colour, no series ring, no name and — this is the "no
       * motion of their own" — no WALK, because the walk is read off the
       * card (arenaFx.ts). A grey box that slides.
       *
       * They carry the parent's card now (engine, ChildProto), so all of
       * that arrives for free and a child of a slime wobbles like a slime.
       * What is left is the size: three fifths, so four of them in a lane
       * read as something that came apart rather than as four more cards.
       */
      const w = (fu.isKing ? 2 : fu.spawned ? 0.6 : 1) * CELL * 0.88;

      // The shadow and the aura ring lie on the ground under the unit, so
      // they must not inherit the lunge and shake that `art` carries.
      const shadow = new Graphics();
      container.addChild(shadow);

      // The aura ring lies on the ground under the unit, so it must not inherit
      // the lunge and shake that `art` carries.
      let aura: Graphics | null = null;
      if (look.aura) {
        aura = new Graphics();
        aura.y = w / 2 - 4;
        container.addChild(aura);
      }

      const body = new Graphics();
      body.roundRect(-w / 2, -w / 2, w, w, 10).fill(cardColor(fu.cardId));
      art.addChild(body);

      // Card artwork, cover-fitted into the unit box and rounded off.
      const url = artUrlOf(fu.cardId);
      if (url && Assets.cache.has(url)) {
        const tex = Texture.from(url);
        const sprite = new Sprite(tex);
        sprite.anchor.set(0.5, 0);
        sprite.y = -w / 2;
        /*
         * ═══ AND IT FACES THE WAY IT IS FIGHTING ═══
         *
         * Or: *"the artwork on the cards should face the direction of the
         * attack. Which means that if the head faces right — as it does on
         * most of the cards — then when it belongs to the enemy it should
         * be flipped."*
         *
         * He is right about the artwork: it was drawn facing right, every
         * card of it, and the board has two sides. A's units advance to the
         * right and B's to the left, so half the board was walking
         * backwards into the fight — two rows of monsters looking over
         * their shoulders at their own King.
         *
         * `facing` is the same `owner === "A" ? 1 : -1` the walk cycles and
         * the death throws already use further down; this is the one place
         * that had not been told. It is set on the SPRITE rather than on
         * `art`, which the lunge and the shake write to every frame.
         */
        const s = w / tex.width; // portrait art → fills width, top-aligned
        sprite.scale.set(fu.owner === "A" ? s : -s, s);
        const mask = new Graphics().roundRect(-w / 2, -w / 2, w, w, 10).fill(0xffffff);
        sprite.mask = mask;
        art.addChild(mask, sprite);
      }

      // Double frame: the outer ring says whose unit it is, the inner ring says
      // which series it belongs to (so synergy groups are visible in battle too).
      const frame = new Graphics();
      frame
        .roundRect(-w / 2, -w / 2, w, w, 10)
        .stroke({ width: fu.isKing ? 5 : 3, color: OWNER_TINT[fu.owner] });
      const inner = w - (fu.isKing ? 8 : 5);
      frame
        .roundRect(-inner / 2, -inner / 2, inner, inner, 8)
        .stroke({ width: 2, color: seriesTint(fu.cardId), alpha: 0.95 });
      art.addChild(frame);

      const hp = new Graphics();
      const card = CATALOG.get(fu.cardId);
      const rawName = card ? say(card.name) : "";

      // The name sits INSIDE the unit on a dark strip. Drawing it below the box
      // made neighbouring units' labels collide across lanes.
      const plateH = fu.isKing ? 18 : 14;
      const plate = new Graphics();
      plate
        .roundRect(-w / 2, w / 2 - plateH, w, plateH, 6)
        .fill({ color: 0x05080f, alpha: 0.85 })
        .roundRect(-w / 2, w / 2 - plateH, w, 2, 1)
        .fill({ color: seriesTint(fu.cardId), alpha: 0.9 });
      art.addChild(plate);

      const fontSize = fu.isKing ? 11 : 9;
      const maxChars = Math.max(4, Math.floor(w / (fontSize * 0.62)));
      const name =
        rawName.length > maxChars ? rawName.slice(0, maxChars - 1) + "…" : rawName;
      // The element used to be an emoji glyph prefixed to this label. Element
      // icons are image files now and a Pixi Text cannot draw one — it would
      // print the file name. The series colour already runs along the top of
      // this plate and the card art sits right above it, so the name is enough.
      const label = new Text({
        // A card name has a direction and a canvas does not know it. See bidi().
        text: bidi(name),
        style: {
          fontFamily: "Segoe UI, sans-serif",
          fontSize,
          fill: 0xffffff,
          fontWeight: "700",
          align: "center",
        },
      });
      label.anchor.set(0.5);
      label.y = w / 2 - plateH / 2;
      if (label.width > w - 4) label.scale.set((w - 4) / label.width);
      art.addChild(hp, label);

      // Hit flash: a white silhouette that is normally fully transparent.
      const flash = new Graphics();
      flash.roundRect(-w / 2, -w / 2, w, w, 10).fill(0xffffff);
      flash.alpha = 0;
      art.addChild(flash);

      const stun = new Graphics();
      container.addChild(art, stun);
      unitLayer.addChild(container);

      const g: UnitGfx = {
        container,
        art,
        hp,
        flash,
        aura,
        stun,
        look,
        targetAlpha: 1,
        pulse: 0,
        flashAmt: 0,
        shake: 0,
        offX: 0,
        offY: 0,
        shadow,
        life: 1,
        wasHp: fu.hp,
        healed: 0,
        burned: 0,
        isKing: fu.isKing,
        stunnedUntilMs: 0,
        exploding: false,
        deathT: 0,
        dead: false,
        toX: 0,
        toY: 0,
        step: Math.random() * 6,
        speed: 0,
        half: w / 2,
        owner: fu.owner,
        maxHp: fu.maxHp,
        cardId: fu.cardId,
      };
      gfxByUid.set(fu.uid, g);
      uidByGfx.set(g, fu.uid);
      return g;
    }

    /**
     * The same unit, drawn as a different card.
     *
     * Or: *"the Obsidian Egg died and no dragon hatched out of it."* The
     * engine turns it into one now (abilities.ts, runDelayed) by changing
     * the unit's `cardId`, which every frame after that moment carries.
     *
     * A unit's artwork, colour, series ring and name are all decided once,
     * in `drawUnit`, from the card it was at the time — so the honest way
     * to change the card is to build the unit again. It costs one container
     * at one moment in a battle, and it means the dragon is a DRAGON in
     * every respect that drawUnit knows about, rather than an egg with a
     * different picture glued on.
     *
     * Position is carried across by hand. Everything else on the record is
     * either per-frame (and about to be written by the caller) or an effect
     * that has no business surviving a creature turning into another one.
     */
    function reskin(old: UnitGfx, fu: FrameUnit): UnitGfx {
      const { x, y } = old.container;
      gfxByUid.delete(fu.uid);
      uidByGfx.delete(old);
      old.container.destroy({ children: true });
      const g = drawUnit(fu);
      g.container.x = x;
      g.container.y = y;
      g.toX = x;
      g.toY = y;
      return g;
    }

    function applyFrame(units: FrameUnit[]): void {
      for (const fu of units) {
        let g = gfxByUid.get(fu.uid) ?? drawUnit(fu);
        if (g.cardId !== fu.cardId) g = reskin(g, fu);
        /*
         * ═══ WHERE IT IS GOING, NOT WHERE IT IS ═══
         *
         * The frames are thirty a second and the screen draws sixty, so
         * writing the frame's position straight onto the unit made every
         * monster in the game advance in little jumps. The frame sets a
         * target now and the body glides to it in the ticker, which is both
         * smoother and what lets the walk know whether it is moving at all.
         */
        const nx = fx(fu.col);
        const ny = cy(laneCenter(fu.lanes));
        if (g.toX === 0 && g.toY === 0) {
          g.container.x = nx;
          g.container.y = ny;
        }
        g.toX = nx;
        g.toY = ny;
        g.targetAlpha = fu.alive ? 1 : 0;
        const ratio = Math.max(0, Math.min(1, fu.hp / fu.maxHp));
        g.life = ratio;
        /*
         * What changed since the last frame. A rise is healing, whatever
         * healed it; a fall is a blow until an event says otherwise, and
         * what is left over after the events have been played is poison.
         */
        const moved = fu.hp - g.wasHp;
        g.wasHp = fu.hp;
        if (moved > 0) g.healed += moved;
        else if (moved < 0) g.burned += -moved;
        // HP bar sits inside the top of the unit, so it can never be confused
        // with the unit above it in the next lane.
        const barW = g.half * 2 - 6;
        g.hp.clear();
        g.hp
          .roundRect(-barW / 2, -g.half + 3, barW, 5, 2.5)
          .fill({ color: 0x05080f, alpha: 0.85 })
          .roundRect(-barW / 2 + 1, -g.half + 4, (barW - 2) * ratio, 3, 1.5)
          .fill(ratio > 0.35 ? 0x5ad25a : 0xe2c04a);
      }
    }

    function spawnDamage(
      g: UnitGfx,
      amount: number,
      edge = 1,
      extra: { absorbed?: number; reflected?: boolean; healed?: boolean } = {},
    ): void {
      if (amount <= 0) return;
      /*
       * The number grows with the blow and says when the elements decided it.
       * A "×1.5" on the damage is the album's table, caught in the act — and
       * it is the only place in a battle where a rule explains itself without
       * a sentence.
       */
      const strong = edge > 1.01;
      const weak = edge < 0.99;
      // Built before the Text so the number keeps its own direction — a
      // damage floater reads "-250" in any language and wrapping it
      // right-to-left would move the minus sign. See Arena.test.ts.
      /*
       * Three more things a number can be. Healing is the one that was
       * missing entirely — health went up and the screen said nothing — and
       * thorns were being drawn as an ordinary blow, from the wrong
       * direction, which reads as the attacker hitting itself by accident.
       */
      const mark = strong ? " ×1.5" : extra.absorbed ? ` (${extra.absorbed})` : "";
      const colour = extra.healed
        ? 0x6ee787
        : extra.reflected
          ? 0xff9ad5
          : strong
            ? 0xffd166
            : weak
              ? 0xb9c0cf
              : 0xff6b6b;
      const t = new Text({
        text: `${extra.healed ? "+" : "-"}${amount}${mark}`,
        style: {
          fontFamily: "Segoe UI, sans-serif",
          fontSize: Math.round(13 + heftOf(g, amount) * 9),
          fill: colour,
          fontWeight: "800",
        },
      });
      t.anchor.set(0.5);
      t.x = g.container.x + (Math.random() - 0.5) * 14;
      t.y = g.container.y - g.half;
      uiLayer.addChild(t);
      floaters.push({ text: t, life: 1 });
    }

    function spawnRing(
      x: number,
      y: number,
      color: number,
      from: number,
      to: number,
      width = 3,
      ms = 380,
    ): void {
      const g = new Graphics();
      g.x = x;
      g.y = y;
      fxLayer.addChild(g);
      rings.push({ g, life: 1, color, from, to, width, ms });
    }

    /**
     * A handful of something thrown out from a point.
     *
     * `shape` and `dir` are what let one function make ash, rubble and a gust
     * of wind: a dot for sparks, a chip for anything that breaks, a streak
     * for anything blown. Without them every death in the game was the same
     * ring of dots in a different colour.
     */
    function spawnParticles(
      x: number,
      y: number,
      color: number,
      count: number,
      speed: number,
      opts: {
        gravity?: number;
        size?: number;
        shape?: "dot" | "chip" | "streak";
        /** Centre of the spray, in radians. Left out, it goes everywhere. */
        dir?: number;
        /** How wide the spray is around `dir`. */
        spread?: number;
      } = {},
    ): void {
      for (let i = 0; i < count; i++) {
        const a =
          opts.dir === undefined
            ? Math.random() * Math.PI * 2
            : opts.dir + (Math.random() - 0.5) * (opts.spread ?? Math.PI / 3);
        const v = speed * (0.4 + Math.random() * 0.8);
        const size = (opts.size ?? 3) * (0.5 + Math.random());
        const g = new Graphics();
        if (opts.shape === "chip")
          g.rect(-size, -size * 0.8, size * 2, size * 1.6)
            .fill(color)
            .rotation = Math.random() * Math.PI;
        else if (opts.shape === "streak")
          g.rect(-size * 3, -size * 0.4, size * 6, size * 0.8).fill(color);
        else g.circle(0, 0, size).fill(color);
        g.x = x;
        g.y = y;
        fxLayer.addChild(g);
        particles.push({
          g,
          vx: Math.cos(a) * v,
          vy: Math.sin(a) * v,
          life: 1,
          gravity: opts.gravity ?? 0.00035,
        });
      }
    }

    /**
     * ═══ TEN DEATHS ═══
     *
     * Or: *"the shooting, the dying, the movement — all of it has to be much
     * more fun and impressive."*
     *
     * Every card in the game used to die the same death: fourteen dots in the
     * family's colour and a ring. The element decides now (arenaFx.ts), which
     * is the dimension the player is already being taught to read, so a thing
     * made of fire does not go out like a thing made of stone.
     *
     * What is thrown here is only half of it — the BODY does the other half,
     * in the ticker below, where `dies` picks how it goes.
     */
    function deathBurst(g: UnitGfx): void {
      hear("die", 140);
      const x = g.container.x;
      const y = g.container.y;
      const c = g.look.death;
      const glow = g.look.glow;
      const UP = -Math.PI / 2;
      switch (g.look.dies) {
        case "ash":
          // Burns out: embers lift, ash falls through them.
          spawnRing(x, y, 0xffb347, g.half * 0.3, g.half * 1.6, 3);
          spawnParticles(x, y, 0xffc46b, 10, 0.13, {
            size: 2.5,
            gravity: -0.00045,
            dir: UP,
            spread: 1.4,
          });
          spawnParticles(x, y, 0x4a4a52, 12, 0.07, { size: 3, gravity: 0.00018, shape: "chip" });
          return;
        case "wash":
          // Breaks like water: a splash out, drops down.
          spawnRing(x, y, 0x7fd4ff, g.half * 0.3, g.half * 2, 3);
          spawnParticles(x, y, 0x9fe6ff, 16, 0.18, { size: 2.5, gravity: 0.0006 });
          return;
        case "crumble":
          // Falls apart: rubble, straight down, and a puff of dust.
          spawnParticles(x, y, c, 14, 0.1, { size: 3.5, gravity: 0.0009, shape: "chip" });
          spawnParticles(x, y + g.half * 0.6, 0x9c8e78, 8, 0.05, { size: 5, gravity: -0.00008 });
          return;
        case "gust":
          // Blown away, sideways, the way it was facing.
          spawnParticles(x, y, glow, 14, 0.3, {
            size: 2,
            shape: "streak",
            dir: g.owner === "A" ? 0 : Math.PI,
            spread: 0.9,
            gravity: -0.00005,
          });
          return;
        case "zap":
          // Shorts out: a white flash and a scatter of sparks.
          spawnRing(x, y, 0xffffff, g.half * 0.2, g.half * 1.9, 2);
          spawnRing(x, y, c, g.half * 0.5, g.half * 2.4, 1.5);
          spawnParticles(x, y, 0xfff3a8, 14, 0.28, { size: 2, shape: "streak" });
          return;
        case "shatter":
          // Breaks: shards out fast and far, with a hard spark ring.
          spawnRing(x, y, glow, g.half * 0.3, g.half * 2.2, 2);
          spawnParticles(x, y, c, 18, 0.32, { size: 3, shape: "chip", gravity: 0.0005 });
          return;
        case "bloom":
          // Goes up and out, bright, with nothing left behind.
          spawnRing(x, y, 0xffffff, g.half * 0.2, g.half * 2.6, 4);
          spawnParticles(x, y, 0xfff6d0, 12, 0.08, {
            size: 2.5,
            gravity: -0.0004,
            dir: UP,
            spread: 2.2,
          });
          return;
        case "swallow":
          // Taken IN: the sparks fall toward where it was, not away from it.
          for (let i = 0; i < 12; i++) {
            const a = (i / 12) * Math.PI * 2;
            const r = g.half * 1.9;
            spawnParticles(x + Math.cos(a) * r, y + Math.sin(a) * r, c, 1, 0.1, {
              size: 3,
              dir: a + Math.PI,
              spread: 0.2,
            });
          }
          spawnRing(x, y, 0x1a1030, g.half * 1.8, g.half * 0.2, 4);
          return;
        case "melt":
          // Goes down into a puddle, bubbling.
          spawnParticles(x, y + g.half * 0.5, c, 10, 0.06, { size: 4, gravity: 0.0004 });
          spawnRing(x, y + g.half * 0.7, c, g.half * 0.2, g.half * 1.5, 5);
          return;
        default:
          spawnParticles(x, y, c, 14, 0.22, { size: 3.5 });
          spawnParticles(x, y, 0x1a1f2e, 8, 0.12, { size: 5, gravity: -0.0002 });
          spawnRing(x, y, c, g.half * 0.4, g.half * 1.8, 3);
      }
    }

    /**
     * ═══ THE KING FALLING, WHICH IS NOT A BUBBLE ═══
     *
     * Or, after the losing board was given each unit's own death: *"those
     * bubbles that happen when the cards come apart at the end still don't
     * look good. Something more powerful would be better, like the cards
     * that die in the middle of a game."*
     *
     * He had found the one that was left. Every other unit on that board
     * dies its own death now; the King still had `spawnBurst`, and
     * `spawnBurst` was a bubble by construction — the numbers say so:
     *
     *            a death's ring        the King's burst
     *   lives    380ms                 1700ms
     *   draws    one stroke            a stroke AND a white FILLED disc
     *   grows    to the unit's size    to 60px, slowly
     *
     * A translucent white circle swelling for nearly two seconds is a soap
     * bubble; there is no other thing it could be. And it was the slowest
     * object on a screen where every impact in the preceding three minutes
     * resolved in under four hundred milliseconds — so the biggest moment in
     * the game was also the only one that dawdled.
     *
     * "Like the cards that die in the middle" is the answer and it is
     * literal: this is built out of the same two primitives every death in
     * this file uses, `spawnRing` and `spawnParticles`, at the same tempo.
     * It is not a different KIND of effect, it is more of the same one —
     * three rings instead of one, forty-six pieces instead of a dozen, and
     * the widest ring given 620ms rather than 380 because it has four times
     * as far to travel and should not have to hurry.
     *
     * No fill anywhere. That was the bubble.
     */
    function kingFall(x: number, y: number, half: number): void {
      // The flash, the brand's gold, and a wide red one that outruns both.
      spawnRing(x, y, 0xffffff, half * 0.2, half * 2.2, 5);
      spawnRing(x, y, 0xffb020, half * 0.4, half * 3.4, 4, 500);
      spawnRing(x, y, 0xff6b6b, half * 0.9, half * 5.0, 2, 620);
      // What a crown is made of, and what is under it.
      spawnParticles(x, y, 0xffb020, 22, 0.42, { size: 3.5, shape: "chip", gravity: 0.0006 });
      spawnParticles(x, y, 0xffffff, 14, 0.5, { size: 2, shape: "streak" });
      // Dust, lifting, so the ground is in it too.
      spawnParticles(x, y + half * 0.5, 0x9c8e78, 10, 0.08, { size: 6, gravity: -0.00012 });
    }

    /**
     * ═══ HOW MUCH A BLOW IS WORTH, 0 TO 1 ═══
     *
     * Or: *"I want us to work on making the battle animations much prettier
     * and more varied. The shooting, the dying, the movement — all of it has
     * to be much more fun and impressive."*
     *
     * The first thing missing was not prettiness, it was WEIGHT. Every hit in
     * this game drew the same six sparks and the same ring whether it took
     * fifty health or nine hundred; the only thing that changed was the
     * number floating up.
     *
     * Measured against what the TARGET can take, not against an absolute:
     * 300 damage is a scratch on a King with 7,500 health and the end of a
     * Crumb Demon. A blow that takes a third of a unit is a full-weight blow.
     */
    function heftOf(target: UnitGfx, damage: number): number {
      const share = damage / Math.max(1, target.maxHp);
      return Math.max(0.12, Math.min(1, share * 3));
    }

    /**
     * ═══ AND THE ELEMENTS, WHERE THEY CAN BE SEEN ═══
     *
     * `edge` comes from the engine (1.5, 1 or 0.75) and is the table Or wrote
     * out in the album, happening. A winning matchup hits in the ATTACKER's
     * colour, wider and with more of everything; a losing one lands small and
     * dull. Nobody has to be told the table if the board keeps showing it.
     */
    function landHit(
      target: UnitGfx,
      fromX: number,
      fromY: number,
      look: CombatLook,
      damage: number,
      edge = 1,
      /** Who struck, when it was a body and not a shot already in the air. */
      from?: UnitGfx,
      /**
       * Damage that never arrived: armour, a reduction aura, a neighbour
       * taking a share. The engine works it out (simulate.ts) because only
       * it knows what the blow would have been.
       */
      absorbed = 0,
      /** Thorns: this is the attacker paying for having attacked. */
      reflected = false,
    ): void {
      // This much of the fall in its health is explained; anything left
      // over at the end of the frame is poison. See UnitGfx.burned.
      target.burned = Math.max(0, target.burned - damage);
      const heft = heftOf(target, damage);
      const strong = edge > 1.01;
      const weak = edge < 0.99;
      /*
       * The strike: the attacker is thrown AT what it is hitting, from
       * wherever the wind-up left it. This is the other half of the shape —
       * see the `attack` event above.
       */
      const hitter = from;
      if (hitter && hitter !== target && hitter.look.attack === "lunge") {
        const ax = target.container.x - hitter.container.x;
        const ay = target.container.y - hitter.container.y;
        const ad = Math.hypot(ax, ay) || 1;
        hitter.offX = (ax / ad) * hitter.half * (0.42 + heft * 0.25);
        hitter.offY = (ay / ad) * hitter.half * (0.42 + heft * 0.25);
      }
      // A winning matchup reads as bigger than it is; a losing one as smaller.
      const force = heft * (strong ? 1.35 : weak ? 0.55 : 1);
      target.flashAmt = strong ? 1 : 0.75;
      target.shake = Math.max(target.shake, force);
      const dx = target.container.x - fromX;
      const dy = target.container.y - fromY;
      const d = Math.hypot(dx, dy) || 1;
      // Recoil away from whatever hit it, as far as the blow deserves.
      const push = 3 + force * 13;
      target.offX += (dx / d) * push;
      target.offY += (dy / d) * push;
      spawnParticles(
        target.container.x - (dx / d) * target.half * 0.6,
        target.container.y - (dy / d) * target.half * 0.6,
        strong ? look.color : look.glow,
        Math.round(4 + force * 16),
        0.1 + force * 0.16,
        { size: 2 + force * 3 },
      );
      spawnRing(
        target.container.x,
        target.container.y,
        look.color,
        target.half * 0.35,
        target.half * (0.9 + force * 0.9),
        1.5 + force * 3,
      );
      // A second ring, a beat wider, only when the elements decided it.
      if (strong)
        spawnRing(
          target.container.x,
          target.container.y,
          look.glow,
          target.half * 0.6,
          target.half * 2.1,
          2,
        );
      /*
       * ═══ THE FRAME STOPS ═══
       *
       * The oldest trick in fighting games and the one that makes a heavy
       * blow feel heavy: the picture holds still for a few frames at the
       * moment of impact. The replay clock pauses; the sparks do not, so the
       * freeze reads as the hit landing rather than as a stutter.
       *
       * Only for blows that take a third of a unit, no more than once every
       * half second, and 70ms at a time — a battle that stops for every poke
       * is a battle in slow motion. Worst case this stretches a 45-second
       * match by about two seconds.
       */
      if (force > 0.75 && clock - lastFreezeAt > 500) {
        freezeMs = 70;
        lastFreezeAt = clock;
      }
      // The field itself moves for a blow this size.
      if (force > 0.55) quake = Math.max(quake, Math.min(1, (force - 0.5) * 1.6));
      // And it is heard. Small pokes stay silent: a sound that plays for
      // everything is a sound that means nothing.
      if (force > 0.3) hear("hit", 110);
      /*
       * And the floor remembers it for a moment: a dark ring under the
       * feet, which is the difference between a blow landing on a unit and
       * a blow landing in a place.
       */
      if (force > 0.5)
        spawnRing(
          target.container.x,
          target.container.y + target.half * 0.9,
          0x0a0d16,
          target.half * 0.2,
          target.half * (0.9 + force),
          2 + force * 2,
        );
      /*
       * ═══ WHAT THE ARMOUR STOPPED ═══
       *
       * A card whose whole job is to absorb looked exactly like a card that
       * was not being hit hard: the screen only ever saw the number that
       * got through. A pale shield ring and the blocked number in grey say
       * the other half — and only when it is worth saying, because a blow
       * reduced by three is not a card doing its job.
       */
      if (absorbed > damage * 0.15 && absorbed > 20) {
        spawnRing(
          target.container.x,
          target.container.y,
          0x8fb6e8,
          target.half * 1.15,
          target.half * 0.55,
          2.5,
        );
        spawnParticles(target.container.x, target.container.y, 0xcfe2ff, 4, 0.06, { size: 2 });
      }
      spawnDamage(target, damage, edge, { absorbed, reflected });
    }

    /**
     * ═══ A SHOT LEAVES SOMETHING BEHIND IT ═══
     *
     * Or: *"the shots also need improving — how they look, how they move,
     * how fast."*
     *
     * They were five pixels wide whatever they were about to do, they left
     * the barrel with no sign that anything had been fired, and they crossed
     * the board with nothing behind them. So: the shooter flashes and rocks
     * back, the shot is sized by the damage it carries, it tumbles if it is
     * the kind of thing that tumbles, and it drags a thin trail — which is
     * how fast a thing is going, made visible.
     */
    function fireProjectile(from: UnitGfx, target: UnitGfx, damage: number, edge = 1): void {
      const g = new Graphics();
      fxLayer.addChild(g);
      const dist = Math.hypot(
        target.container.x - from.container.x,
        target.container.y - from.container.y,
      );
      const lobbed = from.look.shape === "rock" || from.look.shape === "blob";
      const heft = heftOf(target, damage);

      // The muzzle: a flash at the shooter, pointed at what it is shooting.
      const ang = Math.atan2(
        target.container.y - from.container.y,
        target.container.x - from.container.x,
      );
      spawnParticles(
        from.container.x + Math.cos(ang) * from.half * 0.6,
        from.container.y + Math.sin(ang) * from.half * 0.6,
        from.look.glow,
        Math.round(3 + heft * 5),
        0.1 + heft * 0.08,
        { size: 1.8 + heft, dir: ang, spread: 0.7 },
      );
      // And it rocks back on the shot, the way anything that fires does.
      from.offX -= Math.cos(ang) * (2 + heft * 4);
      from.offY -= Math.sin(ang) * (2 + heft * 4);
      hear("shoot", 90);

      shots.push({
        g,
        x0: from.container.x,
        y0: from.container.y,
        targetUid: uidByGfx.get(target) ?? "",
        look: from.look,
        t: 0,
        dur: Math.max(70, (dist / CELL) * from.look.flightMs),
        // A lobbed rock or blob travels in an arc; bolts and shards fly flat.
        arc: lobbed ? Math.min(26, dist * 0.12) : 0,
        size: 4 + heft * 4,
        spin: lobbed ? 7 : 0,
        trail: 0,
        damage,
        // Carried along with the shot: the hit it lands is the one that has
        // to show what the elements did.
        edge,
        phase: Math.random() * 10,
      });
    }

    /**
     * ═══ THE LOSING BOARD GOES DOWN ═══
     *
     * Or: *"and the death, mainly at the end, when everyone just turns into
     * bubbles."*
     *
     * That is exactly what it was. Every surviving loser was flagged
     * `exploding` and given a `spawnBurst` — a growing yellow ring, the same
     * one, all at the same instant, over the whole half of the board. Ten
     * bubbles and a board that was gone before anybody could look at it.
     *
     * (And one bubble survived that round, on the King, until he found it
     * too. See `kingFall`.)
     *
     * Two changes, and the first matters more: each unit dies ITS OWN death
     * now (deathBurst, by element) instead of the generic ring. The second is
     * that they go in a WAVE rather than together — front rank first, back
     * rank last — which is the difference between a board collapsing and a
     * board being switched off. The King goes last and is the only one that
     * still gets the shockwave, because it is the only one the shockwave was
     * ever about.
     */
    function triggerFinale(units: FrameUnit[]): void {
      finaleStarted = true;
      const loser = result.winner === "A" ? "B" : result.winner === "B" ? "A" : null;
      if (!loser) return; // a draw does not collapse a board
      sfx.play("explode");
      const falling = units
        .filter((fu) => fu.owner === loser && (fu.alive || fu.isKing))
        .map((fu) => ({ fu, g: gfxByUid.get(fu.uid) }))
        .filter((x): x is { fu: FrameUnit; g: UnitGfx } => !!x.g)
        // Nearest the middle of the arena first: the line that was holding.
        .sort((a, b) => {
          if (a.fu.isKing !== b.fu.isKing) return a.fu.isKing ? 1 : -1;
          const mid = ARENA.width / 2;
          return Math.abs(a.fu.col - mid) - Math.abs(b.fu.col - mid);
        });
      falling.forEach(({ fu, g }, i) => {
        collapse.push({ at: clock + i * 70, g, king: fu.isKing });
      });
    }

    void app
      .init({
        width: W,
        height: H,
        background: "#0e1220",
        antialias: true,
        /*
         * WebGL, explicitly. Pixi v8 probes WebGPU first by default, and on
         * phones that probe is the least reliable part of starting up —
         * immature drivers, and a failure there takes the whole init with it.
         * WebGL is on every phone that can run this game at all.
         */
        preference: "webgl",
        /*
         * Capped at 2.
         *
         * A modern phone reports a devicePixelRatio of 3, which with
         * antialiasing asks for a buffer nine times the canvas — and in
         * Amanda mode the canvas is already twice as tall. That allocation
         * failing is exactly the kind of thing that ends up as "it could not
         * show me the battle". Two is past the point anyone can see.
         */
        resolution: Math.min(window.devicePixelRatio || 1, 2),
        autoDensity: true,
      })
      .then(async () => {
        // Preload every card texture this battle needs, so units are drawn with
        // their artwork from the very first frame instead of flat colour boxes.
        const urls = [
          ...new Set(
            result.frames
              .flatMap((f) => f.units.map((u) => u.cardId))
              .map(artUrlOf)
              .filter((u): u is string => u !== null),
          ),
        ];
        // One shared budget, and the backdrop and the cards race it together
        // rather than one after the other. Whatever has arrived by then is
        // used; the rest fall back to their colour box and the match runs.
        const give_up = new Promise<null>((resolve) => {
          timers.push(window.setTimeout(() => resolve(null), ART_WAIT_MS));
        });
        const inTime = <T,>(p: Promise<T>): Promise<T | null> =>
          Promise.race([p.catch(() => null), give_up]);

        /*
          * The two faces, fetched with everything else rather than after it.
          * A missing one is normal — a guest has no avatar — and `inTime`
          * already turns any failure into null, so the banner falls back to
          * the name alone and the battle is never held up for a picture.
          */
        const faceUrl = (who?: PlayerCard | null) =>
          who?.avatar ? `${import.meta.env.BASE_URL}brand/${who.avatar}.webp` : null;
        const myFaceUrl = faceUrl(me);
        const theirFaceUrl = faceUrl(them);

        const [bgTexture, , myFace, theirFace] = await Promise.all([
          inTime(
            Assets.load(`${import.meta.env.BASE_URL}arena/${backdrop}.webp`) as Promise<Texture>,
          ),
          urls.length ? inTime(Assets.load(urls)) : Promise.resolve(null),
          myFaceUrl ? inTime(Assets.load(myFaceUrl) as Promise<Texture>) : Promise.resolve(null),
          theirFaceUrl
            ? inTime(Assets.load(theirFaceUrl) as Promise<Texture>)
            : Promise.resolve(null),
        ]);
        initialized = true;
        if (disposed) {
          app.destroy(true, { children: true });
          return;
        }
        hostRef.current?.appendChild(app.canvas);
        app.stage.addChild(bgLayer, unitLayer, fxLayer, uiLayer);

        const FIELD = H - HEAD; // playable area, below the header band

        // The painted battlefield, cover-fitted under everything else.
        if (bgTexture) {
          const bgSprite = new Sprite(bgTexture);
          bgSprite.anchor.set(0.5);
          bgSprite.scale.set(Math.max(W / bgTexture.width, FIELD / bgTexture.height));
          bgSprite.x = W / 2;
          bgSprite.y = HEAD + FIELD / 2;
          bgLayer.addChild(bgSprite);
          // Knock it back just enough that the cards standing on it keep their
          // contrast — any heavier and the painted floor stops reading at all.
          bgLayer.addChild(
            new Graphics().rect(0, HEAD, W, FIELD).fill({ color: 0x060912, alpha: 0.22 }),
          );
        }

        const bg = new Graphics();
        // header strip that carries the two identity banners
        bg.rect(0, 0, W, HEAD).fill({ color: 0x070b14, alpha: 0.95 });
        bg.rect(0, 0, W / 2, HEAD).fill({ color: localTint, alpha: 0.18 });
        bg.rect(W / 2, 0, W / 2, HEAD).fill({ color: oppTint, alpha: 0.18 });
        // territory tint over each half of the field
        const terr = bgTexture ? 0.05 : 0.1;
        bg.rect(0, HEAD, W / 2, FIELD).fill({ color: localTint, alpha: terr });
        bg.rect(W / 2, HEAD, W / 2, FIELD).fill({ color: oppTint, alpha: terr });
        // alternating lane bands make the four lanes readable at a glance
        for (let l = 0; l < LANES; l++)
          if (l % 2 === 1)
            bg.rect(0, HEAD + l * CELL, W, CELL).fill({ color: 0xffffff, alpha: bgTexture ? 0.02 : 0.03 });
        // column guides (faint) and lane separators (stronger)
        for (let c = 0; c <= ARENA.width; c++) bg.moveTo(c * CELL, HEAD).lineTo(c * CELL, H);
        bg.stroke({ width: 1, color: 0x2a3550, alpha: bgTexture ? 0.3 : 0.5 });
        for (let l = 0; l <= LANES; l++)
          bg.moveTo(0, HEAD + l * CELL).lineTo(W, HEAD + l * CELL);
        bg.stroke({ width: 1, color: 0x3a4a63, alpha: bgTexture ? 0.45 : 1 });
        // the front line where the two boards meet
        bg.moveTo(W / 2, HEAD).lineTo(W / 2, H).stroke({ width: 4, color: 0x5d7399 });
        bg.rect(W / 2 - 2, HEAD, 4, FIELD).fill({ color: 0xffd36b, alpha: 0.12 });
        // soft edge bands keep the eye on the middle of the field
        const edge = 26;
        bg.rect(0, HEAD, W, edge).fill({ color: 0x05070e, alpha: 0.3 });
        bg.rect(0, H - edge, W, edge).fill({ color: 0x05070e, alpha: 0.3 });
        bg.rect(0, HEAD, edge, FIELD).fill({ color: 0x05070e, alpha: 0.25 });
        bg.rect(W - edge, HEAD, edge, FIELD).fill({ color: 0x05070e, alpha: 0.25 });
        bgLayer.addChild(bg);

        // Identity banners: you on the left (A), opponent on the right (B).
        /*
          * ═══ A FACE AND A NAME, NOT AN EMOJI AND A NOUN ═══
          *
          * These were `🧑 אתה` and `🤖 היריב`: a picture drawn by whoever
          * made the phone, and the word for "somebody". The face and the name
          * are the two things the versus screen spent its whole three seconds
          * establishing, and the battle threw both away at the moment they
          * mattered most.
          *
          * The face is 20px against a 26px band — it has to sit INSIDE the
          * header, because anything taller covers a unit in the back lane.
          */
        const banner = (
          who: PlayerCard | null | undefined,
          face: Texture | null,
          fallback: string,
          x: number,
          color: number,
        ) => {
          const row = new Container();
          const label = new Text({
            // A nickname is whatever the player typed, in whichever
            // direction they typed it. See bidi().
            text: bidi(who?.nickname ?? fallback),
            style: {
              fontFamily: "Segoe UI, sans-serif",
              fontSize: 15,
              fill: color,
              fontWeight: "800",
            },
          });
          label.anchor.set(0, 0.5);
          const FACE = 20;
          let width = label.width;
          if (face) {
            const sprite = new Sprite(face);
            sprite.width = FACE;
            sprite.height = FACE;
            sprite.x = 0;
            sprite.y = -FACE / 2;
            /*
              * A round face, the way it is drawn everywhere else. Pixi has no
              * border-radius, so the circle is a mask over the sprite.
              */
            const ring = new Graphics().circle(FACE / 2, 0, FACE / 2).fill(0xffffff);
            sprite.mask = ring;
            row.addChild(sprite, ring);
            label.x = FACE + 6;
            width = FACE + 6 + label.width;
          }
          row.addChild(label);
          /*
            * Centred by hand: a Container's own width is the union of its
            * children, and anchoring it would move the mask with it.
            */
          row.x = x - width / 2;
          row.y = HEAD / 2;
          uiLayer.addChild(row);
        };
        banner(me, myFace, t("sb1bd099", "אתה"), W * 0.25, localTint);
        banner(them, theirFace, t("s8854c7a", "היריב"), W * 0.75, oppTint);

        // Battle clock, centred in the header band. A 30 second fight needs to
        // show how much of it is left, and shout when it is nearly gone.
        const clockText = new Text({
          text: "",
          style: {
            fontFamily: "Segoe UI, sans-serif",
            fontSize: 16,
            fill: 0xffffff,
            fontWeight: "800",
          },
        });
        clockText.anchor.set(0.5);
        clockText.x = W / 2;
        clockText.y = HEAD / 2;
        uiLayer.addChild(clockText);

        // Red breathing edge for the final seconds.
        const urgency = new Graphics();
        urgency.alpha = 0;
        uiLayer.addChild(urgency);

        // How the battle ended, in two words, over the board rather than on
        // top of a panel laid across it.
        const announce = new Container();
        announce.alpha = 0;
        /*
         * Big, because he asked for big: *"in big letters in the middle of
         * the screen, like the ones at the start of a battle."* The
         * countdown there is 120px for a single digit; a Hebrew phrase at
         * that size would not fit the arena, so it is sized from the board
         * instead and capped — 56px on his 832px phone, and it shrinks with
         * the canvas rather than running off it.
         */
        /*
         * ═══ AND A MISSING ANSWER MUST NOT TAKE THE BATTLE DOWN ═══
         *
         * Or: *"at the end of stage one it said I could not show you the
         * battle."* That message is the arena catching a throw, and the
         * throw was mine from this morning: `END_WORDS[endedBy]()` on a
         * result whose `endedBy` is undefined is a call on undefined, and
         * it happens before a single frame is drawn.
         *
         * A result can arrive without it. The field is a day old: a server
         * that has not redeployed sends an online result without it, and a
         * service worker that has handed out a fresh Arena chunk beside a
         * cached engine chunk produces exactly the same thing locally.
         *
         * `winReason` has been on every result since long before today and
         * answers most of the question — kingDown is a crown falling and
         * everything else is the clock. A dead end then reads as "time up",
         * which is what the game said for years and is wrong in a way
         * nobody can see. Losing the whole battle screen is not.
         */
        const endedBy: EndedBy =
          result.endedBy ?? (result.winReason === "kingDown" ? "king" : "time");
        /*
         * ═══ THE BIGGEST WORDS IN THE GAME, IN THE GAME'S OWN FACE ═══
         *
         * Everything drawn into this canvas is set in Segoe UI, which is
         * nobody's choice — it is the system's. The brand already has an
         * answer for its biggest word, on the home screen (album.css,
         * `.intro__name`): Rubik Beastly, white, glowing in Amanda's teal.
         * A Hebrew display face that looks chewed, because the game's name
         * should read as a monster rather than as a title bar.
         *
         * The end of a battle is the other moment that deserves it, and it
         * was the one place still dressed as medieval fantasy: a gold that
         * belongs to buttons, under a chess piece.
         *
         * The teal glow is a SECOND copy of the same text behind the first,
         * because a Pixi text style carries one shadow and this needs two —
         * the glow that makes it Amanda's, and a dark one underneath that
         * keeps it readable over a bright board. Same string, same metrics,
         * so they sit exactly on top of each other.
         */
        const annBaseY = HEAD + (H - HEAD) / 2;
        announce.x = W / 2;
        announce.y = annBaseY;
        uiLayer.addChild(announce);

        const annSize = Math.round(Math.min(56, W / 11));
        // Held unwrapped, and wrapped at each `new Text` below: the rule is
        // that a canvas string is VISIBLY right-to-left where it is drawn
        // (see Arena.test.ts), and a wrapping hidden one line up is the
        // shape that rule exists to catch.
        const annWords = (END_WORDS[endedBy] ?? END_WORDS.time)();
        const annFace = { fontFamily: "Rubik Beastly, Segoe UI, sans-serif", fontSize: annSize, fill: 0xffffff };
        const buildEnding = (): void => {
          const glow = new Text({
            text: bidi(annWords),
            style: {
              ...annFace,
              // Amanda's teal, at no distance and a wide blur: a glow, not a
              // shadow. The same colour as the name on the home screen.
              dropShadow: { color: 0x5ae6dc, alpha: 0.85, blur: 20, distance: 0, angle: 0 },
            },
          });
          const body = new Text({
            text: bidi(annWords),
            style: {
              ...annFace,
              dropShadow: { color: 0x05070d, alpha: 0.9, blur: 9, distance: 3, angle: Math.PI / 2 },
            },
          });
          glow.anchor.set(0.5);
          body.anchor.set(0.5);
          announce.addChild(glow, body);
        };
        /*
         * And it waits for the font. Pixi measures and rasterises a Text the
         * moment it is made; made before Rubik Beastly has loaded, it bakes
         * in the fallback and looks exactly like the thing being fixed. The
         * words are not needed for another fifteen seconds, so there is no
         * cost to asking first — and either outcome builds them, because a
         * missing font must not cost the player the ending.
         */
        if (typeof document !== "undefined" && document.fonts?.load) {
          void document.fonts.load(`${annSize}px "Rubik Beastly"`).then(buildEnding, buildEnding);
        } else {
          buildEnding();
        }

        /** Milliseconds since the ending was announced; drives it off again. */
        let annMs = 0;
        const frames = result.frames;
        const events = result.events;
        const msPerFrame = 1000 / SIMULATION.ticksPerSecond;
        const lastUnits = frames.length ? frames[frames.length - 1]!.units : [];
        let elapsed = 0;
        let eventCursor = 0;
        if (frames.length > 0) applyFrame(frames[0]!.units);

        /** Translate one battle event into the effects it should play. */
        function playEvent(ev: (typeof events)[number]): void {
          const actor = ev.uid ? gfxByUid.get(ev.uid) : undefined;
          const target = ev.targetUid ? gfxByUid.get(ev.targetUid) : undefined;

          switch (ev.type) {
            case "attack": {
              if (!actor) return;
              /*
               * ═══ THE WIND-UP ═══
               *
               * Or: *"what else can be improved in the animations?"*
               *
               * This used to THROW the body forward on `attack` — which is
               * the frame the swing starts, not the frame it lands — so the
               * lunge and the impact happened at the same moment and the
               * blow had no preparation at all. Anticipation, impact,
               * recovery is the whole shape of a hit, and the engine already
               * sends two events with a gap between them; only the first was
               * being used, and for the wrong half.
               *
               * So `attack` pulls BACK, away from the target, and `hit`
               * throws forward. A card that lunges leans into it; a card
               * that shoots crouches on the spot.
               */
              actor.pulse = 1;
              if (target) {
                const dx = target.container.x - actor.container.x;
                const dy = target.container.y - actor.container.y;
                const d = Math.hypot(dx, dy) || 1;
                const back = actor.look.attack === "lunge" ? actor.half * 0.3 : actor.half * 0.16;
                actor.offX = -(dx / d) * back;
                actor.offY = -(dy / d) * back;
              }
              return;
            }
            case "hit": {
              if (!target) return;
              const damage = ev.damage ?? 0;
              if (actor && actor.look.attack === "projectile") {
                // Ranged: the reaction waits until the shot actually arrives.
                fireProjectile(actor, target, damage, ev.edge ?? 1);
              } else {
                const from = actor ?? target;
                landHit(
                  target,
                  from.container.x,
                  from.container.y,
                  from.look,
                  damage,
                  ev.edge,
                  actor,
                  ev.absorbed ?? 0,
                  ev.reflected === true,
                );
              }
              return;
            }
            case "death": {
              const g = actor ?? target;
              if (!g || g.dead) return;
              g.dead = true;
              deathBurst(g);
              return;
            }
            case "knockback": {
              if (!target) return;
              spawnParticles(
                target.container.x,
                target.container.y + target.half * 0.6,
                0xb9a98a,
                7,
                0.1,
                { size: 3, gravity: -0.0001 },
              );
              target.shake = 1;
              return;
            }
            case "stun": {
              if (!target) return;
              target.stunnedUntilMs = (ev.untilTick ?? 0) * msPerFrame;
              spawnRing(
                target.container.x,
                target.container.y,
                0x9fe6ff,
                target.half * 0.3,
                target.half * 1.4,
                2,
              );
              return;
            }
            case "split": {
              if (!actor) return;
              spawnRing(actor.container.x, actor.container.y, actor.look.color, 4, actor.half * 2.2, 3);
              spawnParticles(actor.container.x, actor.container.y, actor.look.color, 10, 0.18, {
                size: 3,
              });
              return;
            }
            /*
             * ═══ THE EGG OPENING ═══
             *
             * The card swap above is silent and instant, which on its own
             * reads as a glitch — a monster replaced between two frames.
             * This is the moment of it: the shell goes outwards as chips,
             * fire goes up, and two rings say that something arrived.
             *
             * Drawn from the same two primitives as every death in this
             * file, for the same reason the King's fall is: an effect built
             * out of the game's own vocabulary belongs to the game, and one
             * invented for a single card does not.
             */
            case "transform": {
              const g = actor;
              if (!g) return;
              /*
               * The shell giving way, and then what was inside it.
               *
               * `die` is this game's sound for a thing coming apart — a
               * crack, a weight going down, pieces settling — which is
               * exactly what a shell does. The voice is looked up from the
               * card the unit has NOW, so the Flame Dragon roars as it
               * arrives and nothing here knows the name of a single card.
               */
              sfx.play("die");
              sfx.voice(voiceFor(g.cardId).cry, 120);
              // The shell, outwards and down.
              spawnParticles(g.container.x, g.container.y, 0x2b2b35, 16, 0.3, {
                size: 3,
                shape: "chip",
                gravity: 0.0006,
              });
              // And what was inside it, upwards.
              spawnParticles(g.container.x, g.container.y, 0xffb347, 12, 0.22, {
                size: 2.5,
                gravity: -0.0004,
                dir: -Math.PI / 2,
                spread: 1.5,
              });
              spawnRing(g.container.x, g.container.y, 0xffffff, g.half * 0.2, g.half * 1.8, 4);
              spawnRing(g.container.x, g.container.y, 0xffb020, g.half * 0.5, g.half * 2.8, 2, 520);
              g.pulse = 1;
              quake = Math.max(quake, 0.5);
              return;
            }
            case "reveal": {
              if (ev.col === undefined || !ev.lanes) return;
              // A Ground Floor card coming up from under a corpse.
              spawnRing(fx(ev.col), cy(laneCenter(ev.lanes)), 0xffd36b, 6, CELL * 0.7, 3);
              return;
            }
            default:
              return;
          }
        }

        app.ticker.add((ticker) => {
          const dt = ticker.deltaMS;
          // The replay holds still for the length of a hit-stop; `clock`,
          // which drives the effects and the countdown, never stops.
          if (freezeMs > 0) freezeMs -= dt;
          else elapsed += dt;
          clock += dt;
          const k = Math.min(1, dt / 90);

          /*
           * ═══ THE CLOCK IS THE CLOCK, NOT THE LENGTH OF THE REPLAY ═══
           *
           * Or: *"when the king dies before the end of the battle time, the
           * clock goes down automatically so the battle ends at 0 together
           * with the king dying. That's weird. If the king dies the battle
           * just ends, even if there are 23 seconds left on the clock and I
           * didn't get the end-of-clock beep. That is completely fine by
           * me."*
           *
           * This read `frames.length`, which is how long the battle ACTUALLY
           * ran — the engine stops the moment a king falls (simulate.ts: the
           * loop runs `while !ended && winner === null`). So a battle decided
           * at 35 seconds produced 1,050 frames, and the clock was told it
           * had 35 seconds to spend. It started at 35, not 58, and emptied
           * exactly as the crown came down.
           *
           * Which looks like the clock chasing the battle, because it is.
           *
           * It counts the allowance now. A king who falls early leaves
           * seconds on it and the replay simply ends, which is what he
           * asked for and is also the truth: that time existed and was not
           * needed.
           *
           * The beeps come free. They fire below WARN_AT, and a battle that
           * ends at 35 never gets there — so "I didn't get the end-of-clock
           * beep" stays true without a second rule saying so.
           */
          const totalSec = PHASES.battle.seconds;
          /*
           * ⚠ And it stops when the battle does. `elapsed` keeps climbing
           * after the last frame — the ticker runs on through the
           * announcement and the explosions — so reading it raw would have
           * the clock carry on down from the 23 seconds the king left on
           * it, and start beeping partway through the victory. Which is the
           * reported bug again, arriving four seconds later.
           */
          const played = Math.min(elapsed, playbackMs);
          const leftSec = Math.max(0, totalSec - played / 1000);
          const shown = Math.ceil(leftSec);
          if (clockText.text !== `${shown}s`) clockText.text = `${shown}s`;
          const warning = leftSec <= WARN_AT && leftSec > 0;
          // Count the last seconds out loud, the same way the build phase does.
          if (shown !== lastTick && leftSec > 0 && shown <= WARN_AT) {
            lastTick = shown;
            sfx.play(shown <= 3 ? "tickUrgent" : "tick");
          }
          clockText.style.fill = warning ? 0xff6b6b : 0xffffff;
          const beat = warning ? 1 + Math.sin(clock / 90) * 0.12 : 1;
          clockText.scale.set(beat);
          if (warning) {
            urgency.clear();
            const pulse = 0.18 + Math.sin(clock / 160) * 0.1;
            urgency
              .rect(0, HEAD, W, H - HEAD)
              .stroke({ width: 6, color: 0xff5a5a, alpha: Math.max(0, pulse) });
            urgency.alpha = 1;
          } else if (urgency.alpha !== 0) {
            urgency.clear();
            urgency.alpha = 0;
          }
          /*
           * The end of the replay, measured by the replay. `elapsed` is the
           * position in the recording; when it reaches the end, the last
           * frame has been SHOWN, hit-stops and all.
           */
          if (!timeUp && elapsed >= playbackMs) {
            timeUp = true;
            // The clock sting belongs to the clock. A crown falling has the
            // battle's own noise behind it already.
            if (endedBy !== "king") sfx.play("timeUp");
          }

          /*
           * Once the battle is over, say how — and then get out of the way.
           *
           * This used to ease alpha towards 1 and stop there, which is a
           * fade-in with no fade-out: whatever it covered, it covered until
           * the screen changed. The explosions start 300ms after it
           * finishes now, with nothing in front of them.
           *
           * It rises the whole time it is up, which is the other half of
           * what he asked for and also why it never sits still long enough
           * to feel like a sign.
           */
          if (timeUp) {
            annMs += dt;
            const appear = Math.min(1, annMs / 180);
            const leave = Math.max(0, annMs - (ANNOUNCE_MS - 400)) / 400;
            announce.alpha = Math.max(0, Math.min(appear, 1 - leave));
            announce.y = annBaseY - Math.min(1, annMs / ANNOUNCE_MS) * 30;

            // Nothing is playing any more, so from here real time is the
            // right clock again — and `annMs` is real time, counted from a
            // moment the picture chose rather than a moment a timer did.
            // `triggerFinale` sets `finaleStarted` but does not check it —
            // it was only ever called once, by a timer. Called from a ticker
            // it would fire sixty explosions a second.
            if (annMs >= holdMs && !finaleStarted) triggerFinale(lastUnits);
            if (annMs >= holdMs + FINALE_MS && !finishedRef.current) {
              finishedRef.current = true;
              onFinish();
            }
          }

          if (!finaleStarted) {
            const idx = Math.min(frames.length - 1, Math.floor(elapsed / msPerFrame));
            const frame = frames[idx];
            if (frame) applyFrame(frame.units);
            const currentTick = frame?.tick ?? 0;
            while (eventCursor < events.length && events[eventCursor]!.tick <= currentTick) {
              playEvent(events[eventCursor]!);
              eventCursor++;
            }
          }

          /*
           * The camera, settling. Applied to the field and the effects on it
           * — not to `uiLayer`, because a clock that shakes with the board
           * reads as the screen breaking rather than as the board being hit.
           */
          quake *= 0.86;
          if (quake > 0.004) {
            const amp = quake * 7;
            const ox = (Math.random() - 0.5) * amp;
            const oy = (Math.random() - 0.5) * amp;
            bgLayer.x = ox * 0.4;
            bgLayer.y = oy * 0.4;
            unitLayer.x = ox;
            unitLayer.y = oy;
            fxLayer.x = ox;
            fxLayer.y = oy;
          } else if (unitLayer.x !== 0) {
            bgLayer.x = bgLayer.y = 0;
            unitLayer.x = unitLayer.y = 0;
            fxLayer.x = fxLayer.y = 0;
          }

          // --- the losing board, going down in a wave ---
          while (collapse.length && collapse[0]!.at <= clock) {
            const { g, king } = collapse.shift()!;
            g.container.alpha = 1;
            g.exploding = true;
            deathBurst(g);
            // One shockwave, for the one death the battle was about.
            if (king) {
              kingFall(g.container.x, g.container.y, g.half);
              quake = 1;
            } else {
              quake = Math.max(quake, 0.35);
            }
          }

          // --- units: glide, walk, lunge spring, hit flash, shake, aura ---
          for (const g of gfxByUid.values()) {
            if (g.exploding) {
              /*
               * ═══ AND THE BODY GOES ITS OWN WAY ═══
               *
               * The sparks are thrown in deathBurst; this is what happens to
               * the monster itself, and it is the half that makes a death
               * read as a KIND of death. Everything used to swell to twice
               * its size and fade, whatever it was made of.
               */
              g.deathT = Math.min(1, g.deathT + dt / 420);
              const ease = 1 - (1 - g.deathT) * (1 - g.deathT);
              switch (g.look.dies) {
                case "melt":
                  // Down into a puddle: flattens and spreads.
                  g.container.scale.set(1 + ease * 0.5, Math.max(0.04, 1 - ease * 1.05));
                  g.art.y = ease * g.half * 0.8;
                  g.container.alpha = 1 - ease * ease;
                  break;
                case "crumble":
                  // Falls where it stood.
                  g.container.scale.set(1 - ease * 0.25, 1 - ease * 0.45);
                  g.art.y = ease * g.half * 0.7;
                  g.art.rotation = ease * 0.5 * (g.owner === "A" ? 1 : -1);
                  g.container.alpha = 1 - ease;
                  break;
                case "swallow":
                  // Taken in: to a point, then nothing.
                  g.container.scale.set(Math.max(0.02, 1 - ease * 1.1));
                  g.container.alpha = 1 - ease * ease * ease;
                  break;
                case "gust":
                  // Blown off the board, stretched along the way.
                  g.container.scale.set(1 + ease * 0.9, Math.max(0.1, 1 - ease * 0.7));
                  g.art.x = ease * g.half * 3 * (g.owner === "A" ? 1 : -1);
                  g.container.alpha = 1 - ease;
                  break;
                case "zap":
                  // Flickers out: a few blinks and gone.
                  g.container.scale.set(1 + ease * 0.15);
                  g.container.alpha =
                    g.deathT > 0.75 ? 0 : Math.sin(g.deathT * 40) > 0 ? 0.95 : 0.15;
                  break;
                case "shatter":
                  // One hard jolt, then pieces.
                  g.container.scale.set(1 + ease * 0.25, 1 - ease * 0.15);
                  g.container.alpha = 1 - ease * 1.6;
                  break;
                case "bloom":
                  // Up and out, bright to the last frame.
                  g.container.scale.set(1 + ease * 1.1);
                  g.art.y = -ease * g.half * 1.2;
                  g.container.alpha = 1 - ease * ease;
                  break;
                case "wash":
                  // Sinks through the floor.
                  g.container.scale.set(1 - ease * 0.2, 1 - ease * 0.6);
                  g.art.y = ease * g.half;
                  g.container.alpha = 1 - ease;
                  break;
                case "ash":
                  // Shrinks as it burns, lifting a little.
                  g.container.scale.set(Math.max(0.05, 1 - ease * 0.9));
                  g.art.y = -ease * g.half * 0.5;
                  g.container.alpha = 1 - ease;
                  break;
                default:
                  g.container.alpha += (0 - g.container.alpha) * k * 1.4;
                  g.container.scale.set(
                    g.container.scale.x + (2.1 - g.container.scale.x) * k * 1.4,
                  );
              }
              continue;
            }
            g.container.alpha += (g.targetAlpha - g.container.alpha) * k;
            g.pulse *= 0.82;

            /*
             * ═══ THE GLIDE, AND WHAT IT TELLS THE WALK ═══
             *
             * The body chases the frame's target rather than being placed on
             * it, so movement is smooth between frames — and the distance it
             * covers per frame IS how fast it is going, which is the one
             * thing a walk cycle needs to know. A unit standing still stands
             * still; nothing bounces on the spot.
             */
            const dx = g.toX - g.container.x;
            const dy = g.toY - g.container.y;
            const close = Math.min(1, k * 1.6);
            g.container.x += dx * close;
            g.container.y += dy * close;
            g.speed += (Math.min(1, Math.hypot(dx, dy) / 2.2) - g.speed) * Math.min(1, k * 0.6);
            const walking = g.speed > 0.04 && g.targetAlpha > 0.5;

            // the lunge / recoil springs back toward rest
            const decay = 1 - Math.min(1, k * 1.1);
            g.offX *= decay;
            g.offY *= decay;
            g.shake *= 0.84;
            const shakeAmp = g.shake * 3;

            /*
             * ═══ SIX WALKS ═══
             *
             * Or: *"the movement, all of it has to be much more fun and
             * impressive."* Every monster in the game slid across the floor
             * upright and perfectly still. The style comes off the card —
             * what flies, what is heavy, what family it belongs to
             * (arenaFx.ts) — so nothing is authored per card and a new one
             * walks the day it is drawn.
             */
            let walkY = 0;
            let walkX = 0;
            let sx = 1;
            let sy = 1;
            let tilt = 0;
            const facing = g.owner === "A" ? 1 : -1;
            const beat = dt * 0.006;
            switch (g.look.walk) {
              case "float": {
                // Always hovering, harder when it is going somewhere.
                g.step += dt * 0.0032;
                walkY = Math.sin(g.step) * (2.5 + g.speed * 2);
                break;
              }
              case "stomp": {
                if (walking) {
                  const was = Math.sin(g.step);
                  g.step += beat * (0.7 + g.speed * 0.5);
                  const now = Math.sin(g.step);
                  const lift = Math.max(0, now);
                  walkY = -lift * 3.5;
                  // Lands flat and wide, the way something heavy does.
                  sy = 1 - lift * 0.06;
                  sx = 1 + lift * 0.05;
                  tilt = now * 0.05 * facing;
                  // The ground takes it: one shake on the frame the foot
                  // comes down, and only for things heavy enough to earn it.
                  if (was >= 0 && now < 0) {
                    if (g.look.weight > 0.5) g.shake = Math.max(g.shake, 0.45);
                    // Dust, where the foot actually lands.
                    spawnParticles(
                      g.container.x,
                      g.container.y + g.half * 0.9,
                      0x9c8e78,
                      g.look.weight > 0.5 ? 4 : 2,
                      0.035,
                      { size: 2.5, gravity: -0.00006, dir: -Math.PI / 2, spread: 2.6 },
                    );
                  }
                }
                break;
              }
              case "squish": {
                if (walking) {
                  g.step += dt * 0.009;
                  const b = Math.sin(g.step);
                  // Squash and stretch, which is the whole personality of a
                  // blob: wide and low, then tall and narrow.
                  sy = 1 + b * 0.12;
                  sx = 1 - b * 0.1;
                  walkY = -Math.max(0, b) * 3;
                }
                break;
              }
              case "scuttle": {
                if (walking) {
                  // Fast, small and slightly sideways: a thing with legs.
                  g.step += dt * 0.021;
                  walkY = -Math.abs(Math.sin(g.step)) * 1.6;
                  walkX = Math.sin(g.step * 0.5) * 1.2;
                  tilt = Math.sin(g.step * 0.5) * 0.05;
                }
                break;
              }
              case "step": {
                if (walking) {
                  g.step += dt * 0.011;
                  walkY = -Math.abs(Math.sin(g.step)) * 2.4;
                  tilt = Math.sin(g.step) * 0.04 * facing;
                }
                break;
              }
              default:
                break;
            }
            /*
             * ═══ AND IT CASTS A SHADOW ═══
             *
             * Or: *"what else can be improved in the animations?"* This,
             * first. The shadow is what puts a thing ON the floor rather than
             * in front of it, and it is also free information: it shrinks and
             * pales as a flier rises, and it spreads as a stomper lands. The
             * same ellipse does both because both are the same number — how
             * far off the ground the body is.
             */
            if (g.targetAlpha > 0.5) {
              const lift = Math.max(0, -walkY);
              const spread = 1 - lift / 26;
              g.shadow.clear();
              /*
               * Just BELOW the card, not under its middle: a unit here is
               * drawn as a card standing on the floor, so a shadow inside
               * its own footprint is a shadow nobody can see. The first
               * version put it at 0.92 of the half-height and the card sat
               * on top of it.
               */
              g.shadow
                .ellipse(0, g.half * 1.06, g.half * 0.78 * spread, g.half * 0.19 * spread)
                .fill({ color: 0x05070d, alpha: 0.5 * spread });
            } else if (g.shadow.alpha !== 0) {
              g.shadow.clear();
            }

            /*
             * ═══ HEALING, AND BURNING ═══
             *
             * Both read off the health itself (see UnitGfx.wasHp), so every
             * source counts — regen, an aura, the family bonus, a poison
             * stack, a lane that burns — without the engine emitting thirty
             * events a second for a thirtieth of a point at a time.
             *
             * Shown in whole numbers, when enough of them have gathered: a
             * "+2" floating off a card every tick is noise, and a card
             * quietly going green while nothing is written on it is the
             * thing that was missing.
             */
            if (g.healed >= 1 && g.targetAlpha > 0.5) {
              if (Math.random() < 0.35)
                spawnParticles(
                  g.container.x + (Math.random() - 0.5) * g.half,
                  g.container.y + g.half * 0.5,
                  0x6ee787,
                  1,
                  0.05,
                  { size: 2.5, gravity: -0.0004, dir: -Math.PI / 2, spread: 0.8 },
                );
              if (g.healed >= 60) {
                spawnDamage(g, Math.round(g.healed), 1, { healed: true });
                g.healed = 0;
              }
            }
            if (g.burned >= 1 && g.targetAlpha > 0.5) {
              // Poison: it drips rather than striking, and it is the colour
              // of the thing that put it there.
              if (Math.random() < 0.3)
                spawnParticles(
                  g.container.x + (Math.random() - 0.5) * g.half,
                  g.container.y - g.half * 0.3,
                  0x8bd450,
                  1,
                  0.03,
                  { size: 2.5, gravity: 0.0003 },
                );
              if (g.burned >= 60) {
                spawnDamage(g, Math.round(g.burned));
                g.burned = 0;
              }
            }

            /*
             * ═══ ALMOST DEAD SHOULD LOOK ALMOST DEAD ═══
             *
             * The most important state on the board was a thin bar. Under a
             * quarter of its health a monster breathes hard and throws the
             * odd spark of whatever it is made of — which is the same
             * information the bar carries, in the place the eye already is,
             * and it is what tells a seven-year-old who to finish.
             *
             * The King gets it from a third, because the King is the match.
             */
            const hurtAt = g.isKing ? 0.34 : 0.25;
            if (g.life < hurtAt && g.targetAlpha > 0.5) {
              const panic = 1 - g.life / hurtAt;
              g.step += dt * 0.004 * panic;
              sy *= 1 + Math.sin(clock / (120 - panic * 50)) * 0.05 * panic;
              if (Math.random() < 0.035 * panic)
                spawnParticles(
                  g.container.x + (Math.random() - 0.5) * g.half,
                  g.container.y + (Math.random() - 0.5) * g.half,
                  g.look.color,
                  1,
                  0.05,
                  { size: 2, gravity: -0.00025 },
                );
            }

            // Leaning into the direction of travel, on top of the walk.
            const lean = g.speed * 0.07 * facing;
            g.art.rotation += (tilt + lean - g.art.rotation) * Math.min(1, k * 0.8);
            const s = (g.targetAlpha < 0.5 ? 0.6 : 1) + g.pulse * 0.18;
            const grow = (from: number, to: number) => from + (to - from) * k;
            g.container.scale.set(
              grow(g.container.scale.x, s * sx),
              grow(g.container.scale.y, s * sy),
            );
            g.art.x = g.offX + walkX + (Math.random() - 0.5) * shakeAmp;
            g.art.y = g.offY + walkY + (Math.random() - 0.5) * shakeAmp;

            g.flashAmt *= 0.8;
            g.flash.alpha = g.flashAmt * 0.65;

            if (g.aura && g.look.aura) {
              const on = g.targetAlpha > 0.5;
              g.aura.alpha = on ? 1 : 0;
              if (on) drawAura(g.aura, g.look.aura.kind, g.look.aura.color, g.half * 0.95, clock / 1000);
            }

            // frozen: a pale ring plus three shards orbiting the unit
            if (clock < g.stunnedUntilMs && g.targetAlpha > 0.5) {
              g.stun.clear();
              const r = g.half * 0.95;
              g.stun.circle(0, 0, r).stroke({ width: 2, color: 0x9fe6ff, alpha: 0.5 });
              for (let i = 0; i < 3; i++) {
                const a = clock / 320 + (i * Math.PI * 2) / 3;
                g.stun
                  .circle(Math.cos(a) * r, Math.sin(a) * r * 0.5 - g.half * 0.5, 3)
                  .fill({ color: 0xdff6ff, alpha: 0.9 });
              }
            } else {
              g.stun.clear();
            }
          }

          // --- projectiles ---
          for (let i = shots.length - 1; i >= 0; i--) {
            const p = shots[i]!;
            p.t += dt / p.dur;
            const target = gfxByUid.get(p.targetUid);
            const tx = target ? target.container.x : p.x0;
            const ty = target ? target.container.y : p.y0;
            const u = Math.min(1, p.t);
            /*
             * A flat shot picks up speed on the way — it was perfectly
             * linear, which is the one thing nothing ever thrown does — and
             * a lobbed one keeps its even pace, because an arc reads as
             * weight only if it hangs.
             */
            const travel = p.arc > 0 ? u : u * u * 0.35 + u * 0.65;
            p.g.x = p.x0 + (tx - p.x0) * travel;
            // a lob rises and falls on the way over
            p.g.y = p.y0 + (ty - p.y0) * travel - Math.sin(travel * Math.PI) * p.arc;
            p.trail -= dt;
            if (p.trail <= 0 && u < 0.95) {
              p.trail = 26;
              spawnParticles(p.g.x, p.g.y, p.look.color, 1, 0.01, { size: p.size * 0.42 });
            }
            // Swells through the last fifth of the flight: the hit is coming.
            const near = u > 0.8 ? 1 + (u - 0.8) * 2.2 : 1;
            drawProjectile(
              p.g,
              p.look,
              p.spin > 0 ? (clock / 1000) * p.spin : Math.atan2(ty - p.y0, tx - p.x0),
              p.phase + clock / 100,
              p.size * near,
            );
            if (p.t >= 1) {
              if (target) landHit(target, p.x0, p.y0, p.look, p.damage, p.edge);
              p.g.destroy();
              shots.splice(i, 1);
            }
          }

          // --- debris ---
          for (let i = particles.length - 1; i >= 0; i--) {
            const q = particles[i]!;
            q.g.x += q.vx * dt;
            q.g.y += q.vy * dt;
            q.vy += q.gravity * dt;
            q.life -= dt / 620;
            q.g.alpha = Math.max(0, q.life);
            q.g.scale.set(Math.max(0.1, q.life));
            if (q.life <= 0) {
              q.g.destroy();
              particles.splice(i, 1);
            }
          }

          // --- expanding rings ---
          for (let i = rings.length - 1; i >= 0; i--) {
            const r = rings[i]!;
            r.life -= dt / r.ms;
            const u = 1 - Math.max(0, r.life);
            r.g.clear();
            r.g
              .circle(0, 0, r.from + (r.to - r.from) * u)
              .stroke({ width: r.width, color: r.color, alpha: Math.max(0, r.life) * 0.9 });
            if (r.life <= 0) {
              r.g.destroy();
              rings.splice(i, 1);
            }
          }

          for (let i = floaters.length - 1; i >= 0; i--) {
            const f = floaters[i]!;
            f.text.y -= dt * 0.03;
            f.life -= dt / 700;
            f.text.alpha = Math.max(0, f.life);
            if (f.life <= 0) {
              f.text.destroy();
              floaters.splice(i, 1);
            }
          }
        });

        const playbackMs = frames.length * msPerFrame;
        /*
         * ═══ EVERY ENDING SAYS WHY, INCLUDING THE GOOD ONE ═══
         *
         * This used to hold only when `winReason !== "kingDown"`, so the
         * ending the whole game is ABOUT — a crown coming down — was the one
         * with nothing on the screen: the board just collapsed. Or asked for
         * all three, *"before you get to the end"*, and he is right that the
         * king is the one most worth saying out loud.
         *
         * ═══ AND IT USED TO SAY IT BEFORE IT HAPPENED ═══
         *
         * Or: *"a message comes up saying the king is dead two seconds
         * before the battle ends, and only afterwards the clock runs out and
         * I see him explode."*
         *
         * Two clocks, and they do not run at the same speed. The replay
         * advances by `elapsed`, which STOPS during a hit-stop — `freezeMs`
         * holds the picture still for 70ms on every telling blow, which is
         * what gives a hit its weight. These three moments were
         * `window.setTimeout`, which knows nothing about that and counts
         * wall time regardless.
         *
         * So every hit-stop in the battle pushed the picture further behind
         * the timers, and by the end of a long fight the gap is the sum of
         * all of them — twenty or thirty blows, a second or two. The
         * announcement fired on time by the wall and early by the board: the
         * words arrived, THEN the clock ran out, THEN the king fell. Exactly
         * backwards, and the one ordering the whole screen is about.
         *
         * They are marks on the replay's own clock now. There is only one
         * clock, so nothing can run ahead of the thing it is announcing.
         */
        const holdMs = VERDICT_MS;

        /*
         * ═══ AND A BATTLE STILL HAS TO END ═══
         *
         * The timers above were wrong about WHEN, and right about one thing:
         * they always fired. The ticker does not — a hidden tab gets no
         * animation frames at all, so a player who switches away mid-battle
         * and never comes back would sit in a match that cannot finish.
         *
         * So one backstop, at ten seconds past the longest this can honestly
         * take. It is not the normal path and must never beat it, which is
         * what the margin is for; `finishedRef` means whichever arrives
         * first is the only one that counts.
         */
        timers.push(
          window.setTimeout(
            () => {
              if (disposed || finishedRef.current) return;
              finishedRef.current = true;
              onFinish();
            },
            playbackMs + holdMs + FINALE_MS + 10_000,
          ),
        );
      })
      .catch((err: unknown) => {
        // WebGL refused, a texture blew up, anything. Do not leave the player
        // on a blank screen in a match that can never end — but DO keep the
        // reason, or the next report is as untraceable as the last one.
        const reason = err instanceof Error ? err.message : String(err);
        console.error("[arena] could not start:", err);
        /*
         * A chunk that cannot be fetched is not a graphics problem, it is a
         * page holding file names a deploy has deleted. The battle is
         * already decided and the skip below takes the player to the result
         * with everything they earned — but the PAGE is broken for every
         * lazy screen, so it is flagged for repair at the next safe moment.
         * See game/staleBuild.ts.
         */
        if (looksLikeAMovedBuild(err)) markStale();
        if (!disposed) {
          setWhy(reason.slice(0, 120));
          setFailed(true);
        }
      });

    /*
     * A watchdog for every way this can fail that we have not thought of.
     *
     * It asks the only question that matters to the player: is there anything
     * on the screen? Testing an `initialized` flag instead was not enough —
     * in a browser with WebGL switched off, init resolved and the flag went
     * true, but no canvas was ever attached and the arena stayed empty.
     */
    timers.push(
      window.setTimeout(() => {
        if (disposed) return;
        if (!hostRef.current?.querySelector("canvas")) {
          setWhy(tf("sb672b2e", "נתקע אחרי {0} שניות בלי ציור", STARTUP_GRACE_MS / 1000));
          setFailed(true);
        }
      }, STARTUP_GRACE_MS),
    );

    return () => {
      disposed = true;
      for (const t of timers) window.clearTimeout(t);
      if (initialized) app.destroy(true, { children: true });
    };
  }, [result, onFinish]);

  // The result was already computed before this component mounted, so skipping
  // the animation costs the replay and nothing else. Offer the way out, and
  // take it automatically for anyone who does not know to press it.
  useEffect(() => {
    if (!failed) return;
    const t = window.setTimeout(() => {
      if (!finishedRef.current) {
        finishedRef.current = true;
        onFinish();
      }
    }, SKIP_AFTER_MS);
    return () => window.clearTimeout(t);
  }, [failed, onFinish]);

  if (failed) {
    return (
      <div className="arena arena--failed" role="alert">
        <div className="arena__oops">🙈</div>
        <p>{t("sbaf8bec", "לא הצלחתי להראות לך את הקרב.")}</p>
        <p className="arena__sub">{t("se051373", "הוא כבר הוכרע — אני לוקחת אותך לתוצאה.")}</p>
        {/* Small, and in the corner: a child does not need it, and the one
            person who does need it cannot ask for it if it is not written. */}
        {why && <p className="arena__why">({why})</p>}
        <button
          className="btn-fight"
          onClick={() => {
            if (finishedRef.current) return;
            finishedRef.current = true;
            onFinish();
          }}
        >
          {t("s54733fd", "קדימה לתוצאה")}
        </button>
      </div>
    );
  }

  /*
   * ⚠ THE FRAME CARRIES THE SHAPE, BECAUSE A PERCENTAGE NEEDS SOMETHING TO
   * BE A PERCENTAGE OF.
   *
   * `.arena canvas { max-height: 100% }` has been in battle.css since Or
   * said *"I only saw my side of the fight"* about the co-op battle, and it
   * never did anything: `.arena` is a content-sized box, so a percentage
   * height inside it does not resolve and the canvas kept its intrinsic
   * size. Measured on a 384-tall screen in 2v2 — the frame was correctly
   * capped at 332px and the canvas inside it was 602, with 265 pixels of the
   * battle below the bottom of the screen and clipped away.
   *
   * An aspect-ratio makes the frame's height DEFINITE (derived from its
   * width), which is what the canvas's percentage needed all along. It is
   * set here rather than in the sheet because only this component knows how
   * many lanes this battle has.
   */
  return (
    <div
      className="arena"
      ref={hostRef}
      style={{ ["aspectRatio" as string]: `${W} / ${H}` }}
    />
  );
}
