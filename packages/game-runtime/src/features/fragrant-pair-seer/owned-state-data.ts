/**
 * 负责寻香魅影与原生成对查验共用的 descriptor 写入、JSON 副本和原数据谓词。
 * 输入为原捕获状态／能力与已验证下一数据；输出保留原严格字段错误、正整数／pair 接受集合与定义顺序。
 * write 先完整核原字段可写／可配置，再逐字段 defineProperty；中途失败保已写前缀，不提供事务或退款。
 * 这些数据工具仅服务本族两个槽，不运行控制器、创建存储、授予租约或结算请求。
 */
import type { Pair } from "@ai-werewolf-arena/game-contract";
import { snapshotPlainData } from "../../domain/plain-data";

export function plainJson(value: unknown): string | null {
  try {
    return JSON.stringify(snapshotPlainData(value, new Set(), 0, 65536));
  } catch {
    return null;
  }
}

export function assertWritable(value: object, next: object): void {
  if (
    Object.getPrototypeOf(value) !== Object.prototype ||
    Reflect.ownKeys(value).length !== Object.keys(next).length ||
    Object.keys(next).some((key) => {
      const d = Object.getOwnPropertyDescriptor(value, key);
      return !d || !("value" in d) || !d.writable || !d.configurable;
    })
  )
    throw Error("fragrant_state_write_revoked");
}

export function write<T extends object>(value: T, next: T): void {
  assertWritable(value, next);
  for (const key of Object.keys(next) as Array<keyof T>)
    Object.defineProperty(value, key, {
      ...Object.getOwnPropertyDescriptor(value, key),
      value: next[key],
    });
}

export const positive = (v: unknown): v is number =>
  typeof v === "number" && Number.isSafeInteger(v) && v > 0 && v < Number.MAX_SAFE_INTEGER - 1;
export function exact(v: unknown, names: readonly string[]): v is Record<string, unknown> {
  return (
    !!v &&
    typeof v === "object" &&
    !Array.isArray(v) &&
    Object.keys(v).length === names.length &&
    names.every((n) => Object.hasOwn(v, n))
  );
}
export function pair(v: unknown): v is Pair {
  return Array.isArray(v) && v.length === 2 && positive(v[0]) && positive(v[1]) && v[0] < v[1];
}
