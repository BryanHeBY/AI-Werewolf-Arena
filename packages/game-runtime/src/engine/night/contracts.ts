/**
 * 负责夜间提案数据与公开扩展契约；完整内建 owner 的私有输入单独归 trusted-runtime。
 * 输入为捕获的阶段操作、已付效果和 actor 查询；输出为有类型的贡献及原状态引用。
 * 机械、觉醒和原毒的内建生产者提交 sourced intent，源原体/因果信息只供运行时消费。
 * 旧原毒／机械／觉醒注入 effect/claim 保留接受宽度；其额外 kind/origin/getter 不被当作新协议读取。
 * 所有内建原毒（含受赠及学者加成）均有来源；此契约不查询 World 或提交库存。
 * 这些外部自定义注入仍保留明确 legacy 接受政策，不把同名字段视为 owned 来源。
 * 本族加成回执、恶夜骑士绑定与摄梦关系不属于通用字段，分别按本夜状态身份由各本族唯一所有者保存。
 */
import { StatusMarksComponent } from "../../domain/components/status-marks";
import {
  ActionProvider,
  ActionRequest,
  ActionRequestExtras,
  ActionStage,
  EntityId,
  ExileFeedback,
  NightSummary,
  Role,
} from "../../domain/model";
import type { AliveComponent } from "../../domain/components/alive";

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
} from "../../domain/night-effects";

/** 狼刀选定时捕获的原生命及印记引用；目标序号相同不代表原体和生命版本仍有效。 */
export interface WolfKnifeTargetScope {
  targetId: EntityId;
  life: AliveComponent;
  version: number;
  marks: StatusMarksComponent;
}

/**
 * 同一夜按阶段顺序累积的运行状态，流水线创建，完整内建 owner 或具体提案命令写入所属效果。
 * 包含原组件、回执和当前性查询，不能直接序列化为玩家观察或录制格式。
 * 效果条目是运行提案或捕获记录；空容器存在不表示已付、有效或已标死，这些由各所有者分别核对。
 */
export interface NightStageState {
  /** 学者／导师在原冲突检查点产生的死亡与刀口；不是直接修改 Alive 的指令。 */
  modifierDeaths?: import("../../domain/night-effects").NightLifeScope[];
  modifierKnifeTargets?: EntityId[];
  wolfChatOrder: EntityId[];
  endedWolves: Set<EntityId>;
  wolfVotes: Record<number, number>;
  wolfTarget: EntityId | null;
  wolfTargetScope?: WolfKnifeTargetScope;
  /** 实际参与选定普通狼刀的投票者；票表的目标键不能代替投票者名单。 */
  wolfTargetVoters?: EntityId[];
  seerChecks: NightSummary["seerChecks"];
  /** 内建有来源 intent 与旧注入 claim 共存；仅同名字段不能把旧对象变成内建来源。 */
  poisonClaims?: Array<NightOriginalPoisonIntent | NightPoisonClaim>;
  inspectionAttacks?: NightInspectionAttack[];
  retaliationAttacks?: import("../../domain/night-effects").NightRetaliationAttack[];
  nightImmunities?: import("../../domain/night-effects").NightImmunityClaim[];
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
 * 可替换夜阶段实际取得的对象：请求与校验、编号查询和显式授予的具体操作。
 * 不提供 World、组件、整夜状态、事件数组、Catalog、请求构造器或能反查私有 runtime 的 token。
 * Provider 也为只含 getAction 的真实对象；候选不是付款，原资格、部分写入与已付效果仍由具体 owner 负责。
 */
export interface NightStageContext<Ports extends object = object> {
  isCurrent(): boolean;
  readonly previousExile: Readonly<ExileFeedback> | null;
  readonly actions: import("../actions/tool-gateway").BoundToolGateway;
  readonly actionProvider: ActionProvider;
  currentDay(): number;
  makeRequest(
    actorId: EntityId,
    allowedTools: ActionRequest["allowedTools"],
    context: ActionRequestExtras & { stage: ActionStage; requiresAction?: boolean },
  ): ActionRequest;
  getAliveByRole(role: Role): EntityId[];
  entityIds(): EntityId[];
  pickMajorityTarget(votes: Record<number, number>): EntityId | null;
  pickMistKnife?(ids: readonly EntityId[]): EntityId | null;
  shuffleWolves(ids: EntityId[]): EntityId[];
  /** 未绑定本族操作的扩展没有此能力；不填入空函数或根据机器 id 推断权限。 */
  readonly ports?: Ports;
}

/** handler 引用及 execute 仍可替换；流水线在原点只读一次实际 callee，并保原 receiver。 */
export interface NightStageHandler<Ports extends object = object> {
  id: string;
  priority: number;
  execute(ctx: NightStageContext<Ports>): Promise<void>;
}

/**
 * 计划只持执行定义的原引用。此面不宣称 raw owner 可用公开 callback 输入直接调用；真实执行交组合根双引用分派。
 * never 只擦除计划不应读写的参数类型，不提供 World 或可调用的伪运行上下文。
 */
export interface NightStageDefinition {
  id: string;
  priority: number;
  execute: (...args: never[]) => Promise<void>;
}
