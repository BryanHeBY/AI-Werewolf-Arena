/**
 * 负责纯粹规范交换对并映射最终放逐目标。输入为原 nullable 目标、诡术师交换与魔术师交换；
 * 输出为原目标 ID／null 或原格式错误。交换对按 descriptor 数据检查，不执行元素访问器，Proxy 被原规则拒绝。
 * 只改最终放逐输出，同对抵消；不修改身份、座位、选票、票权或任何库存。
 */
import { types } from "node:util";
export type ExchangePair = readonly [number, number];
function normalized(pair: ExchangePair | null): [number, number] | null {
  if (pair === null) return null;
  if (types.isProxy(pair) || !Array.isArray(pair)) throw new Error("trickster_pair_invalid");
  const d = Object.getOwnPropertyDescriptors(pair as object);
  const a = d["0"]?.value,
    b = d["1"]?.value;
  if (
    Reflect.ownKeys(d).length !== 3 ||
    d.length?.value !== 2 ||
    !Number.isSafeInteger(a) ||
    !Number.isSafeInteger(b) ||
    a <= 0 ||
    b <= 0 ||
    a >= Number.MAX_SAFE_INTEGER ||
    b >= Number.MAX_SAFE_INTEGER ||
    a === b
  )
    throw new Error("trickster_pair_invalid");
  return a < b ? [a, b] : [b, a];
}
export function matchingExchangePairs(a: ExchangePair | null, b: ExchangePair | null): boolean {
  // 左对完整规范后才规范右对；任何一侧格式错误保原首错，不把null解释为相同交换。
  const x = normalized(a),
    y = normalized(b);
  return !!x && !!y && x[0] === y[0] && x[1] === y[1];
}
/** 只映射最终放逐输出；不会改身份、真实座位、选票或票权。 */
export function mapTricksterExileTarget(
  requested: number | null,
  pair: ExchangePair | null,
  magicianPair: ExchangePair | null = null,
): number | null {
  if (
    requested !== null &&
    (!Number.isSafeInteger(requested) || requested <= 0 || requested >= Number.MAX_SAFE_INTEGER)
  )
    throw new Error("trickster_target_invalid");
  const p = normalized(pair),
    cancelled = matchingExchangePairs(p, magicianPair);
  if (requested === null || !p || cancelled) return requested;
  return requested === p[0] ? p[1] : requested === p[1] ? p[0] : requested;
}
