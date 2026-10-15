/**
 * 负责配置错误的固定代码集合和字段路径裁剪。输入为未知异常，输出白名单代码及可选有限路径。
 * 仅检查 Error／板子错误的自有数据描述符，不输出冒号后的原异常内容；外来对象查询失败退通用诊断。
 */
import { BoardConfigurationError } from "./board-definition";
/** 诊断只公开已知机器码，不因一个字符串看起来像命名空间就接受它。 */
export const CONFIG_ERROR_CODES = [
  "board_config_animal_dream_preset_invalid",
  "board_config_bear_role_required",
  "board_config_noble_secret_body_preset_invalid",
  "board_config_radiant_eclipse_preset_invalid",
  "board_config_mist_raven_preset_invalid",
  "board_config_order_prince_preset_invalid",
  "board_config_trickster_preset_invalid",
  "board_config_scholar_mentor_preset_invalid",
  "board_config_time_consort_preset_invalid",
  "board_config_wolf_sorcerer_preset_invalid",
  "board_config_magician_preset_invalid",
  "board_config_red_moon_preset_invalid",
  "board_config_nightmare_preset_invalid",
  "board_config_evil_knight_preset_invalid",
  "board_config_pure_white_preset_invalid",
  "board_config_demon_hunter_preset_invalid",
  "board_config_ghost_bride_preset_invalid",
  "board_config_role_win_condition_not_supported",
  "board_config_disabled_mechanism_parameters",
  "board_config_duplicate_role",
  "board_config_duplicate_win_condition",
  "board_config_duplicate_window",
  "board_config_file_missing",
  "board_config_id_invalid",
  "board_config_id_mismatch",
  "board_config_invalid_field",
  "board_config_invalid_override",
  "board_config_invalid_override_field",
  "board_config_json_invalid",
  "board_config_legacy_base_unknown",
  "board_config_legacy_shape_invalid",
  "board_config_migration_backup_conflict",
  "board_config_migration_cleanup_failed",
  "board_config_migration_required",
  "board_config_migration_rollback_failed",
  "board_config_migration_target_exists",
  "board_config_requires_good_and_wolf",
  "board_config_role_count_mismatch",
  "board_config_role_not_implemented",
  "board_config_role_parameters_not_supported",
  "board_config_role_combination_not_supported",
  "board_config_role_parameters_without_role",
  "board_config_seat_out_of_range",
  "board_config_slaughter_side_requires_both_sides",
  "board_config_window_hook_disabled",
  "config_check_failed",
  "config_check_usage",
  "runtime_config_acp_action_transport_invalid",
  "runtime_config_acp_agent_requires_acp_provider",
  "runtime_config_acp_profile_missing_for_actor",
  "runtime_config_acp_session_config_option_invalid",
  "runtime_config_acp_session_config_options_invalid",
  "runtime_config_acp_session_reuse_invalid",
  "runtime_config_acp_transport_unsupported",
  "runtime_config_agent_default_not_found",
  "runtime_config_agent_invalid",
  "runtime_config_agent_kind_unsupported",
  "runtime_config_agent_not_found",
  "runtime_config_agent_profile_missing_for_actor",
  "runtime_config_agent_provider_not_found",
  "runtime_config_agent_selection_invalid",
  "runtime_config_agent_selections_invalid",
  "runtime_config_anthropic_reasoning_effort_invalid",
  "runtime_config_anthropic_thinking_temperature_unsupported",
  "runtime_config_board_definition_mismatch",
  "runtime_config_board_definition_required",
  "runtime_config_board_invalid",
  "runtime_config_empty_agents_items",
  "runtime_config_empty_providers_items",
  "runtime_config_environment_invalid",
  "runtime_config_file_missing",
  "runtime_config_game_agent_must_be_name",
  "runtime_config_game_name_invalid",
  "runtime_config_invalid_agents",
  "runtime_config_invalid_agents_items",
  "runtime_config_invalid_debug_summary",
  "runtime_config_invalid_debug_summary_agent",
  "runtime_config_invalid_game",
  "runtime_config_invalid_providers",
  "runtime_config_invalid_providers_items",
  "runtime_config_json_invalid",
  "runtime_config_llm_agent_requires_llm_provider",
  "runtime_config_llm_clients_empty",
  "runtime_config_llm_profile_missing_for_actor",
  "runtime_config_locale_invalid",
  "runtime_config_minimum_integer_invalid",
  "runtime_config_missing_configs_dir",
  "runtime_config_missing_environment_value",
  "runtime_config_missing_provider_or_agent_defaults",
  "runtime_config_mixed_llm_and_acp_agents_not_supported_yet",
  "runtime_config_provider_binding_inconsistent",
  "runtime_config_optional_boolean_invalid",
  "runtime_config_optional_number_invalid",
  "runtime_config_player_binding_conflict",
  "runtime_config_player_binding_invalid",
  "runtime_config_player_invalid",
  "runtime_config_player_name_invalid",
  "runtime_config_player_profiles_empty",
  "runtime_config_players_invalid",
  "runtime_config_positive_integer_invalid",
  "runtime_config_prompt_empty",
  "runtime_config_prompt_invalid",
  "runtime_config_provider_default_not_found",
  "runtime_config_provider_invalid",
  "runtime_config_provider_type_unsupported",
  "runtime_config_reasoning_effort_invalid",
  "runtime_config_required_string_invalid",
  "runtime_config_role_binding_invalid",
  "runtime_config_selection_key_invalid",
  "runtime_config_spawn_args_require_acp_agent",
  "runtime_config_spawn_args_require_explicit_acp_agent",
  "runtime_config_string_array_invalid",
  "runtime_config_unknown_field",
] as const;
export type ConfigErrorCode = (typeof CONFIG_ERROR_CODES)[number];

export function configDiagnostic(error: unknown): { code: string; path?: string } {
  let message: unknown;
  let fieldPath: unknown;
  try {
    message =
      error instanceof Error ? Object.getOwnPropertyDescriptor(error, "message")?.value : undefined;
    fieldPath =
      error instanceof BoardConfigurationError
        ? Object.getOwnPropertyDescriptor(error, "fieldPath")?.value
        : undefined;
  } catch {
    /* 外来 Proxy／描述符查询可能抛错，错误输出仍继续使用已取得的有限字段或通用代码。 */
  }
  const candidate = typeof message === "string" ? message.split(":", 1)[0] : "config_check_failed";
  const code = CONFIG_ERROR_CODES.includes(candidate as ConfigErrorCode)
    ? candidate
    : "config_check_failed";
  // 只允许已知配置根与有界字段／数字索引；原 message 中的路径、URL 或其它文字不进入返回值。
  const safePath =
    typeof fieldPath === "string" &&
    fieldPath.length <= 160 &&
    /^(version|id|ruleset|board|rules|mechanisms|roles)(\.[a-z][a-zA-Z0-9_-]{0,31}|\.\d+)*$/.test(
      fieldPath,
    );
  return { code, ...(safePath && typeof fieldPath === "string" ? { path: fieldPath } : {}) };
}
