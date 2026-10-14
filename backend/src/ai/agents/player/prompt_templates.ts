/**
 * 负责 SDK／ACP 共用的身份、板子、行动与约束重试文本模板。输入为调用方类型化的身份、
 * 工具提示、配比 Map 和角色回调，输出按原语言／排列拼接的提示字符串。
 * locale 缺省仍为 zh-CN；原对象、数组和 Map 在原表达式位置读取，不克隆、冻结或重新统计。
 * getter、数组方法或角色回调失败保持原抛出；模板文本不授资源、当前角色或行动许可。
 * 本模块不提交行动、计算期限或实施重试次数，产品文案和消息 key 仍由原文本 owner 持有。
 */
import { Role } from "../../../core/domain";
import { text, type Locale } from "@ai-werewolf-arena/game-text";

/** 调用方提供的身份与人设文本；role 是原显示字符串，不在这里据其重新判断阵营。 */
export interface SystemPromptInput {
  locale?: Locale;
  actorId: number;
  role: string;
  maxPlayerId: number;
  /** 按原数组 join 呈现调用方队友知识，不复验其当前生命、身份或狼队行动权限。 */
  teammateIds: number[];
  boardInfoPrompt?: string;
  configPrompt?: string;
  /** 保留可选原人设；非空判断与正文插入各按原位置读取／trim，不预处理或改变产品文本。 */
  personalityPrompt?: string;
  playerName?: string;
  supportsDebugReporting?: boolean;
  includeToolUseInstructions?: boolean;
}

/** 回合展示输入，不是原 ActionRequest 或租约；阶段、目标和工具内容仍由外层策略准备。 */
export interface UserPromptInput {
  locale?: Locale;
  actorId: number;
  phase: string;
  stage: string;
  isSpeechTurn: boolean;
  stageDirective: string;
  statusDirective?: string;
  /** 仅在没有有效 turnConstraintHint 时选择原必需／可选文案，不在这里强制提交或付款。 */
  requiresAction: boolean;
  turnConstraintHint?: string;
  /** 原可写提示集合；和 effectiveActionTools 的展示不等于网关或回合当前性验证。 */
  allowedTools: string[];
  effectiveActionTools?: string[];
  toolArgHints: string;
  toolUsageHints?: string[];
  actionableIdsHint?: string;
  stageContextHint?: string;
  actionSubmissionHint?: string;
}

/** 配比数据及角色显示回调由调用方持有；模板只使用原 Map，不据 World 再发牌／统计。 */
export interface BoardInfoPromptInput {
  locale?: Locale;
  totalPlayers: number;
  roleCounts: Map<Role, number>;
  roleLabel: (role: Role) => string;
  roleSkillBrief: (role: Role) => string;
}

/** 身份、名字、队友和人设仍依原顺序拼接；工具说明与报告说明保原开关短路。 */
export function buildSystemPrompt(input: SystemPromptInput): string {
  const locale = input.locale ?? "zh-CN";
  return [
    text(locale, "prompt.system.identity", { actor: input.actorId, role: input.role }),
    text(locale, "prompt.system.goal"),
    text(locale, "prompt.system.language"),
    ...(input.playerName ? [text(locale, "prompt.system.name", { name: input.playerName })] : []),
    text(locale, "prompt.system.teammates", {
      teammates: input.teammateIds.join(", ") || text(locale, "common.none"),
    }),
    text(locale, "prompt.system.ids", { max: input.maxPlayerId }),
    text(locale, "prompt.system.boundaries"),
    ...(input.personalityPrompt?.trim()
      ? [text(locale, "prompt.system.personality", { personality: input.personalityPrompt.trim() })]
      : []),
    ...(input.boardInfoPrompt ? [input.boardInfoPrompt] : []),
    ...(input.configPrompt ? [input.configPrompt] : []),
    text(locale, "prompt.system.inspection"),
    text(locale, "prompt.system.events"),
    text(locale, "prompt.system.facts"),
    // 仅显式 false 关闭工具说明；报告还要求原 supportsDebugReporting，开关不注册真实工具。
    ...(input.includeToolUseInstructions !== false ? [text(locale, "prompt.system.tools")] : []),
    text(locale, "prompt.system.confidential"),
    ...(input.supportsDebugReporting && input.includeToolUseInstructions !== false
      ? [text(locale, "prompt.system.reports")]
      : []),
  ].join("\n");
}

/** 原阶段／行动／参数提示逐段读取；现有约束和提交提示优先，空值仍用原缺省文案。 */
export function buildUserPrompt(input: UserPromptInput): string {
  const locale = input.locale ?? "zh-CN";
  const none = text(locale, "common.none");
  return [
    text(locale, "prompt.user.turn", {
      actor: input.actorId,
      phase: input.phase,
      stage: input.stage,
      speech: text(locale, input.isSpeechTurn ? "prompt.user.speech" : "prompt.user.no_speech"),
      context: input.stageContextHint ? ` ${input.stageContextHint}` : "",
    }),
    text(locale, "prompt.user.rules", {
      rules: input.stageDirective,
      status: input.statusDirective ? ` ${input.statusDirective}` : "",
    }),
    text(locale, "prompt.user.actions", {
      constraint:
        input.turnConstraintHint ||
        text(locale, input.requiresAction ? "prompt.user.required" : "prompt.user.optional"),
      tools: input.allowedTools.join(", ") || none,
      effective: input.effectiveActionTools?.join(", ") || none,
    }),
    text(locale, "prompt.user.arguments", {
      hints: input.toolArgHints,
      targets: input.actionableIdsHint ? `; ${input.actionableIdsHint}` : "",
      usage: input.toolUsageHints?.length ? ` ${input.toolUsageHints.join(" ")}` : "",
      submission: input.actionSubmissionHint || text(locale, "prompt.user.submit"),
    }),
  ].join("\n");
}

/** 按原 Role 枚举值顺序筛正配比，两个 map 各在原位置读取 Map 与 callback，不缓存结果或吞错。 */
export function buildBoardInfoPrompt(input: BoardInfoPromptInput): string {
  const locale = input.locale ?? "zh-CN";
  const roles = Object.values(Role).filter((role) => (input.roleCounts.get(role) ?? 0) > 0);
  return [
    text(locale, "prompt.board.title"),
    text(locale, "prompt.board.size", { count: input.totalPlayers }),
    text(locale, "prompt.board.lineup", {
      lineup:
        roles.map((role) => `${input.roleLabel(role)}x${input.roleCounts.get(role)}`).join(", ") ||
        "unknown",
    }),
    text(locale, "prompt.board.skills", {
      skills:
        roles.map((role) => `${input.roleLabel(role)}: ${input.roleSkillBrief(role)}`).join("; ") ||
        "unknown",
    }),
  ].join("\n");
}

/** attempt=1／2／其余分别选原三种文案；maxRetries 只插入文本，循环预算由真实编排者执行。 */
export function buildConstraintRetryPrompt(
  attempt: number,
  maxRetries: number,
  locale: Locale = "zh-CN",
): string {
  return text(
    locale,
    attempt === 1
      ? "prompt.retry.first"
      : attempt === 2
        ? "prompt.retry.second"
        : "prompt.retry.last",
    { attempt, max: maxRetries },
  );
}
