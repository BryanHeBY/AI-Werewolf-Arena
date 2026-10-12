/**
 * Independent literal decision inputs for the refactor two-build comparison.
 * Only issued request DTOs select these old-seat plans; no World, role profile,
 * eligibility implementation or settlement result is consulted. Missing tools
 * fail explicitly. These are equivalence inputs, not independent rule oracles;
 * role acceptance remains covered by handwritten scenario and wire fixtures.
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
