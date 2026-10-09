import type { ObservedToolHandler } from "./context";

export const mechanical_mode: ObservedToolHandler = (context) => {
  const { request, ownState, style } = context;
  const state = ownState.mechanical;
  const ready =
    state?.hasInheritedKnife &&
    state.firstKnifeNight !== null &&
    state.firstKnifeNight <= request.context.day;
  return style === "conservative"
    ? null
    : { name: "mechanical_mode", args: { mode: ready ? "kill" : "skill" } };
};

export const mimic_role: ObservedToolHandler = (context) => {
  const { request, others, pick, style } = context;
  const target = style === "conservative" && request.context.day === 1 ? undefined : pick(others);
  return target === undefined ? null : { name: "mimic_role", args: { target_id: target } };
};

export const awakened_mimic: ObservedToolHandler = (context) => {
  const { request, others, pick, style } = context;
  const target = style === "conservative" && request.context.day === 1 ? undefined : pick(others);
  return target === undefined ? null : { name: "awakened_mimic", args: { target_id: target } };
};

export const awakened_poison: ObservedToolHandler = (context) => {
  const { others, pick, style } = context;
  const target = style === "conservative" ? undefined : pick(others);
  return target === undefined ? null : { name: "awakened_poison", args: { target_id: target } };
};

export const awakened_guard: ObservedToolHandler = (context) => {
  const { request, knownAliveIds, ownState, pick, style } = context;
  const skill = ownState.awakened?.learned?.skill;
  const candidates = knownAliveIds.filter(
    (id) =>
      skill?.kind !== "guard" ||
      skill.lastGuardDay !== request.context.day - 1 ||
      skill.lastTarget !== id,
  );
  return {
    name: "awakened_guard",
    args: { target_id: style === "conservative" ? null : (pick(candidates) ?? null) },
  };
};

export const awakened_attack: ObservedToolHandler = (context) => {
  const { others, pick, style } = context;
  return {
    name: "awakened_attack",
    args: { target_id: style === "conservative" ? null : (pick(others) ?? null) },
  };
};

export const mechanical_inspect: ObservedToolHandler = (context) => {
  const { others, pick, style } = context;
  const target = pick(others);
  return style === "conservative" || target === undefined
    ? null
    : { name: "mechanical_inspect", args: { target_id: target } };
};

export const mechanical_poison: ObservedToolHandler = (context) => {
  const { others, pick, style } = context;
  const target = pick(others);
  return style === "conservative" || target === undefined
    ? null
    : { name: "mechanical_poison", args: { target_id: target } };
};

export const mechanical_guard: ObservedToolHandler = (context) => {
  const { knownAliveIds, pick, style } = context;
  return {
    name: "mechanical_guard",
    args: { target_id: style === "conservative" ? null : (pick(knownAliveIds) ?? null) },
  };
};

export const mechanical_attack: ObservedToolHandler = (context) => {
  const { others, pick } = context;
  return { name: "mechanical_attack", args: { target_id: pick(others) ?? null } };
};
