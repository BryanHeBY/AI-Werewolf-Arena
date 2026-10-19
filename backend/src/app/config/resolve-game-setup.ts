/**
 * 负责合并已解析配置、运行参数和座位／角色 Agent 选择。输入为公开配置与 CLI 覆盖；
 * 输出为完整对局设置、逐玩家配置和语言回退诊断。仅选择已登记角色，不创建对局、
 * 读取认证或授予行动权限；名字和自定义指令保留原文，不参与模型选择。
 */
import type { BoardConfig } from "../../domain";
import type {
  GameConfig,
  AgentBindingConfig,
  GameSetupWarning,
  ResolvedAgentRuntimeProfile,
  ResolvedAuditConfig,
  RuntimeConfig,
} from "./contracts";
import {
  combineCustomInstructions,
  resolveCustomInstructions,
  type ResolvedCustomInstructions,
} from "./custom-instructions";
export type { GameSetupWarning } from "./contracts";
import type { Locale } from "@ai-werewolf-arena/game-contract";
import {
  resolveBoardConfig,
  type BoardName,
  type BoardOverride,
} from "../../rulesets/presets/board-config-resolver";
import { type ResolvedBoardDefinition } from "./board-definition";
import { getDefaultRoleCatalog } from "../../rulesets/roles/role-catalog-assembly";
import { Role } from "../../domain/identity";

export interface RunGameOptions {
  board: string;
  maxDays: number;
  maxRuntimeMs: number;
  llmTimeoutMs: number;
  trace: boolean;
  printAllEvents: boolean;
  printChat: boolean;
  streamEvents: boolean;
  color: boolean;
  printLlmIo: boolean;
  printThinking: boolean;
  printPrivateEvents: boolean;
  recordRootDir?: string;
}

/** 角色／席位绑定只携带自己的指令操作；最终组合在身份分配后执行。 */
export interface ResolvedAgentBinding {
  profile?: ResolvedAgentRuntimeProfile;
  customInstructions?: ResolvedCustomInstructions;
}
export interface ResolvedPlayerConfig extends ResolvedAgentBinding {
  name?: string;
}

/** runner 的完整输入：已解析板子、逐玩家／角色 profile 与可选审计；不携带运行句柄或已分配身份。 */
export interface ResolvedGameSetup {
  options: RunGameOptions;
  boardConfig: BoardConfig;
  defaultProfile: ResolvedAgentRuntimeProfile;
  roles: Readonly<Record<string, ResolvedAgentBinding>>;
  customInstructions?: ResolvedCustomInstructions;
  audit: ResolvedAuditConfig | null;
  boardDefinition?: ResolvedBoardDefinition;
  context: { locale: Locale; displayLocale: Locale; seed?: string };
  players: Readonly<Record<string, ResolvedPlayerConfig>>;
  warnings: readonly GameSetupWarning[];
}

/** 身份分配后独立选择 Agent，再按 Agent→全局→角色→席位顺序组合指令。 */
export function resolvePlayerProfile(
  setup: ResolvedGameSetup,
  actorId: number,
  role?: Role,
): ResolvedAgentRuntimeProfile {
  const player = setup.players[String(actorId)];
  const roleBinding = role ? setup.roles[role] : undefined;
  const selected = player?.profile ?? roleBinding?.profile ?? setup.defaultProfile;
  return {
    ...selected,
    customInstructions: combineCustomInstructions(
      selected.customInstructions,
      setup.customInstructions,
      roleBinding?.customInstructions,
      player?.customInstructions,
    ),
  };
}

export function resolveGameBoard(
  runtime: RuntimeConfig,
  overrides: Partial<RunGameOptions> = {},
): string {
  const board = overrides.board ?? runtime.game.board ?? "six_player_mvp";
  if (!/^[a-z][a-z0-9_-]*$/.test(board)) {
    throw new Error(`runtime_config_board_invalid: ${board}`);
  }
  return board;
}

export function resolveAgentProfileByName(
  runtime: RuntimeConfig,
  agentName?: string,
  warnings: GameSetupWarning[] = [],
): ResolvedAgentRuntimeProfile {
  const selected = agentName ?? runtime.agents.default;
  const entry = Object.hasOwn(runtime.agents.items, selected)
    ? runtime.agents.items[selected]
    : undefined;
  if (!entry) throw new Error(`runtime_config_agent_not_found: ${selected}`);
  const provider = Object.hasOwn(runtime.providers.items, entry.provider)
    ? runtime.providers.items[entry.provider]
    : undefined;
  if (!provider)
    throw new Error(
      `runtime_config_agent_provider_not_found: agent=${selected} provider=${entry.provider}`,
    );
  const customInstructions = combineCustomInstructions(
    undefined,
    resolveCustomInstructions(
      entry.customInstructions,
      runtime.game.locale ?? "zh-CN",
      `agents.items.${selected}.customInstructions`,
      warnings,
    ),
  );
  if (entry.kind === "acp") {
    return {
      name: selected,
      providerName: entry.provider,
      provider:
        provider.type === "acp"
          ? {
              ...provider,
              sessionConfigOptions: {
                ...provider.sessionConfigOptions,
                ...entry.sessionConfigOptions,
              },
            }
          : provider,
      kind: "acp",
      spawnArgs: entry.spawnArgs,
      sessionReuse: entry.sessionReuse,
      actionTransport: entry.actionTransport ?? "mcp",
      customInstructions,
    };
  }
  if (entry.kind === "pi")
    return {
      name: selected,
      providerName: entry.provider,
      provider,
      kind: "pi",
      piSettings: entry.piSettings,
      customInstructions,
    };
  return {
    name: selected,
    providerName: entry.provider,
    provider,
    kind: "llm",
    model: entry.model,
    temperature: entry.temperature,
    maxTokens: entry.maxTokens,
    reasoningEffort: entry.reasoningEffort,
    thinkingEnabled: entry.thinkingEnabled,
    customInstructions,
  };
}

export function resolveGameSetup(
  runtime: RuntimeConfig,
  overrides: Partial<RunGameOptions> = {},
  boardOverride: BoardOverride | ResolvedBoardDefinition | null = null,
): ResolvedGameSetup {
  if (
    !Object.hasOwn(runtime.providers.items, runtime.providers.default) ||
    !Object.hasOwn(runtime.agents.items, runtime.agents.default)
  ) {
    throw new Error("runtime_config_missing_provider_or_agent_defaults");
  }
  const game = runtime.game;
  // 空值合并让显式 false 保持有效；CLI 覆盖只作用于这里声明的运行选项，语言和 seed 仍由 game 提供。
  const options: RunGameOptions = {
    board: resolveGameBoard(runtime, overrides),
    maxDays: overrides.maxDays ?? game.maxDays ?? 10,
    maxRuntimeMs: overrides.maxRuntimeMs ?? game.maxRuntimeMs ?? 30000,
    llmTimeoutMs: overrides.llmTimeoutMs ?? game.llmTimeoutMs ?? 30000,
    trace: overrides.trace ?? game.trace ?? false,
    printAllEvents: overrides.printAllEvents ?? game.printAllEvents ?? false,
    printChat: overrides.printChat ?? game.printChat ?? false,
    streamEvents: overrides.streamEvents ?? game.streamEvents ?? true,
    color: overrides.color ?? game.color ?? true,
    printLlmIo: overrides.printLlmIo ?? game.printLlmIo ?? false,
    printThinking: overrides.printThinking ?? game.printThinking ?? false,
    printPrivateEvents: overrides.printPrivateEvents ?? game.printPrivateEvents ?? true,
    recordRootDir: overrides.recordRootDir ?? game.recordRootDir,
  };
  const auditConfig = runtime.debugSummary?.agent;
  for (const key of ["maxDays", "maxRuntimeMs", "llmTimeoutMs"] as const) {
    if (!Number.isSafeInteger(options[key]) || options[key] <= 0)
      throw new Error(`runtime_config_positive_integer_invalid: game.${key}`);
  }
  // 具名定义必须与选定板子一致；没有定义时只接受原两项内置板子，不由 runner 猜测支持组合。
  const boardDefinition =
    boardOverride && "definition" in boardOverride ? boardOverride : undefined;
  if (boardDefinition && boardDefinition.definition.id !== options.board)
    throw new Error("runtime_config_board_definition_mismatch");
  if (
    !boardDefinition &&
    options.board !== "six_player_mvp" &&
    options.board !== "twelve_player_standard"
  ) {
    throw new Error(`runtime_config_board_definition_required: ${options.board}`);
  }
  const boardConfig =
    boardDefinition?.config ??
    resolveBoardConfig(options.board as BoardName, boardOverride as BoardOverride | null);
  validateGameBindings(game, boardConfig);
  const locale = game.locale ?? "zh-CN";
  const warnings: GameSetupWarning[] = [];
  const players = resolveBindings(runtime, game.players, "players", locale, warnings);
  const roles = resolveBindings(runtime, game.roles, "roles", locale, warnings);
  const customInstructions = resolveCustomInstructions(
    game.customInstructions,
    locale,
    "game.customInstructions",
    warnings,
  );
  return {
    options,
    boardConfig,
    ...(boardDefinition ? { boardDefinition } : {}),
    context: {
      locale,
      displayLocale: game.displayLocale ?? locale,
      ...(game.seed ? { seed: game.seed } : {}),
    },
    players,
    warnings,
    defaultProfile: resolveAgentProfileByName(runtime, game.agent, warnings),
    roles,
    customInstructions,
    // 只有显式 enabled:false 才关闭审计；省略配置保原默认值，创建与失败处理留给运行／审计 owner。
    audit:
      auditConfig?.enabled === false
        ? null
        : {
            profile: resolveAgentProfileByName(
              runtime,
              auditConfig?.agentName ?? game.agent,
              warnings,
            ),
            timeoutMs: auditConfig?.timeoutMs ?? 15000,
            maxAttempts: Math.max(1, auditConfig?.maxAttempts ?? 2),
            concurrency: Math.max(1, auditConfig?.concurrency ?? 4),
            publicMaxItems: Math.max(60, auditConfig?.publicMaxItems ?? 200),
            maxItems: Math.max(50, auditConfig?.maxItems ?? 200),
            playerMaxItems: Math.max(60, auditConfig?.playerMaxItems ?? 120),
          },
  };
}

export function validateGameBindings(game: GameConfig, board: BoardConfig): void {
  const catalog = getDefaultRoleCatalog();
  for (const entry of board.roleSetups) catalog.requireMetadata(entry.role);
  const present = new Set(
    board.roleSetups.filter((entry) => entry.count > 0).map((entry) => entry.role),
  );
  for (const key of Object.keys(game.roles ?? {})) {
    if (!catalog.metadata(key as Role) || !present.has(key as Role))
      throw new Error(`runtime_config_role_binding_invalid: ${key}`);
  }
  for (const key of Object.keys(game.players ?? {})) {
    if (
      !/^[1-9]\d*$/.test(key) ||
      Number(key) > board.boardSize ||
      !Number.isSafeInteger(Number(key))
    )
      throw new Error(`runtime_config_player_binding_invalid: ${key}`);
  }
}

/** 指令按层保留 replace／clear，不能在选择模型时提前覆盖角色或全局文本。 */
function resolveBindings(
  runtime: RuntimeConfig,
  entries: Record<string, AgentBindingConfig & { name?: string }> | undefined,
  scope: "players" | "roles",
  locale: Locale,
  warnings: GameSetupWarning[],
): Record<string, ResolvedPlayerConfig> {
  return Object.fromEntries(
    Object.entries(entries ?? {}).map(([key, entry]) => {
      let profile = entry.agent
        ? resolveAgentProfileByName(runtime, entry.agent, warnings)
        : undefined;
      if (profile?.kind === "acp" && entry.spawnArgs?.length)
        profile = { ...profile, spawnArgs: [...(profile.spawnArgs ?? []), ...entry.spawnArgs] };
      const customInstructions = resolveCustomInstructions(
        entry.customInstructions,
        locale,
        `${scope}.${key}.customInstructions`,
        warnings,
      );
      return [
        key,
        {
          ...(entry.name !== undefined ? { name: entry.name } : {}),
          ...(profile ? { profile } : {}),
          ...(customInstructions !== undefined ? { customInstructions } : {}),
        },
      ];
    }),
  );
}
