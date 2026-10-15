/**
 * 负责全天盾板自爆声明与实际死亡分离的真实DR单元场景。手写保护／无保护／晚换体及发布失败，
 * 字面预期固定原Alive、声明和实际结果；旧板原wolf_self_destruct预告语义保留，不以回放生成oracle。
 */
import { expect, test } from "bun:test";
import { Role, Camp, Phase, ActionWindow, type GameEvent } from "@ai-werewolf-arena/game-contract";
import { World } from "../../../../src/domain/world";
import { COMPONENT } from "../../../../src/domain/components/names";
import { createAliveComponent } from "../../../../src/domain/components/alive";
import { createRoleComponent } from "../../../../src/domain/components/role";
import { initializeAwakenedGuardState } from "../../../../src/features/awakened-guard/state";
import {
  beginGuardCycle,
  openGuardBoundary,
  commitGuardChoice,
} from "../../../../src/features/awakened-guard/authority";
import {
  commitSelfDestructSelection,
  protectedBlastDeathPublication,
} from "../../../../src/features/self-destruct/selection-ports";
import { DeathResolution } from "../../../../src/engine/death-resolution";
import { ToolGateway } from "../../../../src/engine/actions/tool-gateway";
import { EventRegistry } from "../../../../src/engine/events/event-registry";
import { HookRegistry } from "../../../../src/engine/hooks/registry";
import { finishAwakenedDayRoles } from "../../../../src/rulesets/awakened-day-role-plan";
function fixture(install = true, protect = false) {
  const world = new World("en"),
    events: GameEvent[] = [],
    state = { day: 1, phase: Phase.Day, gameOver: false, result: null };
  const lives = [Role.AwakenedGuard, Role.Wolf, Role.Villager].map((r, i) => {
    const id = world.createEntity(),
      role = createRoleComponent(r),
      life = createAliveComponent();
    world.addComponent(id, COMPONENT.Role, role);
    world.addComponent(id, COMPONENT.Alive, life);
    world.addComponent(id, COMPONENT.Camp, { camp: i === 1 ? Camp.Wolf : Camp.Good });
    if (i === 0 && install) initializeAwakenedGuardState(role, world);
    return life;
  });
  if (install) {
    beginGuardCycle(world, 1, 1, {}, () => true);
    commitGuardChoice(
      world,
      openGuardBoundary(world, 1, {}, "night")!,
      protect ? { mode: "protect", targetId: 2 } : { mode: "pass", targetId: null },
      () => true,
    );
  }
  const dr = new DeathResolution(
    world,
    events,
    new ToolGateway(),
    new EventRegistry(new HookRegistry([], [])),
    state,
  );
  const commit = () =>
    commitSelfDestructSelection(
      world,
      { kind: "ordinary", actorId: 2, targetId: null },
      ActionWindow.OnPerSpeechGap,
      Phase.Day,
      events,
      install ? { day: 1, current: () => true } : undefined,
    )!;
  const resolve = (blast: NonNullable<ReturnType<typeof commitSelfDestructSelection>>) =>
    dr.resolve(
      blast.deaths,
      blast.sources,
      {
        async getAction() {
          throw new Error("literal_no_dead_request");
        },
      },
      Phase.Day,
      Phase.Day,
      {},
      protectedBlastDeathPublication(blast, () => events),
    );
  return { world, events, lives, commit, resolve };
}
test.each([false, true])(
  "新板自爆先仅声明，全天盾=%s的真实DR结果分别真死／保活，旧预告不出现",
  async (protect) => {
    const f = fixture(true, protect),
      blast = f.commit();
    expect(f.lives[1]!.alive).toBe(true);
    expect(f.events.map((e) => e.type)).toEqual(["awakened_self_destruct_declared"]);
    await f.resolve(blast);
    expect(f.lives[1]!.alive).toBe(protect);
    const resolved = f.events.filter((e) => e.type === "awakened_self_destruct_resolved");
    expect(resolved).toHaveLength(1);
    expect(resolved[0]!.payload.deaths).toEqual(protect ? [] : [2]);
    expect(f.events.some((e) => e.type === "wolf_self_destruct")).toBe(false);
    expect(f.events.some((e) => e.type === "last_words_granted")).toBe(false);
    expect(f.world.activeDeathActionCount).toBe(0);
  },
);
test("旧调用仍原位发wolf_self_destruct，没有新scope/新事实，真实DR后才改原Alive", async () => {
  const f = fixture(false),
    blast = f.commit();
  expect(f.events.map((e) => e.type)).toEqual(["wolf_self_destruct"]);
  expect(f.lives[1]!.alive).toBe(true);
  await f.resolve(blast);
  expect(f.lives[1]!.alive).toBe(false);
  expect(f.events.map((e) => e.type)).toEqual(["wolf_self_destruct"]);
});
test("新声明后换成同号新体，真实原lifeMap在首生命写前拒绝，新旧身体皆不误杀", async () => {
  const f = fixture(),
    blast = f.commit(),
    replacement = createAliveComponent();
  f.world.addComponent(2, COMPONENT.Alive, replacement);
  await expect(f.resolve(blast)).rejects.toThrow("death_wave_original_life_revoked");
  expect(f.lives[1]!.alive).toBe(true);
  expect(replacement.alive).toBe(true);
  expect(f.events.map((e) => e.type)).toEqual(["awakened_self_destruct_declared"]);
});
test("实际结果sink失败保原真实死亡及已接受声明，不补正常结果或其它词", async () => {
  const f = fixture(),
    blast = f.commit(),
    push = f.events.push.bind(f.events),
    failure = new Error("literal_resolved_sink_failed");
  f.events.push = (...events) => {
    if (events.some((e) => e.type === "awakened_self_destruct_resolved")) throw failure;
    return push(...events);
  };
  expect(await f.resolve(blast).catch((e) => e)).toBe(failure);
  expect(f.lives[1]!.alive).toBe(false);
  expect(f.events.map((e) => e.type)).toEqual(["awakened_self_destruct_declared"]);
  expect(f.world.activeDeathActionCount).toBe(0);
});
test("真实result的JSON复制不能取得延期发布身份，且声明末current失败不创建任何公开前缀", () => {
  const f = fixture(),
    blast = f.commit();
  expect(protectedBlastDeathPublication(structuredClone(blast), () => f.events)).toEqual({});
  const g = fixture();
  expect(
    commitSelfDestructSelection(
      g.world,
      { kind: "ordinary", actorId: 2, targetId: null },
      ActionWindow.OnPerSpeechGap,
      Phase.Day,
      g.events,
      { day: 1, current: () => false },
    ),
  ).toBeNull();
  expect(g.events).toEqual([]);
  expect(g.lives[1]!.alive).toBe(true);
});

test("旧blast与未安装日终不读新增events/day thunk，旧普通自爆只保原Role→Alive两次World查询", () => {
  const f = fixture(false),
    reads: string[] = [],
    get = f.world.getComponent.bind(f.world);
  f.world.getComponent = ((id, name) => {
    reads.push(`${id}:${name}`);
    return get(id, name);
  }) as typeof f.world.getComponent;
  const blast = f.commit();
  expect(reads).toEqual(["2:RoleComponent", "2:AliveComponent"]);
  let extra = 0;
  const unavailable = () => {
    extra++;
    throw new Error("literal_old_new_read");
  };
  const existing = { onInitialWaveCommitted: () => f.events[0]! };
  expect(protectedBlastDeathPublication(blast, unavailable, existing)).toBe(existing);
  finishAwakenedDayRoles(f.world, unavailable, unavailable);
  expect(extra).toBe(0);
});
test.each([false, true])(
  "真实提交publisher先消费身份再调用旧夜报，同步重入传播=%s不重复实际结果",
  async (propagate) => {
    const f = fixture(),
      blast = f.commit();
    let calls = 0;
    const publication = protectedBlastDeathPublication(blast, () => f.events, {
      onInitialWaveCommitted(ids, sources, receipt) {
        calls++;
        const event: GameEvent = { timestamp: 0, type: "night_resolved", payload: { deaths: [] } };
        f.events.push(event);
        if (propagate) publication.onInitialWaveCommitted!(ids, sources, receipt);
        else
          expect(() => publication.onInitialWaveCommitted!(ids, sources, receipt)).toThrow(
            "protected_self_destruct_already_published",
          );
        return event;
      },
    });
    const dr = new DeathResolution(
      f.world,
      f.events,
      new ToolGateway(),
      new EventRegistry(new HookRegistry([], [])),
      { day: 1, phase: Phase.Day, gameOver: false, result: null },
    );
    const result = await dr
      .resolve(
        blast.deaths,
        blast.sources,
        {
          async getAction() {
            throw new Error("literal_no_request");
          },
        },
        Phase.Day,
        Phase.Day,
        {},
        publication,
      )
      .catch((e) => e);
    if (propagate) expect(result).toEqual(new Error("protected_self_destruct_already_published"));
    else expect(result).toBeUndefined();
    expect(calls).toBe(1);
    expect(f.lives[1]!.alive).toBe(false);
    expect(f.events.map((e) => e.type)).toEqual(
      propagate
        ? ["awakened_self_destruct_declared", "night_resolved"]
        : ["awakened_self_destruct_declared", "night_resolved", "awakened_self_destruct_resolved"],
    );
  },
);
