/**
 * 负责流水线与 handler 共享的夜间状态及执行端口契约。
 * 输入为捕获的阶段操作、已付效果和 actor 查询；输出为有类型的贡献及原状态引用。
 * 机械、觉醒和原毒的内建生产者提交 sourced intent，源原体/因果信息只供运行时消费。
 * 旧原毒／机械／觉醒注入 effect/claim 保留接受宽度；其额外 kind/origin/getter 不被当作新协议读取。
 * 所有内建原毒（含受赠及学者加成）均有来源；此契约不查询 World 或提交库存。
 * 这些外部自定义注入仍保留明确 legacy 接受政策，不把同名字段视为 owned 来源。
 * 本族加成回执记录不属于通用字段，按本夜状态身份由学者／导师唯一所有者保存。
 */
import { StatusMarksComponent } from "../../../../core/domain/components/status_marks";
import {
  ActionProvider,
  ActionRequest,
  ActionRequestExtras,
  ActionStage,
  EntityId,
  GameEvent,
  ExileFeedback,
  NightSummary,
  Role,
} from "../../../../core/domain/model";
import { World } from "../../../../core/domain/world";
import { ToolGateway } from "../../../gateway/tool_gateway";
import type { RoleCatalog } from "../../roles/catalog";
import type { DreamNightLink } from "../../roles/dreamer/night_frame";
import type { NightAbilityActorQuery } from "../../roles/night-ability-actors";
import type { AliveComponent } from "../../../../core/domain/components/alive";
import type { NativeNightFailurePolicy } from "../../../../rulesets/native-night-failure-policy";
import type { NativeNightTargetPolicy } from "../../../../rulesets/native-night-target-policy";
import type { NativeNightEffects } from "../../../../rulesets/native-night-effects";

import type {
  NightPoisonClaim,
  NightInspectionAttack,
  NightFoxInspectionClaim,
  NightMechanicalEffect,
  NightGuardClaim,
  NightMerchantBacklash,
  NightBlackMarketBacklash,
  NightAwakenedEffect,
  NightMechanicalIntent,
  NightAwakenedIntent,
  NightOriginalPoisonIntent,
} from "../../../../core/domain/night_effects";

/** 狼刀选定时捕获的原生命及印记引用；目标序号相同不代表原体和生命版本仍有效。 */
export interface WolfKnifeTargetScope {
  targetId: EntityId;
  life: AliveComponent;
  version: number;
  marks: StatusMarksComponent;
}

/**
 * 同一夜按阶段顺序累积的运行状态，流水线创建，具体 handler 写入所属效果。
 * 包含原组件、回执和当前性查询，不能直接序列化为玩家观察或录制格式。
 * 效果条目是运行提案或捕获记录；空容器存在不表示已付、有效或已标死，这些由各所有者分别核对。
 */
export interface NightStageState {
  /** 学者／导师在原冲突检查点产生的死亡与刀口；不是直接修改 Alive 的指令。 */
  modifierDeaths?: import("../../../../core/domain/night_effects").NightLifeScope[];
  modifierKnifeTargets?: EntityId[];
  wolfChatOrder: EntityId[];
  endedWolves: Set<EntityId>;
  wolfVotes: Record<number, number>;
  wolfTarget: EntityId | null;
  wolfTargetScope?: WolfKnifeTargetScope;
  /** 实际参与选定普通狼刀的投票者；票表的目标键不能代替投票者名单。 */
  wolfTargetVoters?: EntityId[];
  seerChecks: NightSummary["seerChecks"];
  /** 已捕获的摄梦关系保留施法者和目标原生命；保护与死亡闭包由同一梦实例推导。 */
  dreamLinks: DreamNightLink[];
  /** 内建有来源 intent 与旧注入 claim 共存；仅同名字段不能把旧对象变成内建来源。 */
  poisonClaims?: Array<NightOriginalPoisonIntent | NightPoisonClaim>;
  inspectionAttacks?: NightInspectionAttack[];
  retaliationAttacks?: import("../../../../core/domain/night_effects").NightRetaliationAttack[];
  nightImmunities?: import("../../../../core/domain/night_effects").NightImmunityClaim[];
  /** 恶夜骑士开夜时的原体绑定供付款后反射使用；含状态和回调，不是可公开的角色知识。 */
  evilKnightBindings?: Map<
    EntityId,
    NonNullable<ReturnType<typeof import("../../roles/evil_knight/state").captureEvilKnight>>
  >;
  foxInspections?: NightFoxInspectionClaim[];
  guardClaims?: NightGuardClaim[];
  merchantBacklashes?: NightMerchantBacklash[];
  blackMarketBacklashes?: NightBlackMarketBacklash[];
  /** 机械效果按护盾、攻击、失败分别保留，消费次数和来源规则由具体能力控制。 */
  mechanicalEffects?: {
    shields: Array<NightMechanicalIntent<"mechanical-shield"> | NightMechanicalEffect>;
    attacks: Array<NightMechanicalIntent<"mechanical-attack"> | NightMechanicalEffect>;
    failures: Array<NightMechanicalIntent<"mechanical-failure"> | NightMechanicalEffect>;
  };
  /** 觉醒效果与机械效果分列，不能因形状相近而合并付款或退休政策。 */
  awakenedEffects?: {
    shields: Array<NightAwakenedIntent<"awakened-shield"> | NightAwakenedEffect>;
    attacks: Array<NightAwakenedIntent<"awakened-attack"> | NightAwakenedEffect>;
  };
}

/**
 * 阶段 handler 使用的运行端口：请求、候选查询和效果写入均在当前阶段执行。
 * 异步行动返回后仍需检查 isCurrent 及具体原体许可；持有此上下文不自动获得领域提交权限。
 */
export interface NightStageContext {
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

/** 默认收集器按原 priority 装配，流水线按计划原顺序执行；处理器返回不等于效果已造成实际死亡。 */
export interface NightStageHandler {
  id: string;
  priority: number;
  execute(ctx: NightStageContext): Promise<void>;
}
