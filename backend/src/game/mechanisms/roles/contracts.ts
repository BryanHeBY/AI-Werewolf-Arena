/**
 * 负责定义角色资料、初始化、运行贡献与展示贡献契约的数据结构。输入为原 profile 及其
 * 原角色／上下文；Catalog 保持同一贡献对象和实际读取顺序。初始化可写原扩展键与容器，
 * 普通读方不取得写权。内建展示只声明中立标识，自定义原文回调仍受信任，不授予租约或动作权限。
 */
import type { NightAbilityKind } from "@ai-werewolf-arena/game-contract";

import type { ReadonlyBoardConfig } from "@ai-werewolf-arena/game-contract";
import type { Locale } from "@ai-werewolf-arena/game-catalog";
import type { VictoryAffiliation } from "@ai-werewolf-arena/game-catalog";
import type { InspectionCamp, RoleId } from "@ai-werewolf-arena/game-catalog";
/** 文件说明：角色 profile 的统一契约定义。 */
import { RoleComponent } from "../../../core/domain/components/role";
import { ActionRequest, BoardConfig, Camp, Role, ToolCall } from "../../../core/domain/model";
import type { ToolSpec, StageDirectiveRule } from "../contracts";
import type { ToolRepairPack } from "../llm/contracts";
import type { NightStageHandler } from "../stages/night/contracts";
import type { ToolRuleMap } from "../validation/contracts";
import type { DeathHook, VotedOutHook } from "../hooks/hook_registry";
import type { z } from "zod";
import type { World } from "../../../core/domain/world";

/** 角色初始化上下文。 */
export interface RoleInitContext {
  locale?: Locale;
  boardConfig?: ReadonlyBoardConfig;
  world?: World;
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

/** 单个角色在机制层的完整配置描述。 */
export interface RoleProfile {
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
  supportedWinConditions?: readonly import("../../../core/domain/identity").WinCondition[];
  /** 熊的被动感知独立于主动查验标签和刀权。 */
  detectableByBear?: (world: World, role: RoleComponent) => boolean;
  initialVictoryAffiliations?:
    | readonly VictoryAffiliation[]
    | ((role: RoleComponent, ctx: RoleInitContext) => readonly VictoryAffiliation[]);
  /** 公开参与限制；秘密免疫仍属于结算 hook。 */
  participation?:
    | { canVote: boolean; canBeExiled: boolean; canBeSheriff: boolean }
    | ((role: RoleComponent) => { canVote: boolean; canBeExiled: boolean; canBeSheriff: boolean });
  wolfTeam?: WolfTeamPermissions | ((role: RoleComponent, world?: World) => WolfTeamPermissions);
  /** 特定时点获知队友的角色，显式保留其已有知识。 */
  knownTeammates?: (role: RoleComponent, world: World) => readonly number[];
  /** 显式公开自爆资格，独立于阵营及刀权。 */
  canSelfDestruct?: boolean | ((role: RoleComponent) => boolean);
  inspectionLabels?:
    | { camp?: InspectionCamp; role?: RoleId }
    | ((role: RoleComponent) => { camp?: InspectionCamp; role?: RoleId });
  configuration?: {
    schema: z.ZodType;
    defaults: Readonly<Record<string, unknown>>;
    apply: (config: BoardConfig, value: unknown) => BoardConfig;
    /** 仅从已解析板子序列化本角色的公开参数。 */
    serialize: (config: BoardConfig) => unknown;
  };
  init?: (roleComp: RoleInitializationComponent, ctx: RoleInitContext) => void;
  /** 内建展示的语言中立标识；不绑定当前请求能力或传出运行状态。 */
  nativePresentation?: import("./presentation-contribution").NativeRolePresentationContribution;
  /** 旧 profile 展示 API 的临时兼容入口；内建与受信任自定义回调均保留原 receiver 和晚 World 读取，待 C44 消费者切换后退出。 */
  renderPrompt?: (roleComp: RoleComponent, locale?: Locale, world?: World) => string;
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
    roleComp: RoleComponent,
    request: ActionRequest,
    pickAliveNotSelf: () => number | null,
    pickAliveByCamp: (camp: "good" | "wolf" | "third_party") => number | null,
    locale?: Locale,
    world?: World,
  ) => ToolCall | null;
}
