/**
 * 负责定义工具参数修复与目标提示的公共数据契约；输入为原参数、行动者和 World／候选引用，
 * 输出契约为修复候选或提示文字。实际处理函数与目标规则由各 registry 拥有。
 * 可写字段与 readonly 候选类型不复制、冻结或验证输入；提示及修复结果不授予请求权限或库存。
 */
import { EntityId, Role, ToolName } from "../../domain/model";
import type { Locale } from "@ai-werewolf-arena/game-contract";

/** 修复只取得本次行动者编号；该字段本身不证明请求绑定、身份或当前行动资格。 */
export interface CoerceContext {
  actorId: EntityId;
}

/**
 * 接收可写的原参数记录与上下文，返回修复候选；null 表示没有候选，不表示已经接受或完成弃权。
 * 类型不限制处理器读取 getter、修改输入或抛错；接收器仍对结果校验 schema 和领域规则。
 */
export type CoerceHandler = (
  args: Record<string, unknown>,
  ctx: CoerceContext,
) => Record<string, unknown> | null;

/** 工具到处理器的可写稀疏表；同名注册保最后处理器值，无有效处理器时保原参数副本。 */
export interface ToolRepairPack {
  coerce: Partial<Record<ToolName, CoerceHandler>>;
}

/**
 * 目标提示按当前工具与候选来源选择编号；查询实时读取所属 owner，不持有提交回执或独立库存。
 * 可选字段由原调用方逐项求值，缺项处理与异常由具体目标规则决定，不统一补全或校验。
 */
export interface TargetHintContext {
  /** 学者修正／追加行动的提示候选；readonly 只限制类型写法，不是冻结后的许可名单。 */
  modifierCandidates?: readonly EntityId[];
  modifierBonusCandidates?: readonly EntityId[];
  /** 行动者及轮次用于原目标规则查询；缺省 day 的处理由具体规则选择。 */
  actorId: EntityId;
  day?: number;
  /** 提示层选择目标策略的角色标签，可来自能力实例；不能据此认定当前身份或真实阵营。 */
  actorRole?: Role;
  /** 能力实例标识只定位本次目标规则，不独立授予该实例的使用权。 */
  abilityId?: string;
  debateTargetId?: number;
  /** 原可写工具数组决定提示分支；是否可提交仍由真实请求、接收器和机制复验。 */
  allowedTools: ToolName[];
  /** 只暴露编号、标量和受限查询句柄，不返回原组件或可写世界。 */
  readonly queries: TargetHintQueries;
  /** 警长、徽章与放逐候选用于对应提示过滤，仍须按原参与规则核资格。 */
  sheriffCandidates?: readonly EntityId[];
  badgeCandidates?: readonly EntityId[];
  exileCandidates?: readonly EntityId[];
}

/** 返回提示文本或无提示；查询／本地化异常按实现传播，提示不等于动作准入结果。 */
export interface TargetHintRegistry {
  buildActionableIdsHint(ctx: TargetHintContext): string | undefined;
}

/** 捕获本次行动者原能力引用，只返回目标判断；不授予使用能力或付款的权限。 */
export interface TargetHintActorQueries {
  luckyAllowed(tool: ToolName, id: EntityId): boolean;
  awakenedGuardAllowed(id: EntityId): boolean;
  potion(): { isLucky(): boolean } | undefined;
}

/** 目标提示的具体查询；候选只是建议，实际提交仍须由网关与资源 owner 复验。 */
export interface TargetHintQueries {
  locale(): Locale;
  aliveIds(): EntityId[];
  nobleChoiceTargets(): readonly EntityId[];
  shelterTargets(): EntityId[];
  eclipseSwallowTargets(): EntityId[];
  isRadiantBoard(): boolean;
  inspection(): { allows(id: EntityId): boolean } | undefined;
  actorRules(): TargetHintActorQueries;
  fearTargets(): EntityId[];
  swapTargets(): EntityId[];
  wolfKnifeAllows(id: EntityId): boolean;
  wolfWitchTargetAllowed(id: EntityId): boolean;
  canBeExiled(id: EntityId): boolean;
  loversVoteAllowed(id: EntityId): boolean;
  canBeSheriff(id: EntityId): boolean;
}
