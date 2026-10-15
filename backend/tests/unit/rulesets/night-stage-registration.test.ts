/**
 * 单元测试以字面冲突 handler 和可观察 Map 为输入，核对声明的同 handler 共享及四种 Ghost 替换操作。getter 次数、精确冲突码、操作轨迹及带接收者引用为独立预期；旧 first-winner 政策另存前态证据。不运行模型、不虚构身份许可或从编译器生成 golden。
 */
import { expect, test } from "bun:test";
import type { NightStageHandler } from "../../../src/engine/night/contracts";
import {
  registerNightStages,
  applyGhostBrideStageRegistration,
  NIGHT_STAGE_SHARING,
  GHOST_BRIDE_STAGE_OPERATIONS,
} from "../../../src/rulesets/night-stage-registration";

test("same original handler shares an observed ID with the original ID reads and no priority or execute reads", () => {
  let idReads = 0,
    priorityReads = 0,
    executeReads = 0;
  const shared: NightStageHandler = {
    get id() {
      idReads++;
      return "shared";
    },
    get priority(): number {
      priorityReads++;
      throw new Error("unused_priority");
    },
    get execute(): NightStageHandler["execute"] {
      executeReads++;
      throw new Error("unused_execute");
    },
  };
  const registered = registerNightStages([shared, shared]);
  expect(registered.size).toBe(1);
  expect(registered.get("shared")).toBe(shared);
  expect(idReads).toBe(3);
  expect(priorityReads).toBe(0);
  expect(executeReads).toBe(0);
  expect(NIGHT_STAGE_SHARING.compatibility).toBe("same-original-handler-reference");
  expect(NIGHT_STAGE_SHARING.sources).toEqual(["role-profile", "compiler-reservation"]);
});

test("distinct same-ID objects conflict even with the same execute/priority and without reading unused duplicate fields", () => {
  const execute = async function (this: { marker: string }) {
    void this.marker;
  };
  const first = { id: "collision", priority: 10, marker: "first", execute },
    second = { id: "collision", priority: 10, marker: "second", execute };
  expect(() => registerNightStages([first, second])).toThrow(
    "night_stage_handler_conflict:collision",
  );
  let unusedReads = 0;
  const ignoredBefore: NightStageHandler = {
    id: "collision",
    get priority(): number {
      unusedReads++;
      throw new Error("unused_priority");
    },
    get execute(): NightStageHandler["execute"] {
      unusedReads++;
      throw new Error("unused_execute");
    },
  };
  expect(() => registerNightStages([first, ignoredBefore])).toThrow(
    "night_stage_handler_conflict:collision",
  );
  expect(unusedReads).toBe(0);
});

test("conflict diagnostics never coerce a foreign observed ID or stringify a handler", () => {
  let coercions = 0;
  const foreign = {
    toString() {
      coercions++;
      throw new Error("foreign_coercion");
    },
  };
  // 显式坏 JS 输入核对诊断安全；生产 ID 仍为类型化字符串。
  const first: NightStageHandler = {
      id: foreign as unknown as string,
      priority: 1,
      async execute() {},
    },
    second: NightStageHandler = {
      id: foreign as unknown as string,
      priority: 2,
      async execute() {},
    };
  expect(() => registerNightStages([first, second])).toThrow("night_stage_handler_conflict");
  expect(coercions).toBe(0);
});

test("a winner's original second ID read cannot overwrite a different registered handler", () => {
  let reads = 0;
  const original: NightStageHandler = { id: "collision", priority: 1, async execute() {} },
    unstable: NightStageHandler = {
      get id() {
        return ++reads === 1 ? "new" : "collision";
      },
      priority: 2,
      async execute() {},
    };
  expect(() => registerNightStages([original, unstable])).toThrow(
    "night_stage_handler_conflict:collision",
  );
  expect(reads).toBe(2);
});

test("declared Ghost operations preserve delete, wedding installs and ordinary-chat clone getter order", () => {
  const trace: string[] = [],
    execute = async () => {},
    chat: NightStageHandler = {
      get id() {
        trace.push("ordinary.id");
        return "wolf_discussion";
      },
      get priority() {
        trace.push("ordinary.priority");
        return 200;
      },
      execute,
    },
    knife: NightStageHandler = { id: "wolf_kill_vote", priority: 400, execute },
    weddingChat: NightStageHandler = {
      get id() {
        trace.push("wedding.chat.id");
        return "ghost_bride_chat";
      },
      priority: 150,
      execute,
    },
    weddingKnife: NightStageHandler = {
      get id() {
        trace.push("wedding.knife.id");
        return "ghost_bride_knife";
      },
      priority: 400,
      execute,
    };
  class ObservedMap extends Map<string, NightStageHandler> {
    override delete(key: string) {
      trace.push("delete:" + key);
      return super.delete(key);
    }
    override set(key: string, value: NightStageHandler) {
      trace.push("set:" + key);
      return super.set(key, value);
    }
    override get(key: string) {
      trace.push("get:" + key);
      return super.get(key);
    }
  }
  const registered = new ObservedMap();
  registered.set("wolf_discussion", chat);
  registered.set("wolf_kill_vote", knife);
  trace.length = 0;
  applyGhostBrideStageRegistration(registered, weddingChat, weddingKnife);
  expect(trace).toEqual([
    "delete:wolf_kill_vote",
    "wedding.chat.id",
    "set:ghost_bride_chat",
    "wedding.knife.id",
    "set:ghost_bride_knife",
    "get:wolf_discussion",
    "ordinary.id",
    "ordinary.id",
    "ordinary.priority",
    "set:wolf_discussion",
  ]);
  const altered = Map.prototype.get.call(registered, "wolf_discussion") as NightStageHandler;
  expect(altered).not.toBe(chat);
  expect(altered.execute).toBe(execute);
  expect(altered.priority).toBe(350);
  expect(registered.has("wolf_kill_vote")).toBe(false);
  expect(Map.prototype.get.call(registered, "ghost_bride_chat")).toBe(weddingChat);
  expect(Map.prototype.get.call(registered, "ghost_bride_knife")).toBe(weddingKnife);
  expect(GHOST_BRIDE_STAGE_OPERATIONS).toEqual([
    { kind: "remove", id: "wolf_kill_vote" },
    { kind: "install", source: "wedding-chat" },
    { kind: "install", source: "wedding-knife" },
    { kind: "reprioritize-if-present", id: "wolf_discussion", priority: 350 },
  ]);
});

test("Ghost registration does not manufacture ordinary chat when it was absent", () => {
  const weddingChat: NightStageHandler = {
      id: "ghost_bride_chat",
      priority: 150,
      async execute() {},
    },
    weddingKnife: NightStageHandler = {
      id: "ghost_bride_knife",
      priority: 400,
      async execute() {},
    },
    registered = new Map<string, NightStageHandler>();
  applyGhostBrideStageRegistration(registered, weddingChat, weddingKnife);
  expect([...registered.keys()]).toEqual(["ghost_bride_chat", "ghost_bride_knife"]);
  expect(registered.get("wolf_discussion")).toBeUndefined();
  expect(registered.get("ghost_bride_chat")).toBe(weddingChat);
  expect(registered.get("ghost_bride_knife")).toBe(weddingKnife);
});
