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
  /* ── the light ones: the game's furniture ── */
  /**
   * A button. Any button: the shop, the tunnel, the way into a match.
   *
   * Or: *"the small vibrations there are now can be on the Asulins logo
   * appearing, and on button presses — going into the shop, into the
   * tunnel, into a game."* So they are not deleted, they are DEMOTED: this
   * is the tick that says a control took the press, and it is the lightest
   * thing in the set because it happens more than anything else.
   */
  tap: 14,
  /** The studio mark coming up. Two feathers, once a session. */
  logo: [12, 70, 18],
  /**
   * A match is starting.
   *
   * Or: *"and when you press start game."* Heavier than a button and
   * lighter than the curtain — the engine turning over.
   */
  go: [80, 50, 80],
  /**
   * The panic is over and the boards are locked.
   *
   * Or: *"and at the start of the panic. And at the END of the panic."* The
   * end of the panic is the one moment in a match where a player's hands
   * stop mattering, and nothing on the screen had said so.
   */
  lock: 170,

  /* ── the heavy ones: the match ── */
  /**
   * A card has left the table and is in your hand.
   *
   * Or: *"the vibrations are really short and not noticeable. There needs
   * to be more vibration in every parameter... also when you take a card."*
   * It was twelve milliseconds, which is at the floor of what a phone's
   * motor can even spin up for. Forty is a thing you feel through a case.
   */
  lift: 40,
  /**
   * An action card is in play. Wound up and let go — and now it is the
   * event it should always have been rather than a flutter.
   */
  action: [45, 55, 90],
  /** And it has been aimed. One heavy thud: the card is spent. */
  aim: 110,
  /**
   * The build phase opening: places, please. Three even beats, mid-weight —
   * the start of something rather than a warning about it.
   */
  build: [70, 60, 70, 60, 70],
  /**
   * Panic. Fast, hard, and ending on the longest pulse of the three — the
   * one pattern here that is meant to be slightly unpleasant, because the
   * phase is.
   */
  panic: [80, 55, 80, 55, 150],
  /**
   * The battle. A beat, a gap, and then the drum: the longest thing in the
   * game, and it happens once a match.
   */
  battle: [110, 70, 300],
  /** Something of theirs came apart. The lightest of the three deaths —
      this one is good news, and it can happen twenty times. */
  kill: 35,
  /**
   * Something of YOURS. Or: *"also when our soldiers die."* Three times the
   * kill and dull with it, so the difference is felt rather than counted.
   */
  fallen: 120,

  /* ── and the end of it ── */
  /**
   * The match is over and you won. A fanfare: three beats and a long one.
   *
   * Or: *"also at the end of a match."* It is the one moment in the game
   * that has earned a vibration a child will describe to somebody.
   */
  victory: [90, 60, 90, 60, 320],
  /** And when it is lost: one long, flat weight. Nothing rhythmic about it. */
  defeat: [260],
  /**
   * A chest, being pressed and being opened.
   *
   * Or: *"and of course also when you press a chest."* Heavy, because a
   * chest is the heaviest object in the game.
   */
  chest: [60, 50, 160],
  /**
   * The prize coming out: diamonds, cards, anything that flies to the purse.
   *
   * Or: *"and when diamonds are taken."* A rattle rather than a thud — many
   * small things arriving, which is exactly what is on the screen.
   */
  gems: [40, 40, 40, 40, 110],
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
const FLOOR: Partial<Record<Buzz, number>> = {
  /*
   * ⚠ A BUTTON ANSWERS ONCE. Every control in the game buzzes through the
   * listener in main.tsx, and the handful that also go through `pressed`
   * would otherwise fire twice on one finger — which on a short pattern is
   * not two taps, it is one longer one, and the difference between a
   * button and a prize stops being legible.
   */
  tap: 90,
  /*
   * ⚠ RAISED WITH THE PATTERNS. A death is 35ms or 120ms now rather than
   * 18 or 55, so the old 200ms floor would have let a wipe run the motor
   * for more than half of every second — which is the drone this floor
   * exists to prevent. 320 leaves a clear gap between two of them.
   */
  kill: 320,
  fallen: 320,
};
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
