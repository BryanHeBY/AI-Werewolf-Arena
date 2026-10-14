/**
 * 单元测试验证寻香魅影／猎魔人槽的原数据安装、编码拒绝及付款后失败前缀。
 * 输入是自有普通角色、原 creator、同数组槽与受控 getter／setter；字面读序、原引用和同一错误为独立预期。
 * 两家族的 World／lease／stock 授权不由本测试模拟，数据 writer 类型也不是许可屏障。
 * 全局 JSON 探针在 finally 恢复；不写档案、不推进对局或调用模型，已有 authority 案例另外验证实际集成。
 */
import { expect, test } from "bun:test";
import { Role, Camp } from "@ai-werewolf-arena/game-contract";
import { createRoleComponent } from "../../../src/core/domain/components/role";
import {
  freshFragrantState,
  installFragrantStateSlot,
  commitFragrantStateSlot,
  commitKnownWolf,
  type FragrantState,
} from "../../../src/game/mechanisms/roles/fragrant_pair_seer/fragrant-state-slot";
import {
  freshDemonHunterState,
  installDemonHunterStateSlot,
  captureDemonHunterStateSlot,
  appendDemonHunterChoiceData,
} from "../../../src/game/mechanisms/roles/demon_hunter/state-slot";

test("both data installers read the original left-hand container and keep exact creator fields", () => {
  const trace: string[] = [],
    phantom = createRoleComponent(Role.FragrantPhantom, Camp.Wolf),
    hunter = createRoleComponent(Role.DemonHunter, Camp.Good);
  let fragrant: FragrantState | undefined,
    demon: ReturnType<typeof freshDemonHunterState> | undefined;
  const fragrantContainer = { set fragrant(value: FragrantState) { trace.push("fragrant-write"); fragrant = value; } },
    demonContainer = { set demonHunter(value: ReturnType<typeof freshDemonHunterState>) { trace.push("demon-write"); demon = value; } };
  Object.defineProperty(phantom, "privateState", { get() { trace.push("fragrant-container"); return fragrantContainer; } });
  Object.defineProperty(hunter, "privateState", { get() { trace.push("demon-container"); return demonContainer; } });
  installFragrantStateSlot(phantom);
  installDemonHunterStateSlot(hunter);
  expect(trace).toEqual(["fragrant-container", "fragrant-write", "demon-container", "demon-write"]);
  expect(Object.keys(fragrant!)).toEqual(["policy", "knownWolfId", "knowledgeNight", "lastChoice", "bindings", "trigger"]);
  expect(fragrant).toEqual({ policy: "awa_fragrant_pair_seer_v1", knownWolfId: null, knowledgeNight: null, lastChoice: null, bindings: [], trigger: null });
  expect(demon).toEqual({ policy: "awa_netease_demon_hunter_v1", history: [] });
});

test("fragrant live write stays committed when its following JSON callee throws", () => {
  const raw = freshFragrantState(), slot = { fragrant: raw, fragrantJson: JSON.stringify(raw) },
    beforeJson = slot.fragrantJson, next = commitKnownWolf(raw, 10),
    failure = new Error("test_fragrant_json_failed"), descriptor = Object.getOwnPropertyDescriptor(JSON, "stringify")!;
  let caught: unknown;
  Object.defineProperty(JSON, "stringify", { configurable: true, value: () => { throw failure; } });
  try { commitFragrantStateSlot(slot, next); } catch (error) { caught = error; }
  finally { Object.defineProperty(JSON, "stringify", descriptor); }
  expect(caught).toBe(failure);
  expect(slot.fragrant).toBe(raw);
  expect(raw.knownWolfId).toBe(10);
  expect(raw.knowledgeNight).toBe(1);
  expect(slot.fragrantJson).toBe(beforeJson);
});

test("hunt data rejects failed next-history encoding before push and retains late day reads", () => {
  const state = freshDemonHunterState(), trace: string[] = [],
    slot = { state, get history() { trace.push("history"); return state.history; }, historyJson: "[]" },
    night = { get day() { trace.push("day"); return 2; } },
    failure = new Error("test_next_history_json_failed"), descriptor = Object.getOwnPropertyDescriptor(JSON, "stringify")!;
  let result: unknown;
  Object.defineProperty(JSON, "stringify", { configurable: true, value: () => { trace.push("encode"); throw failure; } });
  try { result = appendDemonHunterChoiceData(slot, night, 8); }
  finally { Object.defineProperty(JSON, "stringify", descriptor); }
  expect(result).toBeNull();
  expect(trace).toEqual(["history", "history", "history", "day", "day", "history", "encode"]);
  expect(state.history).toEqual([]);
  expect(slot.historyJson).toBe("[]");
});

test("hunt data preserves pushed original history when the following JSON field setter throws", () => {
  const state = freshDemonHunterState(), slot = captureDemonHunterStateSlot(state),
    history = state.history, failure = new Error("test_committed_history_json_set_failed"), trace: string[] = [];
  Object.defineProperty(slot, "historyJson", { get() { return "[]"; }, set() { trace.push("history-json-write"); throw failure; } });
  let caught: unknown;
  try { appendDemonHunterChoiceData(slot, { day: 2 }, 8); } catch (error) { caught = error; }
  expect(caught).toBe(failure);
  expect(slot.history).toBe(history);
  expect(history).toEqual([{ day: 2, targetId: 8 }]);
  expect(Object.isFrozen(history[0])).toBe(true);
  expect(trace).toEqual(["history-json-write"]);
});
