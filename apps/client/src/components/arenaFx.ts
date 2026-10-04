import { Graphics } from "pixi.js";
import type { AbilityType } from "@amanda/shared";
import { CATALOG } from "../data/catalog";
import { ELEMENT_META, seriesColor } from "../data/cardMeta";

/** A hex colour string from the card metadata as a Pixi number. */
function hex(value: string): number {
  return Number.parseInt(value.replace("#", ""), 16);
}

/** Lighten a colour toward white — used for the glow half of every effect. */
function lighten(color: number, amount: number): number {
  const r = (color >> 16) & 0xff;
  const g = (color >> 8) & 0xff;
  const b = color & 0xff;
  const mix = (c: number) => Math.round(c + (255 - c) * amount);
  return (mix(r) << 16) | (mix(g) << 8) | mix(b);
}

/** The silhouette a ranged attack flies as. Driven by the unit's element. */
export type ProjectileShape = "orb" | "shard" | "bolt" | "rock" | "blob" | "gust" | "spark";

const SHAPE_BY_ELEMENT: Record<string, ProjectileShape> = {
  fire: "orb",
  water: "shard",
  earth: "rock",
  air: "gust",
  electric: "bolt",
  metal: "shard",
  light: "spark",
  dark: "orb",
  poison: "blob",
  variable: "spark",
};

export type AuraKind = "heal" | "armor" | "haste" | "slow";

/** Which supportive abilities deserve a permanent ring under the unit. */
const AURA_BY_ABILITY: Partial<Record<AbilityType, AuraKind>> = {
  healAura: "heal",
  regen: "heal",
  armorAura: "armor",
  damageReductionAura: "armor",
  attackSpeedAura: "haste",
  slowAura: "slow",
};

const AURA_COLOR: Record<AuraKind, number> = {
  heal: 0x5ad25a,
  armor: 0x7fa8d9,
  haste: 0xf2c530,
  slow: 0x4fd6d0,
};

/**
 * How one card fights, derived from the data it already carries. Element picks
 * the colour and the shape of what it throws, range decides whether it lunges or
 * shoots, its auras decide what glows under it, and the series decides what
 * colour it bursts into when it dies — so no two families fight alike without
 * anyone hand-authoring 30 animations.
 */
export interface CombatLook {
  attack: "lunge" | "projectile";
  shape: ProjectileShape;
  color: number;
  glow: number;
  /** Flight time of a projectile across one cell, in ms. */
  flightMs: number;
  aura: { kind: AuraKind; color: number } | null;
  flying: boolean;
  /** Colour the unit shatters into — its series, so deaths read as a family. */
  death: number;
}

const FALLBACK: CombatLook = {
  attack: "lunge",
  shape: "orb",
  color: 0xcccccc,
  glow: 0xffffff,
  flightMs: 200,
  aura: null,
  flying: false,
  death: 0x8a93a6,
};

const cache = new Map<string, CombatLook>();

export function combatLook(cardId: string): CombatLook {
  const cached = cache.get(cardId);
  if (cached) return cached;
  const card = CATALOG.get(cardId);
  if (!card) return FALLBACK;

  const element = card.elements[0] ?? "variable";
  const color = hex(ELEMENT_META[element].color);
  const auraKind = card.abilities
    .map((a) => AURA_BY_ABILITY[a.type])
    .find((k): k is AuraKind => k !== undefined);

  const look: CombatLook = {
    attack: card.stats.range === "melee" ? "lunge" : "projectile",
    shape: SHAPE_BY_ELEMENT[element] ?? "orb",
    color,
    glow: lighten(color, 0.55),
    // A sniper's shot snaps across; a lobbed ranged attack has visible travel.
    flightMs: card.stats.range === "sniper" ? 90 : 150,
    aura: auraKind ? { kind: auraKind, color: AURA_COLOR[auraKind] } : null,
    flying: card.flying,
    death: hex(seriesColor(card.seriesId)),
  };
  cache.set(cardId, look);
  return look;
}

/**
 * Draw a projectile into `g`, pointing along `angle`. Redrawn every frame so the
 * shapes can wobble, spin and flicker in flight.
 */
export function drawProjectile(
  g: Graphics,
  look: CombatLook,
  angle: number,
  phase: number,
  size: number,
): void {
  g.clear();
  g.rotation = angle;
  const s = size;
  switch (look.shape) {
    case "orb": {
      g.circle(0, 0, s * 1.6).fill({ color: look.color, alpha: 0.25 });
      g.circle(0, 0, s).fill(look.color);
      g.circle(-s * 0.25, -s * 0.25, s * 0.45).fill(look.glow);
      break;
    }
    case "shard": {
      g.moveTo(s * 1.5, 0)
        .lineTo(0, -s * 0.7)
        .lineTo(-s * 1.1, 0)
        .lineTo(0, s * 0.7)
        .closePath()
        .fill(look.color);
      g.moveTo(s * 1.2, 0).lineTo(0, -s * 0.3).lineTo(-s * 0.5, 0).closePath().fill(look.glow);
      break;
    }
    case "bolt": {
      // A jagged arc that re-rolls each frame, so the lightning crackles.
      const j = () => (Math.sin(phase * 40 + Math.random() * 6) * s) / 2;
      g.moveTo(-s * 1.8, j())
        .lineTo(-s * 0.6, j())
        .lineTo(s * 0.2, j())
        .lineTo(s * 1.8, j())
        .stroke({ width: Math.max(2, s * 0.5), color: look.glow, cap: "round" });
      g.circle(s * 1.6, 0, s * 0.5).fill(look.color);
      break;
    }
    case "rock": {
      g.moveTo(s, -s * 0.2)
        .lineTo(s * 0.3, -s)
        .lineTo(-s * 0.8, -s * 0.6)
        .lineTo(-s, s * 0.4)
        .lineTo(0, s)
        .closePath()
        .fill(look.color);
      g.moveTo(s * 0.3, -s * 0.6).lineTo(-s * 0.3, -s * 0.4).lineTo(0, 0).closePath().fill(look.glow);
      break;
    }
    case "blob": {
      const wob = 1 + Math.sin(phase * 18) * 0.18;
      g.ellipse(0, 0, s * 1.3 * wob, (s * 0.95) / wob).fill(look.color);
      g.circle(-s * 0.3, -s * 0.3, s * 0.3).fill(look.glow);
      g.circle(-s * 1.4, s * 0.2, s * 0.3).fill({ color: look.color, alpha: 0.5 });
      break;
    }
    case "gust": {
      for (let i = 0; i < 3; i++) {
        const off = (i - 1) * s * 0.8;
        g.moveTo(-s * 1.6, off)
          .lineTo(s * 1.4, off * 0.4)
          .stroke({ width: Math.max(1.5, s * 0.35), color: look.glow, alpha: 0.9 - i * 0.2, cap: "round" });
      }
      break;
    }
    case "spark": {
      const r = s * (1 + Math.sin(phase * 25) * 0.12);
      g.moveTo(r * 1.9, 0)
        .lineTo(r * 0.4, r * 0.4)
        .lineTo(0, r * 1.5)
        .lineTo(-r * 0.4, r * 0.4)
        .lineTo(-r * 1.9, 0)
        .lineTo(-r * 0.4, -r * 0.4)
        .lineTo(0, -r * 1.5)
        .lineTo(r * 0.4, -r * 0.4)
        .closePath()
        .fill(look.glow);
      g.circle(0, 0, r * 0.5).fill(look.color);
      break;
    }
  }
}

/** The ring that sits under a unit whose aura is helping (or hurting) others. */
export function drawAura(g: Graphics, kind: AuraKind, color: number, radius: number, phase: number): void {
  g.clear();
  const breathe = 1 + Math.sin(phase * 2.2) * 0.07;
  const r = radius * breathe;
  g.ellipse(0, 0, r, r * 0.42).fill({ color, alpha: 0.13 });
  g.ellipse(0, 0, r, r * 0.42).stroke({ width: 2, color, alpha: 0.55 });
  if (kind === "haste" || kind === "slow") {
    // ticks around the ring spin — fast for haste, backwards and slow for slow
    const dir = kind === "haste" ? 1 : -0.35;
    for (let i = 0; i < 6; i++) {
      const a = phase * 1.8 * dir + (i * Math.PI) / 3;
      g.circle(Math.cos(a) * r, Math.sin(a) * r * 0.42, 2).fill({ color, alpha: 0.8 });
    }
  }
}
