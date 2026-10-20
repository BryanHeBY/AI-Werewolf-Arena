/**
 * 负责表单对原始 JSON 的局部编辑；输入文档、字段路径和值，输出脱离副本。
 * 只修改显式字段，保留原生扩展、认证占位符和未展示选项；不归一为运行配置或读取环境。
 */
import type { Json, JsonObject } from "@ai-werewolf-arena/workbench-contract";
export function asObject(value: unknown): JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : {};
}
export function readPath(value: JsonObject, field: string): Json | undefined {
  return field.split(".").reduce<Json | undefined>((v, key) => asObject(v)[key], value);
}
export function writePath(value: JsonObject, field: string, next: Json | undefined): JsonObject {
  const clone = structuredClone(value),
    keys = field.split(".");
  let owner = clone;
  for (const key of keys.slice(0, -1)) {
    owner[key] = { ...asObject(owner[key]) };
    owner = owner[key] as JsonObject;
  }
  const key = keys.at(-1)!;
  if (next === undefined) delete owner[key];
  else owner[key] = next;
  return clone;
}
