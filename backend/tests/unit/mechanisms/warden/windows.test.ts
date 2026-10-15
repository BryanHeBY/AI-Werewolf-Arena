/**
 * 负责典狱长并发秘密窗口和真实RequestLease交付的字面测试。此层使用显式网关stub隔离调度，
 * 真实工具规则／板子整局另测；两个Provider请求必须独立，不能用另一方的deadline关闭已付前缀。
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
import { initializeWardenState, getWardenState } from "../../../../src/features/warden/state";
import { WARDEN_NIGHT_STAGE } from "../../../../src/features/warden/night-stage";
import { deferRequestDelivery } from "../../../../src/domain/request-delivery";
import type { TrustedNightStageRuntime } from "../../../../src/engine/night/trusted-runtime";
function fixture() {
  const world = new World();
  for (const id of [1, 2, 3]) {
    world.createEntity();
    const role = createRoleComponent(id === 1 ? Role.Warden : Role.Villager);
    if (id === 1) initializeWardenState(role);
    world.addComponent(id, COMPONENT.Role, role);
    world.addComponent(id, COMPONENT.Camp, createCampComponent(id === 1 ? Camp.Wolf : Camp.Good));
    world.addComponent(id, COMPONENT.Alive, createAliveComponent());
  }
  const events: GameEvent[] = [];
  return { world, events };
}
function run(
  f: ReturnType<typeof fixture>,
  provider: (r: ActionRequest) => Promise<ToolCall | null>,
  day = 2,
) {
  return WARDEN_NIGHT_STAGE.execute({
    world: f.world,
    events: f.events,
    state: {},
    currentDay: () => day,
    isCurrent: () => true,
    getAliveByRole: () => [1],
    actionProvider: { getAction: provider },
    toolGateway: {
      validateAndSanitize: (_w: unknown, _id: unknown, call: ToolCall) => ({
        ok: true,
        sanitizedCall: call,
      }),
    },
    makeRequest: (
      actorId: number,
      allowedTools: ActionRequest["allowedTools"],
      context: import("@ai-werewolf-arena/game-contract").ActionRequestExtras & {
        stage: ActionRequest["context"]["stage"];
      },
    ) => ({
      actorId,
      allowedTools,
      phase: Phase.Night,
      context: { day, visible_events: [], turn_constraints: {}, ...context },
    }),
  } as unknown as TrustedNightStageRuntime);
}
test("N1完全不请求pair", async () => {
  const f = fixture();
  let n = 0;
  await run(
    f,
    async () => {
      n++;
      return null;
    },
    1,
  );
  expect(n).toBe(0);
  expect(f.events).toEqual([]);
});
test("两人先建请求并独立秘密提交；God事实次序固定且不向另一方公布回执", async () => {
  const f = fixture(),
    seen: ActionRequest[] = [],
    paid: Array<[number, boolean]> = [];
  let release!: () => void;
  const barrier = new Promise<void>((resolve) => {
    release = resolve;
  });
  await run(f, async (r) => {
    seen.push(r);
    deferRequestDelivery(r, (ok) => paid.push([r.actorId, ok]));
    if (r.context.stage === "warden_pair")
      return { name: "warden_pair", args: { target_ids: [2, 3] } };
    if (r.actorId === 2) {
      await barrier;
      return { name: "warden_decide", args: { choice: "trade" } };
    }
    release();
    return { name: "warden_decide", args: { choice: "betray" } };
  });
  expect(seen.map((r) => [r.actorId, r.context.stage])).toEqual([
    [1, "warden_pair"],
    [2, "warden_decide"],
    [3, "warden_decide"],
  ]);
  expect(seen[1]!.context.warden_partner_id).toBe(3);
  expect(seen[2]!.context.warden_partner_id).toBe(2);
  expect(Object.keys(seen[1]!.context).filter((k) => k.startsWith("warden_"))).toEqual([
    "warden_partner_id",
  ]);
  expect(paid.every(([, ok]) => ok)).toBe(true);
  expect(f.events.map((e) => e.type)).toEqual([
    "warden_pair_chosen",
    "warden_partner_notified",
    "warden_partner_notified",
    "warden_decision",
    "warden_decision",
    "warden_resolved",
  ]);
  for (const event of f.events.filter((e) => e.type === "warden_decision"))
    expect(event.audience).toEqual([event.payload.actorId]);
});
for (const mode of ["missing", "expired", "throw"] as const)
  test(`一方${mode}不退款另一方实际回执`, async () => {
    const f = fixture(),
      out: Array<[number, boolean]> = [];
    const original = new Error("provider_original");
    const p = run(f, async (r) => {
      deferRequestDelivery(r, (ok) => out.push([r.actorId, ok]));
      if (r.context.stage === "warden_pair")
        return { name: "warden_pair", args: { target_ids: [2, 3] } };
      if (r.actorId === 3) {
        if (mode === "throw") throw original;
        if (mode === "expired") {
          r.deadlineAtMs = Date.now() - 1;
          return { name: "warden_decide", args: { choice: "betray" } };
        }
        return null;
      }
      return { name: "warden_decide", args: { choice: "trade" } };
    });
    if (mode === "throw") await expect(p).rejects.toThrow(original);
    else await expect(p).rejects.toThrow();
    expect(out).toContainEqual([1, true]);
    expect(out).toContainEqual([2, true]);
    expect(out).toContainEqual([3, false]);
    expect(getWardenState(f.world.getComponent(1, COMPONENT.Role))!.history).toEqual([
      { day: 2, pair: [2, 3], decisions: [{ playerId: 2, choice: "trade" }], resolved: false },
    ]);
    expect(f.events.filter((e) => e.type === "warden_decision").map((e) => e.payload)).toEqual([
      { policy: "awa_melbourne_warden_v1", day: 2, actorId: 2, choice: "trade" },
    ]);
    expect(f.events.some((e) => e.type === "warden_resolved")).toBe(false);
  });
test("首pair期限关闭false且零历史；通知错误不改写为二次false", async () => {
  const f = fixture(),
    out: boolean[] = [];
  await expect(
    run(f, async (r) => {
      deferRequestDelivery(r, (ok) => out.push(ok));
      r.deadlineAtMs = Date.now() - 1;
      return { name: "warden_pair", args: { target_ids: [2, 3] } };
    }),
  ).rejects.toThrow();
  expect(out).toEqual([false]);
  expect(getWardenState(f.world.getComponent(1, COMPONENT.Role))!.history).toEqual([]);
});

test("对方Provider原错误不被随后秘密receipt的日志sink异常覆盖", async () => {
  const f = fixture(),
    original = new Error("original_participant_error"),
    late = new Error("late_event_sink");
  await expect(
    run(f, async (r) => {
      if (r.context.stage === "warden_pair")
        return { name: "warden_pair", args: { target_ids: [2, 3] } };
      if (r.actorId === 3) {
        Object.defineProperty(f.events, "push", {
          configurable: true,
          get() {
            throw late;
          },
        });
        throw original;
      }
      return { name: "warden_decide", args: { choice: "trade" } };
    }),
  ).rejects.toThrow(original);
  expect(getWardenState(f.world.getComponent(1, COMPONENT.Role))!.history[0]!.decisions).toEqual([
    { playerId: 2, choice: "trade" },
  ]);
});
