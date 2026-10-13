/**
 * Defines original shared test planning data contracts for public test support. Inputs are explicitly
 * authored turn/actor/scenario data; outputs preserve the original nullable choices, source fields and
 * exact callback types. No game, model, filesystem, live permission or expected outcome is allocated or
 * computed here.
 */
import type { ActionStage } from "../../../src/core";
import type { ToolCall } from "../../../src/core";
import type { Role } from "../../../src/core";
import type { MistWireExpectations } from "../features/mist-raven/oracles/transport";
import type { ResolvedBoardDefinition } from "../../../src/runtime/config/board_definition";

export interface PlannedTurn {
  radiantBorrow?: { id: string; state: Record<string, unknown> };
  responseDelayMs?: number;
  currentTeammateIds?: number[];
  terminalFailure?: "missing" | "late" | "revoked";
  hybridChoice?: { targetId: number } | null;
  mechanicalStatus?: {
    learned: [string, string] | null;
    ready: number | null;
    inherited: boolean;
    first: number | null;
    mode: { day: number; kind: "skill" | "kill" } | null;
  };
  day: number;
  stage: ActionStage;
  action: ToolCall | null;
  invalidActions?: ToolCall[];
  expectedInvalidError?: string;
  gargoyleStatus?: { inherited: boolean; active: boolean };
  roleInspectionLatest?: null | { targetId: number; roleLabel: [string, string] };
  hiddenWolfStatus?: { inherited: boolean; active: boolean };
  requiredPromptMarkers?: string[];
  forbiddenPromptMarkers?: string[];
  bearLatest?: null | { day: number; roared: boolean };
  knightResourceRemaining?: 0 | 1;
  charmLatest?: { day: number | null; targetId: number | null };
  dreamLatest?: null | { day: number; targetId: number };
  gravekeeperLatest?: null | {
    exileDay: number;
    receivedDay: number;
    targetId: number;
    camp: "good" | "wolf" | "third_party";
  };
}

export interface ActorTransportPlan {
  verifyGameWire?: boolean;
  mistWire?: MistWireExpectations;
  actorId: number;
  role: Role;
  eventRole?: Role;
  locale: "zh-CN" | "en";
  turns: PlannedTurn[];
  expectedName?: string;
  expectedPersona?: string | null;
  forbiddenPersonas?: string[];
  expectedIdentityMarker?: string;
  requiredSystemMarkers?: string[];
  expectedTeammateIds?: number[];
  requiredCurrentMarkers?: string[];
  forbiddenCurrentMarkers?: string[];
}

export interface TransportGameScenario {
  expectedFailure?: { actorId: number; stage: string };
  board: ResolvedBoardDefinition;
  seed: string;
  eventRoles?: readonly Role[];
  roles: readonly Role[];
  turns: ReadonlyMap<number, PlannedTurn[]>;
  promptAssertions?: (
    actor: number,
    locale: "zh-CN" | "en",
  ) => Pick<
    ActorTransportPlan,
    | "requiredSystemMarkers"
    | "expectedIdentityMarker"
    | "expectedTeammateIds"
    | "requiredCurrentMarkers"
    | "forbiddenCurrentMarkers"
    | "mistWire"
    | "verifyGameWire"
  >;
}
