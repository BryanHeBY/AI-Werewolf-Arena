/**
 * 负责发言、警长选择、放逐投票和警徽继承的观察策略；输入为请求公开候选、可见事件及自己的查验知识。
 * 输出为原具名工具动作；投票把已告知查验作偏好，不查询真实阵营、未公布死亡或引擎判胜。
 * 候选、恋人限制和已知队友只用于本次筛选，阶段、票权、实时生命与许可仍由引擎复验。
 * 固定发言文本、空选择和原随机读取保留；本叶不发布事件或修改投票／警徽状态。
 */
import type { ObservedToolHandler } from "./context";
import { readSeerInspectionResult } from "@ai-werewolf-arena/replay-contract";

export const speak: ObservedToolHandler = (context) => {
  const { request, actor } = context;
  return {
    name: "speak",
    args: { text: `Seat ${actor}, day ${request.context.day}: consider the public evidence.` },
  };
};

export const choose_direction: ObservedToolHandler = (context) => {
  const { random } = context;
  return {
    name: "choose_direction",
    args: { direction: random.next() < 0.5 ? "clockwise" : "counter_clockwise" },
  };
};

export const run_for_sheriff: ObservedToolHandler = (context) => {
  const { request, actor, style } = context;
  return {
    name: "run_for_sheriff",
    args: {
      run:
        request.context.stage === "sheriff_withdraw" || style === "competitive" || actor % 3 === 0,
    },
  };
};

export const vote_for_sheriff: ObservedToolHandler = (context) => {
  const { request, actor, pick } = context;
  const target = pick(request.context.sheriff_candidates?.filter((id) => id !== actor) ?? []);
  return {
    name: "vote_for_sheriff",
    args: { target_id: target ?? null, abstain: target === undefined },
  };
};

export const vote: ObservedToolHandler = (context) => {
  const { observation, request, ownState, teammateIds, others, pick } = context;
  const revealed = request.context.visible_events
    .filter((event) => event.type === "idiot_revealed")
    .map((event) => event.payload.targetId);
  // 能力查验历史优先，只有该链为空值才回退自身预言家历史；空数组不触发回退。
  const histories =
    observation.abilities
      ?.filter((ability) => ability.kind === "seer_check")
      .flatMap((ability) => ability.state.history) ??
    ownState.seer?.history ??
    [];
  // 这些是本人查验记录及可见查验报告形成的优先怀疑名单，不是实时真实阵营的查询。
  const seenWolves = histories.filter((entry) => entry.isWerewolf).map((entry) => entry.targetId);
  for (const event of request.context.visible_events) {
    if (event.type !== "seer_checked") continue;
    const result = readSeerInspectionResult(event.payload);
    if (
      result?.kind === "camp" &&
      result.camp === "wolf" &&
      typeof event.payload.targetId === "number"
    )
      seenWolves.push(event.payload.targetId);
  }
  // 保留恋人不可投、已翻牌白痴、已知队友和显式放逐名单的筛选顺序；未知死亡不补读。
  const candidates = others.filter(
    (id) =>
      !(ownState.lover?.mayNotVotePartner && ownState.lover.partnerId === id) &&
      !revealed.includes(id) &&
      !teammateIds.includes(id) &&
      (request.context.exile_candidates === undefined ||
        request.context.exile_candidates.includes(id)),
  );
  const known = candidates.filter((id) => seenWolves.includes(id));
  const target = pick(known.length ? known : candidates);
  return { name: "vote", args: { target_id: target ?? null, abstain: target === undefined } };
};

/** 警徽候选与已公布存活相交；这里只给继承偏好，不执行警徽转移或重新验证死亡。 */
export const choose_badge_successor: ObservedToolHandler = ({ request, knownAliveIds, pick }) => {
  const target = pick(
    request.context.badge_candidates?.filter((id) => knownAliveIds.includes(id)) ?? [],
  );
  return { name: "choose_badge_successor", args: { target_id: target ?? null } };
};
