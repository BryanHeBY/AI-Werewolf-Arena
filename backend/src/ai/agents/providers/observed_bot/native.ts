import type { ObservedToolHandler } from "./context";
import { PotionType } from "../../../../core";

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

export const inspect_role: ObservedToolHandler = (context) => {
  const { request, ownState, others, pick, style } = context;
  if (
    style === "conservative" &&
    (request.context.stage === "psychic" || request.context.stage === "mirror_girl")
  )
    return null;
  const state = ownState.roleInspection,
    target = pick(
      others.filter(
        (id) =>
          state?.policy === "psychic" || !state?.history.some((report) => report.targetId === id),
      ),
    );
  if (target !== undefined) return { name: "inspect_role", args: { target_id: target } };
};

export const use_potion: ObservedToolHandler = (context) => {
  const { request, knownAliveIds, ownState, actor, others, pick, style, allowed } = context;
  const witch = ownState.witch;
  const knife = request.context.wolf_target;
  if (
    style !== "conservative" &&
    witch &&
    typeof knife === "number" &&
    knownAliveIds.includes(knife) &&
    witch.heal > 0 &&
    (knife !== actor || witch.canSelfHeal)
  ) {
    return { name: "use_potion", args: { target_id: knife, potion_type: PotionType.Heal } };
  }
  if (style !== "conservative" && witch && witch.poison > 0 && request.context.day > 1) {
    const target = pick(others.filter((id) => allowed("poison", id)));
    if (target !== undefined)
      return {
        name: "use_potion",
        args: { target_id: target, potion_type: PotionType.Poison },
      };
  }
  return { name: "use_potion", args: { target_id: actor, potion_type: PotionType.None } };
};

export const shoot: ObservedToolHandler = (context) => {
  const { others, pick } = context;
  const target = pick(others);
  if (target !== undefined) return { name: "shoot", args: { target_id: target } };
};

export const duel: ObservedToolHandler = (context) => {
  const { ownState, others, pick, random, style } = context;
  if (style !== "active" || ownState.knight?.canDuel !== true || random.next() >= 0.5) return null;
  const target = pick(others);
  return target === undefined ? null : { name: "duel", args: { target_id: target, confirm: true } };
};
