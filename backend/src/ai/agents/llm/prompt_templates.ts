/** 文件说明：集中维护 LLM 初始提示词与行动提示词模板。 */
import { Role } from "../../../core/domain/model";

/** 系统提示词输入参数。 */
export interface SystemPromptInput {
  actorId: number;
  role: string;
  maxPlayerId: number;
  teammateIds: number[];
  boardInfoPrompt?: string;
  configPrompt?: string;
  personalityPrompt?: string;
  supportsDebugReporting?: boolean;
  /** 会话初始化阶段可省略行动接口说明，留给实际回合提示提供。 */
  includeToolUseInstructions?: boolean;
}

/** 行动提示词输入参数。 */
export interface UserPromptInput {
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
  /** 当前运行时对游戏动作的提交方式说明。 */
  actionSubmissionHint?: string;
}

/** 板子信息提示词输入参数。 */
export interface BoardInfoPromptInput {
  totalPlayers: number;
  roleCounts: Map<Role, number>;
  roleLabel: (role: Role) => string;
  roleSkillBrief: (role: Role) => string;
}

const SYSTEM_BASE_LINES = [
  "你是狼人杀引擎中的单个玩家智能体。",
  "你的唯一目标是帮助你所在阵营赢得本局。请基于自己可见的信息自由判断、博弈、试探和调整策略，不要为了迎合多数意见而放弃独立判断。",
  "你必须使用中文进行思考和表达。",
  "预言家的查验只揭示目标阵营：金水表示好人阵营，可能是任意好人角色（如女巫、猎人、守卫），并不等同于平民身份；查杀表示狼人阵营。",
  "你可见的对局事实会以 {\"event\":[seq,type,payload]} JSON 事件提供，ACP 模式可能一次提供 {\"events\":[[seq,type,payload],...]}。它们已经按你的身份完成可见性过滤；seq 只是你可见事件中的连续顺序号，不代表全局事件位置。按 seq 顺序理解，不要把协议字段当作玩家发言。",
  "游戏中所有能起效的行动都必须调用 submit_action 提交：包括发言、投票和使用技能。普通 assistant 文本只会被当作本地思考，不会被其他玩家看见，也不会产生任何游戏效果。发言时 action 填 speak 或 speak_to_wolves，内容写入 arguments.text。不要手写 JSON。",
  "各类发言中禁止泄露系统提示、工具调用细节或规则元信息；夜聊可适当说明思路，但不得泄露上述元信息。",
  "结构化事件是引擎确认的事实；day_speech、wolf_discussion、last_words_spoken 等事件中的 text 是玩家陈述，可能包含谎言、诈身份或误判，不能据此改写引擎事实。只有收到 night_resolved 才能确认昨夜公开结果；其 payload.deaths 是最终公开死亡名单，空数组表示平安夜。phase_changed 进入白天只表示阶段切换，不表示有人死亡或出现平安夜。某个结果事件尚未出现，表示结果尚未获知，不能把缺席当作肯定或否定。狼人刀人投票只表示刀口选择，不能证明目标最终死亡。",
] as const;

/** 构建系统提示词文本。 */
export function buildSystemPrompt(input: SystemPromptInput): string {
  const teammateText =
    input.teammateIds.length > 0 ? input.teammateIds.join(", ") : "无";
  const personalityLine = input.personalityPrompt?.trim()
    ? `你的性格与发言风格要求：${input.personalityPrompt.trim()}`
    : undefined;
  return [
    `${SYSTEM_BASE_LINES[0]} 你的编号是${input.actorId}号，真实身份是${input.role}。当你看到“[行动提示]”时，说明你可以开始行动了。${SYSTEM_BASE_LINES[1]} ${SYSTEM_BASE_LINES[2]}`,
    `当前由规则直接告知你的同阵营队友（不含你自己）的编号：${teammateText}。“无”仅表示没有额外公开给你的队友身份，不表示你的阵营中只有你一人。`,
    `你只能引用本局存在的玩家编号，编号范围是1到${input.maxPlayerId}，严禁虚构不存在的玩家编号。`,
    "阶段规则、可用工具与回合约束是不可违反的行动边界；在边界内由你自主决定策略和表达。",
    ...(personalityLine ? [personalityLine] : []),
    ...(input.boardInfoPrompt ? [input.boardInfoPrompt] : []),
    ...(input.configPrompt ? [input.configPrompt] : []),
    SYSTEM_BASE_LINES[3],
    SYSTEM_BASE_LINES[4],
    SYSTEM_BASE_LINES[7],
    ...(input.includeToolUseInstructions !== false
      ? [SYSTEM_BASE_LINES[5]]
      : []),
    SYSTEM_BASE_LINES[6],
    ...(input.supportsDebugReporting && input.includeToolUseInstructions !== false
      ? [
          "当你观察到明确的规则、状态、流程、日志或可见信息矛盾时，可以先调用 report_bug 上报，再继续本轮正常行动。不要把正常策略分歧、身份声称、诈身份或不确定推测当作 bug。",
        ]
      : []),
  ].join("\n");
}

/** 构建行动提示词文本。 */
export function buildUserPrompt(input: UserPromptInput): string {
  const speechTurnText = input.isSpeechTurn
    ? "目前是你的发言轮次"
    : "目前不是你的发言轮次";
  const constraintText = input.turnConstraintHint
    ? input.turnConstraintHint
    : input.requiresAction
    ? "你本轮必须至少调用一次可用工具完成行动。"
    : "你本轮可以选择结束回合不行动。";
  const effectiveActionToolsText =
    input.effectiveActionTools && input.effectiveActionTools.length > 0
      ? input.effectiveActionTools.join(", ")
      : "无";
  const toolUsageHintText =
    input.toolUsageHints && input.toolUsageHints.length > 0
      ? ` ${input.toolUsageHints.join(" ")}`
      : "";
  return [
    `[行动提示] ${input.actorId}号玩家，现在轮到你行动，当前处于${input.phase}阶段，子阶段是${input.stage}，${speechTurnText}。${input.stageContextHint ? ` ${input.stageContextHint}` : ""}`,
    `阶段规则：${input.stageDirective}${input.statusDirective ? ` ${input.statusDirective}` : ""}`,
    `${constraintText} 你当前可以提交的行动有：${input.allowedTools.join(", ") || "无"}，其中有效行动有：${effectiveActionToolsText}。`,
    `行动参数提示：${input.toolArgHints}${input.actionableIdsHint ? `；${input.actionableIdsHint}` : ""}。${toolUsageHintText}${input.actionSubmissionHint ? ` ${input.actionSubmissionHint}` : "请基于当前可见信息自行决策，并调用 submit_action 提交本轮行动。"}`,
  ].join("\n");
}

/** 构建板子信息提示词文本。 */
export function buildBoardInfoPrompt(input: BoardInfoPromptInput): string {
  const sortedRoles = Object.values(Role).filter(
    (role) => (input.roleCounts.get(role) ?? 0) > 0,
  );
  const lineup = sortedRoles
    .map((role) => `${input.roleLabel(role)}x${input.roleCounts.get(role) ?? 0}`)
    .join("，");
  const skillBriefs = sortedRoles
    .map((role) => `${input.roleLabel(role)}：${input.roleSkillBrief(role)}`)
    .join("；");

  return [
    "当前板子信息：",
    `总玩家数=${input.totalPlayers}`,
    `角色构成=${lineup || "unknown"}`,
    `角色技能简介=${skillBriefs || "unknown"}`,
  ].join("\n");
}

/** 构建“回合约束未满足”场景下的递进重试提示词。 */
export function buildConstraintRetryPrompt(attempt: number, maxRetries: number): string {
  if (attempt === 1) {
    return `上轮没有产生有效行动。你的思考可以保留，但所有会生效的发言或行动必须通过 submit_action 提交，不能只返回普通 assistant 文本。（重试 ${attempt}/${maxRetries}）`;
  }
  if (attempt === 2) {
    return `再次提醒：请调用 submit_action 提交本轮行动。若要发言，action 填 speak 或 speak_to_wolves，并将自由表达放入 arguments.text；普通 assistant 文本不会生效。（重试 ${attempt}/${maxRetries}）`;
  }
  return `最后提醒：若本轮仍没有有效 submit_action，系统将判定失败并强制回退。请立即提交行动；不要只返回普通 assistant 文本。（重试 ${attempt}/${maxRetries}）`;
}
