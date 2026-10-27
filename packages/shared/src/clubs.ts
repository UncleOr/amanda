/**
 * Clubs: a few children who play together, and what that lets them do.
 *
 * Or set the whole thing out in one go: *"another button on the home board
 * for 'Club'. Opens a popup. Anyone can found a club and send an invitation
 * to friends, or join an existing club by a 6-digit code. You can of course
 * also leave a club. The club's manager — its founder — can change the name
 * and the emblem, and if you own a club you also get club emblems in the
 * shop. Inside the club there are the club's own challenges… a club member
 * can ask for a card and another member can donate it to them."*
 *
 * ═══ THE RULES THAT MATTER ARE THE ONES ABOUT CHILDREN ═══
 *
 * Everything else here is bookkeeping. These are not:
 *
 *   A DONATION NEVER COSTS A CARD. Or: *"you only donate a card if you
 *   already have it — it slows down your next upgrade, but a card is never
 *   taken from you and never downgraded."* So a donation moves ONE copy, is
 *   refused unless the giver has a spare above what their current level
 *   needs, and can never reduce a card's level. See `canSpare`.
 *
 *   A CODE IS THE PERMISSION. Six digits, like the friend code: you cannot
 *   guess one and you cannot walk the space, so the only way to have a
 *   club's code is for somebody to have given it to you. That is the same
 *   consent the "you must have played them" rule stands in for everywhere
 *   else in this game, in a shape two children in one room can use.
 *
 *   THE CHAT IS FILTERED BEFORE IT IS STORED. Or: *"swear words and rude
 *   words and sensitive words are deleted immediately, a second warning
 *   throws the person out of the club. Either way a report reaches the game
 *   admins."* So the check runs on the server, the message never lands, and
 *   the only thing written down is the report.
 *
 * ═══ AND THE ONE DECISION HE LEFT OPEN ═══
 *
 * Or: *"club challenges reward all the club's members with chests — we need
 * to decide how to do this cleverly so there are not too many prizes."*
 *
 * Measured against what the game already pays. A win is a chest (wood, with
 * silver every 30 trophies and gold every 90); a wooden chest is 3 cards and
 * 5 diamonds, a gold one 8 cards and 40.
 *
 * The answer is the CONTRIBUTION GATE, and it is the only thing standing
 * between clubs and a printing press: a club challenge pays the members who
 * actually pushed it along, not everybody wearing the badge. A club of forty
 * where six played pays six chests, not forty. Without it, joining the
 * biggest club in the game would be worth more than playing it.
 *
 * With it, the numbers are a nudge rather than an economy: a daily wooden
 * chest is worth about one extra win a day, a weekly silver about a third of
 * a day, and the monthly gold is one more of something a player already
 * earns every 90 trophies.
 */

/* ───────────────────────── the club itself ───────────────────────── */

/** Six digits, said out loud across a room. */
export const CLUB_CODE_LENGTH = 6;

/**
 * How many can be in one.
 *
 * Small on purpose. A club is "the people you actually play with" — if it
 * holds a hundred it becomes a place strangers are, which is the thing this
 * game's friends list was carefully built to avoid.
 */
export const MAX_CLUB_MEMBERS = 30;

export const CLUB_NAME_MAX = 20;

/** How many messages the popup keeps. Older ones are gone, not hidden. */
export const CLUB_CHAT_KEEP = 60;
export const CLUB_MESSAGE_MAX = 120;

/**
 * The emblems, which are the game's own icons rather than new art.
 *
 * Or: *"the manager can change the name and emblem (from a number of
 * existing emblems), and if you are the owner of a club the option of club
 * emblems in the shop also opens up for you."*
 *
 * So there are two sets. These come with the club.
 */
export const CLUB_EMBLEMS = [
  "king",
  "guard",
  "skull",
  "fire",
  "thorns",
  "monster",
  "flag",
  "win",
] as const;

/** And these are bought, and only an owner is shown them. See shop_items. */
export const CLUB_EMBLEMS_FOR_SALE = [
  "robot",
  "joker",
  "infinity",
  "nacho",
  "explode",
  "blood",
] as const;

export type ClubEmblem = string;

/** The emblem a club has before anybody chooses one. */
export const DEFAULT_EMBLEM = "flag";

export function isFreeEmblem(id: string): boolean {
  return (CLUB_EMBLEMS as readonly string[]).includes(id);
}

/* ───────────────────────── the words ───────────────────────── */

/**
 * ═══ WHAT NEVER GETS POSTED ═══
 *
 * Or: *"anyone can send a message in the club's public chat. Swear words and
 * curses and sensitive words are deleted immediately; a second warning
 * throws the person out of the club. Either way a report is received by the
 * game's admins. You can also report a club member."*
 *
 * A seed list, Hebrew and English, and it is deliberately short: it covers
 * the words a seven-year-old actually tries, and it is Or's to extend — he
 * writes the words in this game and this is a list of words.
 *
 * ⚠ A LIST IS NOT MODERATION. It will miss things, and it will catch an
 * innocent sentence now and then. That is why the rule above it is shaped
 * the way it is: the first catch is a WARNING with the reason said out loud,
 * not a ban, and a human sees every one of them. The list is the fast half;
 * the report is the half that is actually right.
 *
 * Matching ignores case, and ignores the letters children pad words with to
 * get past exactly this kind of list — see `normalise`.
 */
const BANNED = [
  // Hebrew
  "זין", "כוס", "זונה", "מניאק", "חרא", "תזדיין", "תזדייני", "שרמוטה",
  "בן זונה", "לך תמות", "תמות", "אנס", "אונס", "נאצי", "היטלר",
  // English
  "fuck", "shit", "bitch", "slut", "whore", "cunt", "dick", "rape",
  "nazi", "hitler", "kys", "kill yourself", "retard", "faggot", "nigger",
];

/**
 * Things nobody should be typing into a children's game whether or not they
 * are rude: a phone number, an address, a way to be contacted elsewhere.
 *
 * Or's *"sensitive words"*. This half is not about language at all — it is
 * about a child being moved off a moderated chat and onto one that is not.
 */
const CONTACT = [
  /\b\d{2,3}[-\s]?\d{7}\b/,            // an Israeli phone number
  /\b\d{9,}\b/,                        // a long run of digits: a number or an id
  /[\w.+-]+@[\w-]+\.[\w.]+/,           // an email address
  /\b(whatsapp|וואטסאפ|ווטסאפ|telegram|טלגרם|discord|דיסקורד|instagram|אינסטגרם|tiktok|טיקטוק|snapchat)\b/i,
  /https?:\/\//i,
];

/**
 * Fold away the tricks, so "f u c k" and "fuuuck" are the same word.
 *
 * Runs of one letter collapse to one, and anything that is not a letter or a
 * digit goes. Hebrew has no case, so lowercasing only touches the English.
 */
function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .replace(/(.)\1{1,}/gu, "$1");
}

export interface WordCheck {
  ok: boolean;
  /** Which rule caught it, for the report a human will read. */
  reason: "words" | "contact" | "empty" | "long" | null;
}

/** Is this fit to post? The server asks before anything is written down. */
export function checkMessage(raw: string): WordCheck {
  const text = raw.trim();
  if (!text) return { ok: false, reason: "empty" };
  if (text.length > CLUB_MESSAGE_MAX) return { ok: false, reason: "long" };
  for (const rx of CONTACT) if (rx.test(text)) return { ok: false, reason: "contact" };
  const flat = normalise(text);
  for (const word of BANNED) {
    if (flat.includes(normalise(word))) return { ok: false, reason: "words" };
  }
  return { ok: true, reason: null };
}

/** A club's name goes through the same sieve, for the same reasons. */
export function checkClubName(raw: string): WordCheck {
  const text = raw.trim();
  if (!text) return { ok: false, reason: "empty" };
  if (text.length > CLUB_NAME_MAX) return { ok: false, reason: "long" };
  const flat = normalise(text);
  for (const word of BANNED) {
    if (flat.includes(normalise(word))) return { ok: false, reason: "words" };
  }
  return { ok: true, reason: null };
}

/**
 * How many strikes before the door.
 *
 * Or: *"a second warning throws the person out of the club."* So the first
 * catch warns and the second removes — two strikes, and the removal is from
 * the CLUB and not from the game, because a club is a room a child can be
 * asked to leave without losing everything they own.
 */
export const WARNINGS_BEFORE_REMOVAL = 2;

/* ───────────────────────── the challenges ───────────────────────── */

/*
 * The SAME `Period` the personal challenges use, and the same `periodKey`.
 *
 * There was a second copy of both here for about ten minutes, with its own
 * timezone arithmetic and its own idea of when a week starts. Two functions
 * that must agree about "today" and do not is how a club challenge would
 * roll over on a different evening from the daily one beside it.
 */
import { type Period, periodKey } from "./challenges.js";

export type ClubPeriod = Period;

export interface ClubChallenge {
  id: string;
  period: ClubPeriod;
  /** What the club is counting together. */
  kind: "trophies" | "cards" | "wins" | "battles";
  /** How much of it, across everybody. */
  target: number;
  /** What each CONTRIBUTING member gets when it lands. */
  chest: "wood" | "silver" | "gold";
}

/**
 * The three that are always running.
 *
 * One of each cadence and no more, so the popup never shows a wall. The
 * targets are club-wide sums: thirty people each winning three matches
 * finish the daily between them, and so do three people winning thirty.
 *
 * `battles` counts matches played between two members of the same club,
 * which is the one Or asked for by name: *"club members can have a battle
 * in one click if both are connected = there will also be challenges
 * connected to that."*
 */
export const CLUB_CHALLENGES: ClubChallenge[] = [
  { id: "club.day.wins", period: "daily", kind: "wins", target: 25, chest: "wood" },
  { id: "club.week.trophies", period: "weekly", kind: "trophies", target: 600, chest: "silver" },
  { id: "club.week.battles", period: "weekly", kind: "battles", target: 20, chest: "silver" },
  { id: "club.month.cards", period: "monthly", kind: "cards", target: 400, chest: "gold" },
];

/* ───────────────────────── donating a card ───────────────────────── */

/**
 * May this player give one copy of this card away?
 *
 * Or: *"you only donate a card if you already have it — this slows down your
 * next upgrade but a card will never be taken from you and never
 * downgraded."*
 *
 * Both halves are here. `copies > 0` is "you have one to give", and that is
 * all it takes: copies are the spare change above the level a card is
 * already at, so giving one away cannot reach the card itself. The level is
 * never read and never written.
 */
export function canSpare(owned: { copies: number } | undefined): boolean {
  return !!owned && owned.copies > 0;
}

/** How many copies one request may collect before it closes. */
export const DONATIONS_PER_REQUEST = 5;

/** And how often a member may ask, so a request is worth answering. */
export const REQUEST_EVERY_HOURS = 8;
