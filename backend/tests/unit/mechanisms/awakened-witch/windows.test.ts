/**
 * 负责觉醒女巫真实RequestLease交付与协作时序的字面单元测试。
 * 仅网关用显式stub隔离调度，World/生命/库存/印记/伤害均真实；整局另走真实工具网关和协议。
 * 预期由手写三轮计划给出，覆盖秘密批准并发、失败已付前缀与首写前撤权，不依赖生产策略生成答案。
 */
import { expect, test } from "bun:test";
import {
  Camp,
  Role,
  Phase,
  StatusMark,
  DeathCause,
  type ActionRequest,
  type ActionRequestExtras,
  type GameEvent,
  type ToolCall,
} from "@ai-werewolf-arena/game-contract";
import {
  AWAKENED_WITCH_ROLE_ID,
  awakenedWitchResources,
} from "@ai-werewolf-arena/game-contract/facts/awakened-witch";
import { World } from "../../../../src/domain/world";
import { COMPONENT } from "../../../../src/domain/components/names";
import { createAliveComponent } from "../../../../src/domain/components/alive";
import { createRoleComponent } from "../../../../src/domain/components/role";
import { createCampComponent } from "../../../../src/domain/components/camp";
import { createStatusMarksComponent } from "../../../../src/domain/components/status-marks";
import { deferRequestDelivery } from "../../../../src/domain/request-delivery";
import {
  initializeAwakenedWitchState,
  getAwakenedWitchState,
} from "../../../../src/features/awakened-witch/state";
import { AWAKENED_WITCH_NIGHT_STAGE } from "../../../../src/features/awakened-witch/night-stage";
import { awakenedWitchHealForState } from "../../../../src/features/awakened-witch/heal-ports";
import {
  createNightStageState,
  type TrustedNightStageRuntime,
} from "../../../../src/engine/night/trusted-runtime";
import { DamageResolutionSystem } from "../../../../src/domain/systems/damage-resolution-system";
function fixture() {
  const world = new World();
  for (let id = 1; id <= 12; id++) {
    world.createEntity();
    const role = createRoleComponent(
      id === 1 ? (AWAKENED_WITCH_ROLE_ID as Role) : id > 8 ? Role.Wolf : Role.Villager,
    );
    if (id === 1) initializeAwakenedWitchState(role);
    world.addComponent(id, COMPONENT.Role, role);
    world.addComponent(id, COMPONENT.Camp, createCampComponent(id > 8 ? Camp.Wolf : Camp.Good));
    world.addComponent(id, COMPONENT.Alive, createAliveComponent());
    world.addComponent(id, COMPONENT.StatusMarks, createStatusMarksComponent());
  }
  const events: GameEvent[] = [],
    requests: ActionRequest[] = [];
  const f = {
    world,
    events,
    requests,
    active: true,
    validate: (call: ToolCall) => call,
    ensureMarks: (id: number) => world.getComponent(id, COMPONENT.StatusMarks)!,
  };
  return f;
}
function state(f: ReturnType<typeof fixture>) {
  return getAwakenedWitchState(f.world.getComponent(1, COMPONENT.Role))!;
}
function run(
  f: ReturnType<typeof fixture>,
  provider: (r: ActionRequest) => Promise<ToolCall | null>,
  day = 1,
) {
  const night = createNightStageState();
  night.wolfTarget = 2;
  return {
    night,
    finished: AWAKENED_WITCH_NIGHT_STAGE.execute({
      world: f.world,
      events: f.events,
      state: night,
      currentDay: () => day,
      isCurrent: () => f.active,
      getAliveByRole: () => [1],
      ensureMarks: f.ensureMarks,
      actionProvider: { getAction: provider },
      toolGateway: {
        validateAndSanitize: (_w: unknown, _id: unknown, call: ToolCall) => ({
          ok: true,
          sanitizedCall: f.validate(call),
        }),
      },
      makeRequest: (
        actorId: number,
        allowedTools: ActionRequest["allowedTools"],
        extra: ActionRequestExtras & { stage: ActionRequest["context"]["stage"] },
      ) => {
        const r: ActionRequest = {
          actorId,
          allowedTools,
          phase: Phase.Night,
          context: { day, visible_events: [], turn_constraints: {}, ...extra },
        };
        f.requests.push(r);
        return r;
      },
    } as unknown as TrustedNightStageRuntime),
  };
}
function plan(r: ActionRequest, helpers = [3], approve = true): ToolCall {
  if (r.context.stage === "awakened_witch")
    return {
      name: "awakened_brew",
      args: { mode: "poison", target_id: 9, assistant_ids: helpers },
    };
  if (r.context.stage === "brew_discussion")
    return { name: "brew_discuss", args: { text: r.actorId === 3 ? "" : "  private原话 🐺\n" } };
  return { name: "brew_approve", args: { approve } };
}
test("一次真实交付产生有来源Poison，讨论仅小组、批准仅本人、结果仅God", async () => {
  const f = fixture(),
    out: Array<[string, boolean]> = [];
  const p = run(f, async (r) => {
    deferRequestDelivery(r, (ok) => out.push([r.context.stage, ok]));
    return plan(r);
  });
  await p.finished;
  expect(out).toEqual([
    ["awakened_witch", true],
    ["brew_discussion", true],
    ["brew_approval", true],
  ]);
  expect(f.events.map((e) => [e.type, "audience" in e ? e.audience : undefined])).toEqual([
    ["awakened_brew_chosen", [1]],
    ["brew_started", [3]],
    ["brew_discussion", [3]],
    ["brew_approval", [3]],
    ["brew_resolved", []],
  ]);
  const group = f.events.find((e) => e.type === "brew_started")!;
  expect(Object.keys(group.payload)).not.toContain("actorId");
  expect(f.requests.slice(1).map((r) => r.context.brew_collaboration)).toEqual([
    { ordinal: 1, targetId: 9, assistantIds: [3] },
    { ordinal: 1, targetId: 9, assistantIds: [3] },
  ]);
  expect(p.night.poisonClaims).toHaveLength(1);
  expect(p.night.poisonClaims![0]!.isCurrent!()).toBe(true);
  expect(f.world.getComponent(9, COMPONENT.StatusMarks)!.has(StatusMark.PoisonMark)).toBe(true);
  const damage = new DamageResolutionSystem().resolve(f.world, {
    poisonClaims: p.night.poisonClaims,
    intentNight: 1,
  });
  expect(damage.deaths).toEqual([9]);
  expect(damage.deathSources).toEqual({ 9: [DeathCause.Poison] });
});
test("第二轮两批准先全部冻结再并发返回，前票不进另一请求且回执发表顺序固定", async () => {
  const f = fixture();
  await run(f, async (r) => plan(r)).finished;
  let release!: () => void;
  const barrier = new Promise<void>((r) => {
      release = r;
    }),
    paid: Array<[number, boolean]> = [];
  const p = run(
    f,
    async (r) => {
      deferRequestDelivery(r, (ok) => paid.push([r.actorId, ok]));
      if (r.context.stage !== "brew_approval") return plan(r, [4, 5]);
      expect(
        f.requests.filter((x) => x.context.day === 2 && x.context.stage === "brew_approval"),
      ).toHaveLength(2);
      expect(JSON.stringify(r.context)).not.toContain("approve");
      if (r.actorId === 4) {
        await barrier;
        return { name: "brew_approve", args: { approve: true } };
      }
      release();
      return { name: "brew_approve", args: { approve: false } };
    },
    2,
  );
  await p.finished;
  expect(p.night.poisonClaims).toEqual([]);
  expect(
    f.events.filter((e) => e.type === "brew_approval" && e.payload.day === 2).map((e) => e.payload),
  ).toEqual([
    { policy: "awa_awakened_witch_v1", day: 2, ordinal: 2, actorId: 4, approve: true },
    { policy: "awa_awakened_witch_v1", day: 2, ordinal: 2, actorId: 5, approve: false },
  ]);
  expect(awakenedWitchResources(state(f))).toEqual({
    healRemaining: 1,
    brewRemaining: 1,
    usedAssistantIds: [3, 4, 5],
  });
  expect(paid.every(([, ok]) => ok)).toBe(true);
});
for (const stage of ["awakened_witch", "brew_discussion", "brew_approval"] as const)
  for (const mode of ["missing", "late", "throw"] as const)
    test(`${stage}/${mode}不补默认行动且保已付前缀`, async () => {
      const f = fixture(),
        out: Array<[string, boolean]> = [],
        original = Error("actual-provider-error");
      const p = run(f, async (r) => {
        deferRequestDelivery(r, (ok) => out.push([r.context.stage, ok]));
        if (r.context.stage === stage) {
          if (mode === "throw") throw original;
          if (mode === "late") r.deadlineAtMs = Date.now() - 1;
          else return null;
        }
        return plan(r);
      });
      if (mode === "throw") await expect(p.finished).rejects.toThrow(original);
      else await expect(p.finished).rejects.toThrow();
      expect(out.at(-1)).toEqual([stage, false]);
      expect(p.night.poisonClaims).toEqual([]);
      expect(awakenedWitchResources(state(f)).brewRemaining).toBe(
        stage === "awakened_witch" ? 3 : 2,
      );
      expect(f.events.some((e) => e.type === "brew_resolved")).toBe(false);
    });
test("一方批准失败不覆盖已付另一回执，也不发布假否决", async () => {
  const f = fixture();
  await run(f, async (r) => plan(r)).finished;
  const paid: Array<[number, boolean]> = [];
  const p = run(
    f,
    async (r) => {
      deferRequestDelivery(r, (ok) => paid.push([r.actorId, ok]));
      if (r.context.stage === "brew_approval" && r.actorId === 5) return null;
      return plan(r, [4, 5]);
    },
    2,
  );
  await expect(p.finished).rejects.toThrow();
  expect(paid).toContainEqual([4, true]);
  expect(paid).toContainEqual([5, false]);
  const row = state(f).nights[1]!;
  if (row.mode !== "poison") throw Error("literal-poison-row-required");
  expect(row.outcome).toBe("building");
  expect(row.approvals).toEqual([{ actorId: 4, approve: true }]);
  expect(p.night.poisonClaims).toEqual([]);
  expect(
    f.events
      .filter((e) => e.type === "brew_approval" && e.payload.day === 2)
      .map((e) => ("audience" in e ? e.audience : undefined)),
  ).toEqual([[4]]);
});
test("已付款完成通知抛错只记一次true，后续清理不二次false或撤销库存", async () => {
  const f = fixture(),
    out: boolean[] = [],
    sentinel = Error("completion-error");
  const p = run(f, async (r) => {
    deferRequestDelivery(r, (ok) => {
      out.push(ok);
      throw sentinel;
    });
    return plan(r);
  });
  await expect(p.finished).rejects.toThrow(sentinel);
  expect(out).toEqual([true]);
  expect(awakenedWitchResources(state(f)).brewRemaining).toBe(2);
});
test("准备解药marks时原生命被换，最终复验零消耗且无Heal印记", async () => {
  const f = fixture();
  const original = f.ensureMarks;
  f.ensureMarks = (id) => {
    f.world.addComponent(1, COMPONENT.Alive, createAliveComponent());
    return original(id);
  };
  const p = run(f, async () => ({
    name: "awakened_brew",
    args: { mode: "heal", target_id: 2, assistant_ids: [] },
  }));
  await expect(p.finished).rejects.toThrow();
  expect(state(f).nights).toEqual([]);
  expect(f.world.getComponent(2, COMPONENT.StatusMarks)!.has(StatusMark.HealMark)).toBe(false);
});
test("Poison最终sink getter撤权不能生成已完成毒，保留全同意但building的真实历史", async () => {
  const f = fixture();
  const p = run(f, async (r) => {
    if (r.context.stage === "brew_approval")
      Object.defineProperty(p.night.poisonClaims!, "push", {
        get() {
          f.active = false;
          return Array.prototype.push;
        },
      });
    return plan(r);
  });
  await expect(p.finished).rejects.toThrow();
  const row = state(f).nights[0]!;
  if (row.mode !== "poison") throw Error("literal-poison-row-required");
  expect(row.approvals).toEqual([{ actorId: 3, approve: true }]);
  expect(row.outcome).toBe("building");
  expect(f.world.getComponent(9, COMPONENT.StatusMarks)!.has(StatusMark.PoisonMark)).toBe(false);
});
for (const mode of ["plain", "guard", "poison", "new-life"] as const)
  test(`普通解药${mode}按真实伤害owner结算`, async () => {
    const f = fixture(),
      marks = f.world.getComponent(2, COMPONENT.StatusMarks)!;
    marks.add(StatusMark.WolfKillMark);
    if (mode === "guard") marks.add(StatusMark.GuardMark);
    if (mode === "poison") marks.add(StatusMark.PoisonMark);
    const p = run(f, async () => ({
      name: "awakened_brew",
      args: { mode: "heal", target_id: 2, assistant_ids: [] },
    }));
    await p.finished;
    if (mode === "new-life") f.world.addComponent(2, COMPONENT.Alive, createAliveComponent());
    const damage = new DamageResolutionSystem().resolve(f.world, {
      healClaims: awakenedWitchHealForState(p.night),
    });
    expect(damage.deaths).toEqual(mode === "plain" ? [] : [2]);
    if (mode !== "plain")
      expect(damage.deathSources[2]).toEqual(
        mode === "poison" ? [DeathCause.Poison] : [DeathCause.WolfKill],
      );
  });
