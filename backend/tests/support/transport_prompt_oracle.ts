import type { ActorTransportPlan, PlannedTurn } from "./foundation_transport_plan";

export function assertTransportIdentity(plan: ActorTransportPlan, content: string): void {
  if (plan.expectedTeammateIds === undefined) return;
  const ids = plan.expectedTeammateIds.join(", ") || (plan.locale === "en" ? "None" : "无"),
    marker =
      plan.locale === "en" ? `excluding yourself: ${ids}.` : `队友（不含你自己）的编号：${ids}。`;
  if (!content.includes(marker)) throw new Error("fixture_teammate_knowledge_mismatch");
}

const stages: Record<string, [string, string]> = {
  wolf_discussion: ["狼人交流", "Wolf discussion"],
  wolf_vote: ["狼人刀人投票", "Wolf kill vote"],
  guard: ["守卫行动", "Guard action"],
  seer: ["预言家行动", "Seer action"],
  witch: ["女巫行动", "Witch action"],
  day_speech: ["白天发言", "Day speech"],
  voting: ["放逐投票", "Exile vote"],
  last_words: ["遗言", "Last words"],
  hunter_shot: ["猎人开枪", "Hunter shot"],
  death_shot: ["死亡开枪", "Death shot"],
  mirror_girl: ["魔镜少女行动", "Mirror Girl action"],
  psychic: ["通灵师行动", "Spirit Seer action"],
  hybrid: ["混血儿选择榜样", "Hybrid exemplar selection"],
  black_market_merchant: ["黑市商人交易", "Black Market trade"],
  black_market_recipient: ["黑市幸运儿行动", "Black Market recipient"],
  miracle_merchant: ["奇迹商人赠予", "Miracle Merchant trade"],
  lucky: ["幸运儿行动", "Lucky recipient action"],
  mechanical_mode: ["机械狼模式选择", "Mechanical Wolf mode choice"],
  mechanical_mimic: ["机械狼学习", "Mechanical Wolf learning"],
  mechanical_skill: ["机械狼技能", "Mechanical Wolf skill"],
  mechanical_attack: ["机械狼额外刀", "Mechanical Wolf extra knife"],
  awakened_mimic: ["觉醒隐狼模仿", "Awakened Hidden Wolf learning"],
  awakened_skill: ["觉醒隐狼技能", "Awakened Hidden Wolf skill"],
  awakened_attack: ["觉醒隐狼额外刀", "Awakened Hidden Wolf extra knife"],
  role_inspection: ["具体角色查验", "Role inspection"],
  dreamer: ["摄梦人行动", "Dreamer action"],
  wolf_beauty: ["狼美人魅惑", "Wolf Beauty charm"],
  sheriff_nomination: ["上警报名", "Sheriff nomination"],
  sheriff_campaign_speech: ["警上发言", "Sheriff campaign speech"],
  sheriff_withdraw: ["退水", "Withdraw candidacy"],
  sheriff_vote: ["警长投票", "Sheriff vote"],
  sheriff_choose_direction: ["警长定序", "Sheriff speaking order"],
  before_speeches: ["骑士发言前窗口", "Knight before-speech window"],
  between_speeches: ["骑士发言间隙窗口", "Knight between-speech window"],
  after_speeches: ["骑士发言结束窗口", "Knight after-speech window"],
  on_pre_vote: ["放逐前窗口", "Before exile voting"],
  on_pre_election: ["警长流程前窗口", "Before sheriff election"],
  on_daybreak: ["天亮后窗口", "Daybreak window"],
  on_per_speech_gap: ["发言间隔窗口", "Between speeches"],
};
export function assertTransportPrompt(
  plan: ActorTransportPlan,
  turn: PlannedTurn,
  content: string,
): string {
  const actorMarker =
    plan.locale === "en"
      ? `[Action prompt] Player ${plan.actorId},`
      : `[行动提示] ${plan.actorId}号玩家`;
  if (!content.includes(actorMarker)) throw new Error("fixture_actor_mismatch");
  if (
    !content.includes(
      plan.locale === "en" ? `Current game day: ${turn.day}.` : `当前日次：第${turn.day}天。`,
    )
  )
    throw new Error("fixture_day_mismatch");
  for (const marker of plan.requiredCurrentMarkers ?? [])
    if (!content.includes(marker)) throw new Error("fixture_private_marker_missing");
  for (const marker of plan.forbiddenCurrentMarkers ?? [])
    if (content.includes(marker)) throw new Error("fixture_private_marker_exposed");
  for (const marker of turn.requiredPromptMarkers ?? [])
    if (!content.includes(marker)) throw new Error("fixture_required_turn_marker_missing");
  for (const marker of turn.forbiddenPromptMarkers ?? [])
    if (content.includes(marker)) throw new Error("fixture_premature_marker_exposed");
  if (turn.hybridChoice !== undefined) {
    const state = turn.hybridChoice
      ? { remaining: 0, choice: { day: 1, targetId: turn.hybridChoice.targetId } }
      : { remaining: 1, choice: null };
    if (!content.includes(JSON.stringify(state))) throw new Error("fixture_hybrid_choice_mismatch");
    if (
      !content.includes(
        plan.locale === "en"
          ? "Their true faction and role are unknown."
          : "其真实阵营与底牌未知。",
      )
    )
      throw new Error("fixture_hybrid_unknown_status_missing");
    if (content.includes('"affiliations"') || content.includes('"faction"'))
      throw new Error("fixture_hybrid_hidden_membership_exposed");
  }
  if (turn.gargoyleStatus) {
    const value = (flag: boolean) =>
        plan.locale === "en" ? (flag ? "Yes" : "No") : flag ? "是" : "否",
      { inherited, active } = turn.gargoyleStatus;
    const marker =
      plan.locale === "en"
        ? `Personally inherited the knife: ${value(inherited)}; knife eligibility after this night's inspection: ${value(active)}.`
        : `本人曾接刀：${value(inherited)}；本夜查后刀资格：${value(active)}。`;
    if (!content.includes(marker)) throw new Error("fixture_gargoyle_knife_status_mismatch");
  }
  if (turn.mechanicalStatus) {
    const { learned, ready, inherited, first, mode } = turn.mechanicalStatus,
      english = plan.locale === "en";
    const none = english ? "None" : "无",
      label = learned?.[english ? 1 : 0] ?? none;
    const selection = mode
      ? `${mode.day}: ${english ? (mode.kind === "kill" ? "Kill" : "Skill") : mode.kind === "kill" ? "击杀" : "技能"}`
      : none;
    const marker = english
      ? `Learned role: ${label}; effective night: ${ready ?? none}; inherited knife: ${inherited ? "Yes" : "No"}; fixed first knife night: ${first ?? none}; current mode: ${selection};`
      : `已学角色：${label}；生效夜：${ready ?? none}；曾接刀：${inherited ? "是" : "否"}；固定首次刀夜：${first ?? none}；本夜模式：${selection}；`;
    if (!content.includes(marker)) throw new Error("fixture_mechanical_status_mismatch");
  }
  if (turn.roleInspectionLatest !== undefined) {
    const latest = turn.roleInspectionLatest,
      marker = latest
        ? plan.locale === "en"
          ? `Your latest inspection of player ${latest.targetId}: ${latest.roleLabel[1]}.`
          : `你上一条查验结果：${latest.targetId}号是${latest.roleLabel[0]}。`
        : plan.locale === "en"
          ? "Your latest inspection of player"
          : "你上一条查验结果：";
    if (latest ? !content.includes(marker) : content.includes(marker))
      throw new Error("fixture_role_inspection_history_mismatch");
  }
  if (
    turn.stage === "mirror_girl" &&
    !content.includes(
      plan.locale === "en" ? "Mirror inspection ability for this turn:" : "本轮魔镜查验能力：",
    )
  )
    throw new Error("fixture_mirror_rules_missing");
  if (
    turn.stage === "psychic" &&
    !content.includes(
      plan.locale === "en" ? "Spirit Seer inspection ability for this turn:" : "本轮通灵查验能力：",
    )
  )
    throw new Error("fixture_psychic_rules_missing");
  if (
    turn.stage === "lucky" &&
    (!content.includes(
      plan.locale === "en" ? "This is the Lucky recipient stage" : "当前是幸运儿阶段",
    ) ||
      content.includes(
        plan.locale === "en"
          ? "This is the Witch stage: submit use_potion"
          : "当前女巫阶段：必须调用use_potion",
      ))
  )
    throw new Error("fixture_lucky_rules_mismatch");
  if (
    turn.stage === "role_inspection" &&
    !content.includes(
      plan.locale === "en" ? "Role inspection ability for this turn:" : "本轮具体角色查验能力：",
    )
  )
    throw new Error("fixture_role_inspection_rules_missing");
  if (turn.hiddenWolfStatus) {
    const value = (flag: boolean) =>
        plan.locale === "en" ? (flag ? "Yes" : "No") : flag ? "是" : "否",
      { inherited, active } = turn.hiddenWolfStatus;
    const marker =
      plan.locale === "en"
        ? `Personally inherited the knife: ${value(inherited)}; currently able to attack: ${value(active)}.`
        : `本人曾获得刀权：${value(inherited)}；当前可出刀：${value(active)}。`;
    if (!content.includes(marker)) throw new Error("fixture_hidden_knife_status_mismatch");
  }
  if (turn.bearLatest !== undefined) {
    const report = turn.bearLatest,
      result = report?.roared
        ? plan.locale === "en"
          ? "Bear roared"
          : "熊咆哮了"
        : plan.locale === "en"
          ? "Bear did not roar"
          : "熊没有咆哮";
    const marker = report
      ? plan.locale === "en"
        ? `Latest public announcement: day ${report.day}, ${result}.`
        : `最近公开公告：第${report.day}天，${result}。`
      : plan.locale === "en"
        ? "No Bear announcement has been published yet;"
        : "尚无已公布的熊公告；";
    if (!content.includes(marker)) throw new Error("fixture_bear_history_mismatch");
  }
  if (
    turn.knightResourceRemaining !== undefined &&
    !content.includes(
      plan.locale === "en"
        ? `Duel opportunities remaining: ${turn.knightResourceRemaining}.`
        : `决斗机会剩余：${turn.knightResourceRemaining}。`,
    )
  )
    throw new Error("fixture_knight_resource_mismatch");
  if (turn.charmLatest) {
    const { targetId, day } = turn.charmLatest,
      target = targetId ?? (plan.locale === "en" ? "None" : "无"),
      date = day ?? (plan.locale === "en" ? "None" : "无");
    if (
      !content.includes(
        plan.locale === "en"
          ? `Current charm target: ${target}; last action day: ${date}.`
          : `当前魅惑目标：${target}；上次行动日：${date}。`,
      )
    )
      throw new Error("fixture_charm_history_mismatch");
  }
  if (turn.dreamLatest !== undefined) {
    const choice = turn.dreamLatest,
      marker = choice
        ? plan.locale === "en"
          ? `Latest dream choice: player ${choice.targetId} on night ${choice.day};`
          : `最近梦游选择：第${choice.day}夜的${choice.targetId}号；`
        : plan.locale === "en"
          ? "Latest dream choice:"
          : "最近梦游选择：";
    if (choice ? !content.includes(marker) : content.includes(marker))
      throw new Error("fixture_dream_history_mismatch");
    if (
      turn.stage === "dreamer" &&
      !content.includes(
        plan.locale === "en" ? "Dream ability rules for this turn:" : "本轮梦能力规则：",
      )
    )
      throw new Error("fixture_dream_rules_missing");
  }
  if (turn.gravekeeperLatest !== undefined) {
    const report = turn.gravekeeperLatest,
      camps = {
        good: ["好人", "Good"],
        wolf: ["狼人", "Werewolves"],
        third_party: ["第三方", "Third party"],
      };
    const marker = report
      ? plan.locale === "en"
        ? `Latest grave feedback: night ${report.receivedDay} reports player ${report.targetId}, exiled on day ${report.exileDay}, as ${camps[report.camp][1]}.`
        : `最新守墓反馈：第${report.receivedDay}夜收到第${report.exileDay}日放逐${report.targetId}号的结果：${camps[report.camp][0]}。`
      : plan.locale === "en"
        ? "No exile feedback received yet;"
        : "尚未收到放逐反馈；";
    if (!content.includes(marker)) throw new Error("fixture_gravekeeper_feedback_mismatch");
  }
  if (plan.locale === "en" && /[\u4e00-\u9fff]/.test(content))
    throw new Error("fixture_prompt_not_english");
  const stage = stages[turn.stage][plan.locale === "en" ? 1 : 0];
  const marker = plan.locale === "en" ? `stage: ${stage};` : `子阶段是${stage}，`;
  if (!content.includes(marker))
    throw new Error(`fixture_stage_mismatch:${plan.actorId}:${turn.day}:${turn.stage}`);
  const turnId = /(?:turn_id (?:必须为|must be) |Current turn ID: |当前回合 ID：)(t\d+)/.exec(
    content,
  )?.[1];
  if (!turnId) throw new Error("fixture_turn_id_missing");
  return turnId;
}
export function assertTransportEvents(
  role: string,
  events: Array<[number, string, Record<string, unknown>]>,
  actorId: number,
) {
  for (const [, type, payload] of events) {
    if (type === "hunter_shot") throw new Error("fixture_native_gun_source_exposed");
    if (type === "player_shot" && Object.keys(payload).sort().join() !== "actorId,targetId")
      throw new Error("fixture_gun_private_fields_exposed");
    if (
      type === "bear_roared" &&
      (Object.keys(payload).sort().join() !== "day,roared" ||
        !Number.isSafeInteger(payload.day) ||
        Number(payload.day) < 1 ||
        typeof payload.roared !== "boolean")
    )
      throw new Error("fixture_bear_private_or_invalid_signal");
    if (
      type === "god_private_game_info" ||
      type === "mechanical_poison_reflected" ||
      type === "merchant_trade_resolved" ||
      type === "hybrid_affiliation_resolved"
    )
      throw new Error("fixture_god_information_exposed");
    if (
      [
        "merchant_trade_committed",
        "merchant_trade_skipped",
        "lucky_ability_skipped",
        "hybrid_exemplar_chosen",
      ].includes(type) &&
      payload.actorId !== actorId
    )
      throw new Error("fixture_other_private_skill_exposed");
    if (type.startsWith("mechanical_") && type !== "mechanical_shot" && payload.actorId !== actorId)
      throw new Error("fixture_other_private_skill_exposed");
    if (type.startsWith("awakened_") && payload.actorId !== actorId)
      throw new Error("fixture_other_private_skill_exposed");
    if (["dream_death", "charm_death", "charm_blocked"].includes(type))
      throw new Error("fixture_private_death_information_exposed");
    if (
      [
        "seer_checked",
        "hidden_wolf_awakened",
        "role_inspected",
        "role_inspection_skipped",
        "gargoyle_awakened",
        "charm_applied",
        "dream_applied",
        "gravekeeper_reported",
        "witch_potion_used",
        "witch_potion_skipped",
        "guard_applied",
      ].includes(type) &&
      payload.actorId !== actorId
    )
      throw new Error("fixture_other_private_skill_exposed");
    if (
      ["hidden_wolf", "gargoyle", "mechanical_wolf", "awakened_hidden_wolf"].includes(role) &&
      [
        "wolf_tactical_order",
        "wolf_discussion",
        "wolf_discussion_ended",
        "wolf_kill_vote_cast",
      ].includes(type)
    ) {
      if (type !== "wolf_kill_vote_cast" || payload.actorId !== actorId)
        throw new Error("fixture_hidden_pack_information_exposed");
    } else if (
      [
        "wolf_tactical_order",
        "wolf_discussion",
        "wolf_discussion_ended",
        "wolf_kill_vote_cast",
      ].includes(type) &&
      !["wolf", "wolf_king", "white_wolf_king", "wolf_beauty"].includes(role)
    )
      throw new Error("fixture_wolf_information_exposed");
  }
}
