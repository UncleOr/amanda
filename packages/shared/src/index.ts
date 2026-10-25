/**
 * @amanda/shared — the single source of truth for game data shapes, config,
 * and validation, imported by both the client (apps/client) and the
 * authoritative server (apps/server). One definition, zero drift.
 */

// Schemas & types
export * from "./schemas/common.js";
export * from "./schemas/elements.js";
export * from "./schemas/ability.js";
export * from "./schemas/card.js";
export * from "./schemas/series.js";
export * from "./schemas/actionCard.js";

// Data loading & validation
export * from "./loader.js";

// Central tunable configuration
export * from "./config.js";

// Amanda mode
export * from "./amandaBoard.js";

// Which cards can be WON — asked by the chest pool, the album and the achievements
export * from "./collectable.js";

// What a card costs in a deck — the budget the deck builder spends
export * from "./cardCost.js";
// Copies come in packs: 1, 5 or 10 of one card. See the file.
export * from "./cardPacks.js";
// What is inside each kind of chest — read by the one that fills them and
// by the shop that sells them.
export * from "./chests.js";

// The faces, and a name and a face for whoever never chose one
export * from "./avatars.js";
export * from "./identity.js";

// The decks you build, and what their cards look like from the back
export * from "./cardBacks.js";
export * from "./decks.js";

// The ladder of arenas, and which one a trophy count puts you in.
export * from "./arenas.js";

// The handful of numbers the admin panel may turn, and why only those.
export * from "./tunables.js";

// How much album somebody has — the other half of matchmaking
export * from "./albumPower.js";

// Gifts and promotions: what they give, and the closed list of who they reach
export * from "./grants.js";

// Daily, weekly and monthly challenges, computed from the date
export * from "./challenges.js";

// What beating the computer is worth, and what the board can vouch for
export * from "./soloTrophies.js";

// How many nachos a match is worth, and how many fill a chest
export * from "./nachos.js";

// The emoji players send each other: which exist, and who owns them
export * from "./emoji.js";

// The one line that is yours, thrown across the versus screen
export * from "./catchphrases.js";

// The closed set of things one player may say to the other
export * from "./taunts.js";

// Multiplayer wire protocol
export * from "./net.js";

/** What the server can refuse, as codes the client turns into words. */
export * from "./serverErrors.js";
export * from "./shop.js";
export * from "./trophies.js";
