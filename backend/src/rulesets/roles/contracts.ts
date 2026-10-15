/**
 * 负责定义角色资料、运行贡献及展示贡献的独立装配契约。资料只有身份、公开名称和组合约束，
 * 运行贡献拥有原初始化、许可、工具、阶段与 hook，展示声明只标识原生捕获或受信任原文。
 * 三者不相互授权或复制状态；自定义 flat profile 是明确支持的输入，Catalog 保留其原对象、
 * getter、receiver 与读取时点，不在接入时摊平或调用展示。未知扩展只得值查询；init 仅可写原容器及实际初始 Camp。
 */
import type { NightAbilityKind } from "@ai-werewolf-arena/game-contract";

import type { ReadonlyBoardConfig } from "@ai-werewolf-arena/game-contract";
import type { Locale } from "@ai-werewolf-arena/game-contract";
import type { VictoryAffiliation } from "@ai-werewolf-arena/game-contract";
import type { InspectionCamp, RoleId } from "@ai-werewolf-arena/game-contract";
import { RoleComponent } from "../../domain/components/role";
import type { CampComponent } from "../../domain/components/camp";
import { ActionRequest, BoardConfig, Camp, Role, ToolCall } from "../../domain/model";
import type { ToolSpec, StageDirectiveRule } from "../../engine/actions/tool-contracts";
import type { ToolRepairPack } from "../../agents/tool-repair/contracts";
import type { NightStageDefinition as NightStageHandler } from "../../engine/night/contracts";
import type { ToolRuleMap } from "../../engine/actions/validation-contracts";
import type { DeathHook, VotedOutHook } from "../../engine/hooks/registry";
import type { z } from "zod";

/** 公开运行查询只返回枚举、编号和脱离的 JSON 数据；不返回 World、原组件或新的许可。 */
export interface RoleQueries {
  actorRole(): Role;
  stateData(): unknown;
  currentCamp(): Camp | undefined;
  entityIds(): readonly number[];
  aliveIds(): readonly number[];
  roleValue(id: number): Role | undefined;
  campValue(id: number): Camp | undefined;
  isAlive(id: number): boolean;
}
/** 归属声明只有值输入；它不能通过初始化上下文取得可写 Camp 或任意 World。 */
export interface RoleValueContext {
  readonly currentCamp: () => Camp | undefined;
  readonly locale?: Locale;
  readonly boardConfig?: ReadonlyBoardConfig;
}
/** 初始化可写同一 ownRole 和待安装 Camp；查询当前值不回退该 draft，也不授运行许可。 */
export interface RoleInitContext extends RoleValueContext {
  readonly initialCamp: CampComponent;
  readonly queries: RoleQueries;
}

/** 仅初始化可写原扩展键和替换容器；不向普通读方公开可写角色 API。 */
export type RoleInitializationComponent = Omit<RoleComponent, "privateState"> & {
  privateState: Record<string, unknown>;
};

/** 阵营归属本身不授予知识、狼聊或刀权。 */
export interface WolfTeamPermissions {
  readonly recognizedByPack: boolean;
  readonly recognizes: "pack" | "all" | "none" | readonly Role[];
  readonly canChat: boolean;
  readonly canVoteForKill: boolean;
}

/** 不携带执行回调的角色资料；注册资料本身不授予角色运行支持。 */
export interface RoleMetadata {
  role: Role;
  camp?: Camp;
  label: string;
  skillBrief: string;
  goodSide?: "god" | "villager";
  /** 声明角色数量限制；未声明的角色保持原数量政策。 */
  maxCount?: number;
  /** 具备有限学习规则的角色贡献组合白名单。 */
  supportedBoardRoles?: readonly Role[];
  /** 有限来源目标；公开解析与内部初始化均拒绝不兼容目标。 */
  supportedWinConditions?: readonly import("../../domain/identity").WinCondition[];
}

/** 具体机制的运行贡献；其原函数引用、资源所有权及失败前缀不由资料或展示改变。 */
export interface RoleRuntimeContribution {
  /** 熊的被动感知独立于主动查验标签和刀权。 */
  detectableByBear?: (queries: RoleQueries) => boolean;
  initialVictoryAffiliations?:
    | readonly VictoryAffiliation[]
    | ((queries: RoleQueries, ctx: RoleValueContext) => readonly VictoryAffiliation[]);
  /** 公开参与限制；秘密免疫仍属于结算 hook。 */
  participation?:
    | { canVote: boolean; canBeExiled: boolean; canBeSheriff: boolean }
    | ((queries: RoleQueries) => { canVote: boolean; canBeExiled: boolean; canBeSheriff: boolean });
  wolfTeam?: WolfTeamPermissions | ((queries: RoleQueries) => WolfTeamPermissions);
  /** 特定时点获知队友的角色，显式保留其已有知识。 */
  knownTeammates?: (queries: RoleQueries) => readonly number[];
  /** 显式公开自爆资格，独立于阵营及刀权。 */
  canSelfDestruct?: boolean | ((queries: RoleQueries) => boolean);
  inspectionLabels?:
    | { camp?: InspectionCamp; role?: RoleId }
    | ((queries: RoleQueries) => { camp?: InspectionCamp; role?: RoleId });
  configuration?: {
    schema: z.ZodType;
    defaults: Readonly<Record<string, unknown>>;
    apply: (config: BoardConfig, value: unknown) => BoardConfig;
    /** 仅从已解析板子序列化本角色的公开参数。 */
    serialize: (config: BoardConfig) => unknown;
  };
  init?: (roleComp: RoleInitializationComponent, ctx: RoleInitContext) => void;
  toolSpecs?: ToolSpec[];
  stageDirectives?: StageDirectiveRule[];
  validationRules?: ToolRuleMap;
  nightStages?: NightStageHandler[];
  possibleNightAbilities?: readonly NightAbilityKind[];
  possibleDeathAbilities?: readonly "gun"[];
  llmRepair?: ToolRepairPack;
  votedOutHook?: VotedOutHook;
  deathHook?: DeathHook;
  baselineAction?: (
    queries: RoleQueries,
    request: ActionRequest,
    pickAliveNotSelf: () => number | null,
    pickAliveByCamp: (camp: "good" | "wolf" | "third_party") => number | null,
    locale: Locale | undefined,
  ) => ToolCall | null;
}

/** 展示贡献不拥有运行状态；原生只声明捕获 ID，自定义方法保留实际贡献对象作为 receiver。 */
export type RolePresentationContribution =
  | {
      readonly kind: "native";
      readonly id: import("@ai-werewolf-arena/game-contract").NativeRolePresentationId;
    }
  | { readonly kind: "custom"; renderPrompt?: RoleProfile["renderPrompt"] };

/** 实际组合根分别登记这三份贡献，禁止把它们再次摊平成一个内建 profile。 */
export interface RoleContributions {
  metadata: RoleMetadata;
  runtime: RoleRuntimeContribution;
  presentation: RolePresentationContribution;
}

/** 明确支持的用户 flat 输入；读取与调用仍针对原对象，不经复制或强制规范化。 */
export interface RoleProfile extends RoleMetadata, RoleRuntimeContribution {
  renderPrompt?: (queries: RoleQueries, locale: Locale | undefined) => string;
}

/** 内建 55 个角色均有原生展示声明，不能被宽化为可缺失原生 ID 的自定义分支。 */
export interface NativeRoleContributions extends RoleContributions {
  presentation: Extract<RolePresentationContribution, { kind: "native" }>;
}
