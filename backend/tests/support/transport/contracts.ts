/**
 * 定义公开测试支持使用的原计划数据契约；输入为明确编写的回合、行动者及场景数据，类型保留原可空选择、来源字段与精确回调签名。此模块不分配或计算游戏、模型、文件系统资源、实时许可或结果预期。
 */
import type { ActionStage } from "../../../src/domain";
import type { ToolCall } from "../../../src/domain";
import type { Role } from "../../../src/domain";
import type { MistWireExpectations } from "../features/mist-raven/oracles/transport";
import type { ResolvedBoardDefinition } from "../../../src/app/config/board-definition";

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
  /** 显式离线输入经真实 controller/metadata 交原故障 owner；不是在 replay 另造一份镜像 mutation。 */
  faultPlan?: import("../../../src/domain/fault-plan").FaultPlan;
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
