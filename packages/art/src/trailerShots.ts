/**
 * The trailer's opening, shot by shot.
 *
 * ═══ WHY THIS FILE IS THE STORYBOARD ═══
 *
 * Or, on the first version: *"The storyboard isn't good. Right now they look
 * like two-dimensional cards. They need to really look like they're walking,
 * flying and hovering in the petrol station, and the four of them fighting
 * Amanda, in beautiful cinematic shots. This probably needs to be more than
 * four frames just for the opening."*
 *
 * He is right, and the first version could not have shown him otherwise: it
 * was a paragraph of description plus a contact sheet of the CARDS, which is
 * exactly what two-dimensional cards look like. There is no way to judge a
 * cinematic shot from a description of it.
 *
 * So the storyboard is generated. A still costs about fifteen cents and the
 * motion costs twice that, so the order is: make all eight stills, look at
 * them, throw away the bad ones, and only then animate the survivors.
 * Nothing here ever regenerates a file that is already on disk.
 *
 * ═══ EACH SHOT MOVES ONE CHARACTER, ON PURPOSE ═══
 *
 * Or asked for all five fighting at once. A video model handed five creatures
 * returns five smears — it cannot hold that many designs still for five
 * seconds. Eight short shots of ONE character each, cut fast, read as a
 * bigger fight than one wide shot containing everybody, and each one can be
 * rerolled alone for fifteen cents when it comes back wrong.
 *
 * The only shots holding more than one creature are 6, 7 and 8, where they
 * are small, far away and silhouetted against Amanda's light — which is the
 * one arrangement a model can keep.
 */
import { join } from "node:path";
import { REPO_ROOT } from "./catalog.js";

const P = (...parts: string[]) => join(REPO_ROOT, ...parts);

/** The petrol station. It is one of the game's arenas, painted in its style. */
export const STATION = P("apps", "client", "public", "arena", "fuel.webp");

/**
 * Where each character's likeness comes from.
 *
 * ═══ THE BREAD COMES FROM THE BOOKLET, NOT THE EMOJI ═══
 *
 * Or: *"the fried bread doesn't look anything like it's supposed to."* The
 * board showed him `emoji/bread_hi.png`, which is the chibi 128x128 version —
 * round, smooth, a friendly slice of toast. The character is a FURIOUS craggy
 * fried bread with fangs and fists, and he exists as card #42 in Hod's own
 * booklet. That painting is the reference.
 *
 * This is the second time this bread has been drawn from the wrong source;
 * the first is written up in EMOJI_REFS in emojiLooks.ts.
 */
export const WHO = {
  dragon: P("apps", "client", "public", "cards", "dragons_01_flame_dragon.webp"),
  /*
   * ═══ NOT THE TITAN KING ═══
   *
   * The first round used giants_10_titan_king and got three different giants
   * across three shots: a smooth armoured runed thing in shot 2, a mossy
   * boulder in shot 6, neither of them the card.
   *
   * The card is the reason. The Titan King SITS — he is a crowned giant on a
   * stone throne with waterfalls running off it. Asking for his foot landing
   * in a puddle asks a model to invent how he looks standing up, and it
   * invented differently every time.
   *
   * The Stone Colossus already stands. Or approved the swap: same series,
   * same lava-cracked rock, and it is close to what shot 6 produced on its
   * own — which is the clue that this was always the right giant for a shot
   * about walking.
   */
  giant: P("apps", "client", "public", "cards", "giants_01_stone_colossus.webp"),
  chuppy: P("apps", "client", "public", "cards", "furries_01_chuppy.webp"),
  bread: P("assets", "reference", "fried-bread-card.png"),
  amanda: P("assets", "raw", "brand", "amanda_banner.png"),
  /*
   * ═══ THE LION IS ONE OF HER HEADS ═══
   *
   * Or, on the first round: *"notice there's some lion next to Amanda — did
   * you mean it to be Amanda's head? It didn't come out that way."*
   *
   * He is right on both counts. Amanda is a THREE-HEADED spirit queen: a
   * teal spirit-fire face in the centre, a serpent-dragon head on her left,
   * a burning lion head on her right — all three on necks growing from her
   * own shoulders. It is canon, from page 8 of Hod's deck, and it is written
   * out in AMANDA in brandLooks.ts.
   *
   * Every image of her so far renders those heads as two ANIMALS STANDING
   * BESIDE HER, because no prompt ever said where the necks attach. This
   * painting is the one picture that shows it, so it goes in beside the
   * banner and the prompt points at it.
   */
  amandaCanon: P("assets", "reference", "amanda-canon.png"),
} as const;

/**
 * Said in every prompt.
 *
 * The capitals are not decoration. Generating amanda_idle.webm taught this:
 * the first attempt moved her whole body, because the prompt said only what
 * SHOULD move and a model fills any silence with invention. Most of the words
 * below are about what must not happen.
 */
const LOOK = [
  "Photoreal cinematic 3D animation frame, the look of a modern animated feature:",
  "real volume, real weight, subsurface skin, wet reflective asphalt, volumetric",
  "haze in the air, shallow depth of field, soft filmic contrast, fine film grain.",
  "NOT a flat illustration, NOT a cartoon drawing, NOT a sticker, NOT a trading",
  "card, NOT concept art on a plain background — a frame from a film.",
  "NO TEXT, NO LETTERS, NO LOGOS, NO USER INTERFACE, NO CARD, NO BORDER, NO WATERMARK.",
].join(" ");

/** The location, said the same way every time so the eight shots cut together. */
const PLACE = [
  "Location: a deserted petrol station at night. Wet black asphalt with standing",
  "puddles, a low concrete canopy overhead with flickering fluorescent tubes, two",
  "fuel pumps, a dark kiosk behind, cold blue night beyond the canopy and warm",
  "sodium light pooling underneath it. Deep shadows. The station is empty of people.",
].join(" ");

/** Said whenever a character is carried over from a reference image. */
const KEEP =
  "KEEP THE CHARACTER'S EXACT DESIGN from the reference image — the same silhouette, " +
  "the same colours, the same markings, the same face. Do not redesign it, do not " +
  "restyle it, do not make it cuter, do not add or remove limbs. Only the MEDIUM " +
  "changes: the same creature, built in 3D instead of drawn.";

export interface Shot {
  id: string;
  /** What Or reads beside the frame in the review sheet. */
  he: string;
  /** Seconds this shot holds in the cut. */
  hold: number;
  /** Reference images, in the order the prompt refers to them. */
  refs: string[];
  /**
   * Other shots' APPROVED STILLS, used as references ahead of `refs`.
   *
   * ═══ A GROUP SHOT REFERENCES THE SOLO SHOTS ═══
   *
   * Shot 6 holds all four creatures, and the first two attempts rendered two
   * of them as flat cartoon stickers beside two photoreal ones. Five
   * references, three of them drawn cards, and the model took the cards'
   * STYLE along with their characters — so the fried bread was a rendered
   * crust in shot 5 and a yellow square with eyes 1.1 seconds later.
   *
   * The fix is to stop showing it the cards. By the time shot 6 is made,
   * shots 2 to 5 already contain each creature built in 3D and standing in
   * this exact petrol station under this exact light. Those frames are a
   * better brief than the cards ever were.
   */
  refShots?: string[];
  /** The still. */
  prompt: string;
  /** The five seconds of movement, once the still is approved. */
  motion: string;
}

export const SHOTS: Shot[] = [
  {
    id: "01-pump",
    he: "טיפה נופלת על האספלט. הניאון מהבהב. משהו ענק זז מחוץ לפוקוס.",
    hold: 1.2,
    refs: [STATION],
    prompt: [
      LOOK,
      PLACE,
      "Extreme close-up on a fuel pump nozzle hanging in its cradle, a single drop",
      "of fuel about to fall from it. Behind it, far out of focus, something very",
      "large and dark is moving. The fluorescent tube above throws hard light across",
      "the nozzle and leaves the rest of the frame nearly black.",
      "NO CREATURE IS IN FOCUS. This shot is dread, not a monster.",
    ].join(" "),
    motion: [
      "The drop falls and hits the wet concrete. The fluorescent tube above flickers",
      "twice. The large dark shape behind drifts slowly out of frame, still blurred.",
      "The camera holds almost still, with the faintest drift inward.",
      "NOTHING COMES INTO FOCUS. No creature is revealed. NO TEXT APPEARS. One shot,",
      "no cuts, no whip pan, no zoom.",
    ].join(" "),
  },
  {
    id: "02-titan",
    he: "כף רגל של אבן נוחתת. שלולית מתפוצצת. קולוסוס האבן הולך.",
    hold: 1.4,
    refs: [WHO.giant, STATION],
    prompt: [
      LOOK,
      PLACE,
      "Very low camera, almost at ground level. The enormous STONE COLOSSUS from",
      "the first reference image — a mossy boulder-bodied giant with orange lava",
      "glowing in the cracks between his stones — is walking through the forecourt.",
      "The frame is filled by his foot and lower leg as it lands in a puddle, water",
      "bursting upward around it, the asphalt cracking beneath. His body and head are",
      "above, huge and partly out of frame. The lava inside his cracks lights the",
      "water from within.",
      KEEP,
    ].join(" "),
    motion: [
      "The stone foot slams down and water bursts upward; the ripples spread and the",
      "camera shakes once on the impact. The lava inside his cracks pulses. He begins",
      "to lift the other foot for the next step.",
      "HE DOES NOT CHANGE SHAPE. He does not turn to the camera. Nothing else enters",
      "the frame. NO TEXT APPEARS. One continuous shot.",
    ].join(" "),
  },
  {
    id: "03-dragon",
    he: "דרקון הלהבה טס מתחת לגגון. האש מאירה את התקרה.",
    hold: 1.4,
    refs: [WHO.dragon, STATION],
    prompt: [
      LOOK,
      PLACE,
      "The FIRE DRAGON from the first reference image sweeps in low under the station",
      "canopy with his wings fully spread, banking hard, close to the camera. Flame",
      "trails from his jaws and lights the underside of the concrete roof orange; his",
      "reflection runs across the wet asphalt below him. Motion blur on the wingtips.",
      "The canopy's fluorescent tubes streak past behind him.",
      KEEP,
    ].join(" "),
    motion: [
      "The dragon flies forward beneath the canopy, wings beating twice, and banks",
      "past the camera; his fire lights the roof as he passes and his reflection",
      "sweeps across the wet ground. The camera pans to follow him.",
      "HE DOES NOT LAND, TRANSFORM OR BREATHE AT THE CAMERA. Nothing else enters the",
      "frame. NO TEXT APPEARS. One continuous shot.",
    ].join(" "),
  },
  {
    id: "04-chuppy",
    he: "צ׳ופי רץ. ברקים נזרקים מהפרווה אל השלוליות.",
    hold: 1.3,
    refs: [WHO.chuppy, STATION],
    prompt: [
      LOOK,
      PLACE,
      "The small furious yellow furry creature from the first reference image is",
      "sprinting flat out across the forecourt, seen from a low tracking camera",
      "beside him. Electricity arcs off his fur and earths itself into the puddles he",
      "runs through, lighting them blue-white from inside. His fur is real fur,",
      "lifted by the speed. Streaks of motion blur behind him.",
      KEEP,
    ].join(" "),
    motion: [
      "He runs toward the camera through the puddles, lightning arcing off his fur",
      "into the water with each stride, water spraying up behind him. The camera",
      "tracks sideways to keep up with him.",
      "HE DOES NOT STOP, SPEAK OR CHANGE SHAPE. Nothing else enters the frame.",
      "NO TEXT APPEARS. One continuous shot.",
    ].join(" "),
  },
  {
    id: "05-bread",
    he: "הלחם המטוגן נכנס. קטן, זועם, אגרופים למעלה. זה הצחוק.",
    hold: 1.1,
    refs: [WHO.bread, STATION],
    prompt: [
      LOOK,
      PLACE,
      "A heroic low hero-shot of the FURIOUS FRIED BREAD from the first reference",
      "image: a thick craggy slice of deep-fried bread with a scowling face, bared",
      "fangs and two clenched fists, standing in the middle of the forecourt with his",
      "fists raised, absolutely tiny against the fuel pumps and the canopy above him.",
      "Golden crust, oily sheen, visible pores and burnt edges, rendered in 3D with",
      "real depth and real thickness. The camera takes him completely seriously.",
      KEEP,
      "He is ANGRY, NOT CUTE. He is not smiling toast. He has fangs.",
    ].join(" "),
    motion: [
      "The fried bread stomps one step forward, raises both fists higher and roars",
      "silently up at something enormous off-screen above him. Crumbs shake loose",
      "from his crust. The camera pushes in slightly.",
      "HE STAYS SMALL AND STAYS ANGRY. He does not grow, transform or smile. Nothing",
      "else enters the frame. NO TEXT APPEARS. One continuous shot.",
    ].join(" "),
  },
  {
    id: "06-charge",
    he: "ארבעתם מסתערים יחד. רחב, נמוך, קולנועי.",
    hold: 1.6,
    refShots: ["02-titan", "03-dragon", "04-chuppy", "05-bread"],
    refs: [],
    prompt: [
      LOOK,
      PLACE,
      "Wide low cinematic shot across the forecourt, at the same petrol station as",
      "the four reference images and lit the same way.",
      "The four creatures from those reference images are charging together toward",
      "something off-frame to the right: the mossy lava-cracked STONE COLOSSUS from",
      "the first image striding at the back, the FIRE DRAGON from the second flying",
      "low above him trailing flame, the small YELLOW FURRY creature from the third",
      "sprinting ahead throwing lightning into the puddles, and the tiny FURIOUS",
      "FRIED BREAD from the fourth running last with his fists up. They are seen",
      "from behind and three-quarters, moving away to the right.",
      "EVERY ONE OF THEM IS RENDERED EXACTLY AS IT APPEARS IN ITS REFERENCE IMAGE:",
      "the same photoreal 3D, the same volume, the same materials — real stone, real",
      "scales, real fur, real fried crust. NOT ONE OF THEM IS A FLAT CARTOON, a",
      "sticker, a drawing or a toy. All four belong to the same film as the",
      "reference frames.",
      "They are lit from the right by a cold teal light that is not yet in frame,",
      "which throws four long shadows back toward the camera.",
      "FOUR CREATURES ONLY. Do not add a fifth. Keep them small in the frame — the",
      "station and the empty asphalt are most of the picture.",
    ].join(" "),
    motion: [
      "All four move forward together toward the right of frame — the giant striding,",
      "the dragon beating its wings, the furry one sprinting, the bread stomping",
      "behind. The teal light from the right brightens across them. The camera tracks",
      "slowly right with them.",
      "NOTHING IS ADDED AND NOTHING LEAVES. They do not turn into anything. NO TEXT",
      "APPEARS. One continuous shot.",
    ].join(" "),
  },
  {
    id: "07-amanda",
    he: "אמנדה עולה מאחורי הגגון. ענקית. הם קופאים.",
    hold: 1.8,
    refs: [WHO.amanda, WHO.amandaCanon, STATION],
    prompt: [
      LOOK,
      PLACE,
      "AMANDA rises behind the petrol station, colossal — her shoulders above the",
      "canopy, the whole station tiny beneath her. She is the creature in the first",
      "two reference images.",
      "SHE HAS THREE HEADS, ALL THREE GROWING ON NECKS FROM HER OWN SHOULDERS, as in",
      "the second reference image. CENTRE: a face of glowing teal spirit-fire with",
      "big glowing eyes and a wide knowing grin, a crown of ghost flame rising off",
      "it. LEFT: a teal serpent-dragon head on a long neck. RIGHT: a lion head with a",
      "mane of living orange fire. The serpent and the lion are PART OF HER BODY —",
      "they are NOT separate animals, they do NOT stand on the ground beside her,",
      "and they are not pets. Three necks, one body.",
      "Her body is tall and flowing, deep navy, draped like smoke and trailing off",
      "into mist and embers instead of legs, with long clawed arms. Golden runes float",
      "around her. Rendered in 3D with real volume and real flame.",
      "Her teal light floods the forecourt from behind and throws enormous shadows",
      "forward across the wet asphalt toward the camera. Far below her, tiny and",
      "backlit, four silhouettes are frozen mid-charge looking up: a winged dragon, a",
      "boulder-shouldered giant, a small round furry one and a tiny square one.",
      "Backlit, high contrast, volumetric god-rays through the haze.",
    ].join(" "),
    motion: [
      "Amanda rises a little further and her teal flame flares; her light brightens",
      "across the whole station and the shadows sweep forward. Her serpent head and",
      "her lion head turn slowly, STILL ATTACHED TO HER SHOULDERS, and the floating",
      "runes drift. The four small creatures below stop and look up at her.",
      "The camera tilts slowly upward to follow her.",
      "SHE DOES NOT WALK, ATTACK, SPEAK OR LOOK AT THE CAMERA. Nothing new enters the",
      "frame. NO TEXT APPEARS. One continuous shot.",
    ].join(" "),
  },
  {
    id: "08-fold",
    he: "האור שוטף אותם. הם מתפרקים לגחלים ונכנסים לקלפים.",
    hold: 1.4,
    /*
     * ═══ THE SAME FRAME, AN INSTANT LATER ═══
     *
     * Or: *"look at shot 8. There are 3 different characters there instead
     * of one Amanda with 3 heads."*
     *
     * He is right, and this is the shot-7 bug surviving in the one shot that
     * never got the fix. Shot 7's prompt was rewritten to say the serpent and
     * the lion grow on necks from her shoulders; shot 8's was not, because it
     * reads as a shot about light rather than about her. It still had to draw
     * her, so it drew the banner the only way a prompt that never mentions
     * her anatomy allows: as three creatures standing in a row.
     *
     * Describing her again would be the third place her anatomy is written
     * down and the third place it can rot. Shot 7's approved frame already
     * holds her, correctly, in this station under this light — so this shot
     * borrows it and asks only for the next instant.
     */
    refShots: ["07-amanda"],
    refs: [STATION],
    prompt: [
      LOOK,
      PLACE,
      "THE IDENTICAL FRAME TO THE FIRST REFERENCE IMAGE, one instant later — same",
      "camera, same composition, same petrol station, the same single figure of",
      "AMANDA standing exactly where she stands in it.",
      "SHE IS ONE CREATURE WITH THREE HEADS ON NECKS FROM HER OWN SHOULDERS, exactly",
      "as in the reference image: the teal spirit-fire face in the centre, the",
      "serpent-dragon head on her left, the fire-maned lion head on her right. THERE",
      "IS NOT A SEPARATE SERPENT AND THERE IS NOT A SEPARATE LION. Do not split her",
      "into several figures. Do not put a dragon or a lion on the ground. ONE BODY,",
      "ONE FIGURE, THREE HEADS.",
      "What has changed: her teal light has flooded the forecourt white-teal, and the",
      "four small creatures at her feet are dissolving upward into streams of glowing",
      "embers and sparks that spiral toward the camera. Their silhouettes are half",
      "gone. The station is bleached by the light. Long god-rays, heavy haze, bloom.",
      "NO NEW CREATURE APPEARS. NO CARDS ARE VISIBLE and NO TEXT APPEARS.",
    ].join(" "),
    motion: [
      "The embers spiral up and toward the camera and the teal light grows until it",
      "fills the frame. The small creatures finish dissolving. The camera pushes",
      "straight in to the light.",
      "AMANDA STAYS ONE FIGURE WITH THREE HEADS ON HER SHOULDERS. She does not split",
      "apart, and the serpent and the lion never leave her body.",
      "NOTHING FORMS OUT OF THE EMBERS. No cards, no shapes, NO TEXT. One continuous",
      "shot ending in near-white.",
    ].join(" "),
  },
];

/** How long the opening runs, before the gameplay recording. */
export const OPENING_SECONDS = SHOTS.reduce((n, s) => n + s.hold, 0);
