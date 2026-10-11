import type { ObservedToolHandler } from "./context";

export const speak_to_wolves: ObservedToolHandler = (context) => {
  const {} = context;
  return { name: "speak_to_wolves", args: { text: "End discussion", end_chat: true } };
};

export const kill_vote: ObservedToolHandler = (context) => {
  const { teammateIds, others, pick, request } = context;
  const target =
    request.context.wolf_kill_candidates !== undefined
      ? pick([...request.context.wolf_kill_candidates])
      : pick(others.filter((id) => !teammateIds.includes(id)));
  return {
    name: "kill_vote",
    args: { target_id: target ?? null, abstain: target === undefined },
  };
};

export const charm: ObservedToolHandler = (context) => {
  const { request, ownState, others, pick, style } = context;
  const previous = ownState.wolfBeauty?.history.at(-1),
    target =
      style === "conservative"
        ? undefined
        : pick(
            others.filter(
              (id) => previous?.day !== request.context.day - 1 || previous.targetId !== id,
            ),
          );
  return { name: "charm", args: { target_id: target ?? null } };
};

export const self_destruct_with_target: ObservedToolHandler = (context) => {
  const { ownState, teammateIds, others, pick, random, style } = context;
  if (style !== "active" || ownState.whiteWolfKing?.canDetonate !== true || random.next() >= 0.5)
    return null;
  const target = pick(others.filter((id) => !teammateIds.includes(id)));
  return {
    name: "self_destruct_with_target",
    args: { reason: "Active simulated strategy", confirm: true, target_id: target ?? null },
  };
};

export const self_destruct: ObservedToolHandler = (context) => {
  const { request, random, style } = context;
  return style === "active" && request.context.day > 1 && random.next() < 0.25
    ? { name: "self_destruct", args: { reason: "Active simulated strategy", confirm: true } }
    : null;
};
