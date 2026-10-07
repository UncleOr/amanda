/**
 * Visual brief for each Action Card.
 *
 * Action cards must read as OBJECTS / EFFECTS, never as creatures — that is
 * what separates them from monster cards at a glance. Same darkcomic style,
 * same portrait frame, but an icon-like subject on a dramatic backdrop.
 */
export const ACTION_LOOK: Record<string, string> = {
  triple_draw:
    "three ornate playing cards fanned out in mid-air, trailing golden motion streaks, " +
    "as if snapped from a deck in one sweep",
  energy_boost:
    "a cracked battery cell overloading, raw yellow lightning bursting from its terminals, " +
    "surging power rings radiating outward",
  radioactive_eraser:
    "a chunky pencil eraser glowing sickly radioactive green, rubbing a card out of existence, " +
    "the erased corner dissolving into glowing dust",
  time_freeze:
    "an ornate pocket watch encased in jagged blue ice, its hands frozen mid-tick, " +
    "frost spreading across the glass",
  frozen_hands:
    "a pair of outstretched hands sheathed in thick cracked blue ice, a card frozen solid " +
    "between the fingertips just short of the table, frost crystals spidering outward",
  swap_places:
    "two glowing cards trading places along a pair of curved arrows forming a circle, " +
    "motion trails crossing in the middle",
  xray:
    "a large glowing eye inside an X-ray viewing lens, skeletal scan-lines sweeping across it, " +
    "ghostly blue-green translucency",
  ground_floor:
    "two cards stacked one on top of the other in cross-section, the lower one hidden in shadow " +
    "and glowing faintly, a cutaway of a trapdoor beneath",
  dark_corners:
    "four shadowy corner brackets framing an empty space, dark tendrils curling inward from each corner",
  sandstorm:
    "a violent swirling vortex of desert sand tearing cards loose and spinning them around, " +
    "grit streaking across the frame",
  steel_wall:
    "a massive riveted steel barrier slamming down, a magical rune shield rippling across its face, " +
    "sparks flying where it blocks an impact",
  full_refuel:
    "a glowing fuel canister pouring luminous liquid energy upward into a rising card, " +
    "the card igniting with an upgrade aura and an up-arrow of light",
  amanda_summon:
    "an enormous ominous silhouette rising out of a tear in reality above an abandoned train " +
    "platform, crackling purple-black energy, overwhelming dread, the most epic card in the set",
  recall_card:
    "a magnet-like beam of light lifting a single card up and out of a board slot, " +
    "the empty slot left glowing beneath it",
  fill_lava:
    "molten lava pouring from a cracked vessel and flooding empty board slots, " +
    "glowing orange rivulets filling square cells",
  fill_colossus:
    "heavy carved stone blocks dropping down to fill empty board slots, dust bursting on impact",
  fill_flame:
    "roaring flames erupting upward to fill empty board slots, embers scattering",
  fill_cube:
    "translucent gelatinous cubes dropping into empty board slots with a wobbling splash",
};

/** Shared framing so every action card matches the monster cards' presentation. */
export const ACTION_FRAMING =
  "A single iconic OBJECT or magical EFFECT — explicitly NOT a creature, no monster, no character, " +
  "no face. Centred, filling the frame, dramatic rim lighting, simple dark backdrop with a radial glow. " +
  "ABSOLUTELY NO TEXT: no letters, no words, no numbers, no title, no caption, no signature, no watermark. " +
  "NO CARD FRAME and NO BORDER: do not draw a trading card frame, panel or inner rectangle around it.";
