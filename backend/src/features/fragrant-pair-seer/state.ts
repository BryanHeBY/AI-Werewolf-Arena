/**
 * 负责双生／成对查验的原严格数据 schema、初始状态及接受选择后的纯数据变换。
 * 输入为未知数据或声明的 pair/history；输出为脱离副本与下一状态，拒绝政策、字段、深度和限制不变。
 * 成对 payload 形状来自中立 contract，实际 slot 契约引用这些唯一 factory/schema；
 * 本数据 owner 不写 live 状态、消费资源、控制 roster／租约或解释 checkpoint 为行动资格。
 * 未经验证的普通角色私有扩展键不经过此 Pair 专用 schema，也不因本族收口改变接受语义。
 */

import type { Pair, PairSeerState } from "@ai-werewolf-arena/game-contract";
import { snapshotPlainData } from "../../domain/plain-data";

import { FRAGRANT_PAIR_POLICY } from "@ai-werewolf-arena/game-contract/facts/fragrant-pair-seer";
export { FRAGRANT_PAIR_POLICY } from "@ai-werewolf-arena/game-contract/facts/fragrant-pair-seer";
import { positive, exact, pair } from "./owned-state-data";
export function normalizePair(v: unknown): Pair {
  const p = snapshotPlainData(v);
  if (!Array.isArray(p) || p.length !== 2 || !positive(p[0]) || !positive(p[1]) || p[0] === p[1])
    throw Error("fragrant_pair_invalid");
  return p[0] < p[1] ? [p[0], p[1]] : [p[1], p[0]];
}
export function freshPairSeerState(): PairSeerState {
  return { policy: FRAGRANT_PAIR_POLICY, history: [] };
}
/** Pair schema 保持原 Node 安全副本与精确形状，不执行输入字段访问器或 Proxy trap。 */
export function readPairSeerState(value: unknown): PairSeerState | null {
  try {
    const v = snapshotPlainData(value, new Set(), 0, 65536);
    if (
      !exact(v, ["policy", "history"]) ||
      v.policy !== FRAGRANT_PAIR_POLICY ||
      !Array.isArray(v.history)
    )
      return null;
    let last = 0;
    const seenPairs = new Map<string, boolean>();
    for (const r of v.history) {
      if (
        !exact(r, ["day", "targetIds", "containsWerewolf"]) ||
        !positive(r.day) ||
        r.day <= last ||
        !pair(r.targetIds) ||
        typeof r.containsWerewolf !== "boolean"
      )
        return null;
      const key = JSON.stringify(r.targetIds),
        previous = seenPairs.get(key);
      if (previous !== undefined && previous !== r.containsWerewolf) return null;
      seenPairs.set(key, r.containsWerewolf);
      last = r.day;
    }
    return v as unknown as PairSeerState;
  } catch {
    return null;
  }
}
export function appendPairCheck(
  value: PairSeerState,
  day: number,
  targets: unknown,
  result: boolean,
): PairSeerState {
  const state = readPairSeerState(value);
  if (
    !state ||
    !positive(day) ||
    (state.history.at(-1)?.day ?? 0) >= day ||
    typeof result !== "boolean"
  )
    throw Error("fragrant_pair_check_unavailable");
  const targetIds = normalizePair(targets);
  if (
    state.history.some(
      (r) =>
        JSON.stringify(r.targetIds) === JSON.stringify(targetIds) && r.containsWerewolf !== result,
    )
  )
    throw Error("fragrant_pair_check_result_inconsistent");
  return {
    policy: FRAGRANT_PAIR_POLICY,
    history: [...state.history, { day, targetIds, containsWerewolf: result }],
  };
}
