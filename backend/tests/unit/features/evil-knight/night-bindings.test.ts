/**
 * 单元测试验证恶夜骑士本夜绑定的状态身份、安装失败前缀及实际夜枪保护短路。
 * 输入为真实 World／原体组件、手写同 Map 和故障 getter；原引用、读序及字面拒绝是独立预期。
 * 不提交反射、消费库存或运行整局／模型；同名旧属性注入不视为新 owner 的运行绑定。
 */
import { expect, test } from "bun:test";
import { Camp, Role } from "@ai-werewolf-arena/game-contract";
import { World } from "../../../../src/core/domain/world";
import { COMPONENT } from "../../../../src/core/domain/components/names";
import { createRoleComponent } from "../../../../src/core/domain/components/role";
import { createAliveComponent } from "../../../../src/core/domain/components/alive";
import { captureNightLife } from "../../../../src/core/domain/night_effects";
import type { NightStageState, NightStageContext } from "../../../../src/game/mechanisms/stages/night/contracts";
import type { NightPipelineResult } from "../../../../src/game/engine/phase_pipeline/night_pipeline";
import { captureEvilKnight, freshEvilKnightState } from "../../../../src/game/mechanisms/roles/evil_knight/state";
import { installEvilKnightBoard, EVIL_KNIGHT_FRAME_STAGE } from "../../../../src/game/mechanisms/roles/evil_knight/night_frame";
import {
  hasEvilKnightNightBindings,
  installEvilKnightNightBindings,
  evilKnightNightBinding,
  captureEvilKnightNightShotProtection,
} from "../../../../src/game/mechanisms/roles/evil_knight/night-bindings";

function state(): NightStageState {
  return { wolfChatOrder: [], endedWolves: new Set(), wolfVotes: {}, wolfTarget: null, seerChecks: [] };
}
function fixture() {
  const world = new World(), actorId = world.createEntity(), role = createRoleComponent(Role.EvilKnight, Camp.Wolf), life = createAliveComponent();
  (role.privateState as Record<string, unknown>).evilKnight = freshEvilKnightState();
  world.addComponent(actorId, COMPONENT.Role, role);
  world.addComponent(actorId, COMPONENT.Alive, life);
  installEvilKnightBoard(world);
  const binding = captureEvilKnight(world, captureNightLife(world, actorId)!)!;
  return { world, actorId, role, life, binding };
}

test("same original Map and binding are retained, while old properties and cloned state do not inject", () => {
  const s = state(), f = fixture(), map = new Map([[f.actorId, f.binding]]);
  Object.defineProperty(s, "evilKnightBindings", { get() { throw new Error("retired_slot_must_not_read"); } });
  expect(hasEvilKnightNightBindings(s)).toBe(false);
  expect(evilKnightNightBinding(s, f.actorId)).toBeNull();
  installEvilKnightNightBindings(s, map);
  expect(hasEvilKnightNightBindings(s)).toBe(true);
  expect(evilKnightNightBinding(s, f.actorId)).toBe(f.binding);
  const protection = captureEvilKnightNightShotProtection(s);
  expect(protection(f.actorId)).toBe(true);
  expect(evilKnightNightBinding(state(), f.actorId)).toBeNull();
  // 描述器不会因注册而被读取；普通同形副本也没有本族身份记录。
  const clone = Object.assign({}, state());
  expect(captureEvilKnightNightShotProtection(clone)(f.actorId)).toBe(false);
  map.delete(f.actorId);
  expect(protection(f.actorId)).toBe(false);
  expect(evilKnightNightBinding(s, f.actorId)).toBeNull();
  // @ts-expect-error 通用夜间状态不再携带恶夜骑士私有绑定 Map。
  const retiredStateKey: keyof NightStageState = "evilKnightBindings";
  expect(retiredStateKey as string).toBe("evilKnightBindings");
  type Completed = Extract<NightPipelineResult, { interrupted: false }>;
  // @ts-expect-error 通用结果改为保护查询，不再返回私有 Map。
  const retiredResultKey: keyof Completed = "evilKnightBindings";
  expect(retiredResultKey as string).toBe("evilKnightBindings");
});

test("captured shot query reads Map then isCurrent then policy with original receivers", () => {
  const f = fixture(), s = state(), trace: string[] = [];
  let current = false, policy = "night_shot_immune" as "night_shot_immune" | "hunter_shot_bypasses";
  const record: typeof f.binding = {
    target: f.binding.target,
    get state() { trace.push("state"); return { ...f.binding.state, get shotPolicy() { trace.push("policy"); return policy; } }; },
    isCurrent() { expect(this).toBe(record); trace.push("current"); return current; },
  };
  const map = new Map([[f.actorId, record]]), get = map.get;
  map.get = function(id) { expect(this).toBe(map); trace.push("get"); return get.call(this, id); };
  installEvilKnightNightBindings(s, map);
  const query = captureEvilKnightNightShotProtection(s);
  expect(trace).toEqual([]);
  expect(query(f.actorId)).toBe(false);
  expect(trace).toEqual(["get", "current"]);
  current = true; trace.length = 0;
  expect(query(f.actorId)).toBe(true);
  expect(trace).toEqual(["get", "current", "state", "policy"]);
  policy = "hunter_shot_bypasses";
  expect(query(f.actorId)).toBe(false);
  expect(map.get(f.actorId)).toBe(record);
  // 结果在原输出点捕获旧 Map，而不是在夜枪查询时重新抓 state 或 World。
  installEvilKnightNightBindings(s, new Map());
  expect(evilKnightNightBinding(s, f.actorId)).toBeNull();
  policy = "night_shot_immune";
  expect(query(f.actorId)).toBe(true);
});

test("frame keeps three state reads and installed bindings when immune-array assignment throws", async () => {
  const f = fixture(), s = state(), error = new Error("immune_assignment_rejected");
  let reads = 0, assigned: unknown;
  Object.defineProperty(s, "nightImmunities", { set(value) { assigned = value; throw error; } });
  const ctx = { world: f.world, get state() { reads++; return s; } } as unknown as NightStageContext;
  await expect(EVIL_KNIGHT_FRAME_STAGE.execute(ctx)).rejects.toBe(error);
  expect(reads).toBe(3);
  expect(hasEvilKnightNightBindings(s)).toBe(true);
  const binding = evilKnightNightBinding(s, f.actorId);
  expect(binding?.state).toBe(f.binding.state);
  expect(assigned).toEqual([binding]);
  await expect(EVIL_KNIGHT_FRAME_STAGE.execute(ctx)).rejects.toThrow("evil_knight_night_reentry");
  expect(reads).toBe(4);
});
