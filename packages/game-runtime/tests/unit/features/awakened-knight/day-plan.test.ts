/**
 * 负责觉醒守卫→骑士真实日计划与DR交互的单元场景。最小原生World和字面Provider驱动网关、租约及真死亡，
 * 手写轨迹验证盾先付／真链后续问／误中复原意图／失败前缀，不以生产重放结果生成预期。
 * 此层不冒充完整官方十二人板或真实传输；完整局与两语协议由后续交付门禁验证。
 */
import { expect, test } from "bun:test";
import { Role, Camp, Phase, type GameEvent } from "@ai-werewolf-arena/game-contract";
import { World } from "../../../../src/domain/world";
import { COMPONENT } from "../../../../src/domain/components/names";
import { createAliveComponent } from "../../../../src/domain/components/alive";
import { createRoleComponent } from "../../../../src/domain/components/role";
import {
  initializeAwakenedGuardState,
  getAwakenedGuardState,
} from "../../../../src/features/awakened-guard/state";
import {
  beginGuardCycle,
  openGuardBoundary,
  commitGuardChoice,
} from "../../../../src/features/awakened-guard/authority";
import {
  initializeAwakenedKnightState,
  getAwakenedKnightState,
} from "../../../../src/features/awakened-knight/state";
import { GameActionRequestFactory } from "../../../../src/engine/actions/action-request-factory";
import { DeathResolution } from "../../../../src/engine/death-resolution";
import { EventRegistry } from "../../../../src/engine/events/event-registry";
import { HookRegistry } from "../../../../src/engine/hooks/registry";
import { ToolGateway } from "../../../../src/engine/actions/tool-gateway";
import {
  runAwakenedDayRoleBoundary,
  finishAwakenedDayRoles,
} from "../../../../src/rulesets/awakened-day-role-plan";
import { prepareAwakenedKnight } from "../../../../src/features/awakened-knight/authority";
import type { ActionProvider } from "../../../../src/domain/actions";
import { deferRequestDelivery } from "../../../../src/domain/request-delivery";
function fixture() {
  const world = new World("en"),
    events: GameEvent[] = [],
    state = { day: 1, phase: Phase.Day, gameOver: false, result: null };
  const roles = [
    Role.AwakenedGuard,
    Role.AwakenedKnight,
    Role.Wolf,
    Role.Wolf,
    Role.Villager,
    Role.Villager,
  ];
  const lives = roles.map((r, i) => {
    const id = world.createEntity(),
      life = createAliveComponent(),
      role = createRoleComponent(r);
    world.addComponent(id, COMPONENT.Alive, life);
    world.addComponent(id, COMPONENT.Role, role);
    world.addComponent(id, COMPONENT.Camp, { camp: i === 2 || i === 3 ? Camp.Wolf : Camp.Good });
    if (i === 0) initializeAwakenedGuardState(role, world);
    if (i === 1) initializeAwakenedKnightState(role, world);
    return life;
  });
  prepareAwakenedKnight(world, 2, () => true);
  beginGuardCycle(world, 1, 1, {}, () => true);
  commitGuardChoice(
    world,
    openGuardBoundary(world, 1, {}, "night")!,
    { mode: "wait", targetId: null },
    () => true,
  );
  const gateway = new ToolGateway(),
    deaths = new DeathResolution(
      world,
      events,
      gateway,
      new EventRegistry(new HookRegistry([], [])),
      state,
    );
  const runtime = (provider: ActionProvider) => ({
    world,
    events,
    requests: new GameActionRequestFactory(world, events, 1),
    provider,
    gateway,
    deaths,
    phase: state.phase,
    day: 1,
    phaseRevision: 7,
    current: () => !state.gameOver && [Phase.Day, Phase.Voting].includes(state.phase),
  });
  return {
    world,
    events,
    state,
    lives,
    runtime,
    knight: () => getAwakenedKnightState(world.getComponent(2, COMPONENT.Role)!)!,
    guard: () => getAwakenedGuardState(world.getComponent(1, COMPONENT.Role)!)!,
  };
}
test("同边界Guard先盾狼3，Knight仍消耗尝试3；第二狼4真死后null，只有实际4获得延期词", async () => {
  const f = fixture(),
    trace: string[] = [];
  let duels = 0;
  const provider: ActionProvider = {
    async getAction(r) {
      trace.push(`${r.allowedTools[0]}:${r.actorId}`);
      if (r.allowedTools.includes("awakened_protect"))
        return { name: "awakened_protect", args: { mode: "protect", target_id: 3 } };
      if (r.allowedTools.includes("awakened_duel"))
        return {
          name: "awakened_duel",
          args: { target_id: ++duels === 1 ? 3 : duels === 2 ? 4 : null },
        };
      return { name: "speak", args: { text: "literal final words" } };
    },
  };
  expect(await runAwakenedDayRoleBoundary(f.runtime(provider), {})).toBe("nextNight");
  expect(trace).toEqual([
    "awakened_protect:1",
    "awakened_duel:2",
    "awakened_duel:2",
    "awakened_duel:2",
    "speak:4",
  ]);
  expect(f.lives.map((l) => l.alive)).toEqual([true, true, true, false, true, true]);
  expect(f.knight().attempts.map((a) => a.targetId)).toEqual([3, 4]);
  expect(
    f.events.filter((e) => e.type === "last_words_granted").map((e) => e.payload.playerId),
  ).toEqual([4]);
  expect(
    f.events.filter((e) => e.type === "awakened_duel_resolved").map((e) => e.payload.deaths),
  ).toEqual([[], [4]]);
  expect(f.world.activeDeathActionCount).toBe(0);
});
test("首边界wait不在同边界补盾，首狼3真死完整返回后才给新Guard保护第二狼4", async () => {
  const f = fixture(),
    trace: string[] = [];
  let guards = 0,
    duels = 0;
  const provider: ActionProvider = {
    async getAction(r) {
      if (r.allowedTools.includes("awakened_protect")) {
        trace.push(`guard:${++guards}`);
        if (guards === 2) expect(f.lives[2]!.alive).toBe(false);
        return {
          name: "awakened_protect",
          args:
            guards === 1 ? { mode: "wait", target_id: null } : { mode: "protect", target_id: 4 },
        };
      }
      if (r.allowedTools.includes("awakened_duel")) {
        trace.push(`duel:${++duels}`);
        return {
          name: "awakened_duel",
          args: { target_id: duels === 1 ? 3 : duels === 2 ? 4 : null },
        };
      }
      trace.push(`words:${r.actorId}`);
      return { name: "speak", args: { text: "literal words" } };
    },
  };
  await runAwakenedDayRoleBoundary(f.runtime(provider), {});
  expect(trace).toEqual(["guard:1", "duel:1", "guard:2", "duel:2", "duel:3", "words:3"]);
  expect(f.lives.map((l) => l.alive)).toEqual([true, true, false, true, true, true]);
  expect(f.guard().cycles).toEqual([{ day: 1, status: "protected", targetId: 4, timing: "day" }]);
});
test.each([false, true])(
  "误中Good双方独立致死，Knight有盾=%s也结束链恢复原白天而不继续决斗",
  async (protectKnight) => {
    const f = fixture();
    let duels = 0;
    const provider: ActionProvider = {
      async getAction(r) {
        if (r.allowedTools.includes("awakened_protect"))
          return {
            name: "awakened_protect",
            args: protectKnight
              ? { mode: "protect", target_id: 2 }
              : { mode: "pass", target_id: null },
          };
        if (r.allowedTools.includes("awakened_duel")) {
          duels++;
          return { name: "awakened_duel", args: { target_id: 5 } };
        }
        return { name: "speak", args: { text: "literal miss words" } };
      },
    };
    expect(await runAwakenedDayRoleBoundary(f.runtime(provider), {})).toBe("resumeDay");
    expect(duels).toBe(1);
    expect(f.lives[1]!.alive).toBe(protectKnight);
    expect(f.lives[4]!.alive).toBe(false);
    expect(
      f.events.filter((e) => e.type === "last_words_granted").map((e) => e.payload.playerId),
    ).toEqual(protectKnight ? [5] : [2, 5]);
    expect(f.events.at(-1)?.type).toBe("awakened_duel_chain_ended");
  },
);
test("第二次请求异常保首死和尝试、不授词、不写正常ended；同一边界不能重问", async () => {
  const f = fixture(),
    failure = new Error("literal_second_duel_failed"),
    identity = {};
  let duels = 0;
  const provider: ActionProvider = {
    async getAction(r) {
      if (r.allowedTools.includes("awakened_protect"))
        return { name: "awakened_protect", args: { mode: "pass", target_id: null } };
      if (++duels === 2) throw failure;
      return { name: "awakened_duel", args: { target_id: 3 } };
    },
  };
  expect(await runAwakenedDayRoleBoundary(f.runtime(provider), identity).catch((e) => e)).toBe(
    failure,
  );
  expect(f.lives[2]!.alive).toBe(false);
  expect(f.knight().attempts.map((a) => a.targetId)).toEqual([3]);
  expect(
    f.events.some((e) => e.type === "last_words_granted" || e.type === "awakened_duel_chain_ended"),
  ).toBe(false);
  expect(await runAwakenedDayRoleBoundary(f.runtime(provider), identity)).toBe("resumeDay");
  expect(duels).toBe(2);
  expect(f.world.activeDeathActionCount).toBe(0);
});
test("真实Voting PK窗口保原phase许可且完成链后日终关闭未使用Guard，重复收尾不重发", async () => {
  const f = fixture();
  f.state.phase = Phase.Voting;
  let duels = 0;
  const provider: ActionProvider = {
    async getAction(r) {
      expect(r.phase).toBe(Phase.Voting);
      if (r.allowedTools.includes("awakened_protect"))
        return { name: "awakened_protect", args: { mode: "wait", target_id: null } };
      if (r.allowedTools.includes("awakened_duel"))
        return { name: "awakened_duel", args: { target_id: ++duels === 1 ? 3 : null } };
      return { name: "speak", args: { text: "literal PK words" } };
    },
  };
  expect(await runAwakenedDayRoleBoundary(f.runtime(provider), {})).toBe("nextNight");
  expect(f.guard().cycles).toEqual([{ day: 1, status: "open" }]);
  finishAwakenedDayRoles(
    f.world,
    () => f.events,
    () => 1,
  );
  finishAwakenedDayRoles(
    f.world,
    () => f.events,
    () => 1,
  );
  expect(f.guard().cycles).toEqual([{ day: 1, status: "unused" }]);
  expect(f.events.filter((e) => e.type === "awakened_protection_expired")).toHaveLength(1);
});

for (const skill of ["guard", "knight"] as const)
  for (const failurePoint of ["sink", "true_callback"] as const)
    test(`${skill}付款后${failurePoint}失败保持true通知一次与真实资源前缀`, async () => {
      const f = fixture(),
        accepted: boolean[] = [],
        failure = new Error(`literal_${skill}_${failurePoint}`);
      const push = f.events.push.bind(f.events);
      f.events.push = (...events) => {
        if (
          failurePoint === "sink" &&
          events.some(
            (e) =>
              e.type ===
              (skill === "guard" ? "awakened_protection_chosen" : "awakened_duel_committed"),
          )
        )
          throw failure;
        return push(...events);
      };
      const provider: ActionProvider = {
        async getAction(r) {
          if (r.allowedTools.includes("awakened_protect")) {
            if (skill === "guard")
              expect(
                deferRequestDelivery(r, (value) => {
                  accepted.push(value);
                  if (failurePoint === "true_callback") throw failure;
                }),
              ).toBe(true);
            return {
              name: "awakened_protect",
              args:
                skill === "guard"
                  ? { mode: "protect", target_id: 3 }
                  : { mode: "pass", target_id: null },
            };
          }
          expect(
            deferRequestDelivery(r, (value) => {
              accepted.push(value);
              if (failurePoint === "true_callback") throw failure;
            }),
          ).toBe(true);
          return { name: "awakened_duel", args: { target_id: 3 } };
        },
      };
      expect(await runAwakenedDayRoleBoundary(f.runtime(provider), {}).catch((e) => e)).toBe(
        failure,
      );
      expect(accepted).toEqual([true]);
      if (skill === "guard")
        expect(f.guard().cycles).toEqual([
          { day: 1, status: "protected", targetId: 3, timing: "day" },
        ]);
      else expect(f.knight().attempts).toEqual([{ day: 1, chain: 1, targetId: 3, branch: "wolf" }]);
    });
test("最后真实遗言sink撤销阶段保已发词，不补chain_ended正常终态", async () => {
  const f = fixture(),
    push = f.events.push.bind(f.events);
  let duels = 0;
  f.events.push = (...events) => {
    const length = push(...events);
    if (events.some((e) => e.type === "last_words_spoken")) f.state.phase = Phase.Night;
    return length;
  };
  const provider: ActionProvider = {
    async getAction(r) {
      if (r.allowedTools.includes("awakened_protect"))
        return { name: "awakened_protect", args: { mode: "pass", target_id: null } };
      if (r.allowedTools.includes("awakened_duel"))
        return { name: "awakened_duel", args: { target_id: ++duels === 1 ? 3 : null } };
      return { name: "speak", args: { text: "literal last words" } };
    },
  };
  await expect(runAwakenedDayRoleBoundary(f.runtime(provider), {})).rejects.toThrow(
    "awakened_day_boundary_revoked",
  );
  expect(f.events.filter((e) => e.type === "last_words_spoken")).toHaveLength(1);
  expect(f.events.some((e) => e.type === "awakened_duel_chain_ended")).toBe(false);
  expect(f.lives[2]!.alive).toBe(false);
  expect(f.world.activeDeathActionCount).toBe(0);
});
