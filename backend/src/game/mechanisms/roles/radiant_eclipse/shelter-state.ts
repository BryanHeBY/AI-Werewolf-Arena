/**
 * 庇护的纯状态创建、严格读取、选择与玩家投影。读取返回独立数据，不暴露 live 库存；
 * N2 起效、自选与相邻夜重复目标仍按原规则拒绝。原生安装只做 JSON 复制，不能把这里
 * 的严格 reader 前移到安装入口；借用 lease、首次死亡与已支付效果继续由夜 frame 拥有。
 */
import type { ShelterState } from "@ai-werewolf-arena/game-contract";
import { RADIANT_ECLIPSE_POLICY, record, positive } from "./state-data";

export const createShelterState = (): ShelterState => ({
  policy: RADIANT_ECLIPSE_POLICY,
  lastTarget: null,
  lastDay: null,
});

/** 严格 reader 验证原精确字段形状并返回独立副本，不复制 live 实例身份或租约。 */
export function readShelterState(value: unknown): ShelterState | undefined {
  const current = record(value, ["policy", "lastTarget", "lastDay"]);
  if (
    !current ||
    current.policy !== RADIANT_ECLIPSE_POLICY ||
    (current.lastTarget !== null && !positive(current.lastTarget)) ||
    (current.lastDay !== null && (!positive(current.lastDay) || current.lastDay < 2)) ||
    (current.lastDay === null && current.lastTarget !== null)
  )
    return;
  return {
    policy: RADIANT_ECLIPSE_POLICY,
    lastTarget: current.lastTarget as number | null,
    lastDay: current.lastDay as number | null,
  };
}

/** 选择只构造 next；实际付款、uses 和原槽写入的顺序由夜阶段分别提交。 */
export function selectShelter(
  state: Readonly<ShelterState>,
  day: number,
  targetId: unknown,
  actorId: number,
  livingIds: readonly number[],
): ShelterState {
  const current = readShelterState(state);
  if (!current || !positive(day) || day < 2 || (current.lastDay !== null && day <= current.lastDay))
    throw new Error("radiant_shelter_unavailable");
  if (
    targetId !== null &&
    (!positive(targetId) ||
      targetId === actorId ||
      !livingIds.includes(targetId) ||
      (current.lastDay === day - 1 && current.lastTarget === targetId))
  )
    throw new Error("radiant_shelter_target");
  return {
    policy: RADIANT_ECLIPSE_POLICY,
    lastTarget: targetId as number | null,
    lastDay: day,
  };
}

/** 玩家投影保持原严格读取及失败前缀；它不安装或消费状态。 */
export function projectShelterState(value: unknown) {
  const state = readShelterState(value);
  if (!state) throw new Error("radiant_shelter_state_invalid");
  return state;
}
