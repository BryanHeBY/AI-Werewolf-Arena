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
  const histories =
    observation.abilities
      ?.filter((ability) => ability.kind === "seer_check")
      .flatMap((ability) => ability.state.history) ??
    ownState.seer?.history ??
    [];
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

export const choose_badge_successor: ObservedToolHandler = ({ request, knownAliveIds, pick }) => {
  const target = pick(
    request.context.badge_candidates?.filter((id) => knownAliveIds.includes(id)) ?? [],
  );
  return { name: "choose_badge_successor", args: { target_id: target ?? null } };
};
