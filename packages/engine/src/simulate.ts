import { ARENA, COMBAT, KING, RANGE_REACH, SIMULATION, SUDDEN_DEATH, type Targeting } from "@amanda/shared";
import {
  damageSharer,
  rowAttackTargets,
  runAuras,
  runDamageOverTime,
  runDelayed,
  runOnAttack,
  runOnDamaged,
  runOnDeath,
  runOnHit,
  runOnKill,
  runOnReveal,
  runOnSpawn,
  type BattleOps,
} from "./abilities.js";
import {
  computeDamage,
  elementMultiplier,
  gapAhead,
  isAhead,
  leftEdge,
  rightEdge,
  sharesLane,
} from "./combat.js";
import { buildBattle, createUnitFromCard, type BattleSetup } from "./setup.js";
import type {
  BattleFrame,
  BattleResult,
  BattleState,
  Owner,
  Unit,
  WinReason,
  EndedBy,
} from "./types.js";

const TPS = SIMULATION.ticksPerSecond;
const DT = 1 / TPS;
/** Column distance at which a melee unit is "touching" its target. */
const MELEE_REACH = 0.6;

interface TargetPick {
  unit: Unit;
  gap: number;
  /**
   * This target is not in the unit's own lane, so the unit has to walk across
   * to it before it may swing. Set by King-hunting and by the empty-lane
   * fallback — the two picks that leave the lane. Without it a unit reaches
   * three lanes sideways and hits something it is nowhere near, because
   * `gapAhead` measures along the column axis and knows nothing about lanes.
   */
  crossLane?: boolean;
}

/**
 * How far ahead of `u` the CENTRE of `other` sits. Negative is behind.
 *
 * ⚠ CENTRES, AND NOT `gapAhead`, FOR DECIDING WHO IS IN THE WAY. Hod, after
 * a match: *"he saw Chuppy attack the King even though one of the guards was
 * still alive."* He had. Measured over 200 battles: 43 of 873 blows chosen
 * against a King had one of the King's own standing in front of it, in the
 * attacker's own lane.
 *
 * The cause is the King's body. `gapAhead` measures edge to edge and a King
 * is TWO columns wide, so its near edge reaches a whole half-column further
 * forward than a guard's does. Chuppy at column 4, the King centred at 1.5
 * (its edge at 2.5), the Flame Dragon guarding at 1.85 (its edge at 2.35):
 * by edges the King is NEARER than the thing standing in front of it — 1.0
 * against 1.15 — so the shield test said there was no shield.
 *
 * Centres have no such problem, and they are also what the rule means: a
 * guard standing in front of the King is in the way, whatever the King's
 * shoulders are doing.
 */
function aheadBy(u: Unit, other: Unit): number {
  return (other.col - u.col) * u.facing;
}

/**
 * Who is standing between an attacker and the enemy King — the King's actual
 * bodyguards, whatever lane they happen to be in.
 */
function guardsOf(state: BattleState, u: Unit, king: Unit): Unit[] {
  const kingAt = aheadBy(u, king);
  return state.units.filter(
    (e) =>
      e.alive && e.owner === king.owner && !e.isKing && isAhead(u, e) && aheadBy(u, e) < kingAt,
  );
}

/**
 * The nearest thing worth hitting on the way to the enemy King.
 *
 * Returns the King itself once nothing of its own stands between, and null
 * when that side has no King left — which happens, because a player who
 * placed no cards is given no King at all.
 */
function huntKing(state: BattleState, u: Unit, enemies: Unit[]): TargetPick | null {
  /*
   * The NEAREST King, not simply the first one in the list.
   *
   * A side can hold two of them (Amanda mode: a King per player), and a
   * King-hunter crosses lanes to reach one — so "the first King in the unit
   * array" would send it marching past the crown in front of it to go and
   * find the other player's.
   */
  let king: Unit | undefined;
  let kingGap = Infinity;
  for (const e of enemies) {
    if (!e.isKing) continue;
    const g = gapAhead(u, e);
    if (g < kingGap) {
      king = e;
      kingGap = g;
    }
  }
  if (!king) return null;

  const guards = guardsOf(state, u, king);
  // The King is only reachable once nothing of its own stands in the way.
  const prey = guards.length ? guards : [king];
  let best = prey[0]!;
  let bestGap = gapAhead(u, best);
  for (const e of prey) {
    const g = gapAhead(u, e);
    if (g < bestGap) {
      best = e;
      bestGap = g;
    }
  }
  return { unit: best, gap: bestGap, crossLane: true };
}

/** Whatever is nearest, in any lane. The last resort. */
function nearestAnywhere(u: Unit, enemies: Unit[]): TargetPick | null {
  let best: Unit | undefined;
  let bestGap = Infinity;
  for (const e of enemies) {
    const g = gapAhead(u, e);
    if (g < bestGap) {
      best = e;
      bestGap = g;
    }
  }
  return best ? { unit: best, gap: bestGap, crossLane: true } : null;
}

/**
 * ═══ THE FIVE THAT HUNT SOMETHING IN PARTICULAR ═══
 *
 * Or: *"open me up more options in the cards' preferred target: cards that
 * shoot straight, cards that shoot whoever attacks them, cards that shoot
 * the strongest card at any given moment, cards that shoot snipers, cards
 * that shoot static cards, cards that shoot cards that crossed the line and
 * are attacking."*
 *
 * Two of those were already here (straight ahead, and the crown). The other
 * five all have the same shape — a predicate over the enemies in front, then
 * the nearest match — so they are a table rather than five branches, and the
 * one that is NOT that shape (the strongest, which wants the biggest rather
 * than the nearest) says so by being written out.
 *
 * ⚠ ALL OF THEM CROSS LANES, and that is the whole point: "the strongest
 * card on the board" is not a position, so a card that could only look down
 * its own lane would be a lane card with extra words. Crossing has a cost
 * the engine already charges — see `crossLane`, which makes a walker WALK
 * there before it may swing.
 */
const PREY: Partial<Record<Targeting, (e: Unit, u: Unit) => boolean>> = {
  avenger: (e, u) => e.uid === u.lastHitBy,
  // Not the King: it is static by rule (King's Trap), so a wall-breaker that
  // counted it would hunt the crown and nothing else, every game.
  wallbreaker: (e) => e.moveSpeed === 0 && !e.isKing,
  sniperHunter: (e) => e.range === "sniper",
  invader: (e, u) => e.hasAttacked && hasCrossed(u, e),
};

/**
 * Has this enemy come at me — reached my front line or stepped past it?
 *
 * The arena is two boards laid end to end and the front rows touch in the
 * middle (config.ts: width 8, the rows meet at columns 3 and 4). A owns the
 * low half, B the high one.
 *
 * ⚠ "AT OR PAST THE LINE", NOT "PAST IT", AND THAT IS NOT A ROUNDING
 * CHOICE. `gapAhead` measures edge to edge, so two width-1 units in columns
 * 3 and 4 are already touching: a melee attacker walking at your front row
 * STOPS on the line and fights from there. Measured — a crosser given a
 * speed of 1.6 and something to kill finished the battle at column 4.00,
 * having attacked all the way through it. Under the strict reading the
 * border guard would have hunted almost nothing in almost every match,
 * which is the "card that quietly does nothing" failure wearing a rule.
 */
function hasCrossed(u: Unit, e: Unit): boolean {
  const mid = ARENA.width / 2;
  return u.facing > 0 ? e.col <= mid : e.col >= mid - 1;
}

/** The nearest enemy this unit's targeting is actually looking for. */
function huntPrey(u: Unit, enemies: Unit[]): TargetPick | null {
  /*
   * The strongest thing out there, recomputed every tick — so it changes
   * target the moment something bigger arrives, which is what Or asked for
   * ("at any given moment") and is also what makes it dangerous to play
   * against rather than merely efficient.
   *
   * Power, with health as the tie-break: power is what the card DOES, and
   * two cards of equal power are told apart by which one will be there
   * longer. Excluding the King — see schemas/targeting.ts.
   */
  if (u.targeting === "champion") {
    let best: Unit | undefined;
    for (const e of enemies) {
      if (e.isKing) continue;
      if (!best || e.power > best.power || (e.power === best.power && e.hp > best.hp)) best = e;
    }
    return best ? { unit: best, gap: gapAhead(u, best), crossLane: true } : null;
  }

  const wanted = PREY[u.targeting];
  if (!wanted) return null;
  let best: Unit | undefined;
  let bestGap = Infinity;
  for (const e of enemies) {
    if (!wanted(e, u)) continue;
    const g = gapAhead(u, e);
    if (g < bestGap) {
      best = e;
      bestGap = g;
    }
  }
  return best ? { unit: best, gap: bestGap, crossLane: true } : null;
}

/**
 * Choose what a unit is attacking.
 *
 * An ordinary card fights whatever is in front of it, in its own lane. A card
 * whose targeting is "king" hunts the enemy King instead — across the lanes if
 * it has to — and while the King is still shielded it works on the guards
 * standing in the way. Snipers pick the farthest target rather than the
 * nearest; that is what makes them snipers.
 *
 * ═══ AN EMPTY LANE IS NOT THE END OF THE FIGHT ═══
 *
 * Or, after a game: *"we just had another match that ended with all the
 * attackers in a straight line reaching the end and attacking nothing, and
 * the Kings neither moving nor attacking. If there is nothing to attack in
 * your lane you should start attacking the King or the guards."*
 *
 * Exactly right, and it was a real stall: a lane unit whose own lane had been
 * cleared returned NO target at all, so it walked to the far wall and stood
 * there for the rest of the battle. Two boards could clear opposite lanes and
 * the match would run out the clock with a dozen units staring at a wall.
 *
 * So an empty lane now falls through to hunting the King, which is the same
 * search a King-hunter does — guards first, crown once it is bare. The lane
 * discipline that makes a battle readable is untouched: this only ever
 * happens when there is nothing left in the lane to be disciplined about.
 */
function pickTarget(state: BattleState, u: Unit): TargetPick | null {
  /*
   * ⚠ A CARD THAT CAME UP AMONG THEM CAN HIT WHAT IT IS STANDING NEXT TO.
   *
   * `isAhead` is strict, and the far end of the board is also where the
   * enemy's back row sits — so a diver landing there would come up level
   * with that whole row and be unable to touch any of it, which is the one
   * row the ability exists to get at. While it is still turned round, level
   * counts as in front.
   */
  const level = 0.01;
  const enemies = state.units.filter(
    (e) =>
      e.alive &&
      e.owner !== u.owner &&
      (isAhead(u, e) || (u.flags.dug === true && Math.abs(e.col - u.col) < level)),
  );
  if (enemies.length === 0) return null;

  if (u.targeting === "king") {
    const hunted = huntKing(state, u, enemies);
    if (hunted) return hunted;
    // No King left to hunt: fall through and fight like anything else.
  }

  /*
   * ⚠ AND THE SAME FALL-THROUGH FOR THE OTHER FIVE, FOR THE SAME REASON.
   * Or found the version of this bug that already existed — *"all the
   * attackers in a straight line reaching the end and attacking nothing"* —
   * and a sniper hunter on a board with no snipers is that bug wearing a new
   * name. Nothing of the kind it wants means it fights like anything else.
   */
  /*
   * ⚠ The guard is a string compare and it is here for a reason: this runs
   * for every unit on every tick, and the tutorial's 300-battle check went
   * over its five-second budget the day a map lookup and a call were added
   * to that path for the benefit of the two modes that never use them.
   */
  if (u.targeting !== "lane") {
    const prey = huntPrey(u, enemies);
    if (prey) return prey;
  }

  let ahead = enemies.filter((e) => sharesLane(e, u));
  // A King is shielded by its own units STANDING BETWEEN it and the attacker —
  // not by anything that merely shares the lane. Counting the whole lane meant
  // a 1 HP filler monster parked in the back row made a King untouchable, and
  // sent attackers walking straight past that King to go and kill it.
  const theirKing = ahead.find((e) => e.isKing);
  if (theirKing) {
    const kingAt = aheadBy(u, theirKing);
    const shielded = ahead.some((e) => !e.isKing && aheadBy(u, e) < kingAt);
    if (shielded) ahead = ahead.filter((e) => !e.isKing);
  }
  /*
   * Nothing left in this lane — go and find the crown.
   *
   * `huntKing` can come back empty when that side has no King (a player who
   * placed nothing is given none), so there is one more fallback behind it:
   * the nearest enemy anywhere. Between them, a unit that can see an enemy
   * always has something to walk towards, which is the property that was
   * missing.
   */
  if (ahead.length === 0) return huntKing(state, u, enemies) ?? nearestAnywhere(u, enemies);

  let best = ahead[0]!;
  let bestGap = gapAhead(u, best);
  const wantFarthest = u.range === "sniper";
  for (const e of ahead) {
    const g = gapAhead(u, e);
    if (wantFarthest ? g > bestGap : g < bestGap) {
      best = e;
      bestGap = g;
    }
  }
  return { unit: best, gap: bestGap };
}

function inAttackRange(u: Unit, gap: number): boolean {
  // Melee must be in contact; everything else has a reach in columns (see
  // RANGE_REACH). The epsilon absorbs float rounding when a unit halts exactly
  // at the edge of its reach.
  const own = u.range === "melee" ? MELEE_REACH : RANGE_REACH[u.range];
  // A King cannot step forward, so a melee one could never answer anything
  // that stopped short of it. See KING.minReach for the measurement.
  const reach = u.isKing ? Math.max(own, KING.minReach) : own;
  return gap <= reach + 1e-6;
}

/**
 * ═══ A CARD THAT CANNOT GO ANYWHERE CAN STILL FIRE ═══
 *
 * Or, turning down the obvious fix for the queue — letting a blocked card
 * step sideways into a free lane: *"No. Part of the wisdom is building the
 * board so that you do not put someone walking behind someone static. That is
 * fine. But they can still shoot even if they do not move. Say it has a range
 * of 2 — it should shoot at someone approaching it. Your shots always 'go
 * round' a friend on the way to the enemy."*
 *
 * Shots already went round their own: targeting never looked at allies, and a
 * shooter standing behind a wall of its own has always fired over it. What it
 * could not do was LOOK SIDEWAYS. Lane discipline is only relaxed when the
 * lane is EMPTY, so a card whose own lane held something far away — out of
 * reach, and with no way to close the distance because it is static, rooted,
 * or queued behind one of its own — stood there aiming at the thing it could
 * not hit while an enemy walked past inside its reach.
 *
 * Measured over 60 battles of the real catalogue: 21,961 of 281,570
 * living-unit ticks were exactly that. Roughly a third of them belonged to
 * static shooters — cards whose entire job is to fire.
 *
 * So this is the shot of last resort: the nearest enemy it can hit from
 * precisely where it stands, in any lane. It is only ever reached by a unit
 * that is neither attacking nor moving this tick, which is what keeps lane
 * discipline intact — an advancing card is busy advancing.
 */
function freeShot(state: BattleState, u: Unit): Unit | null {
  let best: Unit | null = null;
  let bestGap = Infinity;
  for (const e of state.units) {
    if (!e.alive || e.owner === u.owner || !isAhead(u, e)) continue;
    const gap = gapAhead(u, e);
    if (gap < bestGap) {
      best = e;
      bestGap = gap;
    }
  }
  return best && inAttackRange(u, bestGap) ? best : null;
}

function effectiveMoveSpeed(u: Unit): number {
  if (u.flags.rooted) return 0;
  return u.moveSpeed * u.moveSlowMult;
}

function effectiveCooldown(u: Unit): number {
  return u.attackSpeed / u.attackSpeedMult;
}

/** Run a full battle deterministically and return the result + event log. */
export function runBattle(setup: BattleSetup): BattleResult {
  const state = buildBattle(setup);
  const catalog = setup.catalog;
  const totalTicks = SIMULATION.totalBattleTicks;
  const frames: BattleFrame[] = [];

  function captureFrame(): void {
    frames.push({
      tick: state.tick,
      units: state.units.map((u) => ({
        uid: u.uid,
        owner: u.owner,
        cardId: u.cardId,
        col: u.col,
        lanes: u.lanes,
        hp: Math.max(0, Math.round(u.hp)),
        maxHp: u.maxHp,
        power: Math.round(u.power),
        alive: u.alive,
        isKing: u.isKing,
        ...(u.flags.spawned ? { spawned: true } : {}),
        ...(u.facing !== (u.owner === "A" ? 1 : -1) ? { turned: true } : {}),
      })),
    });
  }

  const spawnChild: BattleOps["spawnChild"] = (proto) => {
    const u: Unit = {
      uid: `u${state.nextUid++}`,
      cardId: proto.cardId,
      seriesId: proto.seriesId,
      owner: proto.owner,
      name: proto.name,
      elements: [proto.element],
      activeElement: proto.element,
      maxHp: proto.hp,
      hp: proto.hp,
      power: proto.power,
      attackSpeed: proto.attackSpeed,
      moveSpeed: proto.moveSpeed,
      range: "melee",
      flying: false,
      targeting: "lane",
      isKing: false,
      col: proto.col,
      width: 1,
      lanes: [proto.lane],
      facing: proto.facing,
      attackCooldown: 0,
      armor: 0,
      stunnedUntil: -1,
      knockbackImmune: false,
      damageTakenMult: 1,
      attackSpeedMult: 1,
      moveSlowMult: 1,
      auraArmor: 0,
      abilities: [],
      alive: true,
      below: null,
      lastHitBy: null,
      hasAttacked: false,
      // The one thing that is not inherited: this is a PIECE of something,
      // and the screen draws it smaller for it. See `spawned` in types.ts.
      flags: { spawned: true },
    };
    state.units.push(u);
    state.events.push({
      tick: state.tick,
      type: "spawn",
      uid: u.uid,
      cardId: u.cardId,
      owner: u.owner,
      col: u.col,
      lanes: u.lanes,
    });
    return u;
  };

  /** Reveal the Ground-Floor card underneath a freshly-dead unit. */
  function reveal(dead: Unit): void {
    if (!dead.below) return;
    const card = catalog.get(dead.below.cardId);
    if (!card) return;
    const u = createUnitFromCard(state, card, dead.owner, {
      col: dead.col,
      lanes: [dead.lanes[0]!],
      width: 1,
      facing: dead.facing,
      isKing: false,
      below: null,
    });
    state.units.push(u);
    state.events.push({
      tick: state.tick,
      type: "reveal",
      uid: u.uid,
      revealedCardId: card.id,
      owner: u.owner,
      col: u.col,
      lanes: u.lanes,
    });
    runOnReveal(state, u);
  }

  /**
   * ═══ A SHELL IS NOT A CORPSE ═══
   *
   * Or: *"the Obsidian Egg — change its behaviour as well as its text. The
   * text should say it becomes a Flame Dragon after it DIES. And the Flame
   * Dragon itself can be a bit weaker than a normal one — a bit less health
   * and a bit less power — but it still has to fly like a Flame Dragon."*
   *
   * So the egg no longer runs a ten-second timer that nobody could see. It
   * waits to be broken, and breaking it is what lets the thing inside out —
   * which is the version a seven-year-old can work out by watching, and the
   * only version where attacking the egg is a DECISION rather than free
   * damage.
   *
   * It is done here, in front of the death rather than after it, because
   * everything downstream of this line is what happens to a corpse: the
   * Ground Floor card comes up, the swarm abilities fire, a King's fall ends
   * the battle. None of that should happen to an egg; the unit was never
   * destroyed, it changed into something else in the same cell.
   *
   * Keeping the uid is the whole trick. The client follows a unit by uid and
   * rebuilds it whenever its card changes, so a thing that was an egg last
   * frame is drawn as a dragon this frame — wings, series ring, name and all
   * — and the `transform` event, which the egg already used, gives it the
   * shell coming apart and the dragon's own roar on top.
   */
  function hatch(u: Unit): boolean {
    const ab = u.abilities.find((a) => a.type === "hatchOnDeath");
    if (!ab || u.flags.transformed) return false;
    const into = typeof ab.params.into === "string" ? ab.params.into : null;
    const card = into ? catalog.get(into) : undefined;
    if (!card) return false;

    // Built through the same function every other unit is, so the hatchling
    // is a Flame Dragon in every respect the engine knows about — it flies,
    // it knocks back, it tramples — rather than an egg wearing its picture.
    const born = createUnitFromCard(state, card, u.owner, {
      col: u.col,
      lanes: u.lanes,
      width: u.width,
      facing: u.facing,
      isKing: u.isKing,
      below: null,
    });
    const pct = (v: unknown, fallback: number) => (typeof v === "number" ? v : fallback) / 100;
    born.maxHp = Math.max(1, Math.round(born.maxHp * pct(ab.params.hpPct, 75)));
    born.power = Math.round(born.power * pct(ab.params.powerPct, 75));

    // Everything about the card, nothing about the cell. uid, position and
    // what is stacked under it belong to the thing that was already here.
    Object.assign(u, born, {
      uid: u.uid,
      col: u.col,
      lanes: u.lanes,
      width: u.width,
      facing: u.facing,
      below: u.below,
      hp: born.maxHp,
      flags: { ...u.flags, transformed: true },
    });
    state.events.push({
      tick: state.tick,
      type: "transform",
      uid: u.uid,
      cardId: u.cardId,
      owner: u.owner,
    });
    return true;
  }

  const killUnit: BattleOps["killUnit"] = (u) => {
    if (!u.alive) return;
    if (hatch(u)) return;
    u.alive = false;
    u.hp = 0;
    state.events.push({ tick: state.tick, type: "death", uid: u.uid });
    reveal(u);
    runOnDeath(state, ops, u);
    if (u.isKing) {
      /*
       * A side falls when its LAST King falls.
       *
       * With one King a side that is the same thing it always was. With two —
       * Amanda mode, where two players share one side and bring a King each —
       * it is Or's ruling: "הצד נופל רק כששני המלכים נפלו". Before it, the
       * first crown to drop ended the battle for both players, so one player
       * could be knocked out and take their partner with them before the
       * partner had lost anything.
       */
      const stillStanding = state.units.some(
        (o) => o.alive && o.isKing && o.owner === u.owner,
      );
      if (!stillStanding) {
        state.winner = u.owner === "A" ? "B" : "A";
        state.winReason = "kingDown";
        state.ended = true;
      }
    }
  };

  const ops: BattleOps = { killUnit, spawnChild };

  /**
   * How much harder hits land right now. 1 for the first half of the battle,
   * then climbing to SUDDEN_DEATH.peak by the final tick — the clock itself
   * breaking a deadlock that neither board can.
   */
  function escalation(): number {
    const from = totalTicks * SUDDEN_DEATH.startsAt;
    if (state.tick <= from) return 1;
    const through = (state.tick - from) / Math.max(1, totalTicks - from);
    return 1 + (SUDDEN_DEATH.peak - 1) * Math.min(1, through);
  }

  function performAttack(u: Unit, target: Unit): void {
    state.events.push({ tick: state.tick, type: "attack", uid: u.uid, targetUid: target.uid });
    /*
     * The two facts the new targeting modes are made of, recorded in the one
     * place where one unit actually hits another. Here rather than in
     * `pickTarget`, because what matters is the blow that LANDED — a card
     * that aimed at you and died on the way has not attacked you.
     */
    u.hasAttacked = true;
    target.lastHitBy = u.uid;
    // Fires as the swing starts, before anything lands: a vacuum drags the
    // line in, a gelatinous cube swallows what walked into it.
    runOnAttack(state, u, target);
    let dmg = computeDamage(u.power * escalation(), u.activeElement, target);

    /*
     * A neighbour can step in front of part of the blow (Pudding Shield).
     * Taken off the top, before the target's own armor has done its work on
     * the rest — a bodyguard throwing itself in the way does not get to use
     * the protected card's armor to do it.
     */
    const share = damageSharer(state, target);
    if (share && dmg > 0) {
      const moved = Math.floor((dmg * share.pct) / 100);
      dmg -= moved;
      share.ally.hp -= moved;
      state.events.push({
        tick: state.tick,
        type: "hit",
        uid: u.uid,
        targetUid: share.ally.uid,
        damage: moved,
        targetHp: Math.max(0, share.ally.hp),
      });
      if (share.ally.hp <= 0 && share.ally.alive) killUnit(share.ally, u);
    }

    target.hp -= dmg;
    /*
     * What this blow would have been with nothing in the way, so the screen
     * can show the difference. Armour, a reduction aura and a neighbour
     * taking a share all land in the same gap — see computeDamage.
     */
    const unprotected = Math.floor(
      u.power * escalation() * COMBAT.damageMultiplier *
        elementMultiplier(u.activeElement, target.activeElement),
    );
    state.events.push({
      tick: state.tick,
      type: "hit",
      uid: u.uid,
      targetUid: target.uid,
      damage: dmg,
      targetHp: Math.max(0, target.hp),
      // What the elements did to this blow, for the screen to show.
      edge: elementMultiplier(u.activeElement, target.activeElement),
      ...(unprotected > dmg ? { absorbed: unprotected - dmg } : {}),
    });

    /*
     * A swing wide enough to catch the lanes either side. This is what beats
     * anything that multiplies: swarms and splitters fan out sideways when
     * they die, straight into the arc of the next swing.
     */
    for (const splash of rowAttackTargets(state, u, target)) {
      const extra = computeDamage(u.power * escalation(), u.activeElement, splash);
      splash.hp -= extra;
      state.events.push({
        tick: state.tick,
        type: "hit",
        uid: u.uid,
        targetUid: splash.uid,
        damage: extra,
        targetHp: Math.max(0, splash.hp),
        edge: elementMultiplier(u.activeElement, splash.activeElement),
      });
      if (splash.hp <= 0 && splash.alive) killUnit(splash, u);
    }

    runOnHit(state, u, target);
    // Reflected damage is a real hit and has to be recorded as one. Without
    // this a King could kill itself on a thorned defender while its own report
    // showed zero damage taken and no killer — the single most important event
    // of the match, invisible.
    const reflected = runOnDamaged(target, u, dmg);
    if (reflected > 0)
      state.events.push({
        tick: state.tick,
        type: "hit",
        uid: target.uid,
        targetUid: u.uid,
        damage: reflected,
        targetHp: Math.max(0, u.hp),
        reflected: true,
      });

    if (target.hp <= 0 && target.alive) {
      killUnit(target, u);
      if (u.alive) runOnKill(u); // trample: keep momentum
    }
    if (u.hp <= 0 && u.alive) killUnit(u, target); // died to reflected damage
  }

  /**
   * The closest ally standing between this unit and the enemy, if any.
   * Ground units queue up behind their own front line instead of walking
   * through it; flyers pass over and ignore this entirely.
   */
  function blockingAlly(u: Unit): Unit | null {
    let best: Unit | null = null;
    let bestGap = Infinity;
    for (const o of state.units) {
      if (!o.alive || o === u || o.owner !== u.owner) continue;
      if (!sharesLane(o, u) || !isAhead(u, o)) continue;
      const gap = gapAhead(u, o);
      if (gap < bestGap) {
        best = o;
        bestGap = gap;
      }
    }
    return best;
  }

  /** How close a unit will stand behind the ally in front of it. */
  const FOLLOW_GAP = 0.15;
  /** Lanes crossed per second by a unit moving toward a target beside it. */
  const LANE_CHANGE_PER_SECOND = 1.2;

  /**
   * Drift toward the lane its target is in. A King-hunter has to be able to
   * leave its own lane or it can never reach a King sitting in the middle two.
   * A flyer crosses over whatever is in the way; anything on the ground only
   * steps across into a lane it is not blocked out of.
   */
  function driftTowardLane(u: Unit, target: Unit): void {
    if (u.isKing || u.lanes.length > 1) return; // the King holds its 2x2
    const here = u.lanes[0]!;
    const there = target.lanes[0] ?? here;
    if (here === there) return;

    const progress = (u.flags.laneDrift as number | undefined) ?? 0;
    const next = progress + LANE_CHANGE_PER_SECOND * DT;
    if (next < 1) {
      u.flags.laneDrift = next;
      return;
    }
    const step = there > here ? 1 : -1;
    const want = here + step;
    // On the ground you cannot walk through your own; in the air you can.
    if (!u.flying) {
      const occupied = state.units.some(
        (o) =>
          o.alive &&
          o !== u &&
          o.owner === u.owner &&
          o.lanes.includes(want) &&
          Math.abs(o.col - u.col) < 1,
      );
      if (occupied) return;
    }
    u.lanes = [want];
    u.flags.laneDrift = 0;
  }

  function moveUnit(u: Unit, nearest: Unit | null): void {
    const step = effectiveMoveSpeed(u) * DT;
    let next = u.col + u.facing * step;

    const clampTo = (limit: number) => {
      if (u.facing > 0) next = next > limit ? Math.max(u.col, limit) : next;
      else next = next < limit ? Math.min(u.col, limit) : next;
    };

    // Stop at reach of whatever it is attacking.
    if (nearest)
      clampTo(
        u.facing > 0
          ? leftEdge(nearest) - MELEE_REACH - u.width / 2
          : rightEdge(nearest) + MELEE_REACH + u.width / 2,
      );

    // And stop behind its own front line, unless it can fly over it.
    if (!u.flying) {
      const ally = blockingAlly(u);
      if (ally)
        clampTo(
          u.facing > 0
            ? leftEdge(ally) - FOLLOW_GAP - u.width / 2
            : rightEdge(ally) + FOLLOW_GAP + u.width / 2,
        );
    }

    // Columns are 0..width-1. Clamping to `width` let a unit that had cleared
    // its lane walk one step PAST the last column and stand outside the drawn
    // arena — it simply vanished from the battle.
    u.col = Math.min(ARENA.width - 1, Math.max(0, next));
  }

  function step(): void {
    state.tick++;
    runAuras(state);
    // Poison and burning lanes, after the auras that could have healed through
    // them and before anybody acts. Both can kill, so this runs with the
    // simulation's own death bookkeeping available to it.
    runDamageOverTime(state, ops);
    // Stable iteration order (array order) keeps the simulation deterministic.
    const acting = state.units.filter((u) => u.alive);
    for (const u of acting) {
      if (state.ended) break;
      if (!u.alive) continue;

      runDelayed(state, u);
      u.attackCooldown = Math.max(0, u.attackCooldown - DT);
      if (state.tick < u.stunnedUntil) continue; // frozen / stunned

      let picked = pickTarget(state, u);
      /*
       * ⚠ NOTHING IN FRONT, SOMETHING BEHIND: TURN ROUND AND FIGHT IT.
       *
       * This began as the diver's own rule — a card that went round the back
       * is facing home, and once it has eaten through everything between
       * itself and its own board there is nothing "ahead" of it at all, so it
       * would walk to the wall and stand there. That is the stall Or found
       * the first time: *"all the attackers in a straight line reaching the
       * end and attacking nothing."*
       *
       * It belongs to everybody, and the measurement that proved it is the
       * diver seen from the other side. Every unit picks its target from what
       * is IN FRONT of it, so a card that surfaced behind the enemy line was
       * not merely hard to answer, it was unanswerable: a diver sent at four
       * cards that could all shoot finished the battle on 10,000 health of
       * 10,000, having killed three of them, while an identical card without
       * the ability died. Nothing could turn round, so nothing did.
       *
       * It cannot oscillate: a unit only turns when there is something
       * strictly behind it and nothing at all in front, and after turning
       * that something is in front.
       */
      if (!picked && state.units.some((e) => e.alive && e.owner !== u.owner && aheadBy(u, e) < 0)) {
        u.facing = u.facing > 0 ? -1 : 1;
        // Turned round, it is an ordinary card again — including the rule
        // that let it hit what it came up level with. See pickTarget.
        u.flags.dug = false;
        picked = pickTarget(state, u);
      }
      /*
       * A unit fighting outside its own lane has to WALK there.
       *
       * `gapAhead` measures along the column axis and knows nothing about
       * lanes, so without this a unit that had cleared its lane would reach
       * across the board and hit something three lanes away without moving —
       * which is worse than the stall it replaced. `crossLane` is set by
       * exactly the two picks that leave the lane.
       *
       * Static cards stay put and shoot; only something that can move changes
       * lane.
       */
      if (picked && picked.crossLane && effectiveMoveSpeed(u) > 0)
        driftTowardLane(u, picked.unit);
      if (picked && inAttackRange(u, picked.gap)) {
        if (u.attackCooldown <= 0 && u.power > 0) {
          performAttack(u, picked.unit);
          u.attackCooldown = effectiveCooldown(u);
        }
      } else {
        const stood = u.col;
        if (effectiveMoveSpeed(u) > 0) moveUnit(u, picked?.unit ?? null);
        /*
         * It got no nearer. Static, rooted, at the wall, or queued behind one
         * of its own — and in every one of those cases it can still fire at
         * whatever it can already reach. See `freeShot`.
         */
        if (u.col === stood && u.attackCooldown <= 0 && u.power > 0) {
          const shot = freeShot(state, u);
          if (shot) {
            performAttack(u, shot);
            u.attackCooldown = effectiveCooldown(u);
          }
        }
      }
    }
  }

  function resolveTimeout(): void {
    // No King destroyed within the time limit → decide by a tiebreak chain so a
    // match is NEVER a draw.
    const kingFrac = (owner: Owner): number => {
      const k = state.units.find((u) => u.isKing && u.owner === owner);
      return k && k.alive ? k.hp / k.maxHp : 0;
    };
    const totalHp = (owner: Owner): number =>
      state.units.reduce((s, u) => (u.alive && u.owner === owner ? s + u.hp : s), 0);
    const aliveCount = (owner: Owner): number =>
      state.units.reduce((n, u) => (u.alive && u.owner === owner ? n + 1 : n), 0);

    const tiebreaks: Array<[WinReason, (o: Owner) => number]> = [
      ["kingHp", kingFrac],
      ["totalHp", totalHp],
    ];
    for (const [reason, metric] of tiebreaks) {
      const a = metric("A");
      const b = metric("B");
      if (a !== b) {
        state.winner = a > b ? "A" : "B";
        // Record WHICH link of the chain decided it, and by how much, so the
        // result screen can explain a loss where nothing of yours even died.
        state.winReason = reason;
        state.tiebreak = { reason, a, b };
        state.ended = true;
        return;
      }
    }
    // Perfectly even → a deterministic coin flip (seeded), still never a draw.
    state.winner = state.rng.next() < 0.5 ? "A" : "B";
    state.winReason = "coinFlip";
    state.tiebreak = { reason: "coinFlip", a: 0, b: 0 };
    state.ended = true;
  }

  /**
   * Everything that can change while a battle is still happening, as one
   * string.
   *
   * Cheaper and more honest than instrumenting every mover, shooter and
   * damage path separately: if a unit moved, fired to effect, took a hit,
   * died or was revealed, this differs from last tick. If it does not
   * differ, nothing happened — by definition rather than by my having
   * remembered to flag it.
   *
   * A shot that MISSES nothing is the one case this calls "nothing", and
   * that is correct: an attack dealing no damage to anybody, forever, is
   * the stalemate.
   */
  function fingerprint(): string {
    let s = "";
    for (const u of state.units) s += `${u.alive ? 1 : 0}${u.hp}:${u.col}:${u.lanes[0]};`;
    return s;
  }

  // --- run ---
  runOnSpawn(state, ops);
  if (setup.recordFrames) captureFrame();
  const stalemateTicks = Math.round(TPS * SIMULATION.stalemateSeconds);
  let still = 0;
  let last = fingerprint();
  while (!state.ended && state.winner === null && state.tick < totalTicks) {
    step();
    if (setup.recordFrames) captureFrame();
    const now = fingerprint();
    still = now === last ? still + 1 : 0;
    last = now;
    // Nothing has moved, fired to effect or lost a point of health for three
    // seconds. The clock would spend the rest of the battle showing a
    // photograph; resolve it the way the clock would have.
    if (still >= stalemateTicks) break;
  }

  /*
   * ═══ WHAT STOPPED THE BATTLE, AS OPPOSED TO WHO WON IT ═══
   *
   * Or: *"a match ends if you brought the king down or if the time ran out.
   * And if you reach a dead end where no card can move, the clock is cut
   * short. I want some indication of that — 'time up', 'the king is dead' or
   * 'dead end' — in big letters in the middle of the screen."*
   *
   * He could not have one, because the result did not know. `winReason` says
   * how the WINNER was decided — kingDown, or which link of the tiebreak
   * chain settled it — and a dead end resolves through exactly the same
   * tiebreak as a timeout, so from outside the two were one answer.
   *
   * Three ways out of the loop above and this is which one was taken. Read
   * BEFORE resolveTimeout, because that sets a winner and would make a dead
   * end look like a clock running out all over again.
   */
  const endedBy: EndedBy =
    state.ended || state.winner !== null
      ? "king"
      : still >= stalemateTicks
        ? "deadEnd"
        : "time";

  if (state.winner === null && !state.ended) resolveTimeout();

  state.events.push({ tick: state.tick, type: "win", winner: state.winner });

  return {
    winner: state.winner,
    ticks: state.tick,
    endedBy,
    winReason: state.winReason,
    tiebreak: state.tiebreak,
    events: state.events,
    finalUnits: state.units,
    frames,
    lanes: state.lanes,
  };
}
