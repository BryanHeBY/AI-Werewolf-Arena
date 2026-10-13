/**
 * 单元测试用字面 schema／文案与 descriptor／Proxy 探针验证重复工具注册。手写预期区分兼容的末引用选择、明确数据 schema 冲突及旧 opaque 模式；内存 ActionReception 检查原首用读取、缓存和抛错，不写 World、联系模型、重建 fixture 或驱动对局。
 */
import { expect, test } from "bun:test";
import { ActionReception } from "../../../src/game/gateway/action-reception";
import { World } from "../../../src/core/domain/world";
import { Phase, type ActionRequest, type ToolName } from "@ai-werewolf-arena/game-contract";
import type { ToolSpec } from "../../../src/game/mechanisms/contracts";
import { ToolSpecRegistry } from "../../../src/game/mechanisms/registries/tool_spec_registry";
import { registerToolSpecs } from "../../../src/rulesets/tool-spec-registration";

const parameters = () => ({
  type: "object",
  properties: { text: { type: "string" } },
  required: ["text"],
  additionalProperties: false,
});
const spec = (schema: Record<string, unknown> = parameters(), hint = "first"): ToolSpec => ({
  name: "speak",
  parameters: schema,
  argHint: hint,
  userPromptHint: hint,
});
const request: ActionRequest = {
  actorId: 1,
  phase: Phase.Day,
  allowedTools: ["speak"],
  context: {
    day: 1,
    stage: "day_speech",
    visible_events: [],
    turn_constraints: { min_valid_actions: 1, max_valid_actions: 1 },
  },
};

test("different equal data specs keep the last original reference and custom bilingual prose", () => {
  const first = spec(),
    last = spec(
      {
        additionalProperties: false,
        required: ["text"],
        properties: { text: { type: "string" } },
        type: "object",
      },
      "custom raw 提示 {actor}",
    );
  const registry = new ToolSpecRegistry([first, last], []);
  expect(registry.get("speak")).toBe(last);
  expect(registry.getArgHint("speak")).toBe("custom raw 提示 {actor}");
  expect(registry.getUserPromptHint("speak", "zh-CN")).toBe("custom raw 提示 {actor}");
  expect(registry.getUserPromptHint("speak", "en")).toBe("custom raw 提示 {actor}");
  expect(Object.isFrozen(last.parameters)).toBe(false);
});

test("same original reference shares without observing parameter accessors", () => {
  let reads = 0;
  const original: ToolSpec = {
    name: "speak",
    get parameters(): Record<string, unknown> {
      reads++;
      throw new Error("same_reference_parameters_not_read");
    },
    argHint: "literal",
  };
  expect(new ToolSpecRegistry([original, original], []).get("speak")).toBe(original);
  expect(reads).toBe(0);
});

test("different data schema now rejects while preserving the already registered prefix", () => {
  // Before fixed Git's legacy last-wins selected this exact incompatible second schema.
  const first = spec(),
    incompatible = spec({ ...parameters(), required: [] }, "last");
  const registered = new Map<ToolName, ToolSpec>();
  expect(() => registerToolSpecs(registered, [first, incompatible])).toThrow(
    "tool_schema_conflict:speak",
  );
  expect(registered.get("speak")).toBe(first);
});

test("complete structure includes unknown keywords and ordered array values", () => {
  for (const [before, after] of [
    [parameters(), { ...parameters(), unrecognized_keyword: 7 }],
    [
      { ...parameters(), unrecognized_keyword: { nested: [1, 2] } },
      { ...parameters(), unrecognized_keyword: { nested: [2, 1] } },
    ],
    [
      { ...parameters(), required: ["text", "other"] },
      { ...parameters(), required: ["other", "text"] },
    ],
    [
      { ...parameters(), unrecognized_keyword: -0 },
      { ...parameters(), unrecognized_keyword: 0 },
    ],
  ] as const) {
    expect(() => new ToolSpecRegistry([spec(before), spec(after)], [])).toThrow(
      "tool_schema_conflict:speak",
    );
  }
});

test("Map.set lookup precedes each one name read, and directive iteration stays last", () => {
  const trace: string[] = [],
    registered = new Map<ToolName, ToolSpec>();
  Object.defineProperty(registered, "set", {
    get() {
      trace.push("set.lookup");
      return Map.prototype.set;
    },
  });
  const tracked = (label: string): ToolSpec => ({
    get name(): ToolName {
      trace.push(`${label}.name`);
      return "speak";
    },
    parameters: parameters(),
    argHint: label,
  });
  registerToolSpecs(registered, [tracked("first"), tracked("second")]);
  expect(trace).toEqual(["set.lookup", "first.name", "set.lookup", "second.name"]);
  trace.length = 0;
  const directives: NonNullable<ConstructorParameters<typeof ToolSpecRegistry>[1]> = [];
  Object.defineProperty(directives, Symbol.iterator, {
    value: function* () {
      trace.push("directive.iterator");
    },
  });
  new ToolSpecRegistry([tracked("first"), tracked("second")], directives);
  expect(trace).toEqual(["first.name", "second.name", "directive.iterator"]);
});

test("accessor, inherited, Proxy and non-data schemas retain unverified lazy overrides", () => {
  let reads = 0,
    traps = 0;
  const accessor: ToolSpec = {
    name: "speak",
    get parameters(): Record<string, unknown> {
      reads++;
      throw new Error("parameter_accessor_not_called");
    },
    argHint: "accessor",
  };
  const inherited = Object.assign(Object.create({ parameters: parameters() }), {
    name: "speak",
    argHint: "inherited",
  }) as ToolSpec;
  const nested = parameters();
  Object.defineProperty(nested.properties.text, "unknown", {
    enumerable: true,
    get() {
      reads++;
      throw new Error("nested_accessor_not_called");
    },
  });
  const nonEnumerable = parameters();
  Object.defineProperty(nonEnumerable, "required", { enumerable: false });
  const cycle: Record<string, unknown> = parameters();
  cycle.self = cycle;
  const proxyParameters = new Proxy(parameters(), {
    getPrototypeOf() {
      traps++;
      throw new Error("proxy_not_reflected");
    },
    ownKeys() {
      traps++;
      throw new Error("proxy_not_reflected");
    },
    getOwnPropertyDescriptor() {
      traps++;
      throw new Error("proxy_not_reflected");
    },
  });
  const proxySpec = new Proxy(spec(), {
    getOwnPropertyDescriptor() {
      traps++;
      throw new Error("proxy_spec_not_reflected");
    },
  });
  for (const last of [
    accessor,
    inherited,
    spec(nested),
    spec(nonEnumerable),
    spec(cycle),
    spec(proxyParameters),
    proxySpec,
    spec({ ...parameters(), custom: () => 1 }),
    spec({ ...parameters(), custom: 1n }),
    spec({ ...parameters(), custom: Number.NaN }),
    spec(Object.assign(Object.create({ custom: 1 }), parameters())),
  ]) {
    expect(new ToolSpecRegistry([spec(), last], []).get("speak")).toBe(last);
  }
  expect(reads).toBe(0);
  expect(traps).toBe(0);
});

test("actual preflight keeps zero constructor reads, first-use cache and later metadata reads", () => {
  let reads = 0,
    schema: Record<string, unknown> = parameters();
  const original: ToolSpec = {
    name: "speak",
    get parameters() {
      reads++;
      return schema;
    },
    argHint: "opaque",
  };
  const registry = new ToolSpecRegistry([spec(), original], []),
    reception = new ActionReception(new World("en"), undefined, registry);
  expect(reads).toBe(0);
  expect(reception.validate(request, "speak", { text: "literal" })).toMatchObject({
    ok: false,
    error: "actor_missing",
  });
  expect(reads).toBe(2);
  schema = { ...parameters(), properties: { text: { type: "number" } } };
  expect(reception.validate(request, "speak", { text: "literal" })).toMatchObject({
    ok: false,
    error: "actor_missing",
  });
  expect(reads).toBe(3);
});

test("schema first-use throws keep their identity and do not install a failed cache", () => {
  let reads = 0;
  const failure = new Error("literal_parameters_failure"),
    original: ToolSpec = {
      name: "speak",
      get parameters(): Record<string, unknown> {
        reads++;
        throw failure;
      },
      argHint: "throw",
    };
  const reception = new ActionReception(
    new World("en"),
    undefined,
    new ToolSpecRegistry([spec(), original], []),
  );
  expect(reads).toBe(0);
  for (let attempt = 0; attempt < 2; attempt++) {
    let caught: unknown;
    try {
      reception.validate(request, "speak", { text: "literal" });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBe(failure);
  }
  expect(reads).toBe(2);
});

test("all eight default duplicate groups still compile into the actual domain index", () => {
  const registry = new ToolSpecRegistry();
  for (const name of [
    "kill_vote",
    "speak_to_wolves",
    "self_destruct",
    "inspect_night_identity",
    "shoot",
    "inspect_role",
    "modify_skill",
    "bonus_action",
  ] as const) {
    expect(registry.get(name)?.name).toBe(name);
  }
});
