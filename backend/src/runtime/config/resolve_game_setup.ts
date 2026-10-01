import type { BoardConfig } from "../../core";
import type { GameConfig, GameAgentSelection, ResolvedAgentRuntimeProfile, ResolvedAuditConfig, RuntimeConfig } from "./contracts";
import { resolveBoardConfig, type BoardName, type BoardOverride } from "../scenarios/board_config_resolver";

export type RunGameOptions = Required<Omit<GameConfig, "agent" | "roleAgents" | "playerAgents" | "recordRootDir">> & {
  recordRootDir?: string;
};

export interface ResolvedGameSetup {
  options: RunGameOptions;
  boardConfig: BoardConfig;
  defaultProfile: ResolvedAgentRuntimeProfile;
  playerProfiles: Readonly<Record<string, ResolvedAgentRuntimeProfile>>;
  roleProfiles: Readonly<Record<string, ResolvedAgentRuntimeProfile>>;
  audit: ResolvedAuditConfig | null;
}

export function resolveGameBoard(runtime: RuntimeConfig, overrides: Partial<RunGameOptions> = {}): BoardName {
  const board = overrides.board ?? runtime.game.board ?? "six_player_mvp";
  if (board !== "six_player_mvp" && board !== "twelve_player_standard") {
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
  boardOverride: BoardOverride | null = null,
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
  return {
    options,
    boardConfig: resolveBoardConfig(options.board, boardOverride),
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
