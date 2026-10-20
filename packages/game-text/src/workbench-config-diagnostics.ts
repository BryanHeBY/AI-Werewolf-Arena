/**
 * 负责把配置诊断转换为可操作的双语说明。输入固定机器码与公开字段路径，输出显示文本。
 * 同类旧格式错误共用恢复建议；错误原文、字段原值与认证不参与翻译，未知码仍由界面提供通用提示。
 */
import { boardLabel, hasBoardLabel } from "./workbench-board";
type Locale = "zh-CN" | "en";

export const zhCN = {
  board_config_animal_dream_preset_invalid:
    "当前玩法固定了角色组合及部分规则。请恢复不受支持的改动，按此玩法允许的选项调整。",
  board_config_bear_role_required:
    "所选角色组合或角色参数尚不受支持。请选择已支持的板子，并移除不属于该板子的角色设置。",
  board_config_role_win_condition_not_supported:
    "判胜条件与当前角色组成不匹配。屠边需要平民和神职，牌组也必须同时包含好人与狼人。",
  board_config_disabled_mechanism_parameters:
    "已关闭的机制仍带有生效参数。请清除该机制的从属设置后保存。",
  board_config_duplicate_role: "同一角色、判胜条件或行动时机被重复配置。请移除重复项。",
  board_config_role_count_mismatch: "角色总人数或座位编号与板子人数不一致。请核对人数及座位范围。",
  board_config_window_hook_disabled:
    "自爆时机与对应阶段开关不一致。请在自爆时机中重新选择，或修正 JSON 中的对应开关。",
  board_config_file_missing: "缺少所需配置。请先保存本地板子和 Agent，并检查配置目录。",
  board_config_id_invalid:
    "配置 ID 无效或与文件名不一致。请使用小写字母开头的字母、数字、下划线或短横线。",
  board_config_invalid_field:
    "字段名称、结构或格式版本不受支持。请检查标出的字段，或从当前模板重新创建。",
  board_config_json_invalid: "JSON 语法不正确。请检查括号、引号与逗号后重试。",
  board_config_migration_required:
    "配置迁移尚未完成或遇到文件冲突。请保留原文件，核对迁移结果后重新读取。",
  config_check_failed: "配置检查未通过。请检查必填项及所选板子、连接和 Agent 是否匹配。",
  runtime_config_acp_action_transport_invalid:
    "ACP 传输、会话复用或会话参数无效。请使用支持的传输及适配器选项。",
  runtime_config_acp_agent_requires_acp_provider:
    "Agent 类型与所选连接不匹配。请选择同类且支持该平台的连接。",
  runtime_config_agent_default_not_found:
    "引用的 Agent 或连接不存在。请重新选择已保存项，并核对全局默认 Agent。",
  runtime_config_empty_agents_items: "尚无可用的 Agent 或连接。请先完成并保存 Agent 配置。",
  runtime_config_agent_invalid:
    "Agent 或连接配置的类型、结构或参数无效。请检查标出的条目及高级 JSON。",
  runtime_config_binding_invalid:
    "玩家或角色设置不适用于当前板子。请处理切换板子后不再适用的设置，并核对座位范围。",
  runtime_config_game_agent_must_be_name:
    "请选择一个已保存的 Agent；启动参数只能用于显式选择的 ACP Agent。",
  runtime_config_custom_instructions_invalid:
    "附加指令格式无效。追加和替换需要非空文本；清除模式不能携带文本。",
  runtime_config_environment_invalid:
    "环境变量配置不正确，或引用的变量未设置。请在运行工作台的进程中设置变量，或填写对应认证。",
  runtime_config_anthropic_reasoning_effort_invalid:
    "思考等级或温度与模型不匹配。请选择该模型支持的等级，并移除冲突的温度设置。",
  runtime_config_locale_invalid:
    "字段值不符合要求。请核对非空文本、语言、正整数、布尔值及列表格式；时间字段有单位提示。",
  runtime_config_board_definition_mismatch:
    "游戏引用的板子与载入的板子定义不一致。请重新选择并保存本地板子。",
  pi_models_invalid:
    "Pi 模型目录或选择无效。自定义模型需要登记模型 ID、API 类型与服务地址；覆盖项必须指向已登记模型。",
  pi_provider_not_configured:
    "所选 Pi 连接不支持这个提供商。请更换连接或在该连接中配置对应提供商。",
  pi_model_not_found: "所选模型不在此提供商的目录中。请选择内置模型，或先在连接中登记自定义模型。",
  pi_auth_invalid: "Pi 认证格式或 OAuth 提供商无效。请使用支持的认证方式，订阅登录可重新导入。",
  pi_config_shell_disabled:
    "此 Pi 接入使用内存会话和游戏工具，不允许启用文件资源、Shell 认证命令或缓存预热。请移除对应扩展。",
  "field.board": "板子",
  "field.rules": "规则",
  "field.mechanisms": "机制",
  "field.roles": "角色设置",
  "field.players": "座位设置",
  "field.game": "游戏配置",
  "field.backends": "连接",
  "field.agents": "Agent",
  "field.items": "条目",
  "field.options": "参数",
  "field.config": "连接参数",
  "field.default": "全局默认",
  "field.agent": "Agent",
  "field.backend": "连接",
  "field.name": "名字",
  "field.customInstructions": "附加指令",
  "field.text": "正文",
  "field.mode": "组合方式",
  "field.maxDays": "最多天数",
  "field.maxRuntimeMs": "整局时限",
  "field.llmTimeoutMs": "单次玩家行动时限",
  "field.defaultProvider": "提供商",
  "field.defaultModel": "模型",
  "field.model": "模型",
  "field.defaultThinkingLevel": "思考等级",
} as const;
export const en: Record<keyof typeof zhCN, string> = {
  board_config_animal_dream_preset_invalid:
    "This variant fixes its role composition and some rules. Restore unsupported changes and choose from the options supported by this variant.",
  board_config_bear_role_required:
    "This role combination or its parameters are unsupported. Choose a supported board and remove settings for roles absent from it.",
  board_config_role_win_condition_not_supported:
    "The victory conditions do not match the roster. Side elimination requires both villagers and gods, and the roster needs good and wolf players.",
  board_config_disabled_mechanism_parameters:
    "A disabled mechanism still has active parameters. Clear its dependent settings before saving.",
  board_config_duplicate_role:
    "A role, victory condition or action window is duplicated. Remove the duplicate entry.",
  board_config_role_count_mismatch:
    "The role total or seat number does not match the board size. Check player counts and seat bounds.",
  board_config_window_hook_disabled:
    "A self-destruct window has its stage disabled. Reselect the window or correct the matching JSON flag.",
  board_config_file_missing:
    "A required configuration is missing. Save a local board and agent, and check the configuration directory.",
  board_config_id_invalid:
    "A configuration ID is invalid or does not match its filename. Start with a lowercase letter and use lowercase letters, digits, underscores or hyphens.",
  board_config_invalid_field:
    "A field, structure or format version is unsupported. Check the indicated field or create a configuration from a current template.",
  board_config_json_invalid: "The JSON syntax is invalid. Check brackets, quotes and commas.",
  board_config_migration_required:
    "Configuration migration is incomplete or conflicted. Keep the original files, inspect the migration result and reload.",
  config_check_failed:
    "Configuration validation failed. Check required fields and whether the board, connection and agent match.",
  runtime_config_acp_action_transport_invalid:
    "The ACP transport, session reuse or session options are invalid. Use supported transport and adapter settings.",
  runtime_config_acp_agent_requires_acp_provider:
    "The agent type does not match its connection. Choose a compatible connection of the same backend kind.",
  runtime_config_agent_default_not_found:
    "A referenced agent or connection does not exist. Reselect a saved item and check the global default agent.",
  runtime_config_empty_agents_items:
    "No usable agent or connection is configured. Configure and save an agent first.",
  runtime_config_agent_invalid:
    "The agent or connection type, structure or parameters are invalid. Check the indicated entry and advanced JSON.",
  runtime_config_binding_invalid:
    "Player or role settings do not apply to this board. Resolve obsolete bindings after changing boards and check seat bounds.",
  runtime_config_game_agent_must_be_name:
    "Select a saved agent. Spawn arguments require an explicitly selected ACP agent.",
  runtime_config_custom_instructions_invalid:
    "Additional instructions are invalid. Append and replace require nonempty text; clear must not include text.",
  runtime_config_environment_invalid:
    "An environment variable is invalid or missing. Set it in the workbench process environment or enter the credentials.",
  runtime_config_anthropic_reasoning_effort_invalid:
    "The thinking level or temperature is incompatible with this model. Choose a supported level and remove conflicting temperature settings.",
  runtime_config_locale_invalid:
    "A field value is invalid. Check text, language, positive integers, booleans and lists. Time fields show their units.",
  runtime_config_board_definition_mismatch:
    "The selected board does not match the loaded definition. Reselect and save the local board.",
  pi_models_invalid:
    "The Pi model catalogue or selection is invalid. Register custom model IDs, API types and endpoints; overrides must reference registered models.",
  pi_provider_not_configured:
    "This Pi connection does not support the selected provider. Choose another connection or configure that provider.",
  pi_model_not_found:
    "The model is not registered for this provider. Choose a bundled model or register the custom model in the connection.",
  pi_auth_invalid:
    "Pi credentials or the OAuth provider are invalid. Use a supported authentication method or reimport subscription credentials.",
  pi_config_shell_disabled:
    "This Pi integration uses in-memory sessions and game tools. Remove file resources, shell credential commands or cache warming.",
  "field.board": "Board",
  "field.rules": "Rules",
  "field.mechanisms": "Mechanisms",
  "field.roles": "Role settings",
  "field.players": "Seat settings",
  "field.game": "Game",
  "field.backends": "Connections",
  "field.agents": "Agents",
  "field.items": "Items",
  "field.options": "Options",
  "field.config": "Connection settings",
  "field.default": "Global default",
  "field.agent": "Agent",
  "field.backend": "Connection",
  "field.name": "Name",
  "field.customInstructions": "Additional instructions",
  "field.text": "Text",
  "field.mode": "Combination mode",
  "field.maxDays": "Maximum days",
  "field.maxRuntimeMs": "Game time limit",
  "field.llmTimeoutMs": "Player action time limit",
  "field.defaultProvider": "Provider",
  "field.defaultModel": "Model",
  "field.model": "Model",
  "field.defaultThinkingLevel": "Thinking level",
};
type MessageKey = keyof typeof zhCN;
const groups: readonly (readonly [readonly string[], MessageKey])[] = [
  [
    [
      "board_config_animal_dream_preset_invalid",
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
    ],
    "board_config_animal_dream_preset_invalid",
  ],
  [
    [
      "board_config_bear_role_required",
      "board_config_role_parameters_without_role",
      "board_config_role_parameters_not_supported",
      "board_config_role_combination_not_supported",
      "board_config_role_not_implemented",
    ],
    "board_config_bear_role_required",
  ],
  [
    [
      "board_config_role_win_condition_not_supported",
      "board_config_slaughter_side_requires_both_sides",
      "board_config_requires_good_and_wolf",
    ],
    "board_config_role_win_condition_not_supported",
  ],
  [["board_config_disabled_mechanism_parameters"], "board_config_disabled_mechanism_parameters"],
  [
    [
      "board_config_duplicate_role",
      "board_config_duplicate_win_condition",
      "board_config_duplicate_window",
    ],
    "board_config_duplicate_role",
  ],
  [
    ["board_config_role_count_mismatch", "board_config_seat_out_of_range"],
    "board_config_role_count_mismatch",
  ],
  [["board_config_window_hook_disabled"], "board_config_window_hook_disabled"],
  [
    [
      "board_config_file_missing",
      "runtime_config_file_missing",
      "runtime_config_missing_configs_dir",
      "board_config_board_definition_required",
      "runtime_config_board_definition_required",
    ],
    "board_config_file_missing",
  ],
  [
    [
      "board_config_id_invalid",
      "board_config_id_mismatch",
      "runtime_config_game_name_invalid",
      "runtime_config_board_invalid",
      "runtime_config_selection_key_invalid",
    ],
    "board_config_id_invalid",
  ],
  [
    [
      "board_config_invalid_field",
      "board_config_invalid_override",
      "board_config_invalid_override_field",
      "board_config_legacy_shape_invalid",
      "board_config_legacy_base_unknown",
      "runtime_config_unknown_field",
      "runtime_config_schema_version_invalid",
      "runtime_config_migration_shape_invalid",
    ],
    "board_config_invalid_field",
  ],
  [
    [
      "board_config_json_invalid",
      "runtime_config_json_invalid",
      "runtime_config_native_json_invalid",
    ],
    "board_config_json_invalid",
  ],
  [
    [
      "board_config_migration_required",
      "board_config_migration_backup_conflict",
      "board_config_migration_cleanup_failed",
      "board_config_migration_rollback_failed",
      "board_config_migration_target_exists",
      "runtime_config_migration_default_invalid",
      "runtime_config_migration_kind_mismatch",
      "runtime_config_migration_target_exists",
      "runtime_config_migration_source_changed",
      "runtime_config_migration_rollback_failed",
      "runtime_config_migration_backup_conflict",
    ],
    "board_config_migration_required",
  ],
  [["config_check_failed", "config_check_usage"], "config_check_failed"],
  [
    [
      "runtime_config_acp_action_transport_invalid",
      "runtime_config_acp_transport_unsupported",
      "runtime_config_acp_session_reuse_invalid",
      "runtime_config_acp_session_config_option_invalid",
      "runtime_config_acp_session_config_options_invalid",
    ],
    "runtime_config_acp_action_transport_invalid",
  ],
  [
    [
      "runtime_config_acp_agent_requires_acp_provider",
      "runtime_config_llm_agent_requires_llm_provider",
      "runtime_config_provider_binding_inconsistent",
      "runtime_config_mixed_llm_and_acp_agents_not_supported_yet",
    ],
    "runtime_config_acp_agent_requires_acp_provider",
  ],
  [
    [
      "runtime_config_agent_default_not_found",
      "runtime_config_agent_not_found",
      "runtime_config_agent_provider_not_found",
      "runtime_config_provider_default_not_found",
      "runtime_config_agent_backend_not_found",
      "runtime_config_missing_provider_or_agent_defaults",
    ],
    "runtime_config_agent_default_not_found",
  ],
  [
    [
      "runtime_config_empty_agents_items",
      "runtime_config_empty_providers_items",
      "runtime_config_empty_backends_items",
      "runtime_config_player_profiles_empty",
      "runtime_config_llm_clients_empty",
      "runtime_config_acp_profile_missing_for_actor",
      "runtime_config_llm_profile_missing_for_actor",
      "runtime_config_agent_profile_missing_for_actor",
    ],
    "runtime_config_empty_agents_items",
  ],
  [
    [
      "runtime_config_agent_invalid",
      "runtime_config_agent_kind_unsupported",
      "runtime_config_agent_selection_invalid",
      "runtime_config_agent_selections_invalid",
      "runtime_config_invalid_agents",
      "runtime_config_invalid_agents_items",
      "runtime_config_agent_options_invalid",
      "runtime_config_invalid_providers",
      "runtime_config_invalid_providers_items",
      "runtime_config_provider_invalid",
      "runtime_config_provider_type_unsupported",
      "runtime_config_invalid_backends",
      "runtime_config_invalid_backends_items",
      "runtime_config_backend_invalid",
      "runtime_config_backend_config_invalid",
      "runtime_config_backend_limits_invalid",
      "runtime_config_backend_kind_unsupported",
      "runtime_config_native_object_invalid",
    ],
    "runtime_config_agent_invalid",
  ],
  [
    [
      "runtime_config_binding_invalid",
      "runtime_config_bindings_invalid",
      "runtime_config_player_binding_conflict",
      "runtime_config_player_binding_invalid",
      "runtime_config_player_invalid",
      "runtime_config_players_invalid",
      "runtime_config_role_binding_invalid",
    ],
    "runtime_config_binding_invalid",
  ],
  [
    [
      "runtime_config_game_agent_must_be_name",
      "runtime_config_spawn_args_require_acp_agent",
      "runtime_config_spawn_args_require_explicit_acp_agent",
    ],
    "runtime_config_game_agent_must_be_name",
  ],
  [
    [
      "runtime_config_custom_instructions_invalid",
      "runtime_config_custom_instructions_mode_invalid",
      "runtime_config_custom_instructions_clear_has_text",
      "runtime_config_custom_instructions_text_empty",
      "runtime_config_prompt_empty",
      "runtime_config_prompt_invalid",
    ],
    "runtime_config_custom_instructions_invalid",
  ],
  [
    ["runtime_config_environment_invalid", "runtime_config_missing_environment_value"],
    "runtime_config_environment_invalid",
  ],
  [
    [
      "runtime_config_anthropic_reasoning_effort_invalid",
      "runtime_config_reasoning_effort_invalid",
      "runtime_config_anthropic_thinking_temperature_unsupported",
      "pi_settings_thinking_invalid",
    ],
    "runtime_config_anthropic_reasoning_effort_invalid",
  ],
  [
    [
      "runtime_config_locale_invalid",
      "runtime_config_player_name_invalid",
      "runtime_config_required_string_invalid",
      "runtime_config_string_array_invalid",
      "runtime_config_optional_boolean_invalid",
      "runtime_config_optional_number_invalid",
      "runtime_config_positive_integer_invalid",
      "runtime_config_minimum_integer_invalid",
      "runtime_config_invalid_game",
      "runtime_config_invalid_debug_summary",
      "runtime_config_invalid_debug_summary_agent",
    ],
    "runtime_config_locale_invalid",
  ],
  [["runtime_config_board_definition_mismatch"], "runtime_config_board_definition_mismatch"],
  [
    [
      "pi_models_invalid",
      "pi_models_duplicate_id",
      "pi_model_api_base_required",
      "pi_model_override_unknown",
      "pi_settings_model_required",
    ],
    "pi_models_invalid",
  ],
  [["pi_provider_not_configured"], "pi_provider_not_configured"],
  [["pi_model_not_found"], "pi_model_not_found"],
  [["pi_auth_invalid", "pi_models_unsupported_oauth"], "pi_auth_invalid"],
  [
    ["pi_config_shell_disabled", "pi_resources_disabled", "pi_cache_warming_disabled"],
    "pi_config_shell_disabled",
  ],
];
const messages = new Map(
  groups.flatMap(([codes, key]) => codes.map((code) => [code, key] as const)),
);
export function workbenchConfigMessage(locale: Locale, code: string): string | undefined {
  const key = messages.get(code);
  return key === undefined ? undefined : (locale === "en" ? en : zhCN)[key];
}
const locations = {
  board: "field.board",
  rules: "field.rules",
  mechanisms: "field.mechanisms",
  roles: "field.roles",
  players: "field.players",
  game: "field.game",
  backends: "field.backends",
  agents: "field.agents",
  items: "field.items",
  options: "field.options",
  config: "field.config",
  default: "field.default",
  agent: "field.agent",
  backend: "field.backend",
  name: "field.name",
  customInstructions: "field.customInstructions",
  text: "field.text",
  mode: "field.mode",
  maxDays: "field.maxDays",
  maxRuntimeMs: "field.maxRuntimeMs",
  llmTimeoutMs: "field.llmTimeoutMs",
  defaultProvider: "field.defaultProvider",
  defaultModel: "field.defaultModel",
  model: "field.model",
  defaultThinkingLevel: "field.defaultThinkingLevel",
} as const satisfies Record<string, MessageKey>;
/** 仅转换字段名；用户命名的 ID 原样显示，绝不把路径当作值或环境变量解析。 */
export function workbenchConfigLocation(locale: Locale, path: string): string {
  const dictionary = locale === "en" ? en : zhCN;
  return path
    .split(".")
    .map((part) =>
      Object.hasOwn(locations, part)
        ? dictionary[locations[part as keyof typeof locations]]
        : hasBoardLabel(part)
          ? boardLabel(locale, part)
          : part,
    )
    .join(" › ");
}
