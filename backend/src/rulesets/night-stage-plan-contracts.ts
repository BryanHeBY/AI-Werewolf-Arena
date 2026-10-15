/**
 * 负责：定义后端夜间阶段成员、来源、执行入口和有限贡献闭包的数据契约。
 * 输入：原 handler 引用、已观察的角色或预约身份；输出：自有只读元数据及明确未知来源。
 * handler 仍是可变执行对象，execute 在实际调用点读取；这些内部契约不是归档 DTO。
 * 声明闭包和阶段预约不授予 actor、World、库存、原体或 lease 权限。
 */
import type { NightStageHandler } from "../engine/night/contracts";
import type { NightAbilityKind } from "@ai-werewolf-arena/game-contract";

/** 仅普通默认贡献数据可参与固定定义；原 handler 引用保留晚执行权限。 */
export interface SupportedNightDefinition {
  readonly reservations: readonly NightStageHandler[];
  readonly roles: readonly Readonly<{
    role: string;
    handlers: readonly NightStageHandler[];
    night: readonly NightAbilityKind[];
    death: readonly "gun"[];
  }>[];
}

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

/** 快照成员归编译器拥有；不透明入口只在实际执行循环需要时拉取原 iterator。 */
export type NightStagePlan =
  | Readonly<{
      mode: "snapshot";
      stages: readonly NightStageHandler[];
      entries: readonly NightStageExecutionEntry[];
      metadata: readonly NightStageMetadata[];
      definition: SupportedNightDefinition | null;
      definitionScope: "built-in" | "injected";
    }>
  | Readonly<{
      mode: "opaque";
      stages: Iterable<NightStageHandler>;
      entries: Iterable<NightStageExecutionEntry>;
      metadata: readonly NightStageMetadata[];
      definition: null;
      definitionScope: "injected";
    }>;

/** 替换引用仅是编译器内的来源证据，不另建注册表或 actor 存储。 */
export interface GhostStageRegistrationChange {
  readonly handler: NightStageHandler;
  readonly original?: NightStageHandler;
  readonly operation: "wedding-chat" | "wedding-knife" | "ordinary-chat-priority";
}
