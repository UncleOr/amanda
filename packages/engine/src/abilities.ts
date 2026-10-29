import { ARENA, BOARD, ROUND_THE_BACK, SIMULATION } from "@amanda/shared";
import type { AbilityType, Element, LocalizedString } from "@amanda/shared";
import { isAhead, sharesLane } from "./combat.js";
import type { BattleState, Owner, Unit } from "./types.js";

const TPS = SIMULATION.ticksPerSecond;

/**
 * Operations the simulation exposes to ability handlers so they can spawn or
 * destroy units without a circular import. simulate.ts supplies the concrete
 * implementations.
 */
export interface BattleOps {
  killUnit(u: Unit, killer: Unit | null): void;
  spawnChild(proto: ChildProto): Unit;
}

export interface ChildProto {
  /**
   * === WHAT IT CAME OUT OF ===
   *
   * Or: *"there is some monster that splits into 4 small monsters — they
   * look like little squares and they just move, with no motion of their
   * own. Fix that."*
   *
   * They were drawn as little squares because they WERE nothing: the
   * engine gave every spawned child the card id "__spawn__", so the
   * renderer found no card behind it, fell back to grey, and drew a blank
   * box with no art, no series ring, no name and no walk.
   *
   * A child of a slime is a smaller slime. Carrying the parent's card
   * gives it, for free, the parent's artwork, its element colour, its
   * series ring and — the part Or is actually describing — its WALK,
   * because that is derived from the card too (arenaFx.ts).
   */
  cardId: string;
  seriesId: string;
  owner: Owner;
  facing: 1 | -1;
  col: number;
  lane: number;
  hp: number;
  power: number;
  attackSpeed: number;
  moveSpeed: number;
  element: Element;
  name: LocalizedString;
}

function num(v: unknown, fallback = 0): number {
  return typeof v === "number" ? v : fallback;
}
function clampCol(col: number): number {
  return Math.min(ARENA.width, Math.max(0, col));
}
/**
 * Clamp to THIS battle's lanes rather than the constant. In Amanda mode the
 * arena is eight lanes deep, and a knockback that clamped to four would have
 * flung half the board into lane 3.
 */
function clampLane(state: BattleState, lane: number): number {
  return Math.min(state.lanes - 1, Math.max(0, lane));
}

/**
 * Recompute every unit's aura-derived multipliers from scratch. Called each
 * tick, so auras are stateless and deterministic.
 */
/**
 * ═══ WHAT A NEUTRALISER SWITCHES OFF ═══
 *
 * Or: *"when it hits a healer — it damages the healing ability; when it hits
 * armour — it cancels the armour; when it hits a poison-spitter — it cancels
 * its abilities."*
 *
 * Three separate cards, so three separate types — but one mechanism, because
 * "this ability no longer fires" is the same sentence three times. A flag is
 * set on the card that was HIT, and every place an ability fires asks first.
 *
 * ⚠ ASKED AT THE FIRING SITE, NOT AT THE HIT. Switching an ability off by
 * deleting it from `u.abilities` would be one line here and a lie everywhere
 * else: the card's details screen reads that array, the report reads it, and
 * a monster whose card stops saying what it is is a monster the child cannot
 * reason about. It keeps the ability and the ability stops working.
 */
const SILENCED_BY: Record<string, AbilityType[]> = {
  silencedHeal: ["regen", "healAura"],
  silencedArmor: ["armorAura", "armorGain"],
  silencedPoison: ["stackingDot", "lineDenialDot"],
};

/** Has this card had that ability of its broken? */
export function silenced(u: Unit, type: AbilityType): boolean {
  for (const flag in SILENCED_BY) if (u.flags[flag] && SILENCED_BY[flag]!.includes(type)) return true;
  return false;
}

export function runAuras(state: BattleState): void {
  for (const u of state.units) {
    if (!u.alive) continue;
    u.damageTakenMult = 1;
    u.attackSpeedMult = 1;
    u.moveSlowMult = 1;
    u.auraArmor = 0;
  }
  for (const src of state.units) {
    if (!src.alive) continue;
    for (const ab of src.abilities) {
      if (ab.trigger !== "aura") continue;
      if (silenced(src, ab.type)) continue;
      const pct = num(ab.params.pct);
      switch (ab.type) {
        case "damageReductionAura":
          for (const ally of state.units)
            if (ally.alive && ally.owner === src.owner)
              ally.damageTakenMult *= 1 - pct / 100;
          break;
        case "attackSpeedAura":
          for (const ally of state.units)
            if (ally.alive && ally.owner === src.owner) ally.attackSpeedMult += pct / 100;
          break;
        case "slowAura":
          for (const enemy of state.units)
            if (enemy.alive && enemy.owner !== src.owner && sharesLane(enemy, src))
              enemy.moveSlowMult *= 1 - pct / 100;
          break;
        case "armorAura":
          for (const ally of state.units)
            if (ally.alive && ally.owner === src.owner)
              ally.auraArmor += num(ab.params.armor, 100);
          break;
        case "healAura":
          // Nearby allies only. Healing the whole board meant 50hp/s reached
          // every unit everywhere, which simply outran the damage in the game:
          // a defender under attack could not be killed by arithmetic, and the
          // battle stalled until the clock ran out. A healer now has to be
          // placed near what it is keeping alive.
          for (const ally of state.units)
            if (
              ally.alive &&
              ally.owner === src.owner &&
              ally.hp < ally.maxHp &&
              nearbyLane(src, ally)
            )
              ally.hp = Math.min(ally.maxHp, ally.hp + num(ab.params.hpPerSecond, 50) / TPS);
          break;
        default:
          break;
      }
    }
    // Self-sustain (regen) also recomputed per tick.
    for (const ab of src.abilities) {
      if (
        ab.trigger === "passive" &&
        ab.type === "regen" &&
        !silenced(src, "regen") &&
        src.hp < src.maxHp
      ) {
        src.hp = Math.min(src.maxHp, src.hp + num(ab.params.hpPerSecond, 40) / TPS);
      }
    }
  }

  /*
   * Series synergies.
   *
   * Who qualifies was settled when the board was built — three of the family
   * TOUCHING each other (Or, 2026-10-06; see synergy.ts). This used to count
   * everything alive of that series anywhere on the board, which is why the
   * count is gone from here: the decision is not made at this point any more,
   * it is made on the building screen where the player can see it.
   */
  if (state.synergies.length > 0) {
    for (const syn of state.synergies) {
      for (const owner of ["A", "B"] as const) {
        const pct = num(syn.ability.params.pct);
        const members = state.units.filter(
          (u) => u.alive && u.owner === owner && u.seriesId === syn.seriesId && u.flags.synergy,
        );
        if (members.length === 0) continue;
        switch (syn.ability.type) {
          case "damageReductionAura":
            for (const m of members) m.damageTakenMult *= 1 - pct / 100;
            break;
          case "attackSpeedAura":
            for (const m of members) m.attackSpeedMult += pct / 100;
            break;
          case "armorAura":
            for (const m of members) m.auraArmor += num(syn.ability.params.armor, 120);
            break;
          case "healAura":
            for (const m of members)
              if (m.hp < m.maxHp)
                m.hp = Math.min(m.maxHp, m.hp + num(syn.ability.params.hpPerSecond, 40) / TPS);
            break;
          case "slowAura":
            for (const e of state.units)
              if (e.alive && e.owner !== owner && members.some((m) => sharesLane(e, m)))
                e.moveSlowMult *= 1 - pct / 100;
            break;
          case "statAura":
            // Already applied, once, in setup.ts — see the note there. It is
            // listed rather than left to `default` so that reading this switch
            // does not suggest the bonus is missing.
            break;
          default:
            break;
        }
      }
    }
  }

  /*
   * ⚠ AND THE LAST WORD ON ARMOUR BELONGS TO THE NEUTRALISER.
   *
   * Or: *"when it hits armour — it cancels the armour."* Cancelling it at
   * the moment of the blow is not enough: `auraArmor` is rebuilt from
   * scratch every tick by whatever allies are standing nearby, so a card
   * whose armour had been broken would be wearing it again a thirtieth of a
   * second later and the ability would read as doing nothing at all. This
   * runs after every source and every synergy has had its say.
   */
  for (const u of state.units) {
    if (!u.alive || !u.flags.silencedArmor) continue;
    u.armor = 0;
    u.auraArmor = 0;
  }
}

/**
 * Damage over time, and the lanes that burn.
 *
 * ═══ WHY THIS EXISTS ═══
 *
 * Six abilities were in the card data with no handler in the engine — they
 * were printed on thirteen cards and did nothing. Or asked for cards that beat
 * each other ("if I see the opponent played X it pays me to play Y"), and the
 * answers were already written on the cards; they just were not wired up.
 *
 * Poison is the answer to a wall. It ignores armor and it ignores how much
 * health something has, because it ramps: every hit adds a stack, and the
 * stacks keep burning whether or not the poisoner is still alive. A Venom
 * Scorpion with 400hp loses a straight fight to a 2500hp Titan King and still
 * kills it, which is exactly the shape a counter should have.
 *
 * Lane denial is the answer to a column. Stack a lane with cheap bodies and
 * the lava dragon ahead of it bills every one of them per second.
 *
 * Both are applied here rather than in an aura pass because both can kill, and
 * killing needs the simulation's own bookkeeping (death events, the King's
 * loss condition, what drops out of a stack).
 */
export function runDamageOverTime(state: BattleState, ops: BattleOps): void {
  // A lane that burns: anything of the other side standing ahead of the source
  // in its lane pays per second, armor or no armor.
  for (const src of state.units) {
    if (!src.alive) continue;
    for (const ab of src.abilities) {
      if (ab.type !== "lineDenialDot" || silenced(src, ab.type)) continue;
      const dps = num(ab.params.dps, 100);
      for (const enemy of state.units) {
        if (!enemy.alive || enemy.owner === src.owner) continue;
        if (!sharesLane(enemy, src) || !isAhead(src, enemy)) continue;
        enemy.hp -= dps / TPS;
      }
    }
  }

  /*
   * ═══ POISON WEARS OFF, AND UNTIL TODAY IT DID NOT ═══
   *
   * Or: *"and I don't know who is spreading poison, but it is at too high a
   * spread and for too long. Every monster is poisoned the whole game —
   * that is what the green bubbles on them mean, isn't it? Let's meter it."*
   *
   * It is, and he is describing the code exactly. `dotStacks` and `dotDps`
   * were only ever added to: nothing anywhere decremented them, cleared
   * them or timed them out. Six cards apply poison on hit, so anything they
   * ever touched kept burning until the clock ran out fifty-eight seconds
   * later — and the client draws the bubbles from health lost with no blow
   * behind it, so the bubbles were telling the truth.
   *
   * It is a refreshing debuff now: every hit pushes the expiry out, and
   * when the hitting stops the poison runs on for DOT_SECONDS and then
   * ends. That keeps the half of it that is the point — a poisoner can die
   * and still finish what it started — and loses the half that is a bug.
   */
  for (const u of state.units) {
    if (num(u.flags.dotStacks, 0) <= 0) continue;
    if (state.tick < num(u.flags.dotUntil, 0)) continue;
    u.flags.dotStacks = 0;
    u.flags.dotDps = 0;
    u.flags.dotUntil = 0;
  }

  // Stacks still burning; the poisoner does not have to be alive for them.
  for (const u of state.units) {
    if (!u.alive) continue;
    const dps = num(u.flags.dotDps, 0);
    if (dps > 0) u.hp -= dps / TPS;
  }

  for (const u of state.units) {
    if (u.alive && u.hp <= 0) ops.killUnit(u, null);
  }
}

/**
 * The most stacks one unit can be carrying, and how long they last.
 *
 * Eight stacks of up to 50 was 400 damage a second, for ever, on a
 * catalogue whose middle card has 525 health — a second and a bit, and it
 * could not be outrun because it never stopped. Five and five seconds.
 *
 * The seconds are counted from the LAST hit rather than the first, so a
 * poisoner in a fight keeps its victim poisoned and one that walks away
 * stops mattering. Five is measured against the thing it has to be able to
 * do: the Venom Scorpion's whole job is killing a wall it cannot out-punch,
 * and five stacks of 40 for five seconds after it dies is still a thousand
 * damage arriving after the scorpion is gone.
 */
const MAX_DOT_STACKS = 5;
const DOT_SECONDS = 5;

/**
 * Add one poison stack to the target, and push the expiry out.
 *
 * Stacks from different poisoners add together, which is the combo half of
 * Or's ask: two cheap insects do what neither of them can do alone. The
 * refresh is shared the same way — either of them hitting keeps all of it
 * burning, which is what makes two of them worth more than one.
 */
function addDotStack(target: Unit, perStack: number, tick: number): void {
  target.flags.dotUntil = tick + DOT_SECONDS * TPS;
  const stacks = num(target.flags.dotStacks, 0);
  if (stacks >= MAX_DOT_STACKS) return;
  target.flags.dotStacks = stacks + 1;
  target.flags.dotDps = num(target.flags.dotDps, 0) + perStack;
}

/**
 * Effects that fire as a unit swings, before the blow lands.
 *
 * `onCollision` is folded in here on purpose: the engine has no separate
 * collision event, and a melee unit's first swing at something IS the moment
 * it met it in the lane. Pretending otherwise would mean a new event type that
 * fires at exactly the same instant.
 */
export function runOnAttack(state: BattleState, u: Unit, target: Unit): void {
  for (const ab of u.abilities) {
    if (ab.trigger !== "onAttack" && ab.trigger !== "onCollision") continue;
    switch (ab.type) {
      case "pullVacuum": {
        // Every few seconds, drag the enemy line one step closer. The answer
        // to a board that wants to keep its distance and shoot.
        const every = num(ab.params.everySeconds, 6);
        const last = num(u.flags.lastPullTick, -Infinity);
        if (state.tick - last < every * TPS) break;
        u.flags.lastPullTick = state.tick;
        const slots = num(ab.params.slots, 1);
        let pulled = 0;
        for (const enemy of state.units) {
          if (!enemy.alive || enemy.owner === u.owner || enemy.isKing) continue;
          if (enemy.knockbackImmune || enemy.moveSpeed <= 0) continue;
          // Toward the thing doing the pulling, worked out from where it
          // actually is. Deriving it from the victim's facing was wrong, and
          // wrong in the most embarrassing direction: it pushed them away.
          const toward = Math.sign(u.col - enemy.col) || 1;
          enemy.col = clampCol(enemy.col + toward * slots);
          pulled++;
        }
        if (pulled > 0)
          state.events.push({ tick: state.tick, type: "knockback", uid: u.uid, targetUid: target.uid, col: target.col });
        break;
      }
      case "absorbOnCollision": {
        // Swallowed: held and unable to act. Once per victim, so a slow blob
        // cannot keep one card stunned for the whole battle.
        const key = `absorbed:${target.uid}`;
        if (u.flags[key]) break;
        u.flags[key] = true;
        const until = state.tick + Math.round(num(ab.params.stunSeconds, 3) * TPS);
        target.stunnedUntil = Math.max(target.stunnedUntil, until);
        target.flags.rooted = true;
        state.events.push({ tick: state.tick, type: "stun", uid: u.uid, targetUid: target.uid, untilTick: until });
        break;
      }
      default:
        break;
    }
  }
}

/**
 * Which other enemies a wide attack also catches.
 *
 * The counter to anything that multiplies. Swarms and splitters fan out into
 * NEIGHBOURING lanes when they die, so the one thing that undoes them is a
 * swing that covers lanes rather than one that hits hard.
 */
export function rowAttackTargets(state: BattleState, u: Unit, target: Unit): Unit[] {
  const ab = u.abilities.find((a) => a.type === "aoeRowAttack");
  if (!ab) return [];
  // `lanes` is the total width of the swing, so a 3 reaches one lane each way.
  const reach = Math.floor((num(ab.params.lanes, 2) - 1) / 2) || 1;
  const hit: Unit[] = [];
  for (const other of state.units) {
    if (!other.alive || other === target || other.owner === u.owner) continue;
    // Beside the real target, not merely somewhere on the board.
    const beside = other.lanes.some((l) => target.lanes.some((tl) => Math.abs(tl - l) <= reach));
    if (!beside) continue;
    if (Math.abs(other.col - target.col) > 1.5) continue;
    hit.push(other);
  }
  return hit;
}

/**
 * The ally that takes part of a blow aimed at this one.
 *
 * The protector half of Or's ask: a Pudding Shield next to something fragile
 * and expensive turns it from a card that dies first into a card that fights.
 * Returns the sharer and the fraction it absorbs.
 */
export function damageSharer(
  state: BattleState,
  target: Unit,
): { ally: Unit; pct: number } | null {
  for (const ally of state.units) {
    if (!ally.alive || ally === target || ally.owner !== target.owner) continue;
    if (!nearbyLane(ally, target)) continue;
    if (Math.abs(ally.col - target.col) > 1.5) continue;
    const ab = ally.abilities.find((a) => a.type === "damageShareAdjacent");
    if (!ab) continue;
    return { ally, pct: num(ab.params.pct, 50) };
  }
  return null;
}

/**
 * Is this unit standing in one of its own King's two guard posts?
 *
 * ═══ WHY ANYTHING NEEDS TO ASK ═══
 *
 * Or, rewriting Goldenhorn: *"takes with it the weakest card next to it THAT
 * IS NOT A GUARD OR THE KING, and turns it into armour."* The King was
 * already excluded. The guards were not, so the card could eat one of the two
 * squares that keep the King alive — and the player's own board would open
 * its crown to the first attacker that walked up. A card that can lose you
 * the match by being placed correctly is not a trade-off, it is a trap.
 *
 * ═══ EXPRESSED IN THE ARENA, NOT IN BOARD SQUARES ═══
 *
 * The client calls them guard posts and finds them at `x === 3` and the
 * King's two lanes (BoardGrid.isGuardPost). A unit here has no x: it has an
 * arena column, and the two sides are mirrored into one 8-wide space. So the
 * same thing is said the way this side of the code can check it — the front
 * column of your own half, in a lane your own King occupies.
 *
 * Which also keeps it true if a King is ever placed somewhere else: the
 * guards are wherever the King is, not wherever the King usually is.
 */
function guardsTheKing(state: BattleState, u: Unit): boolean {
  if (u.isKing) return false;
  // facing 1 is side A, whose front is the last column of its own board;
  // side B is mirrored, so its front is the first column of the other half.
  const front = u.facing === 1 ? BOARD.width - 1 : BOARD.width;
  if (u.col !== front) return false;
  const king = state.units.find((k) => k.isKing && k.owner === u.owner && k.alive);
  if (!king) return false;
  return u.lanes.some((l) => king.lanes.includes(l));
}

/** One-time effects that fire when the battle begins. */
export function runOnSpawn(state: BattleState, ops: BattleOps): void {
  for (const u of state.units) {
    if (!u.alive) continue;
    for (const ab of u.abilities) {
      if (ab.trigger !== "onSpawn") continue;

      /*
       * ═══ ROUND THE BACK ═══
       *
       * Or: *"it basically bypasses everyone and reaches the back part of
       * the board, and then turns around and attacks backwards."*
       *
       * Two lines, and the second one is the whole card: it is put at the
       * far end of the enemy's board and TURNED. Everything else follows
       * from the turn — what counts as "ahead" of it is now the enemy's
       * back row, their King's back, and the whole board between it and
       * home. It walks toward its own side eating its way out.
       *
       * At spawn, so it is already there when the battle starts: nothing to
       * intercept, which is what "bypasses everyone" has to mean on a board
       * where every other card has to walk.
       */
      if (ROUND_THE_BACK.includes(ab.type) && !u.flags.dug) {
        u.col = u.facing > 0 ? ARENA.width - 1 : 0;
        u.facing = u.facing > 0 ? -1 : 1;
        u.flags.dug = true;
        state.events.push({ tick: state.tick, type: "dig", uid: u.uid, col: u.col });
      }

      if (ab.type === "sacrificeAdjacent") {
        // The weakest adjacent ally of the same side — but never the King,
        // and never a guard. See guardsTheKing below for why not.
        const victim = state.units
          .filter(
            (o) =>
              o.alive &&
              o !== u &&
              o.owner === u.owner &&
              !o.isKing &&
              !guardsTheKing(state, o) &&
              o.lanes.some((l) => u.lanes.some((ul) => Math.abs(ul - l) <= 1)),
          )
          .sort((a, b) => a.hp - b.hp)[0];
        if (victim) ops.killUnit(victim, u);
        u.armor += num(ab.params.armorGain, 300);
      }
    }
  }
}

/** Time-triggered effects (delayed transforms). */
export function runDelayed(state: BattleState, u: Unit): void {
  const elapsed = state.tick / TPS;
  for (const ab of u.abilities) {
    if (ab.trigger !== "delayed") continue;
    if (ab.type === "delayedTransform" && !u.flags.transformed) {
      if (elapsed >= num(ab.params.afterSeconds, 10)) {
        /*
         * ═══ AND SOMETHING HAS TO COME OUT OF THE EGG ═══
         *
         * Or: *"the Obsidian Egg died and no dragon hatched out of it."*
         *
         * It never could. This added 1500 to `power` and set a flag, and
         * that was the whole of it: no event, no change of any kind that
         * reaches a screen. The card promises "after 10 seconds a dragon
         * hatches from it with +1500 power" and the game turned an egg into
         * a slightly stronger egg — silently, in the middle of a battle, at
         * a moment nothing marked.
         *
         * Two things are added and the second is the one that matters.
         *
         * `into` changes the unit's CARD. Every frame already carries
         * `cardId` to the client, and the client preloads the art of every
         * card that appears in any frame — so a unit that becomes a dragon
         * on tick 300 has a dragon's artwork ready and starts being drawn
         * as one. Nothing new had to be plumbed; the data was already
         * flowing and nothing was changing it.
         *
         * The event is what lets the shell break on screen. Without it the
         * card would still SWAP, which is a cut rather than a hatching.
         */
        u.power += num(ab.params.powerBonus, 0);
        u.flags.transformed = true;
        const into = typeof ab.params.into === "string" ? ab.params.into : null;
        if (into) u.cardId = into;
        state.events.push({
          tick: state.tick,
          type: "transform",
          uid: u.uid,
          cardId: u.cardId,
          owner: u.owner,
        });
      }
    }
  }
}

/** Attacker-side effects that fire when a hit lands. */
export function runOnHit(state: BattleState, attacker: Unit, target: Unit): void {
  for (const ab of attacker.abilities) {
    if (ab.trigger !== "onHit") continue;
    if (silenced(attacker, ab.type)) continue;
    switch (ab.type) {
      case "knockback":
        if (!target.knockbackImmune) {
          target.col = clampCol(target.col + attacker.facing * num(ab.params.slots, 1));
          state.events.push({ tick: state.tick, type: "knockback", uid: attacker.uid, targetUid: target.uid, col: target.col });
        }
        break;
      case "sideKnockback":
        if (!target.knockbackImmune && target.lanes.length === 1) {
          const from = target.lanes[0]!;
          const to = clampLane(state, from + (from < state.lanes - 1 ? 1 : -1) * num(ab.params.columns, 1));
          target.lanes = [to];
          state.events.push({ tick: state.tick, type: "knockback", uid: attacker.uid, targetUid: target.uid, lanes: target.lanes });
        }
        break;
      case "freezeOnHit": {
        const until = state.tick + Math.round(num(ab.params.freezeSeconds, 2) * TPS);
        target.stunnedUntil = Math.max(target.stunnedUntil, until);
        if (ab.params.resetCooldown) target.attackCooldown = target.attackSpeed;
        state.events.push({ tick: state.tick, type: "stun", uid: attacker.uid, targetUid: target.uid, untilTick: until });
        break;
      }
      case "armorBreak":
        target.armor = 0;
        break;
      /*
       * The three neutralisers. Each one is a flag on the card that was hit
       * and nothing else — see SILENCED_BY above for what each switches off.
       *
       * `silenceArmor` is the one that also does something immediately: an
       * armour that is cancelled has to GO, not stop being topped up, or a
       * card that had already banked 300 armour keeps every point of it and
       * the ability reads as doing nothing. It is `armorBreak` plus "and it
       * does not come back", which is exactly what Or described.
       */
      case "silenceHeal":
        target.flags.silencedHeal = true;
        break;
      case "silenceArmor":
        target.flags.silencedArmor = true;
        target.armor = 0;
        target.auraArmor = 0;
        break;
      case "silencePoison":
        target.flags.silencedPoison = true;
        break;
      case "stackingDot":
        // The point of poison: it does not care about armor, and it does not
        // care how much health the thing in front of it has.
        addDotStack(target, num(ab.params.dotPerStack, 40), state.tick);
        break;
      case "elementSteal":
        if (!attacker.flags.elementStolen) {
          attacker.activeElement = target.activeElement;
          attacker.flags.elementStolen = true;
        }
        break;
      default:
        break;
    }
  }
}

/** Target-side reaction to taking damage. Returns reflected damage dealt back. */
/** Within one lane of each other — the reach of an aura that is not global. */
function nearbyLane(a: Unit, b: Unit): boolean {
  return a.lanes.some((la) => b.lanes.some((lb) => Math.abs(la - lb) <= 1));
}

export function runOnDamaged(target: Unit, attacker: Unit, damage: number): number {
  let reflected = 0;
  for (const ab of target.abilities) {
    if (ab.trigger !== "onDamaged") continue;
    if (ab.type === "damageReflect") {
      reflected += Math.floor((damage * num(ab.params.pct, 0)) / 100);
    }
  }
  if (reflected > 0) attacker.hp -= reflected;
  return reflected;
}

/** Attacker-side effect after a kill (trample = keep momentum). */
export function runOnKill(attacker: Unit): void {
  for (const ab of attacker.abilities) {
    if (ab.trigger === "onKill" && ab.type === "trample") {
      attacker.attackCooldown = 0; // immediately ready to engage the next target
    }
  }
}

/** Death-triggered spawning effects (split / swarm). */
export function runOnDeath(state: BattleState, ops: BattleOps, u: Unit): void {
  for (const ab of u.abilities) {
    if (ab.trigger !== "onDeath") continue;
    if (ab.type === "splitOnDeath" || ab.type === "swarmOnDeath") {
      const count = num(ab.params.count, 2);
      const hp = num(ab.params.childHp ?? ab.params.spiritHp, Math.floor(u.maxHp / 2));
      const power = num(ab.params.childPower ?? ab.params.spiritPower, Math.floor(u.power / 2));
      const baseLane = u.lanes[0]!;
      const childUids: string[] = [];
      for (let i = 0; i < count; i++) {
        // fan out into adjacent lanes: 0 -> same, then ±1, ±2 …
        const offset = i === 0 ? 0 : (i % 2 === 1 ? 1 : -1) * Math.ceil(i / 2);
        const child = ops.spawnChild({
          // A smaller one of whatever just died. See ChildProto.
          cardId: u.cardId,
          seriesId: u.seriesId,
          owner: u.owner,
          facing: u.facing,
          col: u.col,
          lane: clampLane(state, baseLane + offset),
          hp,
          power,
          attackSpeed: u.attackSpeed,
          moveSpeed: u.moveSpeed > 0 ? u.moveSpeed : 1,
          element: u.activeElement,
          name: u.name,
        });
        childUids.push(child.uid);
      }
      state.events.push({ tick: state.tick, type: "split", uid: u.uid, childUids });
    }
  }
}

/** Effects when a stacked (Ground Floor) card is revealed. */
export function runOnReveal(state: BattleState, u: Unit): void {
  for (const ab of u.abilities) {
    if (ab.trigger === "onReveal" && ab.type === "rootOnReveal") {
      // Root the enemy directly ahead in this lane.
      const enemy = state.units.find(
        (e) => e.alive && e.owner !== u.owner && sharesLane(e, u),
      );
      if (enemy) enemy.flags.rooted = true;
    }
  }
}
