/** Shared player identity, board and action prompt templates. */
import { Role } from "../../../core/domain";
import { text, type Locale } from "@ai-werewolf-arena/game-text";

export interface SystemPromptInput {
  locale?: Locale;
  actorId: number;
  role: string;
  maxPlayerId: number;
  teammateIds: number[];
  boardInfoPrompt?: string;
  configPrompt?: string;
  personalityPrompt?: string;
  playerName?: string;
  supportsDebugReporting?: boolean;
  includeToolUseInstructions?: boolean;
}

export interface UserPromptInput {
  locale?: Locale;
  actorId: number;
  phase: string;
  stage: string;
  isSpeechTurn: boolean;
  stageDirective: string;
  statusDirective?: string;
  requiresAction: boolean;
  turnConstraintHint?: string;
  allowedTools: string[];
  effectiveActionTools?: string[];
  toolArgHints: string;
  toolUsageHints?: string[];
  actionableIdsHint?: string;
  stageContextHint?: string;
  actionSubmissionHint?: string;
}

export interface BoardInfoPromptInput {
  locale?: Locale;
  totalPlayers: number;
  roleCounts: Map<Role, number>;
  roleLabel: (role: Role) => string;
  roleSkillBrief: (role: Role) => string;
}

export function buildSystemPrompt(input: SystemPromptInput): string {
  const locale = input.locale ?? "zh-CN";
  return [
    text(locale, "prompt.system.identity", { actor: input.actorId, role: input.role }),
    text(locale, "prompt.system.goal"),
    text(locale, "prompt.system.language"),
    ...(input.playerName ? [text(locale, "prompt.system.name", { name: input.playerName })] : []),
    text(locale, "prompt.system.teammates", { teammates: input.teammateIds.join(", ") || text(locale, "common.none") }),
    text(locale, "prompt.system.ids", { max: input.maxPlayerId }),
    text(locale, "prompt.system.boundaries"),
    ...(input.personalityPrompt?.trim() ? [text(locale, "prompt.system.personality", { personality: input.personalityPrompt.trim() })] : []),
    ...(input.boardInfoPrompt ? [input.boardInfoPrompt] : []),
    ...(input.configPrompt ? [input.configPrompt] : []),
    text(locale, "prompt.system.inspection"),
    text(locale, "prompt.system.events"),
    text(locale, "prompt.system.facts"),
    ...(input.includeToolUseInstructions !== false ? [text(locale, "prompt.system.tools")] : []),
    text(locale, "prompt.system.confidential"),
    ...(input.supportsDebugReporting && input.includeToolUseInstructions !== false ? [text(locale, "prompt.system.reports")] : []),
  ].join("\n");
}

export function buildUserPrompt(input: UserPromptInput): string {
  const locale = input.locale ?? "zh-CN";
  const none = text(locale, "common.none");
  return [
    text(locale, "prompt.user.turn", { actor: input.actorId, phase: input.phase, stage: input.stage,
      speech: text(locale, input.isSpeechTurn ? "prompt.user.speech" : "prompt.user.no_speech"), context: input.stageContextHint ? ` ${input.stageContextHint}` : "" }),
    text(locale, "prompt.user.rules", { rules: input.stageDirective, status: input.statusDirective ? ` ${input.statusDirective}` : "" }),
    text(locale, "prompt.user.actions", { constraint: input.turnConstraintHint || text(locale, input.requiresAction ? "prompt.user.required" : "prompt.user.optional"),
      tools: input.allowedTools.join(", ") || none, effective: input.effectiveActionTools?.join(", ") || none }),
    text(locale, "prompt.user.arguments", { hints: input.toolArgHints,
      targets: input.actionableIdsHint ? `; ${input.actionableIdsHint}` : "",
      usage: input.toolUsageHints?.length ? ` ${input.toolUsageHints.join(" ")}` : "",
      submission: input.actionSubmissionHint || text(locale, "prompt.user.submit") }),
  ].join("\n");
}

export function buildBoardInfoPrompt(input: BoardInfoPromptInput): string {
  const locale = input.locale ?? "zh-CN";
  const roles = Object.values(Role).filter(role => (input.roleCounts.get(role) ?? 0) > 0);
  return [text(locale, "prompt.board.title"), text(locale, "prompt.board.size", { count: input.totalPlayers }),
    text(locale, "prompt.board.lineup", { lineup: roles.map(role => `${input.roleLabel(role)}x${input.roleCounts.get(role)}`).join(", ") || "unknown" }),
    text(locale, "prompt.board.skills", { skills: roles.map(role => `${input.roleLabel(role)}: ${input.roleSkillBrief(role)}`).join("; ") || "unknown" }),
  ].join("\n");
}

export function buildConstraintRetryPrompt(attempt: number, maxRetries: number, locale: Locale = "zh-CN"): string {
  return text(locale, attempt === 1 ? "prompt.retry.first" : attempt === 2 ? "prompt.retry.second" : "prompt.retry.last", { attempt, max: maxRetries });
}
