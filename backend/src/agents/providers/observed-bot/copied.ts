/**
 * 负责根据已告知的机械／觉醒复制状态选择工具候选；输入为玩家观察、请求日次和原选择器，输出为动作或 null。
 * 刀继承日期、所学守护历史只影响本叶偏好，不读取复制目标的真实角色或认定复制已经付款。
 * 当前技能、原体生命、模式窗口和资源仍由机制在提交处复验；工具在请求名单中不等于已获许可。
 */
import type { ObservedToolHandler } from "./context";

export const mechanical_mode: ObservedToolHandler = (context) => {
  const { request, ownState, style } = context;
  const state = ownState.mechanical;
  // 只依据已告知的继承标志和首刀日期决定候选模式；不把该布尔值当成真实刀许可。
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
  // 所学守护仅避开上一夜同目标；这里的存活列表按已公布事实形成，不查询真实生命。
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
  // 原先先抽目标再检查保守风格；即使返回 null 也保留这次非空候选的随机消费。
  const target = pick(others);
  return style === "conservative" || target === undefined
    ? null
    : { name: "mechanical_inspect", args: { target_id: target } };
};

export const mechanical_poison: ObservedToolHandler = (context) => {
  const { others, pick, style } = context;
  // 原先先抽目标再检查保守风格；即使返回 null 也保留这次非空候选的随机消费。
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

/** 本工具保留原不按风格跳过的选择；不要把其它复制工具的保守策略套到这里。 */
export const mechanical_attack: ObservedToolHandler = (context) => {
  const { others, pick } = context;
  return { name: "mechanical_attack", args: { target_id: pick(others) ?? null } };
};
