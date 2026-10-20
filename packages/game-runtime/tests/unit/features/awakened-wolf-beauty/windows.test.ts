/**
 * 负责觉醒魅惑窗口与真实RequestLease的单元测试。显式网关stub只隔离调度，独立预期核N2零请求、
 * missing／期限／原错误／晚事件失败的真实付款前缀；真实Factory／Gateway／DR及协议在场景层另验。
 */
import { expect, test } from "bun:test";
import {
  Camp,
  Role,
  Phase,
  type ActionRequest,
  type ToolCall,
  type GameEvent,
} from "@ai-werewolf-arena/game-contract";
import { World } from "../../../../src/domain/world";
import { COMPONENT } from "../../../../src/domain/components/names";
import { createRoleComponent } from "../../../../src/domain/components/role";
import { createCampComponent } from "../../../../src/domain/components/camp";
import { createAliveComponent } from "../../../../src/domain/components/alive";
import { deferRequestDelivery } from "../../../../src/domain/request-delivery";
import type { TrustedNightStageRuntime } from "../../../../src/engine/night/trusted-runtime";
import {
  initializeAwakenedBeautyState,
  getAwakenedBeautyState,
} from "../../../../src/features/awakened-wolf-beauty/state";
import { awakenedCharmCurrent } from "../../../../src/features/awakened-wolf-beauty/authority";
import {
  AWAKENED_BEAUTY_PREPARE_STAGE,
  AWAKENED_CHARM_STAGE,
} from "../../../../src/features/awakened-wolf-beauty/night-stage";
function fixture(provider: (r: ActionRequest) => Promise<ToolCall | null>) {
  const world = new World();
  for (const id of [1, 2]) {
    world.createEntity();
    const role = createRoleComponent(id === 1 ? Role.AwakenedWolfBeauty : Role.Villager);
    if (id === 1) initializeAwakenedBeautyState(role);
    world.addComponent(id, COMPONENT.Role, role);
    world.addComponent(id, COMPONENT.Alive, createAliveComponent());
    world.addComponent(id, COMPONENT.Camp, createCampComponent(id === 1 ? Camp.Wolf : Camp.Good));
  }
  const clock = { day: 1, phase: Phase.Night },
    events: GameEvent[] = [];
  const ctx = {
    world,
    events,
    currentDay: () => clock.day,
    isCurrent: () => clock.phase === Phase.Night,
    getAliveByRole: () => [1],
    actionProvider: { getAction: provider },
    toolGateway: {
      validateAndSanitize: (_world: unknown, _id: unknown, call: ToolCall) => ({
        ok: true,
        sanitizedCall: call,
      }),
    },
    makeRequest: (
      actorId: number,
      allowedTools: ActionRequest["allowedTools"],
      context: Parameters<TrustedNightStageRuntime["makeRequest"]>[2],
    ) => ({
      actorId,
      allowedTools,
      phase: Phase.Night,
      context: { day: clock.day, visible_events: [], turn_constraints: {}, ...context },
    }),
  } as unknown as TrustedNightStageRuntime;
  return {
    world,
    clock,
    events,
    ctx,
    state: () => getAwakenedBeautyState(world.getComponent(1, COMPONENT.Role))!,
  };
}
test("N1付款true、N2零Provider、N3可再同目标，事实仅本人", async () => {
  const out: boolean[] = [];
  let calls = 0;
  const f = fixture(async (r) => {
    calls++;
    deferRequestDelivery(r, (paid) => out.push(paid));
    return { name: "awakened_charm", args: { target_id: 2 } };
  });
  for (const day of [1, 2, 3]) {
    f.clock.day = day;
    await AWAKENED_BEAUTY_PREPARE_STAGE.execute(f.ctx);
    await AWAKENED_CHARM_STAGE.execute(f.ctx);
  }
  expect(calls).toBe(2);
  expect(out).toEqual([true, true]);
  expect(f.state().choices).toEqual([
    { day: 1, targetId: 2 },
    { day: 3, targetId: 2 },
  ]);
  expect(f.events.map((e) => ("audience" in e ? e.audience : undefined))).toEqual([[1], [1]]);
});
for (const failure of ["missing", "late", "throw"] as const)
  test(`${failure}关闭false且不冒充null，不重开同夜窗口`, async () => {
    const original = new Error("original-provider"),
      out: boolean[] = [];
    const f = fixture(async (r) => {
      deferRequestDelivery(r, (paid) => out.push(paid));
      if (failure === "throw") throw original;
      if (failure === "late") r.deadlineAtMs = Date.now() - 1;
      return failure === "missing" ? null : { name: "awakened_charm", args: { target_id: 2 } };
    });
    await AWAKENED_BEAUTY_PREPARE_STAGE.execute(f.ctx);
    if (failure === "throw")
      await expect(AWAKENED_CHARM_STAGE.execute(f.ctx)).rejects.toBe(original);
    else await expect(AWAKENED_CHARM_STAGE.execute(f.ctx)).rejects.toThrow();
    expect(out).toEqual([false]);
    expect(f.state().choices).toEqual([]);
    expect(awakenedCharmCurrent(f.world, 1, 1)).toBe(false);
    await expect(AWAKENED_CHARM_STAGE.execute(f.ctx)).rejects.toThrow(
      "awakened_charm_window_invalid",
    );
  });
test("makeRequest异常也关闭原窗，不留下可重交库存", async () => {
  const f = fixture(async () => null),
    original = new Error("factory-original");
  await AWAKENED_BEAUTY_PREPARE_STAGE.execute(f.ctx);
  f.ctx.makeRequest = () => {
    throw original;
  };
  await expect(AWAKENED_CHARM_STAGE.execute(f.ctx)).rejects.toBe(original);
  expect(awakenedCharmCurrent(f.world, 1, 1)).toBe(false);
  expect(f.state().choices).toEqual([]);
});
test("付款true后sink错误不退款，原Provider错误不被close通知错误覆盖", async () => {
  const out: boolean[] = [],
    sink = new Error("sink-original");
  const f = fixture(async (r) => {
    deferRequestDelivery(r, (paid) => out.push(paid));
    Object.defineProperty(f.events, "push", {
      get() {
        throw sink;
      },
    });
    return { name: "awakened_charm", args: { target_id: null } };
  });
  await AWAKENED_BEAUTY_PREPARE_STAGE.execute(f.ctx);
  await expect(AWAKENED_CHARM_STAGE.execute(f.ctx)).rejects.toBe(sink);
  expect(out).toEqual([true]);
  expect(f.state().choices).toEqual([{ day: 1, targetId: null }]);
  const original = new Error("provider-original");
  const other = fixture(async (r) => {
    deferRequestDelivery(r, () => {
      throw new Error("close-late");
    });
    throw original;
  });
  await AWAKENED_BEAUTY_PREPARE_STAGE.execute(other.ctx);
  await expect(AWAKENED_CHARM_STAGE.execute(other.ctx)).rejects.toBe(original);
  expect(other.state().choices).toEqual([]);
});
