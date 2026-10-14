/**
 * 单元测试验证噩梦之影状态槽的原左值、历史追加与身份编码失败前缀。
 * 输入为测试自有内存角色／生命、明确 getter 失败及原政策；预期是手写顺序和已写字段。
 * 原窗口授权仍由真实 frame 复验，不把数据槽当许可；不运行模型、传输或完整对局。
 */
import { expect, test } from "bun:test";
import type { FearActionPolicy, NightmareWolfActionPolicy } from "@ai-werewolf-arena/game-contract";
import { COMPONENT } from "../../../../src/core/domain/components/names";
import type { RoleComponent } from "../../../../src/core/domain/components/role";
import { Camp } from "../../../../src/core/domain/identity";
import type { World } from "../../../../src/core/domain/world";
import { createAliveComponent } from "../../../../src/game/observation/component-presentation";
import { NIGHTMARE_SHADOW_STATE_SLOT } from "../../../../src/game/mechanisms/roles/nightmare_shadow/state-slot";
import {
  installNightmareBoard,
  beginNightmareNight,
  commitNightmareFear,
  assertNightmareRosterCurrent,
} from "../../../../src/game/mechanisms/roles/nightmare_shadow/night_frame";

function fixture() {
  const state = NIGHTMARE_SHADOW_STATE_SLOT.create();
  const roles = new Map<number, RoleComponent>([
    [1, { role: "nightmare", privateState: { nightmareShadow: state } } as unknown as RoleComponent],
    [2, { role: "seer", privateState: {} } as RoleComponent],
  ]);
  const camps = new Map([[1, { camp: Camp.Wolf }], [2, { camp: Camp.Good }]]);
  const lives = new Map([...roles.keys()].map((id) => [id, createAliveComponent()]));
  const world = {
    entityIds: () => [...roles.keys()],
    getAliveEntityIds: () => [...lives].filter(([, life]) => life.alive).map(([id]) => id),
    getComponent: (id: number, kind: unknown) => kind === COMPONENT.Role ? roles.get(id) : kind === COMPONENT.Alive ? lives.get(id) : kind === COMPONENT.Camp ? camps.get(id) : undefined,
  } as unknown as World;
  installNightmareBoard(world);
  beginNightmareNight(world, 1);
  return { state, world };
}

test("nightmare slot initialization reads the original left side before both policy fields", () => {
  const trace: string[] = [];
  const container: Record<string, unknown> = {};
  let assigned: unknown;
  Object.defineProperty(container, "nightmareShadow", { set(value) { trace.push("assign"); assigned = value; } });
  const value = {
    get fearActionPolicy(): FearActionPolicy { trace.push("fear"); return "required_when_legal"; },
    get wolfActionPolicy(): NightmareWolfActionPolicy { trace.push("wolf"); return "no_blast_no_self_knife"; },
  };
  NIGHTMARE_SHADOW_STATE_SLOT.install(() => { trace.push("container"); return container; }, value);
  expect(trace).toEqual(["container", "fear", "wolf", "assign"]);
  expect(assigned).toEqual({ policy: "awa_nightmare_dreamer_v1", fearActionPolicy: "required_when_legal", wolfActionPolicy: "no_blast_no_self_knife", packReady: false, lastDay: null, lastTarget: null, history: [] });
  const failure = new Error("test_policy_getter_failure");
  trace.length = 0;
  const bad = { get fearActionPolicy(): FearActionPolicy { trace.push("fear"); throw failure; }, wolfActionPolicy: "standard" as const };
  expect(() => NIGHTMARE_SHADOW_STATE_SLOT.install(() => { trace.push("container"); return container; }, bad)).toThrow(failure);
  expect(trace).toEqual(["container", "fear"]);
});

test("nightmare push callee failure preserves three state writes without history or frame completion", () => {
  const { state, world } = fixture();
  const failure = new Error("test_push_lookup_failure");
  const original = Object.getOwnPropertyDescriptor(Array.prototype, "push")!;
  let caught: unknown;
  // 只在真实状态三项已写之后抛错；先前原身份检查仍使用原 push，不用生产实现生成预期。
  Object.defineProperty(Array.prototype, "push", { configurable: true, get() { if (state.packReady) throw failure; return original.value; } });
  try { commitNightmareFear(world, 1, 1, 2); } catch (error) { caught = error; }
  finally { Object.defineProperty(Array.prototype, "push", original); }
  expect(caught).toBe(failure);
  expect(state.lastDay).toBe(1);
  expect(state.lastTarget).toBe(2);
  expect(state.packReady).toBe(true);
  expect(state.history).toEqual([]);
  expect(() => assertNightmareRosterCurrent(world)).toThrow("nightmare_roster_revoked");
});

test("nightmare identity lookup failure retains appended history while the old frame checkpoint revokes", () => {
  const { state, world } = fixture();
  const failure = new Error("test_identity_lookup_failure");
  const original = Object.getOwnPropertyDescriptor(JSON, "stringify")!;
  let caught: unknown;
  // 原历史 append 成功后，才让下一身份编码失败；finally 恢复全局方法后检查真实 frame 撤权。
  Object.defineProperty(JSON, "stringify", { configurable: true, get() { if (state.history.length === 1) throw failure; return original.value; } });
  try { commitNightmareFear(world, 1, 1, 2); } catch (error) { caught = error; }
  finally { Object.defineProperty(JSON, "stringify", original); }
  expect(caught).toBe(failure);
  expect(state.lastDay).toBe(1);
  expect(state.lastTarget).toBe(2);
  expect(state.packReady).toBe(true);
  expect(state.history).toEqual([{ day: 1, targetId: 2 }]);
  expect(() => assertNightmareRosterCurrent(world)).toThrow("nightmare_roster_revoked");
});
