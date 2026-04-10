import { Role } from "../../domain/model";

export interface SystemPromptInput {
  actorId: number;
  role: string;
  maxPlayerId: number;
  teammateIds: number[];
  allowedTools: string[];
  stageDirective: string;
  mustAct: boolean;
  boardInfoPrompt?: string;
}

export interface UserPromptInput {
  actorId: number;
  phase: string;
  stage: string;
  isSpeechTurn: boolean;
  mustAct: boolean;
  allowedTools: string[];
  toolArgHints: string;
}

export interface BoardInfoPromptInput {
  totalPlayers: number;
  roleCounts: Map<Role, number>;
  roleLabel: (role: Role) => string;
  roleSkillBrief: (role: Role) => string;
}

const SYSTEM_BASE_LINES = [
  "你是狼人杀引擎中的单个玩家智能体。",
  "你必须使用中文进行思考和表达。",
  "你通过函数工具执行行动，不要手写 JSON。",
  "禁止输出思维链与额外元信息。",
] as const;

export function buildSystemPrompt(input: SystemPromptInput): string {
  const actionRule = input.mustAct
    ? "本轮必须完成一次有效行动，且禁止调用 finish_turn。"
    : "本轮可选择结束回合不行动；当你不需要继续行动时，请调用 finish_turn 工具结束回合。";
  const teammateText =
    input.teammateIds.length > 0 ? input.teammateIds.join(", ") : "无";
  return [
    `${SYSTEM_BASE_LINES[0]} 你的编号是${input.actorId}号，真实身份是${input.role}。当你看到“[行动提示]”时，说明你可以开始行动了。${SYSTEM_BASE_LINES[1]} ${SYSTEM_BASE_LINES[2]}`,
    `你当前同阵营队友（不含你自己）的编号：${teammateText}。`,
    `你只能引用本局存在的玩家编号，编号范围是1到${input.maxPlayerId}，严禁虚构不存在的玩家编号。`,
    `仅可调用本轮可用工具：${input.allowedTools.join(", ")}。${input.stageDirective} ${actionRule}`,
    ...(input.boardInfoPrompt ? [input.boardInfoPrompt] : []),
    SYSTEM_BASE_LINES[3],
  ].join("\n");
}

export function buildUserPrompt(input: UserPromptInput): string {
  const speechTurnText = input.isSpeechTurn
    ? "目前是你的发言轮次"
    : "目前不是你的发言轮次";
  const mustActText = input.mustAct
    ? "你本轮必须至少调用一次可用工具完成行动。"
    : "你本轮可以选择结束回合不行动。";
  return [
    `[行动提示] ${input.actorId}号玩家，现在轮到你行动，当前处于${input.phase}阶段，子阶段是${input.stage}，${speechTurnText}。`,
    `${mustActText} 你当前可以使用的工具有：${input.allowedTools.join(", ") || "无"}。`,
    `工具参数提示：${input.toolArgHints}。请直接调用工具完成本轮行动。`,
  ].join("\n");
}

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

export function buildMustActRetryPrompt(attempt: number, maxRetries: number): string {
  if (attempt === 1) {
    return `上轮你没有完成有效工具调用。请立即调用一个可用工具，禁止解释文本。（重试 ${attempt}/${maxRetries}）`;
  }
  if (attempt === 2) {
    return `再次提醒：你必须立刻调用可用工具。不要输出思考、不要输出说明、不要输出自然语言。（重试 ${attempt}/${maxRetries}）`;
  }
  return `最后警告：若你本轮仍不调用可用工具，系统将判定失败并强制回退。现在立刻只输出函数调用。（重试 ${attempt}/${maxRetries}）`;
}

export const SPEAK_TEXT_FILTER_KEYWORDS = [
  "actorid=",
  "玩家编号=",
  "phase=",
  "当前阶段=",
  "actionwindow=",
  "行动窗口=",
  "role=",
  "你的身份=",
  "allowedtools=",
  "可用工具=",
  "context=",
  "阶段上下文=",
  "aliveplayers=",
  "存活玩家视图=",
  "私有查验情报=",
  "toolarghints=",
  "工具参数提示=",
  "你是狼人杀引擎中的单个玩家智能体",
  "json 格式",
] as const;

export const DEFAULT_SPEAK_TEXT = "我先听后位发言再判断。";
