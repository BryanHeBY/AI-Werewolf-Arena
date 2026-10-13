/**
 * 负责 AI 审计工具错误说明、提示、报告标题／字段、发现类别与确定性检查文案。
 * 输入为已有消息 ID、占位参数与两语 literal 模板；输出为 audit 家族片段供审计任务和摘要渲染消费。
 * 这些文本不读取证据、执行检查或认定问题严重性，证据资格与报告提交归原审计 owner。
 * 用户／模型原文由格式化器作为参数保留，不用翻译表替换成新结论。
 */
import type { MessageDefinition } from "./definition";

// parameters 定义本家族拥有的 key 及排序后的唯一参数名；空数组是明确无插值，不是遗漏声明。
export const definition = {
  owner: "audit",
  parameters: {
    "error.invalid_get_audit_context_arguments": [],
    "error.invalid_submit_audit_findings_arguments": [],
    "error.invalid_submit_audit_summary_arguments": [],
    "error.audit_turn_not_open_or_session_invalid": [],
    "error.audit_tool_not_allowed_in_this_mode": [],
    "error.audit_evidence_not_visible_in_current_context": [],
    "error.unknown_audit_tool": [],
    "audit.prompt.identity": [],
    "audit.prompt.language": [],
    "audit.prompt.read": [],
    "audit.prompt.submit": [],
    "audit.prompt.evidence": [],
    "audit.prompt.outcome": [],
    "audit.prompt.acp.init": [],
    "audit.prompt.turn": ["turn"],
    "audit.prompt.mode": ["mode"],
    "audit.prompt.use_tools": [],
    "audit.prompt.inspect": [],
    "audit.prompt.summary": [
      "conclusion",
      "findings",
      "none",
      "pipeline",
      "session",
      "stats",
      "todo",
    ],
    "audit.prompt.claims": [],
    "audit.prompt.boundaries": [],
    "audit.title": ["session"],
    "audit.heading.session": [],
    "audit.heading.stats": [],
    "audit.heading.findings": [],
    "audit.heading.observations": [],
    "audit.heading.todo": [],
    "audit.heading.conclusion": [],
    "audit.heading.pipeline": [],
    "audit.field.board": [],
    "audit.field.winner": [],
    "audit.field.reason": [],
    "audit.field.started": [],
    "audit.field.ended": [],
    "audit.field.total": [],
    "audit.field.actionable": [],
    "audit.field.critical": [],
    "audit.field.high": [],
    "audit.field.medium": [],
    "audit.field.low": [],
    "audit.field.agents_total": [],
    "audit.field.agents_failed": [],
    "audit.field.failed_list": [],
    "audit.field.missing": [],
    "audit.todo": ["category", "message"],
    "audit.conclusion": [],
    "audit.observation.event_counts.title": [],
    "audit.observation.event_counts.detail": ["events", "ops", "players", "timeline"],
    "audit.observation.process_counts.title": [],
    "audit.observation.process_counts.detail": ["blast", "night", "shot"],
    "audit.observation.actions.title": [],
    "audit.observation.actions.detail": ["fallback", "rejected"],
    "audit.observation.invalid_day.title": [],
    "audit.observation.invalid_day.detail": ["count"],
    "audit.observation.request_mismatch.title": [],
    "audit.observation.request_mismatch.detail": ["count"],
    "audit.check.first_day_blast": [],
    "audit.check.guard_mention": [],
    "audit.check.potion_claim": [],
    "audit.check.invalid_day": [],
    "audit.check.request_mismatch": [],
    "audit.category.flow": [],
    "audit.category.rule": [],
    "audit.category.state": [],
    "audit.category.logging": [],
    "audit.category.other": [],
    "audit.pipeline.fallback": [],
  },
} as const satisfies MessageDefinition;

export const zhCN = {
  "error.invalid_get_audit_context_arguments": "get_audit_context参数无效；请提供当前审计turn_id。",
  "error.invalid_submit_audit_findings_arguments": "审计findings参数无效；请按工具schema提交。",
  "error.invalid_submit_audit_summary_arguments":
    "审计summary参数无效；请按工具schema提交当前turn_id和markdown。",
  "error.audit_turn_not_open_or_session_invalid":
    "审计回合未开放或会话不匹配；请使用本任务当前turn_id。",
  "error.audit_tool_not_allowed_in_this_mode":
    "该工具不适用于当前审计模式；请使用当前模式对应的submit工具。",
  "error.audit_evidence_not_visible_in_current_context":
    "证据序号不在本任务授权上下文中；请仅引用当前上下文中可见的证据。",
  "error.unknown_audit_tool": "未知审计工具；请使用当前审计工具列表。",
  "audit.prompt.identity":
    "你是狼人杀复盘审计智能体。唯一职责是从被授权的结构化上下文中发现可验证的问题。",
  "audit.prompt.language": "请使用中文提交审计说明；玩家和模型原文、机器字段及证据序号保持原样。",
  "audit.prompt.read":
    "先调用 get_audit_context 读取当前任务；不要猜测或读取本地文件、终端和其他任务。",
  "audit.prompt.submit":
    "inspect 模式必须以 submit_audit_findings 结束；summarize 模式必须以 submit_audit_summary 结束。",
  "audit.prompt.evidence":
    "普通 assistant 文本仅视为思考，不会成为审计结果。证据序号必须来自当前上下文。",
  "audit.prompt.outcome":
    "存在 session.decision 时，以其 outcome、winningPlayerIds 和 decidedAt 为已记录判胜事实。旧 winner 为 null 也可能是个人或关系胜利。finish_reason 表示运行结束原因，不覆盖已封盘胜利；缺少 decision 时，不从角色或阵营推断获胜成员。",
  "audit.prompt.acp.init":
    "每个实际审计回合会提供 turn_id；届时先调用 get_audit_context，再使用与模式对应的 submit 工具。当前仅初始化会话，尚无有效 turn_id，请不要调用任何工具。",
  "audit.prompt.turn": "当前审计回合 ID：{turn}",
  "audit.prompt.mode": "当前模式：{mode}",
  "audit.prompt.use_tools":
    "请通过审计工具读取上下文并提交结果。不要在普通文本中复制上下文或最终结果。",
  "audit.prompt.inspect": "最多提交 5 条 findings；每条 evidence 必须是上下文中存在的 seq。",
  "audit.prompt.summary":
    "Markdown必须按顺序使用这些二级标题，不使用标题变体、HTML或代码块：{session}、{stats}、{findings}、{todo}或{conclusion}、{pipeline}。{findings}每项占一行，以“- ”开头，写 evidence=1,2，且只能引用上下文findings.evidence；无事项时只写“- {none}”。",
  "audit.prompt.claims":
    "玩家的身份声称、诈身份、策略分歧和不确定推测本身不是引擎故障。区分已确认的引擎事实、玩家原话和待核查迹象；没有足够证据时说明缺失信息。",
  "audit.prompt.boundaries": "仅使用本任务授权的审计工具上下文；不要读取本地文件、终端或其他任务。",
  "audit.title": "调试摘要（{session}）",
  "audit.heading.session": "对局",
  "audit.heading.stats": "问题上报统计",
  "audit.heading.findings": "审查事项",
  "audit.heading.observations": "观察记录",
  "audit.heading.todo": "待办",
  "audit.heading.conclusion": "结论",
  "audit.heading.pipeline": "审计流程",
  "audit.field.board": "板子",
  "audit.field.winner": "胜利阵营",
  "audit.field.reason": "结束原因",
  "audit.field.started": "开始时间",
  "audit.field.ended": "结束时间",
  "audit.field.total": "总数",
  "audit.field.actionable": "待核查上报",
  "audit.field.critical": "严重",
  "audit.field.high": "高",
  "audit.field.medium": "中",
  "audit.field.low": "低",
  "audit.field.agents_total": "审计任务总数",
  "audit.field.agents_failed": "失败任务数",
  "audit.field.failed_list": "失败任务",
  "audit.field.missing": "缺失信息",
  "audit.todo": "核查 {category}：{message}",
  "audit.conclusion": "本局未发现可执行问题，无需新增调试任务。",
  "audit.observation.event_counts.title": "对局事件规模",
  "audit.observation.event_counts.detail":
    "对局事件={events}，逻辑操作={ops}，玩家视角={players}，时间线条目={timeline}",
  "audit.observation.process_counts.title": "关键流程计数",
  "audit.observation.process_counts.detail": "夜间结算={night}，狼人自爆={blast}，死亡开枪={shot}",
  "audit.observation.actions.title": "动作稳定性",
  "audit.observation.actions.detail": "工具拒绝={rejected}，回退={fallback}",
  "audit.observation.invalid_day.title": "元数据异常",
  "audit.observation.invalid_day.detail": "发现 day<=0 的行动条目 {count} 条",
  "audit.observation.request_mismatch.title": "请求编号异常",
  "audit.observation.request_mismatch.detail": "发现 request_id 与 day/phase 不一致条目 {count} 条",
  "audit.check.first_day_blast": "首日出现狼人自爆，建议核查自爆窗口策略配置是否符合预期。",
  "audit.check.guard_mention":
    "本局无守卫但发言提及守卫；这可能是正常诈身份，需结合上下文核查，不代表已确认引擎故障。",
  "audit.check.potion_claim":
    "女巫发言声称已用药但事件流无记录；需区分玩家声称与引擎事实，再核查信息同步。",
  "audit.check.invalid_day": "玩家时间线出现 day<=0 的行动记录，疑似动作上下文写入错误。",
  "audit.check.request_mismatch": "玩家时间线 request_id 与 day/phase 不一致，疑似请求元数据错位。",
  "audit.category.flow": "流程",
  "audit.category.rule": "规则",
  "audit.category.state": "状态",
  "audit.category.logging": "记录",
  "audit.category.other": "其他",
  "audit.pipeline.fallback": "本摘要使用确定性检查与已提供的玩家上报，未纳入模型审计结果。",
} as const satisfies Record<keyof typeof definition.parameters, string>;

export const en = {
  "error.invalid_get_audit_context_arguments":
    "Invalid get_audit_context arguments. Provide the current audit turn_id.",
  "error.invalid_submit_audit_findings_arguments":
    "Invalid audit findings arguments. Submit according to the tool schema.",
  "error.invalid_submit_audit_summary_arguments":
    "Invalid audit summary arguments. Provide the current turn_id and markdown according to the tool schema.",
  "error.audit_turn_not_open_or_session_invalid":
    "The audit turn is closed or the session does not match. Use this task's current turn_id.",
  "error.audit_tool_not_allowed_in_this_mode":
    "This tool is not allowed in the current audit mode. Use the submit tool for that mode.",
  "error.audit_evidence_not_visible_in_current_context":
    "An evidence sequence is not visible in this task's authorized context. Cite only evidence visible in the current context.",
  "error.unknown_audit_tool": "Unknown audit tool. Use the current audit tool list.",
  "audit.prompt.identity":
    "You are a Werewolf replay audit agent. Your only task is to identify verifiable issues in your authorized structured context.",
  "audit.prompt.language":
    "Submit audit explanations in English. Preserve original player and model text, machine fields and evidence sequence IDs.",
  "audit.prompt.read":
    "First call get_audit_context for your current task. Do not guess or read local files, terminals or other tasks.",
  "audit.prompt.submit":
    "End inspect mode with submit_audit_findings and summarize mode with submit_audit_summary.",
  "audit.prompt.evidence":
    "Plain assistant text is reasoning, not an audit result. Evidence sequence IDs must come from the current context.",
  "audit.prompt.outcome":
    "When session.decision is present, use its outcome, winningPlayerIds and decidedAt as the recorded victory. A null legacy winner can mean individual or relationship victory. finish_reason describes runtime completion; it does not override a sealed victory. Without a decision, do not infer winning members from roles or camps.",
  "audit.prompt.acp.init":
    "Each actual audit turn will provide a turn_id. Then call get_audit_context and use the submit tool for that mode. This is only session initialization; no turn_id is valid yet. Do not call any tools now.",
  "audit.prompt.turn": "Current audit turn ID: {turn}",
  "audit.prompt.mode": "Current mode: {mode}",
  "audit.prompt.use_tools":
    "Read context and submit results through the audit tools. Do not copy context or final results into plain text.",
  "audit.prompt.inspect":
    "Submit at most 5 findings. Every evidence value must be a seq present in the current context.",
  "audit.prompt.summary":
    "Use these level-two headings in this order, without heading variants, HTML or code fences: {session}, {stats}, {findings}, {todo} or {conclusion}, and {pipeline}. Put each {findings} item on one line beginning with '- ' and include evidence=1,2, citing only context findings.evidence. If there are no items, write only '- {none}'.",
  "audit.prompt.claims":
    "Role claims, bluffs, strategic disagreements and uncertain guesses are not engine faults by themselves. Distinguish confirmed engine facts, original player speech and indications needing review. State missing information when evidence is insufficient.",
  "audit.prompt.boundaries":
    "Use only audit tool context authorized for this task. Do not read local files, terminals or other tasks.",
  "audit.title": "Debug Summary ({session})",
  "audit.heading.session": "Session",
  "audit.heading.stats": "Bug Report Stats",
  "audit.heading.findings": "Findings",
  "audit.heading.observations": "Observations",
  "audit.heading.todo": "TODO",
  "audit.heading.conclusion": "Conclusion",
  "audit.heading.pipeline": "Debug Pipeline",
  "audit.field.board": "Board",
  "audit.field.winner": "Winner",
  "audit.field.reason": "Finish reason",
  "audit.field.started": "Started at",
  "audit.field.ended": "Ended at",
  "audit.field.total": "Total",
  "audit.field.actionable": "Reports requiring review",
  "audit.field.critical": "Critical",
  "audit.field.high": "High",
  "audit.field.medium": "Medium",
  "audit.field.low": "Low",
  "audit.field.agents_total": "Audit tasks",
  "audit.field.agents_failed": "Failed tasks",
  "audit.field.failed_list": "Failed tasks",
  "audit.field.missing": "Missing information",
  "audit.todo": "Review {category}: {message}",
  "audit.conclusion":
    "No actionable issues were found in this game; no new debugging tasks are needed.",
  "audit.observation.event_counts.title": "Recorded game size",
  "audit.observation.event_counts.detail":
    "Game events={events}, logic operations={ops}, player views={players}, timeline entries={timeline}",
  "audit.observation.process_counts.title": "Key process counts",
  "audit.observation.process_counts.detail":
    "Night resolutions={night}, wolf self-destructions={blast}, death shots={shot}",
  "audit.observation.actions.title": "Action stability",
  "audit.observation.actions.detail": "Tool refusals={rejected}, fallbacks={fallback}",
  "audit.observation.invalid_day.title": "Metadata anomaly",
  "audit.observation.invalid_day.detail": "Found {count} action entries with day<=0",
  "audit.observation.request_mismatch.title": "Request ID anomaly",
  "audit.observation.request_mismatch.detail":
    "Found {count} entries where request_id differs from day/phase",
  "audit.check.first_day_blast":
    "A wolf self-destructed on the first day. Review whether the configured window and strategy are intended.",
  "audit.check.guard_mention":
    "Speech mentions a Guard on a board without one. This may be a legitimate bluff; review the context rather than treating it as a confirmed engine fault.",
  "audit.check.potion_claim":
    "The Witch claims potion use without a recorded potion event. Distinguish the player's claim from engine facts before reviewing information synchronization.",
  "audit.check.invalid_day":
    "A player timeline contains actions with day<=0, indicating a possible action context recording error.",
  "audit.check.request_mismatch":
    "A player timeline request_id differs from day/phase, indicating possible request metadata misalignment.",
  "audit.category.flow": "Flow",
  "audit.category.rule": "Rule",
  "audit.category.state": "State",
  "audit.category.logging": "Logging",
  "audit.category.other": "Other",
  "audit.pipeline.fallback":
    "This summary uses deterministic checks and supplied player reports; no model audit result is included.",
} satisfies Record<keyof typeof definition.parameters, string>;

// 三份原数据一起交 catalog；satisfies 只作编译期 key 对齐，最终公开字典的冻结由 catalog 负责。
export const messages = { definition, zhCN, en };
