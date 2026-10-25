import { useEffect, useRef, useState } from "react";
import { spriteFor } from "../game/skins";
import { looksLikeAMovedBuild, markStale } from "../game/staleBuild";
import { Application, Assets, Container, Graphics, Sprite, Text, Texture } from "pixi.js";
import { ARENA, SIMULATION, type PlayerCard } from "@amanda/shared";
import type { BattleResult, EndedBy, FrameUnit, Owner } from "@amanda/engine";
import { cardColor, CATALOG } from "../data/catalog";
import { seriesColor } from "../data/cardMeta";
import { sfx } from "../game/sfx";
import { combatLook, drawAura, drawProjectile, type CombatLook } from "./arenaFx";
import { line as t, lineF as tf } from "../game/copy";
import { say } from "../game/lang";

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
const POP_ISOLATE = "\u2069";

function rtl(text: string): string {
  return RTL_ISOLATE + text + POP_ISOLATE;
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

/**
 * The mark beside the words. A glyph rather than an icon because this is
 * drawn into a canvas, where the game's own icon set does not reach.
 */
const END_MARKS: Record<EndedBy, string> = {
  king: "♛",
  time: "⏱",
  deadEnd: "✖",
};

/** How long "time's up" and the verdict stay on screen before the result. */
const VERDICT_MS = 2600;

const cx = (col: number): number => (col + 0.5) * CELL;
const cy = (lane: number): number => HEAD + (lane + 0.5) * CELL;
const laneCenter = (lanes: number[]): number => lanes.reduce((s, l) => s + l, 0) / lanes.length;

interface UnitGfx {
  /** Positioned from the replay frame — never touched by the effects. */
  container: Container;
  /** Everything visible. Carries the lunge, recoil and shake offsets. */
  art: Container;
  hp: Graphics;
  /** White overlay that pops when the unit is struck. */
  flash: Graphics;
  /** Ground ring for units that project an aura. */
  aura: Graphics | null;
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
interface Burst {
  g: Graphics;
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
}

export function Arena({
  result,
  onFinish,
  flip = false,
  verdict,
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
  /** One sentence saying how the match was decided, shown when the clock runs out. */
  verdict?: string;
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
    /** The losing board, falling one rank at a time. See triggerFinale. */
    const collapse: Array<{ at: number; g: UnitGfx; king: boolean }> = [];
    const timers: number[] = [];
    const app = new Application();
    const gfxByUid = new Map<string, UnitGfx>();
    const uidByGfx = new Map<UnitGfx, string>();
    const floaters: Floater[] = [];
    const bursts: Burst[] = [];
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
      const w = (fu.isKing ? 2 : 1) * CELL * 0.88;

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
        sprite.scale.set(w / tex.width); // portrait art → fills width, top-aligned
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
        // A card name is Hebrew, and a canvas does not know that. See rtl().
        text: rtl(name),
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
      };
      gfxByUid.set(fu.uid, g);
      uidByGfx.set(g, fu.uid);
      return g;
    }

    function applyFrame(units: FrameUnit[]): void {
      for (const fu of units) {
        const g = gfxByUid.get(fu.uid) ?? drawUnit(fu);
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

    function spawnDamage(g: UnitGfx, amount: number, edge = 1): void {
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
      const mark = strong ? " ×1.5" : "";
      const t = new Text({
        text: `-${amount}${mark}`,
        style: {
          fontFamily: "Segoe UI, sans-serif",
          fontSize: Math.round(13 + heftOf(g, amount) * 9),
          fill: strong ? 0xffd166 : weak ? 0xb9c0cf : 0xff6b6b,
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
    ): void {
      const g = new Graphics();
      g.x = x;
      g.y = y;
      fxLayer.addChild(g);
      rings.push({ g, life: 1, color, from, to, width });
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

    function spawnBurst(x: number, y: number): void {
      const g = new Graphics();
      g.x = x;
      g.y = y;
      fxLayer.addChild(g);
      bursts.push({ g, life: 1 });
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
    ): void {
      const heft = heftOf(target, damage);
      const strong = edge > 1.01;
      const weak = edge < 0.99;
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
      spawnDamage(target, damage, edge);
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
            // direction they typed it. See rtl().
            text: rtl(who?.nickname ?? fallback),
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

        // The end-of-time announcement: "time is up", then how it was decided.
        const announce = new Container();
        announce.alpha = 0;
        const annBg = new Graphics();
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
        const annTitle = new Text({
          text: rtl((END_MARKS[endedBy] ?? "") + " " + (END_WORDS[endedBy] ?? END_WORDS.time)()),
          style: {
            fontFamily: "Segoe UI, sans-serif",
            fontSize: Math.round(Math.min(56, W / 11)),
            fill: 0xffd36b,
            fontWeight: "900",
          },
        });
        annTitle.anchor.set(0.5);
        const annBody = new Text({
          text: verdict ? rtl(verdict) : "",
          style: {
            fontFamily: "Segoe UI, sans-serif",
            fontSize: 13,
            fill: 0xe7ecf5,
            fontWeight: "600",
            align: "center",
            wordWrap: true,
            wordWrapWidth: W - 80,
          },
        });
        annBody.anchor.set(0.5);
        annTitle.y = -Math.round(annTitle.height * 0.22);
        annBody.y = Math.round(annTitle.height * 0.5) + 14;
        const annH = Math.round(annTitle.height + 56);
        annBg
          .roundRect(-W / 2 + 28, -annH / 2, W - 56, annH, 14)
          .fill({ color: 0x080c16, alpha: 0.92 })
          .roundRect(-W / 2 + 28, -annH / 2, W - 56, annH, 14)
          .stroke({ width: 2, color: 0xffd36b, alpha: 0.7 });
        announce.addChild(annBg, annTitle, annBody);
        announce.x = W / 2;
        announce.y = HEAD + (H - HEAD) / 2;
        uiLayer.addChild(announce);

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
              actor.pulse = 1;
              if (actor.look.attack === "lunge" && target) {
                // Melee: throw the body half a unit at whatever it is hitting.
                const dx = target.container.x - actor.container.x;
                const dy = target.container.y - actor.container.y;
                const d = Math.hypot(dx, dy) || 1;
                actor.offX = (dx / d) * actor.half * 0.5;
                actor.offY = (dy / d) * actor.half * 0.5;
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
                landHit(target, from.container.x, from.container.y, from.look, damage, ev.edge);
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

          // The clock reads from the replay position, so it can never drift
          // away from what is actually happening on the field.
          const totalSec = frames.length / SIMULATION.ticksPerSecond;
          const leftSec = Math.max(0, totalSec - elapsed / 1000);
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
          // Once the clock is out, say so and say what decided it.
          if (timeUp) announce.alpha += (1 - announce.alpha) * Math.min(1, dt / 180);

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

          // --- the losing board, going down in a wave ---
          while (collapse.length && collapse[0]!.at <= clock) {
            const { g, king } = collapse.shift()!;
            g.container.alpha = 1;
            g.exploding = true;
            deathBurst(g);
            // One shockwave, for the one death the battle was about.
            if (king) spawnBurst(g.container.x, g.container.y);
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
                  if (was >= 0 && now < 0 && g.look.weight > 0.5)
                    g.shake = Math.max(g.shake, 0.45);
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
            r.life -= dt / 380;
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
          for (let i = bursts.length - 1; i >= 0; i--) {
            const b = bursts[i]!;
            b.life -= dt / FINALE_MS;
            const r = (1 - b.life) * 60;
            b.g.clear();
            b.g.circle(0, 0, r).stroke({ width: 4, color: 0xffcc44, alpha: Math.max(0, b.life) });
            b.g.circle(0, 0, r * 0.6).fill({ color: 0xffffff, alpha: Math.max(0, b.life * 0.5) });
            if (b.life <= 0) {
              b.g.destroy();
              bursts.splice(i, 1);
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
         */
        const holdMs = VERDICT_MS;
        timers.push(
          window.setTimeout(() => {
            timeUp = true;
            // The clock sting belongs to the clock. A crown falling has the
            // battle's own noise behind it already.
            if (endedBy !== "king") sfx.play("timeUp");
          }, playbackMs),
        );
        timers.push(window.setTimeout(() => triggerFinale(lastUnits), playbackMs + holdMs));
        timers.push(
          window.setTimeout(() => {
            if (!finishedRef.current) {
              finishedRef.current = true;
              onFinish();
            }
          }, playbackMs + holdMs + FINALE_MS),
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
  }, [result, onFinish, verdict]);

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

  return <div className="arena" ref={hostRef} />;
}
