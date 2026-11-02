/**
 * ═══ THE GAME IN YOUR HAND ═══
 *
 * Or: *"I want to add vibration: when you pick a card up, when you play an
 * action card (and also when you have chosen a position for an action card —
 * which card to strengthen, say, or which enemy card to destroy), when the
 * panic phase starts, when the battle starts, and every time a monster dies
 * or an enemy monster dies. Obviously each of them needs a slightly different
 * vibration."*
 *
 * Which is the whole design: a phone has ONE motor and it is not a speaker,
 * so the only thing that distinguishes one event from another is RHYTHM —
 * how many pulses, how long, how far apart. The seven below are meant to be
 * told apart through a pocket, so they are built out of three ideas:
 *
 *   a TICK (10-30ms)   something small happened because you touched it
 *   a THUD (40-90ms)   something happened to a card
 *   a ROLL (2+ pulses) something happened to the MATCH
 *
 * ⚠ RHYTHM, NOT STRENGTH. `navigator.vibrate` has no amplitude — a number is
 * a duration and nothing else, and anything under about 10ms is below what a
 * phone's motor can even spin up for. A "gentle" buzz is a SHORT one.
 *
 * ⚠ AND THE MOTOR IS A QUEUE OF ONE. A new call cancels whatever is still
 * running, so two events in the same frame are not two feelings, they are the
 * second one. A battle kills twenty cards in a second; without the floors
 * below that is not a drumroll, it is a single continuous drone, and the
 * phone in a seven-year-old's hands buzzes for fifteen seconds without
 * stopping. See `FLOOR`.
 *
 * Where it does nothing at all: every desktop browser, and every iPhone —
 * Safari has never shipped `navigator.vibrate` and the Taptic engine is not
 * reachable from a web page. This game is played on an Android phone, and on
 * anything else the calls are free and silent.
 */

/**
 * The seven, as `navigator.vibrate` patterns.
 *
 * A number is one pulse. An array alternates buzz, pause, buzz — so
 * `[14, 40, 26]` is a short one, a gap you can feel, then a longer one.
 */
const PATTERN = {
  /**
   * A card has left the table and is in your hand. The lightest thing here:
   * it fires on a gesture you make dozens of times in a build phase, and it
   * is a confirmation, not an event.
   */
  lift: 12,
  /**
   * An action card is in play. Two pulses, the second longer — a thing
   * wound up and then let go, which is what an action card is.
   */
  action: [14, 45, 30],
  /**
   * And it has been aimed. One firm thud: the decision is made and the card
   * is spent.
   */
  aim: 45,
  /**
   * The build phase opening: places, please. Two even taps, mid-weight —
   * the start of something rather than a warning about it.
   *
   * Or asked for this one after the others: *"and it needs to be at the
   * start of the battle and at the start of the build phase too."*
   */
  build: [25, 55, 25],
  /**
   * Panic. Three short pulses in a row, fast — the one pattern here that is
   * meant to be slightly unpleasant, because the phase is.
   */
  panic: [40, 60, 40, 60, 40],
  /**
   * The battle. A short pulse, a beat, then a long one: the drum before the
   * charge. The longest single buzz in the game, and it happens once.
   */
  battle: [60, 70, 170],
  /** Something of theirs came apart. A crisp tick — this one is good news. */
  kill: 18,
  /**
   * Something of yours. Heavier and duller than the kill, and twice as long,
   * so the difference is felt rather than counted.
   */
  fallen: 55,
} as const;

export type Buzz = keyof typeof PATTERN;

/**
 * How long after one of these before another of the SAME kind is allowed.
 *
 * Only the two that can arrive in a crowd need one. Deaths share a single
 * floor rather than having one each: ten of yours and ten of theirs falling
 * together is still one moment, and alternating two patterns through it
 * would feel like neither.
 */
const FLOOR: Partial<Record<Buzz, number>> = { kill: 200, fallen: 200 };
/** Deaths of both kinds answer to one clock. See FLOOR. */
const GROUP: Partial<Record<Buzz, string>> = { kill: "death", fallen: "death" };

const lastAt = new Map<string, number>();

const KEY = "amanda.haptics";

/**
 * On by default, and remembered per device.
 *
 * The opposite of the music, which is off until asked for: vibration is part
 * of how the game feels rather than something playing over it, and a setting
 * nobody finds should be the one that is right for most people.
 */
function loadEnabled(): boolean {
  try {
    return localStorage.getItem(KEY) !== "off";
  } catch {
    return true; // a private window cannot remember, and that is survivable
  }
}

let enabled = loadEnabled();

export const haptics = {
  /**
   * Buzz, if this phone can and this player wants it.
   *
   * Swallows everything. A browser that refuses (no motor, a page that has
   * not been touched yet, a device policy) must never take a card placement
   * or a battle down with it.
   */
  buzz(name: Buzz): void {
    if (!enabled) return;
    if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
    const key = GROUP[name] ?? name;
    const floor = FLOOR[name];
    if (floor !== undefined) {
      const now = Date.now();
      if (now - (lastAt.get(key) ?? -Infinity) < floor) return;
      lastAt.set(key, now);
    }
    try {
      navigator.vibrate(PATTERN[name] as number | number[]);
    } catch {
      /* best effort, always */
    }
  },

  /** Stop whatever is running — the match is over, or the app went away. */
  silence(): void {
    if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
    try {
      navigator.vibrate(0);
    } catch {
      /* ignore */
    }
  },

  isEnabled(): boolean {
    return enabled;
  },

  /** Turn it on or off. Returns the new state. */
  toggleEnabled(): boolean {
    enabled = !enabled;
    try {
      localStorage.setItem(KEY, enabled ? "on" : "off");
    } catch {
      /* ignore */
    }
    if (!enabled) this.silence();
    /*
     * ⚠ THE SWITCH IS ALSO THE TEST, so it answers with something nobody
     * can miss.
     *
     * It used to answer with `lift`, which is twelve milliseconds — the
     * lightest thing in the set, and completely indistinguishable from "this
     * phone cannot vibrate at all". That matters because the three reasons a
     * phone stays still (the app has no VIBRATE permission, the handset is
     * on silent, the browser has never been touched) are invisible from in
     * here, and this row is the only place a player can ask the question.
     */
    else this.buzz("panic");
    return enabled;
  },
};

/** The patterns, for the test that keeps them tellable apart. */
export const PATTERNS = PATTERN;
