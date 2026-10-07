import type { ActorTransportPlan, PlannedTurn } from "./foundation_transport_plan";

const stages: Record<string, [string, string]> = {
  wolf_discussion: ["狼人交流", "Wolf discussion"], wolf_vote: ["狼人刀人投票", "Wolf kill vote"],
  guard: ["守卫行动", "Guard action"], seer: ["预言家行动", "Seer action"], witch: ["女巫行动", "Witch action"],
  day_speech: ["白天发言", "Day speech"], voting: ["放逐投票", "Exile vote"], last_words: ["遗言", "Last words"], hunter_shot: ["猎人开枪", "Hunter shot"],
  sheriff_nomination: ["上警报名", "Sheriff nomination"], sheriff_campaign_speech: ["警上发言", "Sheriff campaign speech"],
  sheriff_withdraw: ["退水", "Withdraw candidacy"], sheriff_vote: ["警长投票", "Sheriff vote"], sheriff_choose_direction: ["警长定序", "Sheriff speaking order"],
  on_pre_vote: ["放逐前窗口", "Before exile voting"],
};
export function assertTransportPrompt(plan: ActorTransportPlan, turn: PlannedTurn, content: string): string {
  const actorMarker = plan.locale === "en" ? `[Action prompt] Player ${plan.actorId},` : `[行动提示] ${plan.actorId}号玩家` ;
  if (!content.includes(actorMarker)) throw new Error("fixture_actor_mismatch");
  if (plan.locale === "en" && /[\u4e00-\u9fff]/.test(content)) throw new Error("fixture_prompt_not_english");
  const stage = stages[turn.stage][plan.locale === "en" ? 1 : 0];
  const marker = plan.locale === "en" ? `stage: ${stage};` : `子阶段是${stage}，`;
  if (!content.includes(marker)) throw new Error(`fixture_stage_mismatch:${plan.actorId}:${turn.day}:${turn.stage}`);
  const turnId = /(?:turn_id (?:必须为|must be) |Current turn ID: |当前回合 ID：)(t\d+)/.exec(content)?.[1];
  if (!turnId) throw new Error("fixture_turn_id_missing");
  return turnId;
}
export function assertTransportEvents(role: string, events: Array<[number, string, Record<string, unknown>]>, actorId: number) {
  for (const [, type, payload] of events) {
    if (type === "god_private_game_info") throw new Error("fixture_god_information_exposed");
    if (["seer_checked", "witch_potion_used", "witch_potion_skipped", "guard_applied"].includes(type) && payload.actorId !== actorId) throw new Error("fixture_other_private_skill_exposed");
    if (["wolf_tactical_order", "wolf_discussion", "wolf_discussion_ended", "wolf_kill_vote_cast"].includes(type) && role !== "wolf") throw new Error("fixture_wolf_information_exposed");
  }
}
