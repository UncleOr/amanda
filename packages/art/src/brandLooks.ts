/**
 * Amanda herself.
 *
 * She is NOT invented here. Her design is canon and comes from the original
 * card deck — `assets/reference/monster-cards-with-bleed.pdf`, page 8, cropped
 * to `assets/reference/amanda-canon.png`. Her card reads:
 *
 *   אמנדה · #∞ · סדרה: האגדיים · כוח: תוהו · טורפת נשמות · ∞ hp · ∞ power
 *
 * A first attempt at this file guessed a smug purple horned brute from her
 * voice alone and got every single thing wrong. Anything generated from here
 * answers to the reference image, not to a description of her personality.
 *
 * One open question, flagged rather than decided: the reference is a soft
 * DIGITAL PAINTING, while every card in the game is `darkcomic` — heavy ink,
 * cel shading. These briefs keep her design and take the game's style so she
 * sits beside the cards. Matching the painting instead is a one-word change.
 */

/** Amanda's canon description — shared by every brand image so she stays one creature. */
export const AMANDA = [
  "AMANDA, a towering three-headed spirit queen.",
  "CENTRE HEAD: a CHARACTERFUL face of glowing teal-cyan spirit-fire — big",
  "expressive glowing eyes with visible pupils, strong brows, a wide knowing",
  "grin. A CHARACTER with a personality, NOT a skull: she has cheeks, a nose",
  "and an expression. No bare skull, no hollow eye sockets, no gaunt corpse.",
  "A crown-like halo of swirling ghost flame rises off her head.",
  "LEFT HEAD: a teal serpent-dragon head on a long neck, mouth open, cartoonish",
  "and lively rather than vicious.",
  "RIGHT HEAD: a lion head with a mane of living orange fire, mouth open mid-roar,",
  "bold and heroic rather than savage.",
  "BODY: tall and flowing, deep navy-blue, draped like smoke, trailing off into",
  "mist and embers instead of legs. Long arms with bold clawed hands.",
  "Golden glowing runes float around her.",
  "Palette: icy teal and cyan against ember orange, over deep midnight blue.",
  "Ancient, vast, amused and pleased with herself — a QUEEN, not a horror.",
  "Readable and appealing to a CHILD. NO gore, NO blood, NO skulls, NOT scary.",
].join(" ");

/**
 * Chuppy — the player's friend, handed over at the very start, the way Ash has
 * Pikachu. Canon is page 9 of the original deck:
 * צ'ופי · #52 · הפרוותיים · חשמל · מכת חישמולייזר, kept at
 * `assets/reference/chuppy-canon.png`. A cheerful fuzzy one, not a monster to
 * be afraid of — that is the whole point of him.
 */
export const CHUPPY = [
  "CHUPPY: a small cheerful fuzzy monster, bright golden-yellow shaggy fur,",
  "a rounded blob body with stubby arms and little rounded fists, two big",
  "round friendly eyes with large dark pupils, THICK bold black eyebrows that",
  "give him a determined cheeky look, a wide open happy grin with one small",
  "tooth, a tuft of spiky fur on top of his head.",
  "Crackling yellow electricity arcs around him, a few bold lightning bolts.",
  "Plucky, funny and likeable — a best friend, NOT frightening, NO fangs,",
  "NO menace. Appealing to a child.",
].join(" ");


/**
 * The two faces on the opening screen.
 *
 * They were emoji — 🤖 and 🧑 — which is exactly what Or means by borrowed.
 * The robot is the everyday opponent (Amanda is NOT: she is the event, see
 * AMANDA-MODE.md), so he is a sparring partner, not a villain: a bit battered,
 * a bit cocky, clearly beatable. The player avatar is deliberately neutral —
 * any kid should be able to see themselves in it.
 */
export const ROBOT = [
  "A friendly battle-robot opponent, head and shoulders, facing forward.",
  "Boxy rounded metal head in steel grey and red, two big round glowing",
  "cyan eye-lenses, a small antenna bent slightly off true, a dented plate",
  "on one cheek, a confident lopsided grin cut into the faceplate.",
  "Scuffed and well used — a sparring partner, not a menace. Appealing to a child.",
].join(" ");

export const PLAYER = [
  "A cheerful young duelist, head and shoulders, facing forward, grinning.",
  "Deliberately generic so any child can read themselves into it: warm skin",
  "tone, tousled hair, bright eyes, a raised collar or hood. No logos, no team",
  "colours, nothing that fixes who they are. Confident and ready.",
].join(" ");

/**
 * Avatars a player can pick for themselves.
 *
 * Or: "important to add girls too" — the first eight were knights, goblins and
 * robots, which is a boy's shelf by accident rather than by choice. The set is
 * mixed now, and several are neither.
 *
 * Drawn in the game's own language rather than taken from a stock set — the
 * same reason the emoji went. Deliberately a crowd with no "default" one at
 * the front: a child should pick the one they like, not accept the first.
 */
export const AVATARS: Record<string, string> = {
  av_sorceress:
    "a young sorceress girl with long braided hair and a star-flecked hood, confident, head-and-shoulders, facing forward, centred and symmetrical, " +
    "filling the middle 70% with clear margin all round so it survives a circular " +
    "crop, flat deep-blue backdrop with a soft glow, readable at 48 pixels",
  av_warrior:
    "a girl warrior with a bandana, a small scar on one cheek and a determined grin, head-and-shoulders, facing forward, centred and symmetrical, " +
    "filling the middle 70% with clear margin all round so it survives a circular " +
    "crop, flat deep-blue backdrop with a soft glow, readable at 48 pixels",
  av_fairy:
    "a small fairy girl with iridescent insect wings and a messy bob, cheeky, head-and-shoulders, facing forward, centred and symmetrical, " +
    "filling the middle 70% with clear margin all round so it survives a circular " +
    "crop, flat deep-blue backdrop with a soft glow, readable at 48 pixels",
  av_vampire:
    "a friendly young vampire girl with a dark bob and two small fangs, amused, head-and-shoulders, facing forward, centred and symmetrical, " +
    "filling the middle 70% with clear margin all round so it survives a circular " +
    "crop, flat deep-blue backdrop with a soft glow, readable at 48 pixels",
  av_alien:
    "a cheerful little green alien with huge black eyes and antennae, head-and-shoulders, facing forward, centred and symmetrical, " +
    "filling the middle 70% with clear margin all round so it survives a circular " +
    "crop, flat deep-blue backdrop with a soft glow, readable at 48 pixels",
  av_mummy:
    "a small mummy wrapped in loose bandages with one bright eye peeking out, head-and-shoulders, facing forward, centred and symmetrical, " +
    "filling the middle 70% with clear margin all round so it survives a circular " +
    "crop, flat deep-blue backdrop with a soft glow, readable at 48 pixels",
  av_pirate:
    "a girl pirate with a tricorn hat and a gold earring, winking, head-and-shoulders, facing forward, centred and symmetrical, " +
    "filling the middle 70% with clear margin all round so it survives a circular " +
    "crop, flat deep-blue backdrop with a soft glow, readable at 48 pixels",
  av_wolf:
    "a shaggy young werewolf pup with floppy ears, tongue out, friendly, head-and-shoulders, facing forward, centred and symmetrical, " +
    "filling the middle 70% with clear margin all round so it survives a circular " +
    "crop, flat deep-blue backdrop with a soft glow, readable at 48 pixels",
  av_knight:
    "a young knight in a dented helmet, visor up, grinning, head-and-shoulders, facing forward, centred and symmetrical, " +
    "filling the middle 70% with clear margin all round so it survives a circular " +
    "crop, flat deep-blue backdrop with a soft glow, readable at 48 pixels",
  av_witch:
    "a small witch in a crooked pointed hat, mischievous smile, head-and-shoulders, facing forward, centred and symmetrical, " +
    "filling the middle 70% with clear margin all round so it survives a circular " +
    "crop, flat deep-blue backdrop with a soft glow, readable at 48 pixels",
  av_goblin:
    "a cheeky green goblin with big ears and one gold tooth, head-and-shoulders, facing forward, centred and symmetrical, " +
    "filling the middle 70% with clear margin all round so it survives a circular " +
    "crop, flat deep-blue backdrop with a soft glow, readable at 48 pixels",
  av_robot:
    "a round-headed little robot with one glowing cyan eye-lens, head-and-shoulders, facing forward, centred and symmetrical, " +
    "filling the middle 70% with clear margin all round so it survives a circular " +
    "crop, flat deep-blue backdrop with a soft glow, readable at 48 pixels",
  av_ghost:
    "a friendly pale ghost with huge dark eyes, slightly cross-eyed, head-and-shoulders, facing forward, centred and symmetrical, " +
    "filling the middle 70% with clear margin all round so it survives a circular " +
    "crop, flat deep-blue backdrop with a soft glow, readable at 48 pixels",
  av_cat:
    "a fluffy orange monster-cat with two small horns, smug, head-and-shoulders, facing forward, centred and symmetrical, " +
    "filling the middle 70% with clear margin all round so it survives a circular " +
    "crop, flat deep-blue backdrop with a soft glow, readable at 48 pixels",
  av_slime:
    "a happy translucent green slime blob with a face, head-and-shoulders, facing forward, centred and symmetrical, " +
    "filling the middle 70% with clear margin all round so it survives a circular " +
    "crop, flat deep-blue backdrop with a soft glow, readable at 48 pixels",
  av_dragon:
    "a baby dragon with oversized wings and a cheerful snaggletooth, head-and-shoulders, facing forward, centred and symmetrical, " +
    "filling the middle 70% with clear margin all round so it survives a circular " +
    "crop, flat deep-blue backdrop with a soft glow, readable at 48 pixels",
};

/** One brief per brand image. */
export const BRAND_LOOK: Record<string, string> = {
  ...AVATARS,
  // The face. Everything else is cropped from this, so it is centred and
  // symmetrical with nothing important near the edges.
  amanda_portrait:
    `${AMANDA} Head-and-shoulders portrait of the CENTRE head, facing straight ahead, ` +
    "perfectly centred and symmetrical, the serpent head and the burning lion head " +
    "flanking her at the edges of the shoulders. Deep midnight-blue backdrop with a " +
    "faint rune glow. The subject fills the middle 70% with clear margin on all four " +
    "sides so it survives being cropped to a circle. Readable silhouette at tiny sizes. " +
    "Warm and charismatic, the villain a child quotes.",

  // The logo lockup. No lettering is asked for — Hebrew is not something an
  // image model can spell, and the wordmark is set in the app over this.
  amanda_logo:
    `${AMANDA} An emblem: her three heads and clawed upper body inside a bold rounded ` +
    "badge with a thick outline, like a sticker-album crest. Monster cards fan out " +
    "behind her shoulders on both sides. Centred and symmetrical. " +
    // Asking for transparency once got a checkerboard PAINTED INTO the picture —
    // the pattern an editor draws to SHOW transparency. Ask for a flat colour and
    // cut it out afterwards instead (see cutBackdrop in process.ts).
    "Background: one FLAT SOLID dark midnight-blue colour filling the whole frame, " +
    "absolutely no checkerboard pattern, no grey squares, no transparency grid. " +
    "NO TEXT, NO LETTERS, NO WORDS of any kind.",

  // Chuppy's face, for menus and for the card that starts every album.
  chuppy_portrait:
    `${CHUPPY} Head-and-shoulders portrait, facing straight ahead, perfectly ` +
    "centred and symmetrical, grinning at the viewer. Deep electric-blue backdrop " +
    "with a bright crackling glow behind him. The subject fills the middle 70% " +
    "with clear margin on all four sides. Readable silhouette at tiny sizes.",

  // Chuppy full-length, the way a card shows him.
  chuppy_card:
    `${CHUPPY} Full body, standing and leaning forward with both little fists ` +
    "raised, mid-cheer, lightning bolts forking down on both sides of him against " +
    "a deep electric-blue sky. Energetic hero pose.",

  // The opening screen's two faces, cropped to circles by the UI.
  versus_robot:
    `${ROBOT} Perfectly centred and symmetrical head-and-shoulders portrait, ` +
    "the subject filling the middle 70% with clear margin on all four sides so " +
    "it survives being cropped to a circle. Flat deep-blue backdrop with a soft " +
    "glow behind the head. Readable at small sizes.",

  versus_player:
    `${PLAYER} Perfectly centred and symmetrical head-and-shoulders portrait, ` +
    "the subject filling the middle 70% with clear margin on all four sides so " +
    "it survives being cropped to a circle. Flat deep-blue backdrop with a soft " +
    "glow behind the head. Readable at small sizes.",

  // Wide art for the Amanda-mode screen, where she shares the frame with UI.
  amanda_banner:
    `${AMANDA} Wide horizontal banner. Amanda looms in from the RIGHT side of the ` +
    "frame at full height, arms spread wide, looking down at the viewer. The LEFT " +
    "HALF is near-empty midnight atmosphere with drifting runes and embers — " +
    "deliberate negative space for text. NO TEXT, NO LETTERS.",
};


/** Shape each brand image is generated at. */
export const BRAND_ASPECT: Record<string, "1:1" | "16:9" | "3:4"> = {
  amanda_portrait: "1:1",
  chuppy_portrait: "1:1",
  versus_robot: "1:1",
  ...Object.fromEntries(Object.keys(AVATARS).map((k) => [k, "1:1" as const])),
  versus_player: "1:1",
  chuppy_card: "3:4",
  amanda_logo: "1:1",
  amanda_banner: "16:9",
};

export function buildBrandPrompt(id: string, styleBrief: string): string {
  return [
    BRAND_LOOK[id],
    "Single character, clean and uncluttered, poster-quality, no watermark, no signature.",
    `Art style: ${styleBrief}`,
  ].join(" ");
}
