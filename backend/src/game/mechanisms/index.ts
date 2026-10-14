/**
 * 为后端消费者公开机制契约、注册器及具体机制装配出口。输入来自各唯一所有者的具名定义；导出保留公开机制 API 与夜间玩家资格查询。不枚举玩家、消费能力库存或建立第二套资格算法。
 */
export * from "./contracts";
export * from "./broadcast/agent_event_visibility_registry";
export * from "./broadcast/visibility_registry";
export * from "./config/contracts";
export * from "./config/normalizer_registry";
export * from "./hooks/hook_registry";
export * from "./llm/contracts";
export * from "./llm/target_hint_registry";
export * from "./llm/tool_call_repair_registry";
export * from "./last_words/last_words_mechanism";
export * from "./prompt/config_render_registry";
export * from "./script/event_render_registry";
export * from "./shared/phase_stage_localization_registry";
export * from "./roles/permissions";
export * from "./registries/tool_spec_registry";
export * from "./registries/win_condition_registry";
export * from "./roles/contracts";
export * from "./roles/catalog";
export * from "./roles/role-catalog-assembly";
export * from "./roles/wolf_team";
export * from "./roles/inspection";
export * from "./roles/abilities";
export {
  bindNightAbilityActorQuery,
  createNightActorEligibilityQuery,
  createNightAbilityActorQuery,
  type NightActorEligibilityQuery,
  type NightAbilityActorQuery,
  type NightAbilityRosterPort,
} from "./roles/night-ability-actors";
export * from "./roles/ability_changes";
export * from "./roles/night-ability-grants";
export * from "./sheriff/config_normalizer";
export * from "./sheriff/election";
export * from "./sheriff/speaking_order";
export * from "./sheriff/badge";
export * from "./self_destruct/config_normalizer";
export * from "./stages/night/contracts";
export * from "./stages/night/night_stage_registry";
export * from "./validation/tool_validation_rule_registry";
export * from "./win_conditions/contracts";
