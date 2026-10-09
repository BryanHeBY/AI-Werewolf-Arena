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
import type { NightAbilityKind } from "./abilities";
import type {World} from "../../../core/domain/world";

/** 角色初始化上下文。 */
export interface RoleInitContext {
  locale?: Locale;
  boardConfig?: BoardConfig;
  world?:World;
}

/** Faction membership alone never grants knowledge, chat access or a knife. */
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
  /** Declared composition limit; omitted roles retain their existing multiplicity. */
  maxCount?: number;
  /** Composition whitelist contributed by a role whose learning rules are deliberately finite. */
  supportedBoardRoles?: readonly Role[];
  /** Passive Bear sensing is independent of active inspection labels/knife permission. */
  detectableByBear?: (world:World,role:RoleComponent)=>boolean;
  initialVictoryAffiliations?: readonly VictoryAffiliation[] | ((role: RoleComponent, ctx: RoleInitContext) => readonly VictoryAffiliation[]);
  /** Public participation restrictions; secret immunity belongs to resolution hooks. */
  participation?: { canVote: boolean; canBeExiled: boolean; canBeSheriff: boolean } | ((role: RoleComponent) => { canVote: boolean; canBeExiled: boolean; canBeSheriff: boolean });
  wolfTeam?: WolfTeamPermissions | ((role: RoleComponent,world?:World) => WolfTeamPermissions);
  /** Explicit public self-destruct capability, independent of faction/knife access. */
  canSelfDestruct?: boolean;
  inspectionLabels?: { camp?: InspectionCamp; role?: RoleId } | ((role: RoleComponent) => { camp?: InspectionCamp; role?: RoleId });
  configuration?: {
    schema: z.ZodType;
    defaults: Readonly<Record<string, unknown>>;
    apply: (config: BoardConfig, value: unknown) => BoardConfig;
    /** Serialize only this role's public parameters from a resolved internal board. */
    serialize: (config: BoardConfig) => unknown;
  };
  init?: (roleComp: RoleComponent, ctx: RoleInitContext) => void;
  renderPrompt?: (roleComp: RoleComponent, locale?: Locale,world?:World) => string;
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
    world?:World,
  ) => ToolCall | null;
}
