/**
 * 负责领域行动／请求数据及执行、请求构造两种中立端口的唯一声明。
 * 输入为机器身份、允许工具、阶段和中立摘要；输出原有类型的工具、请求或验证结果。
 * 请求实例端口只暴露 create，不公开工厂内部字段；构造器端口只保原三参数 new 签名，类型不创建请求或实现深复制。
 * 这些声明不授予资源或行动权限，期限、原体复验与提交仍归各实际所有者。
 * 保留原请求附加字段、可选性与可写数组；ActionProvider 是运行接口，不是可序列化数据。
 */
import type { ToolCall, ToolName, ActionStage, ActionWindow, Phase, MessageRef, GameEvent } from "@ai-werewolf-arena/game-contract";
export { TOOL_NAMES, ACTION_STAGES, DEATH_SHOT_STAGES } from "@ai-werewolf-arena/game-contract";
export type {
  ToolArgMap,
  ToolName,
  ToolCall,
  TypedToolCall,
  ToolValidationResult,
  TurnConstraints,
  ActionStage,
} from "@ai-werewolf-arena/game-contract";

import type { EntityId } from "./identity";
import type { World } from "./world";

export interface KnightDuelSelection {
  actorId: EntityId;
  targetId: EntityId;
}
export type KnightDuelCommit = "rejected" | "continue" | "night" | "terminal";
export type SelfDestructSelection =
  | { kind: "ordinary"; actorId: EntityId; targetId: null }
  | { kind: "white_wolf_king"; actorId: EntityId; targetId: EntityId | null };

import type { ActionRequest, ActionRequestExtras } from "@ai-werewolf-arena/game-contract/requests";
export type {
  ActionRequest,
  ActionRequestContext,
  ActionRequestExtras,
} from "@ai-werewolf-arena/game-contract/requests";

export interface ActionProvider {
  getAction(request: ActionRequest): Promise<ToolCall | null>;
}

/** 工厂原八字段输入；只声明字段形状，不以目标／角色标签替代具体机制当前性校验。 */
export interface ActionRequestConstructionInput {
  phase: Phase;
  actorId: EntityId;
  /** 保留原可写数组输入；工厂在原位置复制，不把工具名称当成具体行动许可。 */
  allowedTools: ToolName[];
  stage: ActionStage;
  /** 只供原请求约束构造，不意味着本次行动已经提交或必须成功。 */
  requiresAction: boolean;
  summary: string | MessageRef;
  actionWindow?: ActionWindow;
  /** 原机制附加数据；工厂仍按原次序复制，公共日次与可见事实由其实际实现填入。 */
  context?: ActionRequestExtras;
}

/** 调用方只依赖原同步方法；调用保持所属对象 receiver，端口本身不保存 World、租约或资源。 */
export interface ActionRequestConstructionPort {
  create(input: ActionRequestConstructionInput): ActionRequest;
}

/**
 * 在各机制原构造点使用的真实类签名。装配端晚提供构造器，机制仍 new 各自原 World／事件／日次实例；
 * 事件只读数组保原构造接受面，不复制／冻结数组，不共享日工厂或授予请求、资源和死亡权限。
 */
export interface ActionRequestFactoryConstructorPort {
  new (world: World, events: readonly GameEvent[], day: number): ActionRequestConstructionPort;
}
