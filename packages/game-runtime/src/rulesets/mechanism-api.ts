/**
 * 为后端消费者公开机制契约、注册器及具体机制装配出口。输入来自各唯一所有者的具名定义；导出保留公开机制 API 与夜间玩家资格查询。不枚举玩家、消费能力库存或建立第二套资格算法。
 */
export * from "../engine/actions/tool-contracts";
export * from "../agents/observation/agent-event-visibility-registry";
export * from "../agents/observation/visibility-registry";
export * from "./configuration/contracts";
export * from "./configuration/normalizer-registry";
export * from "../engine/hooks/registry";
export * from "../agents/tool-repair/contracts";
export * from "../agents/tool-repair/target-hint-registry";
export * from "../agents/tool-repair/tool-call-repair-registry";
export * from "../features/last-words/last-words-mechanism";
export * from "../agents/prompt/config-render-registry";
export * from "../agents/presentation/event-render-registry";
export * from "../agents/presentation/phase-stage-localization-registry";
export * from "./roles/permissions";
export * from "../engine/actions/tool-spec-registry";
export * from "../engine/victory/condition-registry";
export * from "./roles/contracts";
export * from "./roles/catalog";
export * from "./roles/role-catalog-assembly";
export * from "../features/wolf-team/permissions";
export * from "../engine/inspection";
export {
  ROLE_INSPECTION_POLICY_ROLES,
  projectPairState,
  copyAbilityData,
  allNightAbilities,
  nightAbilityDisabled,
  abilityStatus,
  findNightAbility,
  activeNightAbility,
  retiredNightAbilityIds,
  projectRoleInspectionState,
  projectSeerState,
  projectWitchState,
  setNightAbilityEnabled,
  retireBorrowedNightAbility,
  expireLuckyAbilitiesOnDeath,
  setNightAbilityStartDay,
  recordNightAbilityUse,
  type NightAbility,
  type NightAbilityReadView,
} from "../features/night-abilities/abilities";
export {
  bindNightAbilityActorQuery,
  createNightActorEligibilityQuery,
  createNightAbilityActorQuery,
  type NightActorEligibilityQuery,
  type NightAbilityActorQuery,
  type NightAbilityRosterPort,
} from "../features/night-abilities/night-ability-actors";
export * from "../features/night-abilities/ability-changes";
export * from "../features/night-abilities/night-ability-grants";
export * from "../features/sheriff/config-normalizer";
export * from "../features/sheriff/election";
export * from "../features/sheriff/speaking-order";
export * from "../features/sheriff/badge";
export * from "../features/self-destruct/config-normalizer";
export * from "../engine/night/contracts";
export { NightStageRegistry, getDefaultNightStageRegistry } from "./night-stage-plan";
export * from "../engine/actions/tool-validation-rule-registry";
export * from "../engine/victory/contracts";
