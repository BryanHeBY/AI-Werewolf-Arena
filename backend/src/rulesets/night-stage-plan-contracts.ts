/**
 * Owns backend night-plan membership, source and execution-entry contracts.
 * Inputs are observed role/reservation identities and original handler references;
 * outputs are immutable owned metadata and entries, with explicit unknown sources.
 * Handler references remain mutable execution objects, never neutral archive DTOs.
 * These data contracts grant no actor, World, resource or lease authority.
 */
import type { NightStageHandler } from "../game/mechanisms/stages/night/contracts";

export type NightStageMetadata =
  | Readonly<{ ordinal: number; kind: "data"; id: string; priority: number }>
  | Readonly<{ ordinal: number; kind: "opaque" }>;

export type NightStageContributionSource =
  | Readonly<{ kind: "role-profile"; role: string }>
  | Readonly<{
      kind: "compiler-reservation";
      reservation:
        "demon-native" | "death-activation" | "role-inspection" | "lucky" | "black-market";
    }>
  | Readonly<{
      kind: "ghost-replacement";
      operation: "wedding-chat" | "wedding-knife" | "ordinary-chat-priority";
    }>
  | Readonly<{ kind: "unknown"; reason: "override" | "unobserved-reference" | "foreign-role" }>;

export interface NightStageExecutionEntry {
  readonly handler: NightStageHandler;
  readonly sources: readonly NightStageContributionSource[];
}

/** Snapshot entries are owned; opaque entries pull the original iterator only on demand. */
export type NightStagePlan =
  | Readonly<{
      mode: "snapshot";
      stages: readonly NightStageHandler[];
      entries: readonly NightStageExecutionEntry[];
      metadata: readonly NightStageMetadata[];
    }>
  | Readonly<{
      mode: "opaque";
      stages: Iterable<NightStageHandler>;
      entries: Iterable<NightStageExecutionEntry>;
      metadata: readonly NightStageMetadata[];
    }>;

/** Replacement refs are compiler-local evidence, not a second registration or actor store. */
export interface GhostStageRegistrationChange {
  readonly handler: NightStageHandler;
  readonly original?: NightStageHandler;
  readonly operation: "wedding-chat" | "wedding-knife" | "ordinary-chat-priority";
}
