/**
 * 负责受限观察机器人的角色工具选择。输入为已投影的自身知识、请求候选、策略风格与原随机选择器；
 * 输出为原工具动作或无行动，不能从真实 World 补造未告知身份、库存或对手存活信息。
 * 历史去重与公开政策只影响候选偏好；生命、请求许可、目标有效性和付款仍由提交入口复验。
 * 选择顺序与随机抽取保持，返回动作不等于领域已提交；具体工具的空行动与失败语义分别保留。
 */
export const demon_hunt: ObservedToolHandler = ({ ownState, request, others, pick, style }) => {
  if (!ownState.demonHunter || request.context.day < 2) return null;
  const target = style === "conservative" ? undefined : pick(others);
  return { name: "demon_hunt", args: { target_id: target ?? null, abstain: target === undefined } };
};
export const choose_admired_player: ObservedToolHandler = ({
  knownAliveIds,
  request,
  ownState,
}) => {
  const target = knownAliveIds.find((id) => id !== request.actorId);
  return ownState.lonelyGirl?.remaining === 1 && target !== undefined
    ? { name: "choose_admired_player", args: { target_id: target } }
    : null;
};
export const choose_wild_model: ObservedToolHandler = ({ knownAliveIds, request }) => {
  const target = knownAliveIds.find((id) => id !== request.actorId);
  return target === undefined ? null : { name: "choose_wild_model", args: { target_id: target } };
};
export const choose_thief_card: ObservedToolHandler = ({ ownState, style }) => {
  const state = ownState.thief;
  if (!state || state.remaining !== 1 || !state.cards?.length) return null;
  if (style === "conservative" && !state.required) return null;
  return { name: "choose_thief_card", args: { slot: state.cards[0]!.slot } };
};
import { text } from "@ai-werewolf-arena/game-text";
import type { ObservedToolHandler } from "./context";
import { PotionType } from "@ai-werewolf-arena/game-contract";

export const write_note: ObservedToolHandler = ({ ownState, style }) =>
  ownState.wallNote?.effectiveRemaining === 1 && style !== "conservative"
    ? { name: "write_note", args: { text: "..." } }
    : null;

export const challenge: ObservedToolHandler = ({ request, ownState, style }) => {
  const target = request.context.debate_target_id;
  return style !== "conservative" && ownState.debater?.remaining === 1 && target !== undefined
    ? { name: "challenge", args: { target_id: target } }
    : null;
};
export const debate_vote: ObservedToolHandler = ({ random, style }) => ({
  name: "debate_vote",
  args: { support: style === "conservative" ? false : random.next() < 0.6 },
});

export const choose_lovers: ObservedToolHandler = ({ knownAliveIds, pick }) => {
  const first = pick(knownAliveIds),
    second = pick(knownAliveIds.filter((id) => id !== first));
  return first === undefined || second === undefined
    ? null
    : { name: "choose_lovers", args: { first_id: first, second_id: second } };
};

export const choose_exemplar: ObservedToolHandler = (context) => {
  const { others, pick } = context;
  const target = pick(others);
  return target === undefined ? null : { name: "choose_exemplar", args: { target_id: target } };
};

export const guard: ObservedToolHandler = (context) => {
  const { knownAliveIds, ownState, pick, style, allowed } = context;
  const target =
    style === "conservative"
      ? undefined
      : pick(
          knownAliveIds.filter((id) => id !== ownState.guard?.lastTarget && allowed("guard", id)),
        );
  return { name: "guard", args: { target_id: target ?? null, abstain: target === undefined } };
};

export const dream: ObservedToolHandler = (context) => {
  const { others, pick } = context;
  const target = pick(others);
  if (target !== undefined) return { name: "dream", args: { target_id: target } };
};

export const check_identity: ObservedToolHandler = (context) => {
  const { ownState, others, pick, style, bound, allowed } = context;
  if (
    (bound?.activation === "lucky" || bound?.activation === "black_market") &&
    style === "conservative"
  )
    return null;
  // 绑定实例决定本次政策；原生历史仍用于偏好排序，不补读真实身份或合并两份库存。
  const checked = ownState.seer?.history.map((entry) => entry.targetId) ?? [];
  const seer = bound?.kind === "seer_check" ? bound.state : ownState.seer;
  const permitted = others.filter(
    (id) =>
      allowed("check", id) &&
      (seer?.targetPolicy !== "awa_fresh_others_v1" ||
        !seer.history.some((row) => row.targetId === id)),
  );
  const fresh = permitted.filter((id) => !checked.includes(id));
  const target = pick(fresh.length ? fresh : permitted);
  if (target !== undefined) return { name: "check_identity", args: { target_id: target } };
  if (seer?.targetPolicy === "awa_fresh_others_v1") return null;
};

import { inspectionRepeats } from "@ai-werewolf-arena/game-contract/role-inspection-policy";

export const inspect_night_identity: ObservedToolHandler = ({
  ownState,
  others,
  teammateIds,
  pick,
  style,
}) => {
  const targets =
    ownState.roleInspection?.policy === "wolf_witch"
      ? others.filter((id) => !teammateIds.includes(id))
      : others;
  const target = style === "conservative" ? undefined : pick(targets);
  return {
    name: "inspect_night_identity",
    args: { target_id: target ?? null, abstain: target === undefined },
  };
};

export const inspect_role: ObservedToolHandler = (context) => {
  const { request, ownState, others, pick, style } = context;
  if (style === "conservative" && request.context.turn_constraints.min_valid_actions === 0)
    return null;
  const state = ownState.roleInspection,
    target = pick(
      others.filter(
        (id) =>
          (state && inspectionRepeats(state)) ||
          !state?.history.some((report) => report.targetId === id),
      ),
    );
  if (target !== undefined) return { name: "inspect_role", args: { target_id: target } };
};

export const use_potion: ObservedToolHandler = (context) => {
  const {
    observation,
    request,
    knownAliveIds,
    ownState,
    actor,
    others,
    pick,
    style,
    allowed,
    bound,
  } = context;
  // 优先使用请求绑定的药实例，再查已知原生实例；受赠药不能继承原生双药政策。
  const ability =
    bound?.kind === "potion"
      ? bound
      : observation.abilities.find((row) => row.kind === "potion" && row.source.kind === "native");
  const witch = ability?.kind === "potion" ? ability.state : ownState.witch;
  const both =
    ability?.source.kind === "native" && witch?.potionPolicy === "awa_both_native_experimental_v1";
  // 多刀候选优先，单刀字段保留原回退；这里只读本次已告知刀口，不查询夜间真实结果。
  const knife =
    request.context.wolf_targets?.find((id) => id !== actor || witch?.canSelfHeal) ??
    request.context.wolf_target;
  // 保留先救后毒的选择顺序；同夜药记录和自救政策只筛选偏好，提交入口仍复验资源。
  if (
    style !== "conservative" &&
    witch &&
    typeof knife === "number" &&
    knownAliveIds.includes(knife) &&
    witch.heal > 0 &&
    !witch.healUsedThisNight &&
    (both || !witch.poisonUsedThisNight) &&
    (knife !== actor || witch.canSelfHeal)
  ) {
    return { name: "use_potion", args: { target_id: knife, potion_type: PotionType.Heal } };
  }
  if (
    style !== "conservative" &&
    witch &&
    witch.poison > 0 &&
    request.context.modifier_poison_blocked !== true &&
    !witch.poisonUsedThisNight &&
    (both || !witch.healUsedThisNight) &&
    request.context.day > 1
  ) {
    const target = pick(others.filter((id) => allowed("poison", id)));
    if (target !== undefined)
      return {
        name: "use_potion",
        args: { target_id: target, potion_type: PotionType.Poison },
      };
  }
  // 不用药也返回具名动作，区别于 null 停止和 undefined 继续寻找工具。
  return { name: "use_potion", args: { target_id: actor, potion_type: PotionType.None } };
};

export const shoot: ObservedToolHandler = (context) => {
  const { others, pick, request } = context;
  const target = pick(
    [...(request.context.shoot_candidates ?? others)].filter((id) => id !== request.actorId),
  );
  return { name: "shoot", args: { target_id: target ?? null } };
};

export const duel: ObservedToolHandler = (context) => {
  const { ownState, others, pick, random, style } = context;
  if (style !== "active" || ownState.knight?.canDuel !== true || random.next() >= 0.5) return null;
  const target = pick(others);
  return target === undefined ? null : { name: "duel", args: { target_id: target, confirm: true } };
};

export const choose_shapeshifter_card: ObservedToolHandler = ({ ownState }) => {
  const s = ownState.shapeshifter;
  if (!s || s.remaining !== 1 || s.mustChoose !== true || !s.allowedSlots?.length || !s.cards)
    return null;
  const card = s.cards.find((c) => s.allowedSlots!.includes(c.slot));
  return card ? { name: "choose_shapeshifter_card", args: { slot: card.slot } } : null;
};

/** 只使用夜窗已告知的存活名单；翻译与目标分开选，保守风格明确不指定翻译。 */
export const silence: ObservedToolHandler = ({ request, ownState, pick, style }) => {
  const candidates = request.context.silence_candidates;
  if (!ownState.silenceElder || !candidates?.length) throw new Error("silence_observation_missing");
  const target = pick([...candidates])!;
  const translator =
    style === "conservative" ? undefined : pick(candidates.filter((id) => id !== target));
  return { name: "silence", args: { target_id: target, translator_id: translator ?? null } };
};
export const gesture: ObservedToolHandler = ({ locale }) => ({
  name: "gesture",
  args: { description: text(locale, "bot.silence.gesture") },
});
export const translateSilence: ObservedToolHandler = ({ locale, style }) => ({
  name: "translate_silence",
  args: { text: style === "conservative" ? null : text(locale, "bot.silence.translation") },
});
/** 仅消费本轮明确告知的候选及自身政策，不能从 World 推导暗夜死亡或真实身份。 */
export const curseExile: ObservedToolHandler = ({ ownState, request, style, pick }) => {
  const s = ownState.crow;
  if (!s || !request.context.crow_candidates) throw new Error("crow_observation_missing");
  const target =
    style === "conservative" && s.actionPolicy === "optional"
      ? undefined
      : pick([...request.context.crow_candidates]);
  return { name: "curse_exile", args: { target_id: target ?? null } };
};
export const fear: ObservedToolHandler = ({
  ownState,
  request,
  others,
  teammateIds,
  pick,
  style,
}) => {
  const state = ownState.nightmare;
  if (!state) throw new Error("nightmare_observed_state_missing");
  const day = request.context.day;
  const targets = others.filter(
    (id) =>
      !(state.lastDay === day - 1 && state.lastTarget === id) &&
      (!state.packReady || !teammateIds.includes(id)),
  );
  const target =
    style === "conservative" && state.fearActionPolicy === "optional" ? undefined : pick(targets);
  return { name: "fear", args: { target_id: target ?? null, abstain: target === undefined } };
};

export const swapTargets: ObservedToolHandler = ({ ownState, request, knownAliveIds, pick }) => {
  const state = ownState.magician;
  if (!state) throw new Error("magician_observed_state_missing");
  const used = new Set(state.history.flatMap((row) => row.pair ?? []));
  const candidates = request.context.swap_candidates;
  const targets = knownAliveIds.filter(
    (id) => !used.has(id) && (!candidates || candidates.includes(id)),
  );
  if (request.context.day < state.firstNight || targets.length < 2)
    return { name: "swap_targets", args: { first_id: null, second_id: null, abstain: true } };
  // 依次抽第一人、排除第一人再抽第二人；保持随机流消费顺序和原空选择语义。
  const first = pick(targets),
    second = pick(targets.filter((id) => id !== first));
  if (first == null || second == null)
    return { name: "swap_targets", args: { first_id: null, second_id: null, abstain: true } };
  return { name: "swap_targets", args: { first_id: first, second_id: second, abstain: false } };
};

export const resetExileVote: ObservedToolHandler = ({ ownState }) => {
  if (!ownState.orderPrince) throw new Error("order_prince_observed_state_missing");
  return {
    name: "reset_exile_vote",
    args: { activate: !ownState.orderPrince.history.some((row) => row.activate) },
  };
};

export const swapExileTargets: ObservedToolHandler = ({
  ownState,
  request,
  knownAliveIds,
  pick,
}) => {
  const state = ownState.trickster;
  if (!state) throw new Error("trickster_observed_state_missing");
  const used = new Set(state.history.flatMap((row) => row.pair ?? []));
  const candidates = request.context.trickster_candidates;
  if (!candidates) throw new Error("trickster_candidates_missing");
  const targets = knownAliveIds.filter((id) => !used.has(id) && candidates.includes(id));
  const first = pick(targets),
    second = pick(targets.filter((id) => id !== first));
  if (first == null || second == null) throw new Error("trickster_target_invalid");
  return {
    name: "swap_exile_targets",
    args: { first_id: first, second_id: second, abstain: false },
  };
};

export const swapNightSeats: ObservedToolHandler = ({ ownState, request, knownAliveIds, pick }) => {
  const state = ownState.wolfSorcerer;
  if (!state) throw new Error("wolf_sorcerer_observed_state_missing");
  const used = new Set(state.history.flatMap((row) => row.pair ?? [])),
    candidates = request.context.sorcerer_candidates;
  const targets = knownAliveIds.filter(
    (id) => !used.has(id) && (!candidates || candidates.includes(id)),
  );
  const first = pick(targets),
    second = first == null ? null : pick(targets.filter((id) => id !== first));
  return first == null || second == null
    ? { name: "swap_night_seats", args: { first_id: null, second_id: null, abstain: true } }
    : { name: "swap_night_seats", args: { first_id: first, second_id: second, abstain: false } };
};

export const lockTime: ObservedToolHandler = ({ ownState, request, knownAliveIds, pick }) => {
  const state = ownState.timeConsort;
  if (!state || state.exhausted) throw new Error("time_consort_observed_state_invalid");
  // 只根据已知耗身和上一夜历史筛选，不读取尚未告知的触发日期。
  const previous = state.history.at(-1),
    candidates = request.context.consort_candidates;
  const targets = knownAliveIds.filter(
    (id) =>
      (previous?.day !== request.context.day - 1 || previous.targetId !== id) &&
      (!candidates || candidates.includes(id)),
  );
  const target = pick(targets);
  return target == null
    ? { name: "lock_time", args: { target_id: null, abstain: true } }
    : { name: "lock_time", args: { target_id: target, abstain: false } };
};

export const modifySkill: ObservedToolHandler = ({ ownState, request, knownAliveIds, pick }) => {
  const state = ownState.scholarMentor,
    modes = request.context.modifier_modes,
    candidates = request.context.modifier_candidates;
  if (!state || !modes || !candidates) throw new Error("scholar_mentor_observation_missing");
  const allowed = modes.filter((mode) => state.remaining[mode] === 1);
  const targets = candidates.filter((id) => knownAliveIds.includes(id) && id !== request.actorId);
  const mode = allowed[pick(allowed.map((_, i) => i)) ?? -1],
    target = pick(targets);
  if (!mode || target == null)
    return { name: "modify_skill", args: { mode: null, target_id: null } };
  return { name: "modify_skill", args: { mode, target_id: target } };
};
export const bonusAction: ObservedToolHandler = ({ request, knownAliveIds, pick }) => {
  const kind = request.context.modifier_bonus_kind,
    candidates = request.context.modifier_bonus_candidates;
  if (!kind || !candidates) throw new Error("scholar_mentor_bonus_observation_missing");
  const target = pick(candidates.filter((id) => knownAliveIds.includes(id))) ?? null;
  return { name: "bonus_action", args: { kind, target_id: target, abstain: target === null } };
};
