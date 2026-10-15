/**
 * 可信夜流水线与完整内建资源程序的私有输入。World、组件、事件、Catalog、请求构造器和整夜状态只停留在此侧。
 * 组合根同时核实际 handler 与原 execute 引用；被替换的 execute 永远只取得公开窄对象。
 * 此接口不提供公开反查 token，不复制组件或缓存另一份资源；内建原资格／付款／已付复验仍是原程序。
 */
import { StatusMarksComponent } from "../../domain/components/status-marks";
import {
  ActionProvider,
  ActionRequest,
  ActionRequestExtras,
  ActionStage,
  EntityId,
  GameEvent,
  ExileFeedback,
  Role,
} from "../../domain/model";
import { World } from "../../domain/world";
import { ToolGateway } from "../actions/tool-gateway";
import type { RoleCatalog } from "../../rulesets/roles/catalog";
import type { ActionRequestFactoryConstructorPort } from "../../domain/actions";
import type { NightAbilityActorQuery } from "../../features/night-abilities/actor-query-ports";
import type { NativeNightFailurePolicy } from "../../rulesets/native-night-failure-policy";
import type { NativeNightTargetPolicy } from "../../rulesets/native-night-target-policy";
import type { NativeNightEffects } from "../../rulesets/native-night-effects";

import type { NightAwakenedEffect } from "../../domain/night-effects";

import type { NightStageDefinition, NightStageState } from "./contracts";

export interface TrustedNightStageRuntime {
  isCurrent(): boolean;
  readonly previousExile: Readonly<ExileFeedback> | null;
  world: World;
  roleCatalog: RoleCatalog;
  readonly nightActors: NightAbilityActorQuery;
  readonly nativeNightFailure: NativeNightFailurePolicy;
  readonly nativeNightTargets: NativeNightTargetPolicy;
  readonly nativeNightEffects: NativeNightEffects;
  toolGateway: ToolGateway;
  events: GameEvent[];
  actionProvider: ActionProvider;
  currentDay(): number;
  /** 装配端惰性构造器；各机制原点新建实例，不复用 makeRequest，也不进入请求 context／录制 DTO。 */
  readonly requestFactory: ActionRequestFactoryConstructorPort;
  makeRequest(
    actorId: EntityId,
    allowedTools: ActionRequest["allowedTools"],
    context: ActionRequestExtras & { stage: ActionStage; requiresAction?: boolean },
  ): ActionRequest;
  getAliveByRole(role: Role): EntityId[];
  ensureMarks(entityId: EntityId): StatusMarksComponent;
  pickMajorityTarget(votes: Record<number, number>): EntityId | null;
  /** 迷雾有限板在所有投票者明确放弃后使用的回退，随机流具名且可复现。 */
  pickMistKnife?(ids: readonly EntityId[]): EntityId | null;
  shuffleWolves(ids: EntityId[]): EntityId[];
  state: NightStageState;
}

/** 完整内建程序私留原组件引用；该较窄输入不作为可替换扩展的 callback 契约。 */
export interface TrustedNightStageHandler extends NightStageDefinition {
  execute(runtime: TrustedNightStageRuntime): Promise<void>;
}

/** 建立这一夜唯一的提案容器；尚未绑定 World，创建本身不支付或赋予请求权。 */
export function createNightStageState(): NightStageState {
  return {
    wolfChatOrder: [],
    endedWolves: new Set<EntityId>(),
    wolfVotes: {},
    wolfTarget: null,
    seerChecks: [],
    poisonClaims: [],
    guardClaims: [],
    merchantBacklashes: [],
    blackMarketBacklashes: [],
    mechanicalEffects: { shields: [], attacks: [], failures: [] },
    awakenedEffects: { shields: [], attacks: [] },
  };
}

/**
 * 可信自定义伤害阶段只获明确加毒印记命令，不取得 StatusMarks 组件或任意槽写入。
 * 组件仍由原 ensureMarks 唯一取得／创建，add 及失败前缀留在该原调用点。
 */
export function bindSyntheticNightDamageCommands(runtime: TrustedNightStageRuntime) {
  return {
    addPoisonMark(id: EntityId): void {
      runtime.ensureMarks(id).add(importedStatusMark.PoisonMark);
    },
  };
}

/** 旧自定义觉醒提案输入保宽；不读取额外 kind/origin，不返回真实提案数组或组件。 */
export function bindLegacyAwakenedProposals(runtime: TrustedNightStageRuntime) {
  return {
    get appendShield() {
      const values = runtime.state.awakenedEffects!.shields,
        callee = values.push,
        invoke = Reflect.apply.bind(Reflect);
      return (effect: NightAwakenedEffect) => invoke(callee, values, [effect]) as number;
    },
    get appendAttack() {
      const values = runtime.state.awakenedEffects!.attacks,
        callee = values.push,
        invoke = Reflect.apply.bind(Reflect);
      return (effect: NightAwakenedEffect) => invoke(callee, values, [effect]) as number;
    },
    addWolfKillMark(id: EntityId): void {
      runtime.ensureMarks(id).add(importedStatusMark.WolfKillMark);
    },
  };
}
import { StatusMark as importedStatusMark } from "../../domain/model";
