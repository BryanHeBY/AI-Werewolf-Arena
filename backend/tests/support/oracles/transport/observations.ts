/**
 * 负责提供传输测试的共享断言与手写预期，属于测试支持层而非生产观察器。
 * 输入为调用方的计划或观察元组，输出为库存、身份、标记和错误的有界断言。
 * 预期由原测试字面数据提供，不执行传输、模型或生产结算来重新计算结果。
 */
import type { ActorTransportPlan } from "../../transport/contracts";
import { isDeepStrictEqual } from "node:util";
import type { PlannedTurn } from "../../transport/contracts";
import { ANIMAL_DREAM_EVENT_TYPES } from "@ai-werewolf-arena/game-contract/facts/animal-dream";
import { readAnimalDreamFact } from "@ai-werewolf-arena/game-contract/facts/animal-dream";
import { FRAGRANT_PAIR_EVENT_TYPES } from "@ai-werewolf-arena/game-contract/facts/fragrant-pair-seer";
import { readFragrantPairFact } from "@ai-werewolf-arena/game-contract/facts/fragrant-pair-seer";
import { RADIANT_ECLIPSE_EVENT_TYPES } from "@ai-werewolf-arena/game-contract/facts/radiant-eclipse";
import { readRadiantEclipseFact } from "@ai-werewolf-arena/game-contract/facts/radiant-eclipse";
import { radiantEclipseAudience } from "@ai-werewolf-arena/game-contract/facts/radiant-eclipse";
import { readModifierChoiceFact } from "@ai-werewolf-arena/game-contract/facts/scholar-mentor";
import { readModifierSkipFact } from "@ai-werewolf-arena/game-contract/facts/scholar-mentor";
import { readModifierBonusFact } from "@ai-werewolf-arena/game-contract/facts/scholar-mentor";
import { readTimeConsortChoiceFact } from "@ai-werewolf-arena/game-contract/facts/time-wolf-consort";
import { readTimeConsortSkipFact } from "@ai-werewolf-arena/game-contract/facts/time-wolf-consort";
import { readWolfSorcererExchangeFact } from "@ai-werewolf-arena/game-contract/facts/wolf-sorcerer";
import { readWolfSorcererSkipFact } from "@ai-werewolf-arena/game-contract/facts/wolf-sorcerer";
import { readNightmareOwnFearFact } from "@ai-werewolf-arena/game-contract/facts/nightmare";
import { readTricksterExchangeFact } from "@ai-werewolf-arena/game-contract/facts/trickster";
import { readTricksterSkipFact } from "@ai-werewolf-arena/game-contract/facts/trickster";
import { assertMistTransportEvents } from "../../features/mist-raven/oracles/transport";
import type { MistWireExpectations } from "../../features/mist-raven/oracles/transport";
import type { MistWireState } from "../../features/mist-raven/oracles/transport";

export function assertTransportIdentity(plan: ActorTransportPlan, content: string): void {
  for (const marker of plan.requiredSystemMarkers ?? []) {
    if (!content.includes(marker)) throw new Error("fixture_system_rules_missing:" + marker);
  }
  if (plan.expectedTeammateIds === undefined) return;
  const ids = plan.expectedTeammateIds.join(", ") || (plan.locale === "en" ? "None" : "无"),
    marker =
      plan.locale === "en" ? `excluding yourself: ${ids}.` : `队友（不含你自己）的编号：${ids}。`;
  if (!content.includes(marker)) throw new Error("fixture_teammate_knowledge_mismatch");
}

const stages: Record<string, [string, string]> = {
  fox_distract: ["子狐迷惑", "Fox Cub distraction"],
  puffer_reaction: ["河豚票后反击", "Pufferfish ballot reaction"],
  fragrant_bind: ["寻香绑定", "Fragrant binding"],
  pair_inspection: ["双目标查验", "Pair inspection"],
  night_noble: ["设置夜仆", "Choose a servant"],
  secret_body: ["秘密之身保护", "Secret Body protection"],
  awakened_idiot_reveal_speech: ["活人翻牌发言", "Living role reveal speech"],
  sheriff_badge_choice: ["警徽移交选择", "Badge successor choice"],
  eclipse_swallow: ["吞噬技能", "Swallow skill"],
  radiant_shelter: ["流光庇护", "Radiant shelter"],
  alchemist_mist: ["未明之雾", "Alchemist Mist"],
  alchemist_snake: ["法老之蛇救治", "Snake healing"],
  raven_knife: ["狼鸦额外刀", "Raven extra knife"],
  scholar_mentor_choice: ["学者／导师施法", "Scholar / Mentor modifier"],
  scholar_mentor_bonus: ["强化额外行动", "Enhanced bonus action"],
  exile_pk_speech: ["放逐PK发言", "Exile PK speeches"],
  exile_pk_vote: ["放逐PK重投", "Exile PK revote"],
  order_prince_choice: ["定序王子选择", "Order Prince choice"],
  order_prince_speech: ["定序王子发言", "Order Prince speech"],
  order_prince_revote: ["定序重投", "Restarted exile vote"],
  trickster_exchange: ["诡术师交换", "Trickster exchange"],
  time_consort_lock: ["蚀时狼妃封锁", "Time-Wolf Consort lock"],
  wolf_sorcerer_exchange: ["狼术师交换", "Wolf Sorcerer exchange"],
  magician_exchange: ["魔术师交换", "Magician exchange"],
  pure_white_girl: ["纯白之女查验", "Pure White Girl inspection"],
  wolf_witch: ["狼巫查验", "Wolf Witch inspection"],
  demon_hunter: ["猎魔人选择", "Demon Hunter choice"],
  ghost_bride_groom: ["鬼魂新娘选择新郎", "Ghost Bride chooses Groom"],
  ghost_bride_chat: ["情侣私聊", "Partner chat"],
  ghost_bride_witness: ["共同选择证婚人", "Joint Witness choice"],
  ghost_bride_knife: ["婚礼继承夜刀", "Inherited wedding knife"],
  lonely_girl: ["孤独少女首夜崇拜", "Lonely Girl initial admiration"],
  wild_child: ["野孩子首夜选榜样", "Wild Child initial model choice"],
  thief: ["盗贼首次身份选择", "Thief initial identity choice"],
  shapeshifter: ["千面人首次身份必选", "Many-Faced One mandatory initial choice"],
  wall_notes: ["匿名墙纸条", "Anonymous wall note"],
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
  debate_challenge: ["杠精开杠选择", "Debater challenge choice"],
  debate_speech: ["双方开杠发言", "Both debate statements"],
  debate_ballot: ["匿名开杠表决", "Sealed debate ballot"],
  cupid: ["丘比特连接情侣", "Cupid lover selection"],
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
  silence_elder: ["长老禁言选择", "Elder silence choice"],
  silence_gesture: ["禁言动作表达", "Silenced gesture"],
  silence_translation: ["动作翻译", "Gesture interpretation"],
  crow_curse: ["乌鸦诅咒", "Crow curse"],
  nightmare_fear: ["噩梦之影恐惧", "Nightmare fear"],
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
  if (
    ["night_noble", "awakened_idiot"].includes(plan.role) &&
    /night_spent|noble_contract_closed|secret_body_blocked|noble_body_/.test(content)
  )
    throw Error("fixture_noble_actual_state_exposed");
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
  if (turn.radiantBorrow) {
    const { id, state } = turn.radiantBorrow;
    const bound =
      plan.locale === "en"
        ? `This turn executes only the engine-bound ability ${id}; do not add an ability ID to tool arguments.`
        : `本轮只执行引擎指定的能力 ${id}；不要在工具参数中增加能力编号。`;
    const boundLines = content.match(
      plan.locale === "en"
        ? /This turn executes only the engine-bound ability [^;]+; do not add an ability ID to tool arguments\./g
        : /本轮只执行引擎指定的能力 [^；]+；不要在工具参数中增加能力编号。/g,
    );
    if (boundLines?.length !== 1 || boundLines[0] !== bound)
      throw Error("fixture_radiant_bound_mismatch");
    const prefix = plan.locale === "en" ? `Ability ${id}:` : `能力 ${id}：`;
    const segments = content.split(prefix);
    if (segments.length !== 2) throw Error("fixture_radiant_summary_missing");
    const json = segments[1]!.split(
      plan.locale === "en" ? "your resources and records=" : "本人资源与记录=",
    )[1];
    if (!json) throw Error("fixture_radiant_state_missing");
    let actual: unknown;
    for (let end = 1; end <= json.length; end++) {
      if (json[end - 1] !== "}") continue;
      try {
        actual = JSON.parse(json.slice(0, end));
        break;
      } catch {
        /* nested object is incomplete */
      }
    }

    if (!isDeepStrictEqual(actual, state)) throw Error("fixture_radiant_borrow_state_mismatch");
  }
  for (const marker of turn.requiredPromptMarkers ?? [])
    if (!content.includes(marker)) throw new Error("fixture_required_turn_marker_missing");
  for (const marker of turn.forbiddenPromptMarkers ?? [])
    if (content.includes(marker)) throw new Error("fixture_premature_marker_exposed");
  if (plan.mistWire) {
    const hints: Record<string, [string, string]> = {
      alchemist_mist: ["cast_mist", "target_ids"],
      alchemist_snake: ["use_snake", "target_id"],
      raven_knife: ["raven_knife", "target_id"],
    };
    const hint = hints[turn.stage];
    if (hint && (!content.includes(hint[0]) || !content.includes(`"${hint[1]}"`)))
      throw new Error("fixture_mist_action_hint_missing");
  }
  if (turn.currentTeammateIds !== undefined) {
    const ids = turn.currentTeammateIds.join(", ") || (plan.locale === "en" ? "None" : "无");
    const marker =
      plan.locale === "en"
        ? `Wolf teammate identities revealed for this turn, excluding yourself: ${ids}.`
        : `本轮规则告知你的狼人队友编号（不含本人）：${ids}。`;
    if (!content.includes(marker)) throw new Error("fixture_current_teammate_knowledge_mismatch");
  }
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
  expected?: MistWireExpectations,
  state?: MistWireState,
) {
  assertMistTransportEvents(role, actorId, events, expected, state);
  for (const [, type, payload] of events) {
    if ((ANIMAL_DREAM_EVENT_TYPES as readonly string[]).includes(type)) {
      const f = readAnimalDreamFact(type, payload);
      if (
        !f ||
        ![
          "animal_cat_revealed",
          "animal_puffer_revealed",
          "animal_fox_chosen",
          "animal_knife_notified",
          "animal_beauty_notified",
          "animal_puffer_decided",
        ].includes(type)
      )
        throw Error("fixture_animal_god_fact_exposed");
      if (!type.endsWith("_revealed")) {
        const expectedRole =
          type === "animal_fox_chosen"
            ? "fox_cub"
            : type === "animal_puffer_decided"
              ? "pufferfish"
              : type === "animal_beauty_notified"
                ? "wolf_beauty"
                : null;
        if (
          payload.actorId !== actorId ||
          (expectedRole && role !== expectedRole) ||
          (type === "animal_knife_notified" && !["wolf", "wolf_beauty"].includes(role))
        )
          throw Error("fixture_animal_owner_fact_exposed");
      }
      if (state?.currentDay !== undefined && f.payload.day > state.currentDay)
        throw Error("fixture_animal_future_fact_exposed");
    }

    if (
      type.startsWith("noble_body_") ||
      ["noble_contract_closed", "secret_body_blocked"].includes(type)
    )
      throw Error("fixture_noble_god_fact_exposed");
    if (
      [
        "noble_servant_chosen",
        "noble_night_notified",
        "secret_body_chosen",
        "secret_body_night_notified",
      ].includes(type)
    ) {
      if (
        payload.actorId !== actorId ||
        role !== (type.startsWith("noble_") ? "night_noble" : "awakened_idiot") ||
        (state?.currentDay !== undefined && Number(payload.day) > state.currentDay)
      )
        throw Error("fixture_noble_owner_fact_exposed");
    }
    if ((FRAGRANT_PAIR_EVENT_TYPES as readonly string[]).includes(type)) {
      const fact = readFragrantPairFact(type, payload);
      if (
        !fact ||
        !["fragrant_pair_chosen", "fragrant_pair_inspected", "fragrant_night_notified"].includes(
          type,
        ) ||
        fact.actorId !== actorId ||
        (type === "fragrant_pair_inspected"
          ? role !== "awakened_seer"
          : role !== "fragrant_phantom") ||
        (state?.currentDay !== undefined && fact.day > state.currentDay)
      )
        throw Error("fixture_fragrant_owner_fact_exposed");
    }
    if ((RADIANT_ECLIPSE_EVENT_TYPES as readonly string[]).includes(type)) {
      const fact = readRadiantEclipseFact(type, payload);
      if (!fact || !radiantEclipseAudience(type, fact).includes(actorId))
        throw Error("fixture_radiant_private_fact_exposed");
    }
    if (type === "ability_changed" && payload.actorId !== actorId)
      throw Error("fixture_other_ability_change_exposed");
    if (type === "modifier_conflict_resolved") throw new Error("fixture_modifier_conflict_exposed");
    if (
      type === "modifier_choice_committed" &&
      (!["day_scholar", "night_mentor"].includes(role) ||
        payload.actorId !== actorId ||
        !readModifierChoiceFact(type, payload))
    )
      throw new Error("fixture_modifier_choice_exposed");
    if (
      type === "modifier_choice_skipped" &&
      (!["day_scholar", "night_mentor"].includes(role) ||
        payload.actorId !== actorId ||
        !readModifierSkipFact(type, payload))
    )
      throw new Error("fixture_modifier_skip_exposed");
    if (
      type === "modifier_bonus_resolved" &&
      (payload.actorId !== actorId || !readModifierBonusFact(type, payload))
    )
      throw new Error("fixture_modifier_bonus_exposed");
    if (
      role === "night_mentor" &&
      [
        "wolf_tactical_order",
        "wolf_discussion",
        "wolf_discussion_ended",
        "wolf_kill_vote_cast",
      ].includes(type) &&
      (type !== "wolf_kill_vote_cast" || payload.actorId !== actorId)
    )
      throw new Error("fixture_mentor_pack_information_exposed");

    if (type === "time_consort_reflected")
      throw new Error("fixture_time_consort_reflection_exposed");
    if (
      type === "time_consort_lock_committed" &&
      (role !== "time_wolf_consort" ||
        payload.actorId !== actorId ||
        !readTimeConsortChoiceFact(type, payload))
    )
      throw new Error("fixture_time_consort_private_information_exposed");
    if (
      type === "time_consort_lock_skipped" &&
      (role !== "time_wolf_consort" ||
        payload.actorId !== actorId ||
        !readTimeConsortSkipFact(type, payload))
    )
      throw new Error("fixture_time_consort_private_information_exposed");
    if (
      type === "wolf_sorcerer_exchange_committed" &&
      (role !== "wolf_sorcerer" ||
        payload.actorId !== actorId ||
        !readWolfSorcererExchangeFact(type, payload))
    )
      throw new Error("fixture_wolf_sorcerer_private_information_exposed");
    if (
      type === "wolf_sorcerer_exchange_skipped" &&
      (role !== "wolf_sorcerer" ||
        payload.actorId !== actorId ||
        !readWolfSorcererSkipFact(type, payload))
    )
      throw new Error("fixture_wolf_sorcerer_private_information_exposed");
    if (
      type === "trickster_exchange_committed" &&
      (role !== "trickster" ||
        payload.actorId !== actorId ||
        !readTricksterExchangeFact(type, payload))
    )
      throw new Error("fixture_trickster_private_information_exposed");
    if (
      type === "trickster_exchange_skipped" &&
      (role !== "trickster" || payload.actorId !== actorId || !readTricksterSkipFact(type, payload))
    )
      throw new Error("fixture_trickster_private_information_exposed");

    if (
      type === "nightmare_fear_committed" &&
      (role !== "nightmare" || !readNightmareOwnFearFact(type, payload))
    )
      throw new Error("fixture_nightmare_private_information_exposed");

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
      type === "thief_initial_deal" ||
      type === "shapeshifter_initial_deal" ||
      type === "wild_child_model_eliminated" ||
      type === "mechanical_poison_reflected" ||
      type === "merchant_trade_resolved" ||
      type === "hybrid_affiliation_resolved" ||
      type === "cupid_relation_resolved" ||
      type === "lovers_death"
    )
      throw new Error("fixture_god_information_exposed");
    if (
      [
        "lonely_girl_admired_chosen",
        "wild_child_model_chosen",
        "wild_child_transformed",
        "wild_child_pack_activated",
        "thief_identity_chosen",
        "shapeshifter_identity_chosen",
        "merchant_trade_committed",
        "merchant_trade_skipped",
        "lucky_ability_skipped",
        "hybrid_exemplar_chosen",
        "cupid_lovers_chosen",
        "lover_recognized",
      ].includes(type) &&
      payload.actorId !== actorId
    )
      throw new Error("fixture_other_private_skill_exposed");
    if (
      type === "lonely_girl_admired_chosen" &&
      (Object.keys(payload).length !== 4 || Object.hasOwn(payload, "camp"))
    )
      throw new Error("fixture_girl_god_membership_exposed");
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
      [
        "hidden_wolf",
        "gargoyle",
        "mechanical_wolf",
        "awakened_hidden_wolf",
        "eclipse_maid",
      ].includes(role) &&
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
      ![
        "wolf",
        "wolf_king",
        "white_wolf_king",
        "wolf_beauty",
        "wolf_witch",
        "evil_knight",
        "nightmare",
        "red_moon_apostle",
        "trickster",
        "time_wolf_consort",
        "wolf_sorcerer",
        "night_mentor",
        "raven_claw_wolf",
        "night_noble",
        "fragrant_phantom",
      ].includes(role)
    )
      throw new Error("fixture_wolf_information_exposed");
    if (
      role === "fragrant_phantom" &&
      [
        "wolf_tactical_order",
        "wolf_discussion",
        "wolf_discussion_ended",
        "wolf_kill_vote_cast",
      ].includes(type) &&
      (type !== "wolf_kill_vote_cast" || payload.actorId !== actorId)
    )
      throw new Error("fixture_fragrant_pack_information_exposed");
  }
}
