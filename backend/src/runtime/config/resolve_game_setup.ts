import type { BoardConfig } from "../../core";
import type { GameConfig, GameAgentSelection, ResolvedAgentRuntimeProfile, ResolvedAuditConfig, RuntimeConfig, PlayerConfig } from "./contracts";
import type { Locale } from "@ai-werewolf-arena/game-catalog";
import { resolveBoardConfig, type BoardName, type BoardOverride } from "../scenarios/board_config_resolver";
import { type ResolvedBoardDefinition } from "./board_definition";
import { getDefaultRoleCatalog } from "../../game/mechanisms/roles/catalog";
import { Role } from "../../core/domain/identity";

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

export interface ResolvedPlayerConfig { name?: string; profile?: ResolvedAgentRuntimeProfile; personalityPrompt?: string | null }

export interface ResolvedGameSetup {
  options: RunGameOptions;
  boardConfig: BoardConfig;
  defaultProfile: ResolvedAgentRuntimeProfile;
  playerProfiles: Readonly<Record<string, ResolvedAgentRuntimeProfile>>;
  roleProfiles: Readonly<Record<string, ResolvedAgentRuntimeProfile>>;
  audit: ResolvedAuditConfig | null;
  boardDefinition?: ResolvedBoardDefinition;
  context: { locale: Locale; displayLocale: Locale; seed?: string };
  players: Readonly<Record<string, ResolvedPlayerConfig>>;
  warnings: readonly string[];
}

/** Select after seats/roles are assigned; names never influence model selection. */
export function resolvePlayerProfile(setup: ResolvedGameSetup, actorId: number, role?: Role): ResolvedAgentRuntimeProfile {
  const player = setup.players[String(actorId)];
  const selected = player?.profile ?? setup.playerProfiles[String(actorId)]
    ?? (role ? setup.roleProfiles[role] : undefined) ?? setup.defaultProfile;
  return player?.personalityPrompt !== undefined
    ? { ...selected, personalityPrompt: player.personalityPrompt ?? undefined } : selected;
}

export function resolveGameBoard(runtime: RuntimeConfig, overrides: Partial<RunGameOptions> = {}): string {
  const board = overrides.board ?? runtime.game.board ?? "six_player_mvp";
  if (!/^[a-z][a-z0-9_-]*$/.test(board)) {
    throw new Error(`runtime_config_board_invalid: ${board}`);
  }
  return board;
}

export function resolveAgentProfileByName(runtime: RuntimeConfig, agentName?: string): ResolvedAgentRuntimeProfile {
  const selected = agentName ?? runtime.agents.default;
  const entry = runtime.agents.items[selected];
  if (!entry) throw new Error(`runtime_config_agent_not_found: ${selected}`);
  const provider = runtime.providers.items[entry.provider];
  if (!provider) throw new Error(`runtime_config_agent_provider_not_found: agent=${selected} provider=${entry.provider}`);
  if (entry.kind === "acp") {
    return {
      name: selected,
      providerName: entry.provider,
      provider,
      kind: "acp",
      spawnArgs: entry.spawnArgs,
      sessionReuse: entry.sessionReuse,
      actionTransport: entry.actionTransport ?? "mcp",
      personalityPrompt: entry.personalityPrompt,
    };
  }
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
    personalityPrompt: entry.personalityPrompt,
  };
}

function resolveSelections(
  runtime: RuntimeConfig,
  selections: Record<string, GameAgentSelection> | undefined,
): Record<string, ResolvedAgentRuntimeProfile> {
  return Object.fromEntries(Object.entries(selections ?? {}).map(([key, selection]) => {
    const name = typeof selection === "string" ? selection : selection.agent;
    const profile = resolveAgentProfileByName(runtime, name);
    const spawnArgs = typeof selection === "object" ? selection.spawnArgs : undefined;
    const personalityPrompt = typeof selection === "object" ? selection.personalityPrompt : undefined;
    return [key, {
      ...profile,
      ...(profile.kind === "acp" && spawnArgs?.length
        ? { spawnArgs: [...(profile.spawnArgs ?? []), ...spawnArgs] }
        : {}),
      ...(personalityPrompt !== undefined ? { personalityPrompt } : {}),
    }];
  }));
}

export function resolveGameSetup(
  runtime: RuntimeConfig,
  overrides: Partial<RunGameOptions> = {},
  boardOverride: BoardOverride | ResolvedBoardDefinition | null = null,
): ResolvedGameSetup {
  if (!runtime.providers.items[runtime.providers.default] || !runtime.agents.items[runtime.agents.default]) {
    throw new Error("runtime_config_missing_provider_or_agent_defaults");
  }
  const game = runtime.game;
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
    if (!Number.isSafeInteger(options[key]) || options[key] <= 0) throw new Error(`runtime_config_positive_integer_invalid: game.${key}`);
  }
  const boardDefinition = boardOverride && "definition" in boardOverride ? boardOverride : undefined;
  if (boardDefinition && boardDefinition.definition.id !== options.board) throw new Error("runtime_config_board_definition_mismatch");
  if (!boardDefinition && options.board !== "six_player_mvp" && options.board !== "twelve_player_standard") {
    throw new Error(`runtime_config_board_definition_required: ${options.board}`);
  }
  const boardConfig = boardDefinition?.config ?? resolveBoardConfig(options.board as BoardName, boardOverride as BoardOverride | null);
  validateGameBindings(game, boardConfig);
  const locale = game.locale ?? "zh-CN";
  const warnings: string[] = [];
  const players = resolvePlayers(runtime, game.players, locale, warnings);
  return {
    options,
    boardConfig,
    ...(boardDefinition ? { boardDefinition } : {}),
    context: { locale, displayLocale: game.displayLocale ?? locale, ...(game.seed ? { seed: game.seed } : {}) },
    players, warnings,
    defaultProfile: resolveAgentProfileByName(runtime, game.agent),
    playerProfiles: resolveSelections(runtime, game.playerAgents),
    roleProfiles: resolveSelections(runtime, game.roleAgents),
    audit: auditConfig?.enabled === false ? null : {
      profile: resolveAgentProfileByName(runtime, auditConfig?.agentName ?? game.agent),
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
  for (const entry of board.roleSetups) catalog.require(entry.role);
  const present = new Set(board.roleSetups.filter(entry => entry.count > 0).map(entry => entry.role));
  for (const key of Object.keys(game.roleAgents ?? {})) {
    if (!catalog.get(key as Role) || !present.has(key as Role)) throw new Error(`runtime_config_role_binding_invalid: ${key}`);
  }
  for (const key of Object.keys(game.playerAgents ?? {})) {
    if (!/^[1-9]\d*$/.test(key) || Number(key) > board.boardSize || !Number.isSafeInteger(Number(key))) {
      throw new Error(`runtime_config_player_binding_invalid: ${key}`);
    }
  }
  for (const key of Object.keys(game.players ?? {})) {
    if (!/^[1-9]\d*$/.test(key) || Number(key) > board.boardSize || !Number.isSafeInteger(Number(key))) throw new Error(`runtime_config_player_binding_invalid: ${key}`);
    if (game.playerAgents && key in game.playerAgents) throw new Error(`runtime_config_player_binding_conflict: ${key}`);
  }
}

function resolvePlayers(runtime: RuntimeConfig, entries: Record<string, PlayerConfig> | undefined, locale: Locale, warnings: string[]): Record<string, ResolvedPlayerConfig> {
  return Object.fromEntries(Object.entries(entries ?? {}).map(([seat, entry]) => {
    let profile = entry.agent ? resolveAgentProfileByName(runtime, entry.agent) : undefined;
    if (profile?.kind === "acp" && entry.spawnArgs?.length) profile = { ...profile, spawnArgs: [...(profile.spawnArgs ?? []), ...entry.spawnArgs] };
    let personalityPrompt: string | null | undefined = entry.personalityPrompt === null ? null : undefined;
    if (typeof entry.personalityPrompt === "string") personalityPrompt = entry.personalityPrompt;
    else if (entry.personalityPrompt) {
      if (entry.personalityPrompt[locale]) personalityPrompt = entry.personalityPrompt[locale];
      else {
        const fallback = entry.personalityPrompt["zh-CN"] ? "zh-CN" : "en";
        personalityPrompt = entry.personalityPrompt[fallback];
        warnings.push(`locale_prompt_fallback: players.${seat}.personalityPrompt -> ${fallback}`);
      }
    }
    return [seat, { ...(entry.name !== undefined ? { name: entry.name } : {}), ...(profile ? { profile } : {}),
      ...(personalityPrompt !== undefined ? { personalityPrompt } : {}) }];
  }));
}
