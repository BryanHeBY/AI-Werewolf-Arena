/**
 * Owns duplicate domain-tool schema compatibility and last-reference presentation selection.
 * Inputs are original ToolSpec references and the registry's owned Map; outputs are
 * the selected original references or a named schema conflict, without validating actions.
 * Different descriptions may override when complete own-data schemas have equal structure.
 * Node Proxy detection precedes reflection; accessors, inherited parameters and non-data
 * structures remain explicitly unverified legacy overrides and are never eagerly evaluated.
 * This policy does not freeze schemas, read World/clock/RNG or claim semantic JSON Schema
 * equivalence. Runtime parsing and its first-use cache remain ActionReception's responsibility.
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

type SchemaObservation = { kind: "data"; structure: SchemaStructure } | { kind: "opaque" };

const opaque: SchemaObservation = Object.freeze({ kind: "opaque" });

/** The bounded structural reader observes descriptors, never field getters or toJSON. */
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

/** Preserve Map.set lookup before the original single name read, then select the last ref. */
export function registerToolSpecs(
  registered: Map<ToolName, ToolSpec>,
  specs: readonly ToolSpec[],
): void {
  for (const spec of specs) {
    registered.set(checkedName(registered, spec), spec);
  }
}
