/**
 * Owns the one immutable board-parameter binding for each original World identity.
 * Inputs are complete own-data board configurations; outputs are a deeply readonly
 * execution view and detached serialization DTOs, or explicit data/revision failures.
 * Node Proxy checks precede reflection; no accessor, iterator or inherited field is
 * evaluated. Checked clones alone freeze, never callers, World, actors or handlers.
 * Equal complete inputs reuse the bound owner; a World has no parameter replacement
 * or reset command. Binding reads no World methods, clock or RNG and grants no action.
 * Safe dispatch structures retain legacy family refusals before complete shape validation.
 */
import { types } from "node:util";
import {
  boardConfigSchema,
  type BoardConfig,
  type ReadonlyBoardConfig,
} from "@ai-werewolf-arena/game-contract";
import { boardPresetViolation } from "./board-support";

const owners = new WeakMap<object, BoardParameters>();
const factoryInstances = new WeakSet<object>();
const constructionToken = Symbol("board-parameters-construction");
const dataError = "rule_parameters_not_data";

/** Validate descriptors first; structuredClone only receives already proven own data. */
function assertData(value: unknown, ancestors: Set<object>, depth: number): void {
  if (
    value === undefined ||
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value))
  )
    return;
  if (typeof value !== "object" || types.isProxy(value) || depth > 16 || ancestors.has(value))
    throw new Error(dataError);
  const array = Array.isArray(value),
    prototype = Object.getPrototypeOf(value);
  if (array ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null)
    throw new Error(dataError);
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Reflect.ownKeys(descriptors).some((key) => typeof key !== "string"))
    throw new Error(dataError);
  if (array) {
    const length = descriptors.length?.value;
    if (
      !Number.isSafeInteger(length) ||
      length < 0 ||
      Object.keys(descriptors).length !== length + 1 ||
      !Array.from({ length }, (_, index) => Object.hasOwn(descriptors, String(index))).every(
        Boolean,
      )
    )
      throw new Error(dataError);
  }
  ancestors.add(value);
  try {
    for (const [key, descriptor] of Object.entries(descriptors)) {
      if (array && key === "length") continue;
      if (!Object.hasOwn(descriptor, "value") || !descriptor.enumerable) throw new Error(dataError);
      assertData(descriptor.value, ancestors, depth + 1);
    }
  } finally {
    ancestors.delete(value);
  }
}

function freezeData(value: unknown): void {
  if (!value || typeof value !== "object") return;
  for (const descriptor of Object.values(Object.getOwnPropertyDescriptors(value))) {
    freezeData(descriptor.value);
  }
  Object.freeze(value);
}

function equalData(left: unknown, right: unknown): boolean {
  if (left === null || right === null || typeof left !== "object" || typeof right !== "object")
    return Object.is(left, right);
  if (Array.isArray(left) !== Array.isArray(right)) return false;
  const leftKeys = Object.keys(left).sort(),
    rightKeys = Object.keys(right).sort();
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every(
      (key, index) =>
        key === rightKeys[index] &&
        equalData(
          Object.getOwnPropertyDescriptor(left, key)!.value,
          Object.getOwnPropertyDescriptor(right, key)!.value,
        ),
    )
  );
}

/** The only mutable DTO view returned here is detached archival data, not runtime rules. */
export class BoardParameters {
  readonly #board: BoardConfig;

  private constructor(token: typeof constructionToken, board: BoardConfig) {
    if (token !== constructionToken) throw new Error("rule_parameters_constructor_forbidden");
    freezeData(board);
    this.#board = board;
    Object.freeze(this);
    factoryInstances.add(this);
  }

  static compile(input: unknown): BoardParameters {
    assertData(input, new Set(), 0);
    const copied = structuredClone(input);
    // This qualifies only the two structures dereferenced by the legacy dispatch.
    // It is not a normalized-board verdict or a runtime permission.
    if (
      !copied ||
      typeof copied !== "object" ||
      Array.isArray(copied) ||
      !Array.isArray(Object.getOwnPropertyDescriptor(copied, "roleSetups")?.value)
    )
      throw new Error("rule_parameters_invalid");
    const rows: unknown[] = Object.getOwnPropertyDescriptor(copied, "roleSetups")!.value;
    const conditions: unknown = Object.getOwnPropertyDescriptor(copied, "winConditions")?.value;
    if (
      (conditions !== undefined && !Array.isArray(conditions)) ||
      rows.some(
        (row) =>
          !row ||
          typeof row !== "object" ||
          Array.isArray(row) ||
          typeof Object.getOwnPropertyDescriptor(row, "role")?.value !== "string" ||
          typeof Object.getOwnPropertyDescriptor(row, "count")?.value !== "number",
      )
    )
      throw new Error("rule_parameters_invalid");
    // Read-only partial qualification preserves original family refusal priority;
    // only the subsequent strict schema result can create an owned instance.
    const violation = boardPresetViolation(copied as ReadonlyBoardConfig);
    if (violation) throw new Error(violation);
    const parsed = boardConfigSchema.safeParse(copied);
    if (!parsed.success) throw new Error("rule_parameters_invalid");
    return new BoardParameters(constructionToken, parsed.data);
  }

  get board(): ReadonlyBoardConfig {
    return this.#board;
  }

  encode(): BoardConfig {
    return structuredClone(this.#board);
  }
}
Object.freeze(BoardParameters.prototype);
Object.freeze(BoardParameters);

function isFactoryParameters(input: object): input is BoardParameters {
  return factoryInstances.has(input);
}

/** Publish once; equal data reuses the original owner without granting a recompile command. */
export function bindBoardParameters(
  worldIdentity: object,
  input: ReadonlyBoardConfig | BoardParameters,
): BoardParameters {
  const previous = owners.get(worldIdentity);
  if (previous && input === previous.board) return previous;
  if (types.isProxy(input)) throw new Error(dataError);
  const candidate = isFactoryParameters(input) ? input : BoardParameters.compile(input);
  if (previous) {
    if (!equalData(previous.board, candidate.board))
      throw new Error("rule_parameters_revision_not_supported");
    return previous;
  }
  owners.set(worldIdentity, candidate);
  return candidate;
}

/** Authoritative lookup never trusts replaceable context aliases or compiles a new source. */
export function requireBoardParameters(worldIdentity: object): BoardParameters {
  const parameters = owners.get(worldIdentity);
  if (!parameters) throw new Error("rule_parameters_not_bound");
  return parameters;
}
