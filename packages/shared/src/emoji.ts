/**
 * The emoji one player sends the other: which exist, and who owns them.
 *
 * Or: *"the emoji (illustrated, in the theme!) — these beautiful ones are also
 * something you buy in the shop or win in a chest, so that encourages you
 * too."*
 *
 * ═══ WHY THEY ARE DRAWN AND NOT UNICODE ═══
 *
 * The taunts used to carry a 😂 each. A unicode emoji is drawn by whoever made
 * the phone: it looks different on every device, it belongs to nobody, and —
 * the part that decides it here — **it cannot be given to you,** because you
 * already have it. The moment an emoji is a picture this game owns, holding
 * one is a thing, and a chest can contain it.
 *
 * ═══ WHY OWNERSHIP IS A LIST AND NOT A FLAG ON THE ROW ═══
 *
 * `free: true` is what a starter emoji is, and everything else is owned
 * through `player_items` like every other purchasable thing — the shop's one
 * door (apps/server/src/shop.ts `deliver`). So "do I have this" is the same
 * question for an emoji, an avatar and a card skin, and the day a new one is
 * sellable it is grantable in the same commit.
 *
 * The art brief is packages/art/src/emojiLooks.ts, deliberately apart from
 * this: that file draws pictures, this one decides who owns them, and Or can
 * move one from a paid pack to the free set without regenerating anything.
 */

/**
 * How an emoji MOVES when it is sent.
 *
 * Or: *"the emoji you send during a match should be a sort of gif, with
 * animation."* They are — but the movement is CSS over the still drawing
 * rather than sixteen video files, and that is a deliberate trade:
 *
 *   SIXTEEN ANIMATED WEBPS IS MEGABYTES. This is a game a seven-year-old
 *   opens on a phone, over whatever connection is going, and the whole client
 *   bundle is currently 630KB. A set of looping clips would be several times
 *   the game.
 *
 *   AND IT WOULD STILL ONLY MOVE ONE WAY. A still drawing plus a motion is
 *   two independent things: the picture can be redrawn without re-animating
 *   it, and the movement can be retimed without regenerating art.
 *
 * Each one is matched to what the emoji MEANS, which is the part that makes
 * it read as alive rather than as a thing jiggling: a laugh shakes, a shock
 * snaps in, a flame flickers. If Or wants real frame animation later, the
 * pipeline for it exists (packages/art/src/animate.ts) and this field becomes
 * the fallback for anything not yet filmed.
 */
export type EmojiMotion =
  | "pop"
  | "shake"
  | "bob"
  | "swing"
  | "flicker"
  | "beat"
  | "wobble"
  | "spin";

export interface Emoji {
  /** What travels over the wire, and the name of the picture file. */
  id: string;
  /** For a screen reader, and for the shop. */
  he: string;
  en: string;
  /** Everybody has it, with no account and no purchase. */
  free?: boolean;
  /** Which pack it is sold in. Absent on the free ones. */
  pack?: string;
  /** How it moves when it is sent. See EmojiMotion. */
  motion: EmojiMotion;
}

/**
 * The starter eight, and the two packs.
 *
 * Eight free is a deliberate number: enough that a guest can hold a whole
 * conversation and never feel locked out of talking, few enough that the
 * player who buys a pack has visibly more to say. The thing being sold is
 * EXPRESSION, which only works if the free set is a floor rather than a
 * teaser.
 */
export const EMOJI: readonly Emoji[] = [
  // ── everybody has these ──
  { id: "wave", he: "היי", en: "Hi", free: true, motion: "swing" },
  { id: "flex", he: "אני מוכן", en: "Ready", free: true, motion: "beat" },
  { id: "shock", he: "ואו", en: "Whoa", free: true, motion: "pop" },
  { id: "laugh", he: "חחח", en: "Haha", free: true, motion: "shake" },
  { id: "think", he: "רגע, חושב", en: "Thinking", free: true, motion: "bob" },
  { id: "scared", he: "מפחיד", en: "Scary", free: true, motion: "wobble" },
  { id: "crown", he: "כתר", en: "Crown", free: true, motion: "bob" },
  { id: "crumb", he: "פירורים", en: "Crumbs", free: true, motion: "wobble" },

  // ── the monsters pack ──
  { id: "fireskull", he: "גולגולת בוערת", en: "Burning skull", pack: "emoji.monsters", motion: "flicker" },
  { id: "monsterheart", he: "לב מפלצת", en: "Monster heart", pack: "emoji.monsters", motion: "beat" },
  { id: "wink", he: "קריצה", en: "Wink", pack: "emoji.monsters", motion: "pop" },
  { id: "babydragon", he: "דרקונצ'יק", en: "Baby dragon", pack: "emoji.monsters", motion: "bob" },

  // ── the Amanda pack ──
  { id: "smirk", he: "החיוך של אמנדה", en: "Amanda's smirk", pack: "emoji.amanda", motion: "flicker" },
  { id: "firelion", he: "אריה אש", en: "Fire lion", pack: "emoji.amanda", motion: "shake" },
  { id: "slimeblob", he: "ריר שמח", en: "Happy slime", pack: "emoji.amanda", motion: "wobble" },
  { id: "crumbdemon", he: "שד פירורים", en: "Crumb demon", pack: "emoji.amanda", motion: "spin" },
];

/**
 * How a bare emoji is told apart from a taunt on the one `say` channel.
 *
 * Both sides have to agree on this, which is why it is here and not in
 * whichever file happened to need it first. One channel rather than two
 * because the rate limit and the per-match cap apply to both equally — a
 * child hammering one picture is the same problem as hammering one sentence.
 */
export const EMOJI_SAY_PREFIX = "emoji.";

/** The id to send for this emoji. */
export function sayIdFor(emojiId: string): string {
  return EMOJI_SAY_PREFIX + emojiId;
}

/** The emoji a `say` id refers to, or null when it is not one. */
export function emojiFromSayId(id: string): Emoji | undefined {
  return id.startsWith(EMOJI_SAY_PREFIX) ? BY_ID.get(id.slice(EMOJI_SAY_PREFIX.length)) : undefined;
}

const BY_ID = new Map(EMOJI.map((e) => [e.id, e]));

export function emojiById(id: string): Emoji | undefined {
  return BY_ID.get(id);
}

/** What a player may send: the free ones, plus whatever packs they hold. */
export function ownedEmoji(items: readonly string[]): Emoji[] {
  const has = new Set(items);
  return EMOJI.filter((e) => e.free || (e.pack !== undefined && has.has(e.pack)));
}

/** The packs, for the shop and for a chest to pick from. */
export const EMOJI_PACKS: ReadonlyArray<{ id: string; he: string; en: string }> = [
  { id: "emoji.monsters", he: "חבילת מפלצות", en: "Monsters pack" },
  { id: "emoji.amanda", he: "חבילת אמנדה", en: "Amanda pack" },
];
