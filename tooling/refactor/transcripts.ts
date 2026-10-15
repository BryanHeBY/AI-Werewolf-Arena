/**
 * 负责提供双构建比较的独立字面动作输入。仅消费已发出的请求 DTO 来选择固定座位计划，输出动作或 null。
 * 不查询 World、角色 profile、资格实现或结算结果；未覆盖的工具明确失败，不自动调用生产 fallback。
 * 这些计划用于等价比较，不是规则正确性的独立预期；角色验收仍依赖手写场景与通信样本。
 */
export interface TranscriptRequest {
  actorId: number;
  phase: string;
  actionWindow?: string;
  allowedTools: readonly string[];
  context: { day: number; stage: string; round?: number; [key: string]: unknown };
}
export interface TranscriptAction {
  name: string;
  args: Record<string, unknown>;
}
export interface LiteralTranscript {
  family: "basic" | "fragrant" | "animal";
  plan: string;
  failureStage?: string;
}
export function literalAction(
  r: TranscriptRequest,
  input: LiteralTranscript,
): TranscriptAction | null {
  // 分支次序属于冻结计划：先处理共享发言／警长动作，再按有限族、日期与座位选取字面回复。
  if (r.context.stage === input.failureStage) throw Error("literal_decision_failure");
  const day = r.context.day;
  const has = (name: string) => r.allowedTools.includes(name);
  const action = (name: string, args: Record<string, unknown>) => ({ name, args });
  if (has("speak_to_wolves"))
    return action("speak_to_wolves", { text: "Literal discussion", end_chat: true });
  if (has("speak"))
    return action("speak", { text: `Literal ${r.context.stage} seat ${r.actorId}` });
  if (has("run_for_sheriff"))
    return action("run_for_sheriff", { run: input.plan === "cat_badge" && r.actorId === 9 });
  if (has("vote_for_sheriff")) return action("vote_for_sheriff", { target_id: 9, abstain: false });
  if (has("choose_direction")) return action("choose_direction", { direction: "clockwise" });
  if (has("choose_badge_successor")) return action("choose_badge_successor", { target_id: 5 });
  if (has("self_destruct"))
    return input.plan === "cat_badge" &&
      day === 1 &&
      r.actorId === 2 &&
      r.actionWindow === "on_pre_vote"
      ? action("self_destruct", { confirm: true, reason: "Literal skipped vote" })
      : null;
  if (input.family === "animal") {
    if (has("fox_distract"))
      return action("fox_distract", { target_id: input.plan === "fox_beauty" ? 1 : null });
    if (has("charm"))
      return action("charm", {
        target_id: input.plan === "fox_beauty" ? (day === 4 ? 7 : 5) : null,
      });
    if (has("puffer_retaliate")) return action("puffer_retaliate", { activate: true });
  }
  if (has("bind_fragrant_pair"))
    return action("bind_fragrant_pair", {
      target_ids:
        input.plan === "first_link" && day === 1
          ? [5, 6]
          : input.plan === "inherited_gun" && day === 3
            ? [1, 12]
            : null,
    });
  if (has("check_pair"))
    return action("check_pair", {
      target_ids: (r.context.pair_check_candidates as number[]).includes(2) ? [9, 2] : [9, 10],
    });
  if (has("check_identity")) return action("check_identity", { target_id: day });
  if (has("guard")) return action("guard", { target_id: null, abstain: true });
  if (has("use_potion"))
    return input.plan === "inherited_gun" && day === 1
      ? action("use_potion", { target_id: 2, potion_type: "poison" })
      : action("use_potion", { target_id: r.actorId, potion_type: "none" });
  if (has("shoot"))
    return action("shoot", { target_id: input.plan === "inherited_gun" ? 1 : null });
  if (has("kill_vote")) {
    const target =
      input.family === "basic"
        ? null
        : input.plan === "cat_badge"
          ? [9, 6, 7, 8][day - 1]
          : input.plan === "fox_beauty"
            ? [null, null, 6, 8][day - 1]
            : input.plan === "inherited_gun"
              ? [9, 10, 11][day - 1]
              : [5, 7, 8][day - 1];
    if (target === undefined) throw Error("literal_plan_exhausted");
    return action("kill_vote", { target_id: target, abstain: target === null });
  }
  if (has("vote")) {
    const target =
      input.family === "basic"
        ? day
        : input.plan === "inherited_gun"
          ? [3, 4, null][day - 1]
          : day === 4
            ? 1
            : day + 1;
    if (target === undefined) throw Error("literal_plan_exhausted");
    return action("vote", { target_id: target, abstain: target === null });
  }
  throw Error(`literal_unplanned_tool: ${r.context.stage}/${r.allowedTools.join(",")}`);
}
