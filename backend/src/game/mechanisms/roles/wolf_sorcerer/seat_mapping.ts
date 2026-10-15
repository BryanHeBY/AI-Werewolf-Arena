/**
 * 负责按原座位占用交换顺序计算最终玩家目标。输入为原目标 ID、魔术师对与狼术师对；
 * 输出为 M(W(requested))，两对按原先后复制／校验，格式错误直接传播。
 * 只算 ID，不改实际座位、身份、选票或交换库存，也不授予本夜生效资格。
 */
import { types } from "node:util";
export type SeatExchangePair = readonly [number, number];
function positive(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value > 0 &&
    value < Number.MAX_SAFE_INTEGER
  );
}
function copyPair(value: SeatExchangePair | null): SeatExchangePair | null {
  if (value === null) return null;
  if (types.isProxy(value) || !Array.isArray(value))
    throw new Error("wolf_sorcerer_mapping_invalid");
  const d: Record<string, PropertyDescriptor> = Object.getOwnPropertyDescriptors(value as object);
  const a = d["0"],
    b = d["1"],
    length = d["length"];
  if (
    Reflect.ownKeys(d).length !== 3 ||
    !a ||
    !("value" in a) ||
    !b ||
    !("value" in b) ||
    !length ||
    !("value" in length) ||
    length.value !== 2 ||
    !positive(a.value) ||
    !positive(b.value) ||
    a.value === b.value
  )
    throw new Error("wolf_sorcerer_mapping_invalid");
  return [a.value, b.value];
}
function swap(id: number, pair: SeatExchangePair | null): number {
  return pair ? (id === pair[0] ? pair[1] : id === pair[1] ? pair[0] : id) : id;
}
/** 实际座位按 M 再 W 交换，占用者反查因此先应用 W 再 M，即 M(W(requested))。 */
export function resolveOrderedSeatTarget(
  requestedId: number,
  magicianPair: SeatExchangePair | null,
  sorcererPair: SeatExchangePair | null,
): number {
  if (!positive(requestedId)) throw new Error("wolf_sorcerer_mapping_invalid");
  // 校验仍先魔术师后狼术师；应用的逆序是占用者反查规则，不修改真实座位。
  const magician = copyPair(magicianPair),
    sorcerer = copyPair(sorcererPair);
  return swap(swap(requestedId, sorcerer), magician);
}
