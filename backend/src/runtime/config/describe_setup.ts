/**
 * 负责已解析 setup 的可公开配置摘要。输入为完整 setup 和显示语言，输出板子、玩家绑定、执行选项与有限 Agent 概要。
 * 仅取白名单字段，省略 provider 对象及其环境、命令参数、接入 URL 和提示原文；不重新读取文件或校验运行资格。
 */
import { text, type Locale } from "@ai-werewolf-arena/game-text";
import { ROLE_DEFINITIONS } from "@ai-werewolf-arena/game-catalog";
import type { ResolvedGameSetup } from "./resolve_game_setup";
import type { ResolvedAgentRuntimeProfile } from "./contracts";

function agentSummary(profile: ResolvedAgentRuntimeProfile) {
  return {
    name: profile.name,
    kind: profile.kind,
    providerName: profile.providerName,
    ...(profile.model ? { model: profile.model } : {}),
    customPrompt: Boolean(profile.personalityPrompt),
  };
}

/** prompt 只显示“设置／清空”状态；座位名和板子数据仍是配置内容，不将摘要当无用户文本的诊断。 */
export function describeResolvedSetup(
  setup: ResolvedGameSetup,
  displayLocale: Locale = setup.context.displayLocale,
) {
  return {
    board: setup.options.board,
    definitionVersion: setup.boardDefinition?.definition.version ?? null,
    ruleset: setup.boardDefinition?.definition.ruleset ?? null,
    rules: setup.boardDefinition?.definition.rules ?? null,
    roles: setup.boardConfig.roleSetups,
    parameters: setup.boardDefinition?.definition.roles ?? {},
    mechanisms: setup.boardDefinition?.definition.mechanisms ?? {},
    defaultAgent: agentSummary(setup.defaultProfile),
    playerAgents: Object.fromEntries(
      Object.entries(setup.playerProfiles).map(([seat, profile]) => [seat, agentSummary(profile)]),
    ),
    roleAgents: Object.fromEntries(
      Object.entries(setup.roleProfiles).map(([role, profile]) => [role, agentSummary(profile)]),
    ),
    players: Object.fromEntries(
      Object.entries(setup.players).map(([seat, entry]) => [
        seat,
        {
          ...(entry.name !== undefined ? { name: entry.name } : {}),
          ...(entry.profile ? { agent: agentSummary(entry.profile) } : {}),
          // undefined 沿用绑定策略，null 显式清空；状态位与最终 profile 的非空提示概览不同。
          customPrompt: entry.personalityPrompt !== undefined && entry.personalityPrompt !== null,
          clearedPrompt: entry.personalityPrompt === null,
        },
      ]),
    ),
    context: setup.context,
    executionSupport: { locales: ["zh-CN", "en"], reproducibleSeed: true, mixedTransports: true },
    warnings: setup.warnings,
    warningMessages: setup.warnings.map((warning) =>
      text(displayLocale, "config.warning.locale_prompt_fallback", {
        path: warning.path,
        requested: warning.requestedLocale,
        fallback: warning.fallbackLocale,
      }),
    ),
    audit: setup.audit
      ? {
          agent: agentSummary(setup.audit.profile),
          timeoutMs: setup.audit.timeoutMs,
          concurrency: setup.audit.concurrency,
        }
      : null,
    limits: {
      maxDays: setup.options.maxDays,
      maxRuntimeMs: setup.options.maxRuntimeMs,
      turnTimeoutMs: setup.options.llmTimeoutMs,
    },
    catalog: {
      total: ROLE_DEFINITIONS.length,
      planned: ROLE_DEFINITIONS.filter((item) => item.status === "planned").length,
    },
    sources: {
      board: setup.boardDefinition?.sourceFile ?? "internal_fixture",
      fields: setup.boardDefinition?.fieldSources ?? {},
    },
  };
}
