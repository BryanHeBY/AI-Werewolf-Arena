/**
 * 负责重复领域工具 schema 的结构兼容与最后原引用的展示选择。输入为原 ToolSpec 引用与注册表拥有的 Map，
 * 输出为选中的原规格或具名 schema 冲突，不校验玩家动作或授予调用权限。
 * 完整自有数据 schema 的结构相同才允许不同说明覆盖；Proxy 先于反射识别。
 * 访问器、继承 parameters 与非数据结构沿原不透明覆盖政策，不主动读取 getter。
 * 不冻结 schema、不读 World／时钟／RNG，也不宣称 JSON Schema 语义等价；运行解析与首次缓存仍归 ActionReception。
 */
import { types } from "node:util";
import type { ToolName } from "@ai-werewolf-arena/game-contract";
import type { ToolSpec } from "../game/mechanisms/contracts";

export const TOOL_SCHEMA_CONFLICT = "tool_schema_conflict";

type SchemaStructure =
  | null
  | boolean
  | string
  | number
  | { kind: "object" | "array"; entries: [string, SchemaStructure][] };

// data 才参与完整结构比较；opaque 是原兼容接受面，不表示已验证安全或等价。
type SchemaObservation = { kind: "data"; structure: SchemaStructure } | { kind: "opaque" };

const opaque: SchemaObservation = Object.freeze({ kind: "opaque" });

/** 有界结构读取只观察描述符，不调用字段 getter 或 toJSON；超限／循环返回不透明，不自行拒绝整个覆盖。 */
function observeStructure(
  value: unknown,
  ancestors: Set<object>,
  budget: { remaining: number },
  depth: number,
): SchemaObservation {
  if (--budget.remaining < 0 || depth > 128) return opaque;
  if (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "string" ||
    (typeof value === "number" && Number.isFinite(value))
  ) {
    return { kind: "data", structure: value };
  }
  if (typeof value !== "object" || types.isProxy(value) || ancestors.has(value)) return opaque;
  const array = Array.isArray(value),
    prototype = Object.getPrototypeOf(value);
  if (array ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null)
    return opaque;
  const keys = Reflect.ownKeys(value);
  if (keys.some((key) => typeof key !== "string")) return opaque;
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const entries: [string, SchemaStructure][] = [];
  // 只跟踪当前递归路径；共享但不成环的子对象可分别观察，退出路径由 finally 保证。
  ancestors.add(value);
  try {
    for (const key of (keys as string[]).sort()) {
      const descriptor = descriptors[key];
      if (!descriptor || !("value" in descriptor)) return opaque;
      if (!descriptor.enumerable && !(array && key === "length")) return opaque;
      const child = observeStructure(descriptor.value, ancestors, budget, depth + 1);
      if (child.kind === "opaque") return opaque;
      entries.push([key, child.structure]);
    }
  } finally {
    ancestors.delete(value);
  }
  return { kind: "data", structure: { kind: array ? "array" : "object", entries } };
}

function observeParameters(spec: ToolSpec): SchemaObservation {
  if (types.isProxy(spec)) return opaque;
  const descriptor = Object.getOwnPropertyDescriptor(spec, "parameters");
  if (!descriptor || !("value" in descriptor)) return opaque;
  return observeStructure(descriptor.value, new Set(), { remaining: 65_536 }, 0);
}

function equalStructure(left: SchemaStructure, right: SchemaStructure): boolean {
  if (left === null || right === null || typeof left !== "object" || typeof right !== "object")
    return Object.is(left, right);
  return (
    left.kind === right.kind &&
    left.entries.length === right.entries.length &&
    left.entries.every(
      ([key, value], index) =>
        key === right.entries[index]![0] && equalStructure(value, right.entries[index]![1]),
    )
  );
}

function checkedName(registered: Map<ToolName, ToolSpec>, spec: ToolSpec): ToolName {
  const name = spec.name,
    previous = registered.get(name);
  if (previous !== undefined && previous !== spec) {
    const before = observeParameters(previous),
      after = observeParameters(spec);
    if (
      before.kind === "data" &&
      after.kind === "data" &&
      !equalStructure(before.structure, after.structure)
    ) {
      const suffix = typeof name === "string" ? `:${name}` : "";
      throw new Error(TOOL_SCHEMA_CONFLICT + suffix);
    }
  }
  return name;
}

/** 先取得 Map.set，再进行原单次 name 读取与兼容检查；成功选最后原引用，失败保已登记前缀。 */
export function registerToolSpecs(
  registered: Map<ToolName, ToolSpec>,
  specs: readonly ToolSpec[],
): void {
  for (const spec of specs) {
    registered.set(checkedName(registered, spec), spec);
  }
}
