import { ROLE_DEFINITIONS } from "@ai-werewolf-arena/game-catalog";
import type { ResolvedGameSetup } from "./resolve_game_setup";
import type { ResolvedAgentRuntimeProfile } from "./contracts";

function agentSummary(profile: ResolvedAgentRuntimeProfile) {
  return { name: profile.name, kind: profile.kind, providerName: profile.providerName,
    ...(profile.model ? { model: profile.model } : {}),
    customPrompt: Boolean(profile.personalityPrompt),
  };
}

/** Whitelist only: no provider object, env, command arguments, URL or prompt text. */
export function describeResolvedSetup(setup: ResolvedGameSetup) {
  return {
    board: setup.options.board,
    definitionVersion: setup.boardDefinition?.definition.version ?? null,
    ruleset: setup.boardDefinition?.definition.ruleset ?? null,
    rules: setup.boardDefinition?.definition.rules ?? null,
    roles: setup.boardConfig.roleSetups,
    parameters: setup.boardDefinition?.definition.roles ?? {},
    mechanisms: setup.boardDefinition?.definition.mechanisms ?? {},
    defaultAgent: agentSummary(setup.defaultProfile),
    playerAgents: Object.fromEntries(Object.entries(setup.playerProfiles).map(([seat, profile]) => [seat, agentSummary(profile)])),
    roleAgents: Object.fromEntries(Object.entries(setup.roleProfiles).map(([role, profile]) => [role, agentSummary(profile)])),
    players: Object.fromEntries(Object.entries(setup.players).map(([seat, entry]) => [seat, {
      ...(entry.name !== undefined ? { name: entry.name } : {}),
      ...(entry.profile ? { agent: agentSummary(entry.profile) } : {}),
      customPrompt: entry.personalityPrompt !== undefined && entry.personalityPrompt !== null,
      clearedPrompt: entry.personalityPrompt === null,
    }])),
    context: setup.context,
    executionSupport: { locales: ["zh-CN"], reproducibleSeed: false, mixedTransports: false },
    warnings: setup.warnings,
    audit: setup.audit ? { agent: agentSummary(setup.audit.profile), timeoutMs: setup.audit.timeoutMs, concurrency: setup.audit.concurrency } : null,
    limits: { maxDays: setup.options.maxDays, maxRuntimeMs: setup.options.maxRuntimeMs, turnTimeoutMs: setup.options.llmTimeoutMs },
    catalog: { total: ROLE_DEFINITIONS.length, planned: ROLE_DEFINITIONS.filter(item => item.status === "planned").length },
    sources: { board: setup.boardDefinition?.sourceFile ?? "internal_fixture", fields: setup.boardDefinition?.fieldSources ?? {} },
  };
}
