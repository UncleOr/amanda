/**
 * A name and a face for somebody who never chose one.
 *
 * Or: *"a player with no nickname gets an automatic handle like the bot's,
 * and a default picture (but not an emoji)."*
 *
 * ═══ WHY THIS WAS NEEDED ═══
 *
 * Or: *"in a 1v1 on the computer you don't see the opponent's name."* It was
 * not a display bug. Asked of the database: **113 players, 10 with a
 * nickname.** Ninety-one percent of everybody who has opened this game has no
 * name to show, so the screen correctly fell back to the word for
 * "somebody" — and the versus screen, which exists to make the opponent a
 * person, introduced you to a stranger with no face.
 *
 * ═══ STABLE, NOT RANDOM ═══
 *
 * The handle is derived from the player's own id, so it is the same every
 * time they play and the same for everyone who meets them. A random one would
 * make the same opponent a different person in every match, which is worse
 * than having no name at all.
 *
 * It is a PLACEHOLDER, not an identity: the moment somebody types a nickname
 * theirs wins, here and everywhere.
 */
import { AVATAR_IDS } from "./avatars.js";

/**
 * FNV-1a, 32-bit.
 *
 * Written out rather than imported because it has to give the same answer in
 * the browser and on the server, forever — a hash that changes implementation
 * renames every player at once.
 */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * The words an automatic handle is built from.
 *
 * Same register as the bots' — Or asked for that in so many words — and in
 * Latin letters in both languages, because a gamer tag is the same string
 * everywhere and transliterating one makes it a word rather than a handle.
 */
const BASES = [
  "CyberFang", "PixelGoblin", "SlimeLord", "BoneRattler", "NeonWitch",
  "TurboSnail", "GlitchWolf", "StinkBomb", "MegaTooth", "VoidKitten",
  "RustKnight", "BubbleDoom", "ThunderMoth", "GrumpyYeti", "LaserNoodle",
  "MossTitan", "ZapperBee", "CrumbEater", "IronPickle", "GhostWaffle",
  "DustDragon", "SourSprite", "BoltGremlin", "FuzzBeast",
] as const;

/** 90 numbers, so the same base reads as a different player. */
const NUMBERS = 90;

/** A handle for a player who has not chosen one. Stable for that player. */
export function handleFor(playerId: string): string {
  const h = hash(playerId);
  return `${BASES[h % BASES.length]}${10 + (Math.floor(h / BASES.length) % NUMBERS)}`;
}

/**
 * A face for a player who has not chosen one.
 *
 * Only from the FREE list: a default that happens to be something the shop
 * sells would either give it away or draw a face the player does not own.
 */
export function avatarFor(playerId: string): string {
  return AVATAR_IDS[hash(`${playerId}:face`) % AVATAR_IDS.length]!;
}

/**
 * What to show for somebody, whether or not they ever filled anything in.
 *
 * `playerId` may be missing — a bot has no account, and a guest's card can
 * arrive before their id does. Then there is nothing to be stable about and
 * the caller's own fallback is the honest answer.
 */
export function shownName(nickname: string | null | undefined, playerId?: string | null): string | null {
  const own = nickname?.trim();
  if (own) return own;
  return playerId ? handleFor(playerId) : null;
}

export function shownAvatar(avatar: string | null | undefined, playerId?: string | null): string | null {
  if (avatar) return avatar;
  return playerId ? avatarFor(playerId) : null;
}
