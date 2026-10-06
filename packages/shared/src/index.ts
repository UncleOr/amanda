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

// The ladder of arenas, and which one a trophy count puts you in.
export * from "./arenas.js";

// The handful of numbers the admin panel may turn, and why only those.
export * from "./tunables.js";

// Multiplayer wire protocol
export * from "./net.js";
