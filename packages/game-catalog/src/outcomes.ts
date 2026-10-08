/** Language-neutral victory facts. Runtime role state stays in the engine. */
export const FACTION_IDS = ["good", "wolf", "third_party"] as const;
export type FactionId = typeof FACTION_IDS[number];
export const VICTORY_CHECKPOINTS = ["night_settled", "day_interrupted", "exile_settled", "max_days_reached"] as const;
export type VictoryCheckpoint = typeof VICTORY_CHECKPOINTS[number];
export interface VictoryPoint { day: number; phase: "night" | "day" | "voting"; checkpoint: VictoryCheckpoint }
export type VictoryAffiliation =
  | { kind: "faction"; faction: FactionId }
  | { kind: "individual"; goalId: string }
  | { kind: "relationship"; groupId: string };
export type VictoryTarget =
  | { kind: "faction"; faction: FactionId }
  | { kind: "individual"; goalId: string; playerId: number }
  | { kind: "relationship"; groupId: string };
export type VictoryClaim = VictoryTarget & { winningPlayerIds: number[] };
export type GameOutcome =
  | { kind: "victory"; primary: VictoryClaim; additional: VictoryClaim[]; winningPlayerIds: number[] }
  | { kind: "no_winner" };
