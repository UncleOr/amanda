/**
 * Post-battle analysis.
 *
 * `runBattle` already records every meaningful thing that happened; this turns
 * that raw event stream into something a person — or a strategy tuner — can
 * reason about: who actually did the work, who was dead weight, which lane gave
 * way, and whether the board was built well.
 *
 * It is pure and headless like the rest of the engine, and emits typed finding
 * CODES rather than sentences, so the UI can phrase them and a tuning script can
 * count them.
 */
import { SIMULATION } from "@amanda/shared";
import type { Card } from "@amanda/shared";
import type { BattleEvent, BattleResult, Owner, Unit } from "./types.js";

/** What one unit did with its time in the arena. */
export interface UnitReport {
  uid: string;
  cardId: string;
  /** Hebrew display name, copied so consumers need no catalog lookup. */
  name: string;
  owner: Owner;
  seriesId: string;
  isKing: boolean;
  maxHp: number;
  /** Lane it started the battle in. */
  lane: number;
  /** Board column it started in, 0 = back row, 3 = front row (own board). */
  startX: number;
  /**
   * Columns it actually advanced across the arena. 0 means it never moved —
   * either it is a static card, or nothing ever reached it.
   */
  colsMoved: number;
  damageDealt: number;
  damageTaken: number;
  /** Enemies this unit landed the killing blow on. */
  kills: number;
  /** Attacks it actually landed. */
  hits: number;
  survived: boolean;
  /** Tick it died on, or null if it was still standing at the end. */
  diedAtTick: number | null;
}

export interface SideReport {
  owner: Owner;
  damageDealt: number;
  kills: number;
  losses: number;
  survivors: number;
  /** Units that never dealt a single point of damage. */
  idle: number;
  units: UnitReport[];
}

/**
 * One readable beat of the battle. `tick` is engine time; the UI divides by the
 * tick rate to show seconds.
 */
export interface TimelineEntry {
  tick: number;
  kind:
    | "firstBlood"
    | "kill"
    | "kingDown"
    | "reflected"
    | "split"
    | "reveal"
    | "freeze"
    | "end";
  owner?: Owner;
  /** Acting unit's display name, where there is one. */
  actor?: string;
  target?: string;
  damage?: number;
}

/**
 * A judgement about the battle. Codes, not sentences — the client writes the
 * Hebrew and a balance script can tally them across thousands of matches.
 */
export type FindingCode =
  | "mvp"
  | "deadWeight"
  | "kingCarried"
  | "kingFellEarly"
  | "laneCollapse"
  | "overkill"
  | "wipe"
  | "closeCall"
  | "outnumbered"
  | "backRowIdle"
  | "diedToThorns";

export interface Finding {
  code: FindingCode;
  owner: Owner;
  /** Unit this is about, when it is about one. */
  uid?: string;
  name?: string;
  lane?: number;
  /** The number that justifies the finding (damage, a count, a percentage). */
  value?: number;
}

/**
 * How well a side played, 1 to 10, and what went into it.
 *
 * A win is not a win is not a win: taking a board apart in eight seconds
 * without losing anything is a different performance from scraping through on
 * the clock, and the score should say so. Losing caps the score, because the
 * board did not do its job — but a close, hard-fought loss still scores well
 * above a collapse.
 */
export interface Grade {
  /** 1 (dismal) to 10 (flawless). */
  score: number;
  /** The parts it is made of, each 0..1, for showing the player why. */
  parts: {
    /** Did you win, and how decisively. */
    outcome: number;
    /** How quickly it was settled. */
    speed: number;
    /** Damage you dealt against damage you took. */
    trade: number;
    /** How much of your board actually fought. */
    participation: number;
    /** How much of your board was still standing. */
    survival: number;
  };
}

export interface BattleReport {
  winner: Owner | null;
  ticks: number;
  totalDamage: number;
  totalDeaths: number;
  sides: Record<Owner, SideReport>;
  /** A 1-10 mark for each side's performance. */
  grades: Record<Owner, Grade>;
  timeline: TimelineEntry[];
  findings: Finding[];
}

const OWNERS: Owner[] = ["A", "B"];
/** Each player's board is 4 wide; side B is mirrored into the far half. */
const BOARD_WIDTH = 4;

/** Arena column back to the owner's own board column (0 = back, 3 = front). */
function toBoardX(owner: Owner, col: number): number {
  const x = owner === "A" ? col : BOARD_WIDTH * 2 - 1 - col;
  return Math.max(0, Math.min(BOARD_WIDTH - 1, Math.round(x)));
}

/**
 * The auto-filler card dropped into every empty slot when a board locks. It is
 * not a choice the player made, so it counts toward damage and losses but stays
 * out of the narrative — otherwise a dozen of them dying in the first half
 * second buries everything that actually mattered.
 */
export const FILLER_CARD_ID = "crumb_demon";

function emptySide(owner: Owner): SideReport {
  return { owner, damageDealt: 0, kills: 0, losses: 0, survivors: 0, idle: 0, units: [] };
}

/**
 * Build the report. `units` is `result.finalUnits`, which carries the identity
 * and starting shape of everything that took the field.
 */
export function buildReport(
  result: BattleResult,
  catalog: Map<string, Card>,
  opts: { fillerCardId?: string } = {},
): BattleReport {
  const filler = opts.fillerCardId ?? FILLER_CARD_ID;
  const byUid = new Map<string, UnitReport>();

  for (const u of result.finalUnits) {
    byUid.set(u.uid, {
      uid: u.uid,
      cardId: u.cardId,
      name: u.name.he,
      owner: u.owner,
      seriesId: u.seriesId,
      isKing: u.isKing,
      maxHp: u.maxHp,
      lane: u.lanes[0] ?? 0,
      startX: 0,
      colsMoved: 0,
      damageDealt: 0,
      damageTaken: 0,
      kills: 0,
      hits: 0,
      survived: u.alive,
      diedAtTick: null,
    });
  }

  // Starting board positions come from the tick-0 spawn events, and how far
  // each unit travelled comes from the recorded frames (when they were kept).
  const startCol = new Map<string, number>();
  for (const ev of result.events) {
    if (ev.type !== "spawn" || !ev.uid || ev.col === undefined) continue;
    startCol.set(ev.uid, ev.col);
    const u = byUid.get(ev.uid);
    if (u) u.startX = toBoardX(u.owner, ev.col);
  }
  for (const frame of result.frames) {
    for (const fu of frame.units) {
      const u = byUid.get(fu.uid);
      const from = startCol.get(fu.uid);
      if (!u || from === undefined) continue;
      const moved = Math.abs(fu.col - from);
      if (moved > u.colsMoved) u.colsMoved = Math.round(moved * 10) / 10;
    }
  }

  /** Units that took serious damage from their own attacks bouncing back. */
  const reflectedOnto = new Map<string, number>();
  const timeline: TimelineEntry[] = [];
  /** Who hit each unit last — that is who gets credited with the kill. */
  const lastAttacker = new Map<string, string>();
  let firstBloodSeen = false;

  for (const ev of result.events) {
    switch (ev.type) {
      case "hit": {
        const dmg = ev.damage ?? 0;
        // Thorns killing the attacker is the kind of thing a player has to be
        // told about, or the death looks like it came from nowhere.
        if (ev.reflected && ev.targetUid) {
          reflectedOnto.set(ev.targetUid, (reflectedOnto.get(ev.targetUid) ?? 0) + dmg);
          const hurt = byUid.get(ev.targetUid);
          const thorns = ev.uid ? byUid.get(ev.uid) : undefined;
          if (hurt && dmg >= hurt.maxHp * 0.25)
            timeline.push({
              tick: ev.tick,
              kind: "reflected",
              owner: hurt.owner,
              actor: thorns?.name,
              target: hurt.name,
              damage: dmg,
            });
        }
        const actor = ev.uid ? byUid.get(ev.uid) : undefined;
        const target = ev.targetUid ? byUid.get(ev.targetUid) : undefined;
        if (actor) {
          actor.damageDealt += dmg;
          actor.hits += 1;
        }
        if (target) target.damageTaken += dmg;
        if (ev.uid && ev.targetUid) lastAttacker.set(ev.targetUid, ev.uid);
        break;
      }
      case "death": {
        const dead = ev.uid ? byUid.get(ev.uid) : undefined;
        if (!dead) break;
        dead.survived = false;
        dead.diedAtTick = ev.tick;
        const killerUid = lastAttacker.get(dead.uid);
        const killer = killerUid ? byUid.get(killerUid) : undefined;
        // Only credit a kill to the other side — a unit sacrificed by its own
        // ally is a loss, not a kill.
        if (killer && killer.owner !== dead.owner) killer.kills += 1;
        if (dead.cardId !== filler) {
          timeline.push({
            tick: ev.tick,
            kind: dead.isKing ? "kingDown" : firstBloodSeen ? "kill" : "firstBlood",
            owner: dead.owner,
            actor: killer?.name,
            target: dead.name,
          });
          firstBloodSeen = true;
        }
        break;
      }
      case "split": {
        const actor = ev.uid ? byUid.get(ev.uid) : undefined;
        timeline.push({ tick: ev.tick, kind: "split", owner: actor?.owner, actor: actor?.name });
        break;
      }
      case "stun": {
        const target = ev.targetUid ? byUid.get(ev.targetUid) : undefined;
        const actor = ev.uid ? byUid.get(ev.uid) : undefined;
        timeline.push({
          tick: ev.tick,
          kind: "freeze",
          owner: target?.owner,
          actor: actor?.name,
          target: target?.name,
        });
        break;
      }
      case "reveal": {
        const card = ev.revealedCardId ? catalog.get(ev.revealedCardId) : undefined;
        timeline.push({
          tick: ev.tick,
          kind: "reveal",
          owner: ev.owner,
          target: card?.name.he ?? ev.revealedCardId,
        });
        break;
      }
      default:
        break;
    }
  }

  timeline.push({ tick: result.ticks, kind: "end", owner: result.winner ?? undefined });

  const sides: Record<Owner, SideReport> = { A: emptySide("A"), B: emptySide("B") };
  for (const u of byUid.values()) {
    const side = sides[u.owner];
    side.units.push(u);
    side.damageDealt += u.damageDealt;
    side.kills += u.kills;
    // Survivor and loss counts describe the board the player built, so the
    // auto-filler ring is left out of them.
    if (u.cardId !== filler) {
      if (u.survived) side.survivors += 1;
      else side.losses += 1;
      if (u.damageDealt === 0) side.idle += 1;
    }
  }
  for (const owner of OWNERS)
    sides[owner].units.sort((a, b) => b.damageDealt - a.damageDealt);

  return {
    winner: result.winner,
    ticks: result.ticks,
    totalDamage: sides.A.damageDealt + sides.B.damageDealt,
    totalDeaths: sides.A.losses + sides.B.losses,
    sides,
    timeline,
    grades: {
      A: grade(sides, "A", result, filler),
      B: grade(sides, "B", result, filler),
    },
    findings: analyse(sides, result, byUid, filler, reflectedOnto),
  };
}

const clamp01 = (n: number): number => Math.max(0, Math.min(1, n));

/** Mark one side's performance out of ten. */
function grade(
  sides: Record<Owner, SideReport>,
  owner: Owner,
  result: BattleResult,
  filler: string,
): Grade {
  const mine = sides[owner];
  const theirs = sides[owner === "A" ? "B" : "A"];
  const won = result.winner === owner;
  const real = mine.units.filter((u) => u.cardId !== filler);
  const total = Math.max(1, real.length);

  // Winning on a King is the whole point; winning on the clock is scraping it.
  const outcome = won ? (result.winReason === "kingDown" ? 1 : 0.7) : 0;
  // A fast win is a good win; a fast loss is the worst kind.
  const through = result.ticks / Math.max(1, SIMULATION.totalBattleTicks);
  const speed = won ? clamp01(1 - through) : clamp01(through);
  // Did you out-trade them?
  const bothDealt = mine.damageDealt + theirs.damageDealt;
  const trade = bothDealt > 0 ? clamp01(mine.damageDealt / bothDealt) : 0.5;
  // Did the board you built actually fight?
  const participation = clamp01(real.filter((u) => u.hits > 0).length / total);
  // And how much of it came home.
  const survival = clamp01(real.filter((u) => u.survived).length / total);

  const weighted =
    outcome * 0.4 + speed * 0.15 + trade * 0.2 + participation * 0.15 + survival * 0.1;
  // 1..10, and a loss can never reach the top of the scale.
  const capped = won ? weighted : Math.min(weighted, 0.55);
  return {
    score: Math.max(1, Math.min(10, Math.round(capped * 9 + 1))),
    parts: { outcome, speed, trade, participation, survival },
  };
}

/** Everything that is worth telling a player about how their board performed. */
function analyse(
  sides: Record<Owner, SideReport>,
  result: BattleResult,
  byUid: Map<string, UnitReport>,
  filler: string,
  reflectedOnto: Map<string, number>,
): Finding[] {
  const findings: Finding[] = [];
  // Measure against the match's FULL allotted time, not how long it actually
  // ran: a King dying is what ends a battle, so its death tick is always near
  // `result.ticks` and comparing against that could never flag anything.
  const fullTicks = SIMULATION.totalBattleTicks;

  for (const owner of OWNERS) {
    const side = sides[owner];
    const real = side.units.filter((u) => u.cardId !== filler);
    if (!real.length) continue;

    // Who carried the fight.
    const best = real[0]!; // already sorted by damage dealt
    if (best.damageDealt > 0 && best.damageDealt >= side.damageDealt * 0.3)
      findings.push({
        code: best.isKing ? "kingCarried" : "mvp",
        owner,
        uid: best.uid,
        name: best.name,
        value: Math.round((best.damageDealt / Math.max(1, side.damageDealt)) * 100),
      });

    // Cards that contributed nothing at all.
    const idle = real.filter((u) => u.damageDealt === 0 && u.damageTaken === 0);
    if (idle.length >= 2)
      findings.push({ code: "deadWeight", owner, value: idle.length });

    // A back row that never got into the fight means the board was too deep.
    const backRow = real.filter((u) => !u.isKing && u.damageDealt === 0 && u.survived);
    if (backRow.length >= 3)
      findings.push({ code: "backRowIdle", owner, value: backRow.length });

    // The King dying in the first third is what loses matches.
    const king = real.find((u) => u.isKing);
    if (king && king.diedAtTick !== null && king.diedAtTick < fullTicks / 3)
      findings.push({
        code: "kingFellEarly",
        owner,
        uid: king.uid,
        name: king.name,
        value: king.diedAtTick,
      });

    // A lane where everything died is the hole the enemy came through.
    const byLane = new Map<number, UnitReport[]>();
    for (const u of real)
      if (!u.isKing) byLane.set(u.lane, [...(byLane.get(u.lane) ?? []), u]);
    for (const [lane, units] of byLane)
      if (units.length >= 2 && units.every((u) => !u.survived))
        findings.push({ code: "laneCollapse", owner, lane, value: units.length });

    // Everything wiped out.
    if (side.survivors === 0) findings.push({ code: "wipe", owner, value: side.losses });
  }

  // How close it actually was, measured by what was left standing.
  const survA = sides.A.survivors;
  const survB = sides.B.survivors;
  if (result.winner && Math.abs(survA - survB) <= 1)
    findings.push({ code: "closeCall", owner: result.winner, value: Math.abs(survA - survB) });
  else if (result.winner) {
    const margin = result.winner === "A" ? survA - survB : survB - survA;
    if (margin >= 5) findings.push({ code: "outnumbered", owner: result.winner, value: margin });
  }

  // Killed by your own punch coming back at you. Invisible without being told.
  for (const [uid, dmg] of reflectedOnto) {
    const u = byUid.get(uid);
    if (!u || u.survived || dmg < u.maxHp * 0.5) continue;
    findings.push({
      code: "diedToThorns",
      owner: u.owner,
      uid: u.uid,
      name: u.name,
      value: Math.round((dmg / Math.max(1, u.maxHp)) * 100),
    });
  }

  // Damage poured into units that were already dying.
  const overkill = [...byUid.values()]
    .filter((u) => u.cardId !== filler && !u.survived && u.damageTaken > u.maxHp * 1.4)
    .sort((a, b) => b.damageTaken - a.damageTaken)[0];
  if (overkill)
    findings.push({
      code: "overkill",
      owner: overkill.owner === "A" ? "B" : "A", // the side that wasted the damage
      uid: overkill.uid,
      name: overkill.name,
      value: Math.round((overkill.damageTaken / Math.max(1, overkill.maxHp)) * 100),
    });

  return findings;
}

/** Unit lookup type used above, re-exported for consumers building their own views. */
export type ReportUnits = Map<string, UnitReport>;

/** A `Unit` narrowed to what the report needs — handy for tests. */
export type ReportableUnit = Pick<
  Unit,
  "uid" | "cardId" | "name" | "owner" | "seriesId" | "isKing" | "maxHp" | "lanes" | "alive"
>;

/** Re-exported so consumers can type their own event filters. */
export type { BattleEvent };
