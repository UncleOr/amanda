import { useEffect, useRef, useState } from "react";
import { Application, Assets, Container, Graphics, Sprite, Text, Texture } from "pixi.js";
import { ARENA, SIMULATION } from "@amanda/shared";
import type { BattleResult, FrameUnit, Owner } from "@amanda/engine";
import { cardColor, CATALOG } from "../data/catalog";
import { seriesColor } from "../data/cardMeta";
import { sfx } from "../game/sfx";
import { combatLook, drawAura, drawProjectile, type CombatLook } from "./arenaFx";

const CELL = 72;
/** Header band above the lanes, so the identity banners never cover a unit. */
const HEAD = 26;
const W = ARENA.width * CELL;
/** Four lanes is the ordinary arena; Amanda mode is eight. Per battle. */
const laneCount = (result: { lanes?: number }) => result.lanes ?? ARENA.lanes;
const heightFor = (lanes: number) => lanes * CELL + HEAD;
const OWNER_TINT = { A: 0x4aa3ff, B: 0xff5a5a } as const;
/** Which generated battlefield backdrop to fight on (assets/raw/arena/<id>). */
const BACKDROP = "rift";

/** Series tint as a Pixi colour, so same-family units read as a group. */
function seriesTint(cardId: string): number {
  const id = CATALOG.get(cardId)?.seriesId ?? "";
  return Number.parseInt(seriesColor(id).replace("#", ""), 16);
}

/** Public URL of a card's artwork, or null when it has none yet. */
function artUrlOf(cardId: string): string | null {
  const sprite = CATALOG.get(cardId)?.art.sprite;
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
  /** Phase for the idle bob of flying units. */
  bob: number;
  /** Replay time (ms) until which the unit shows as frozen. */
  stunnedUntilMs: number;
  exploding: boolean;
  dead: boolean;
  half: number;
  owner: Owner;
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
  phase: number;
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
}: {
  result: BattleResult;
  onFinish: () => void;
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
      const rawName = card?.name.he ?? "";

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
        text: name,
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
        bob: Math.random() * Math.PI * 2,
        stunnedUntilMs: 0,
        exploding: false,
        dead: false,
        half: w / 2,
        owner: fu.owner,
      };
      gfxByUid.set(fu.uid, g);
      uidByGfx.set(g, fu.uid);
      return g;
    }

    function applyFrame(units: FrameUnit[]): void {
      for (const fu of units) {
        const g = gfxByUid.get(fu.uid) ?? drawUnit(fu);
        g.container.x = fx(fu.col);
        g.container.y = cy(laneCenter(fu.lanes));
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

    function spawnDamage(g: UnitGfx, amount: number): void {
      if (amount <= 0) return;
      const t = new Text({
        text: `-${amount}`,
        style: {
          fontFamily: "Segoe UI, sans-serif",
          fontSize: 15,
          fill: 0xff6b6b,
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

    function spawnParticles(
      x: number,
      y: number,
      color: number,
      count: number,
      speed: number,
      opts: { gravity?: number; size?: number } = {},
    ): void {
      for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2;
        const v = speed * (0.4 + Math.random() * 0.8);
        const size = (opts.size ?? 3) * (0.5 + Math.random());
        const g = new Graphics();
        g.circle(0, 0, size).fill(color);
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

    function spawnBurst(x: number, y: number): void {
      const g = new Graphics();
      g.x = x;
      g.y = y;
      fxLayer.addChild(g);
      bursts.push({ g, life: 1 });
    }

    /** The strike itself: flash, recoil, sparks and the damage number. */
    function landHit(
      target: UnitGfx,
      fromX: number,
      fromY: number,
      look: CombatLook,
      damage: number,
    ): void {
      target.flashAmt = 1;
      target.shake = 1;
      const dx = target.container.x - fromX;
      const dy = target.container.y - fromY;
      const d = Math.hypot(dx, dy) || 1;
      // Recoil away from whatever hit it.
      target.offX += (dx / d) * 7;
      target.offY += (dy / d) * 7;
      spawnParticles(
        target.container.x - (dx / d) * target.half * 0.6,
        target.container.y - (dy / d) * target.half * 0.6,
        look.glow,
        6,
        0.14,
        { size: 2.5 },
      );
      spawnRing(
        target.container.x,
        target.container.y,
        look.color,
        target.half * 0.35,
        target.half * 1.1,
        2,
      );
      spawnDamage(target, damage);
    }

    function fireProjectile(from: UnitGfx, target: UnitGfx, damage: number): void {
      const g = new Graphics();
      fxLayer.addChild(g);
      const dist = Math.hypot(
        target.container.x - from.container.x,
        target.container.y - from.container.y,
      );
      const lobbed = from.look.shape === "rock" || from.look.shape === "blob";
      shots.push({
        g,
        x0: from.container.x,
        y0: from.container.y,
        targetUid: uidByGfx.get(target) ?? "",
        look: from.look,
        t: 0,
        dur: Math.max(80, (dist / CELL) * from.look.flightMs),
        // A lobbed rock or blob travels in an arc; bolts and shards fly flat.
        arc: lobbed ? Math.min(26, dist * 0.12) : 0,
        damage,
        phase: Math.random() * 10,
      });
    }

    function triggerFinale(units: FrameUnit[]): void {
      finaleStarted = true;
      const loser = result.winner === "A" ? "B" : result.winner === "B" ? "A" : null;
      if (!loser) return; // a draw does not collapse a board
      sfx.play("explode");
      for (const fu of units) {
        if (fu.owner !== loser) continue;
        if (!fu.alive && !fu.isKing) continue; // collapse the survivors + the King
        const g = gfxByUid.get(fu.uid);
        if (!g) continue;
        g.container.alpha = 1;
        g.exploding = true;
        spawnBurst(g.container.x, g.container.y);
      }
    }

    void app
      .init({
        width: W,
        height: H,
        background: "#0e1220",
        antialias: true,
        resolution: window.devicePixelRatio || 1,
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

        const [bgTexture] = await Promise.all([
          inTime(
            Assets.load(`${import.meta.env.BASE_URL}arena/${BACKDROP}.webp`) as Promise<Texture>,
          ),
          urls.length ? inTime(Assets.load(urls)) : Promise.resolve(null),
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
        const banner = (text: string, x: number, color: number) => {
          const t = new Text({
            text,
            style: {
              fontFamily: "Segoe UI, sans-serif",
              fontSize: 15,
              fill: color,
              fontWeight: "800",
            },
          });
          t.anchor.set(0.5, 0.5);
          t.x = x;
          t.y = HEAD / 2;
          uiLayer.addChild(t);
        };
        banner("🧑 אתה", W * 0.25, localTint);
        banner("🤖 היריב", W * 0.75, oppTint);

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
        const annTitle = new Text({
          text: "⏱ נגמר הזמן!",
          style: {
            fontFamily: "Segoe UI, sans-serif",
            fontSize: 26,
            fill: 0xffd36b,
            fontWeight: "800",
          },
        });
        annTitle.anchor.set(0.5);
        const annBody = new Text({
          text: verdict ?? "",
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
        annTitle.y = -18;
        annBody.y = 16;
        const annH = 90;
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
                fireProjectile(actor, target, damage);
              } else {
                const from = actor ?? target;
                landHit(target, from.container.x, from.container.y, from.look, damage);
              }
              return;
            }
            case "death": {
              const g = actor ?? target;
              if (!g || g.dead) return;
              g.dead = true;
              spawnParticles(g.container.x, g.container.y, g.look.death, 14, 0.22, { size: 3.5 });
              spawnParticles(g.container.x, g.container.y, 0x1a1f2e, 8, 0.12, {
                size: 5,
                gravity: -0.0002,
              });
              spawnRing(g.container.x, g.container.y, g.look.death, g.half * 0.4, g.half * 1.8, 3);
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
          elapsed += dt;
          clock = elapsed;
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

          // --- units: lunge spring, hit flash, shake, bob, aura, frost ---
          for (const g of gfxByUid.values()) {
            if (g.exploding) {
              g.container.alpha += (0 - g.container.alpha) * k * 1.4;
              const s = g.container.scale.x + (2.1 - g.container.scale.x) * k * 1.4;
              g.container.scale.set(s);
              continue;
            }
            g.container.alpha += (g.targetAlpha - g.container.alpha) * k;
            const s = (g.targetAlpha < 0.5 ? 0.6 : 1) + g.pulse * 0.18;
            g.container.scale.set(g.container.scale.x + (s - g.container.scale.x) * k);
            g.pulse *= 0.82;

            // the lunge / recoil springs back toward rest
            const decay = 1 - Math.min(1, k * 1.1);
            g.offX *= decay;
            g.offY *= decay;
            g.shake *= 0.84;
            const shakeAmp = g.shake * 3;
            g.bob += dt * 0.004;
            const bobY = g.look.flying && g.targetAlpha > 0.5 ? Math.sin(g.bob) * 3 : 0;
            g.art.x = g.offX + (Math.random() - 0.5) * shakeAmp;
            g.art.y = g.offY + bobY + (Math.random() - 0.5) * shakeAmp;

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
            p.g.x = p.x0 + (tx - p.x0) * u;
            // a lob rises and falls on the way over
            p.g.y = p.y0 + (ty - p.y0) * u - Math.sin(u * Math.PI) * p.arc;
            drawProjectile(p.g, p.look, Math.atan2(ty - p.y0, tx - p.x0), p.phase + clock / 100, 5);
            if (p.t >= 1) {
              if (target) landHit(target, p.x0, p.y0, p.look, p.damage);
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
        // A fight that went the distance gets the clock-out announcement before
        // the board collapses; one that ended on a King going down does not.
        const ranOutOfTime = result.winReason !== "kingDown";
        const holdMs = ranOutOfTime ? VERDICT_MS : 0;
        if (ranOutOfTime)
          timers.push(
            window.setTimeout(() => {
              timeUp = true;
              sfx.play("timeUp");
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
      .catch(() => {
        // WebGL refused, a texture blew up, anything. Do not leave the player
        // on a blank screen in a match that can never end.
        if (!disposed) setFailed(true);
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
        if (!hostRef.current?.querySelector("canvas")) setFailed(true);
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
        <p>לא הצלחתי להראות לך את הקרב.</p>
        <p className="arena__sub">הוא כבר הוכרע — אני לוקחת אותך לתוצאה.</p>
        <button
          className="btn-fight"
          onClick={() => {
            if (finishedRef.current) return;
            finishedRef.current = true;
            onFinish();
          }}
        >
          קדימה לתוצאה
        </button>
      </div>
    );
  }

  return <div className="arena" ref={hostRef} />;
}
