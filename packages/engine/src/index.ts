/**
 * @amanda/engine — the deterministic, headless auto-battle simulation.
 *
 * The same (setup + seed) always yields a byte-identical BattleResult, so the
 * server can run a match authoritatively and clients replay it from the seed.
 * No rendering, DOM or timing dependencies live here — pure game logic.
 */
export * from "./types.js";
export * from "./rng.js";
export * from "./combat.js";
export * from "./setup.js";
export { runBattle } from "./simulate.js";
export * from "./report.js";
export type { BattleOps, ChildProto } from "./abilities.js";
// The build-time rule for "three of the family, touching" — the client needs
// it to show the bonus on the board the player is still arranging.
export { synergyMembers, touching } from "./synergy.js";
