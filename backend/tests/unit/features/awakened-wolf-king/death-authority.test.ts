/**
 * 单元测试验证狼爪原库存、真实死亡 collector／许可和 continuation 的完整边界。
 * 输入为独立 World、手写来源和 Provider；库存、生命、交付布尔轨迹为字面预期，不调用生产 oracle。
 * 不跑完整 PM 对局或模型；本测试包含真实工具校验、RequestLease 与每爪独立付款。
 */
import { expect, test } from "bun:test";
import { Camp, DeathCause, Phase, Role, type GameEvent } from "@ai-werewolf-arena/game-contract";
import { AWAKENED_WOLF_KING_ROLE_ID } from "@ai-werewolf-arena/game-contract/facts/awakened-claws";
import { World } from "../../../../src/domain/world";
import { COMPONENT } from "../../../../src/domain/components/names";
import { createAliveComponent } from "../../../../src/domain/components/alive";
import { createRoleComponent } from "../../../../src/domain/components/role";
import {
  createNativeClaws,
  createReceivedClaw,
  installAwakenedClaws,
  ownedAwakenedClaws,
  getAwakenedClaws,
} from "../../../../src/features/awakened-wolf-king/state";
import { AWAKENED_CLAW_DEATH_HOOK } from "../../../../src/features/awakened-wolf-king/death-hook";
import { DeathResolution } from "../../../../src/engine/death-resolution";
import { ToolGateway } from "../../../../src/engine/actions/tool-gateway";
import { EventRegistry } from "../../../../src/engine/events/event-registry";
import { HookRegistry, type DeathHook } from "../../../../src/engine/hooks/registry";
import {
  deferRequestDelivery,
  assertRequestDelivery,
  deriveBoundedRequest,
} from "../../../../src/domain/request-delivery";
import type { ActionProvider } from "../../../../src/domain/actions";
import { hunterDeathHook } from "../../../../src/features/hunter/death-hook";
import { setHunterState } from "../../../../src/features/hunter/ports";
import { DreamNightFrame } from "../../../../src/features/dreamer/night-frame";

function fixture(received = false, hooks: DeathHook[] = []) {
  const world = new World("en"),
    events: GameEvent[] = [];
  const lives = Array.from({ length: 5 }, (_, index) => {
    const id = world.createEntity(),
      life = createAliveComponent(),
      role = createRoleComponent(
        index === 0 ? (received ? Role.Wolf : (AWAKENED_WOLF_KING_ROLE_ID as Role)) : Role.Villager,
      );
    world.addComponent(id, COMPONENT.Alive, life);
    world.addComponent(id, COMPONENT.Role, role);
    world.addComponent(id, COMPONENT.Camp, { camp: index === 0 ? Camp.Wolf : Camp.Good });
    if (index === 0)
      installAwakenedClaws(
        role,
        received ? createReceivedClaw(9, 1, createNativeClaws().units[0]!) : createNativeClaws(),
        world,
        id,
      );
    return life;
  });
  const resolution = new DeathResolution(
    world,
    events,
    new ToolGateway(),
    new EventRegistry(new HookRegistry([], [AWAKENED_CLAW_DEATH_HOOK, ...hooks])),
    { day: 2, phase: Phase.Day, gameOver: false, result: null },
  );
  return {
    world,
    events,
    lives,
    role: world.getComponent(1, COMPONENT.Role)!,
    stock: () => ownedAwakenedClaws(world, 1)!,
    resolve: (provider: ActionProvider, causes = [DeathCause.Exile], dreams?: DreamNightFrame) =>
      resolution.resolve(
        [1],
        { 1: causes },
        provider,
        Phase.Day,
        Phase.Day,
        { 1: dreams ? Phase.Night : Phase.Day },
        dreams ? { dreams, nightOriginIds: [1] } : undefined,
      ),
  };
}

test("native double claw pays independently, first target full hook precedes second, and each request has its own delivery", async () => {
  const trace: string[] = [],
    delivered: boolean[] = [];
  const observe: DeathHook = async (_runtime, ids) => {
    trace.push(`dead:${ids[0]}`);
    return { extraDeaths: [], extraDeathSources: {} };
  };
  const f = fixture(false, [observe]);
  let asks = 0;
  await f.resolve({
    async getAction(request) {
      if (!request.allowedTools.includes("shoot"))
        return { name: "speak", args: { text: "literal words" } };
      asks++;
      trace.push(`ask:${asks}`);
      expect(request.context.action_failure_policy).toBe("error");
      expect(request.context.allow_fallback).toBe(false);
      expect(request.context.stage).toBe("death_shot");
      expect(deferRequestDelivery(request, (accepted) => delivered.push(accepted))).toBe(true);
      assertRequestDelivery(request);
      if (asks === 2) {
        expect(f.lives[1]!.alive).toBe(false);
        expect(request.context.shoot_candidates).not.toContain(2);
        expect(delivered).toEqual([true]);
      }
      return { name: "shoot", args: { target_id: asks + 1 } };
    },
  });
  expect(asks).toBe(2);
  expect(trace).toEqual(["ask:1", "dead:1", "dead:2", "ask:2", "dead:3"]);
  expect(delivered).toEqual([true, true]);
  expect(f.stock().units.map((u) => u.status)).toEqual(["spent", "spent"]);
  expect(f.events.filter((e) => e.type === "player_shot").map((e) => e.payload)).toEqual([
    { actorId: 1, targetId: 2 },
    { actorId: 1, targetId: 3 },
  ]);
  expect(f.world.activeDeathActionCount).toBe(0);
});

test("second request failure keeps first payment/death and closes false without spending the other unit", async () => {
  const f = fixture(),
    failure = new Error("literal_second_provider_failed"),
    delivered: boolean[] = [];
  let asks = 0;
  expect(
    await f
      .resolve({
        async getAction(request) {
          if (!request.allowedTools.includes("shoot"))
            return { name: "speak", args: { text: "literal" } };
          asks++;
          deferRequestDelivery(request, (accepted) => delivered.push(accepted));
          if (asks === 2) throw failure;
          return { name: "shoot", args: { target_id: 2 } };
        },
      })
      .catch((error) => error),
  ).toBe(failure);
  expect(delivered).toEqual([true, false]);
  expect(f.stock().units.map((u) => u.status)).toEqual(["spent", "ready"]);
  expect(f.lives.map((life) => life.alive)).toEqual([false, false, true, true, true]);
  expect(f.world.activeDeathActionCount).toBe(0);
});

test("last owner eligibility query replacing the selected target rejects before paying either claw", async () => {
  const f = fixture(),
    get = f.world.getComponent.bind(f.world),
    isOpen = f.world.isDeathActionOpen.bind(f.world),
    delivered: boolean[] = [];
  let armed = false,
    swapped = false;
  f.world.isDeathActionOpen = (...args) => {
    const result = isOpen(...args);
    if (result) armed = true;
    return result;
  };
  f.world.getComponent = ((id, name) => {
    const value = get(id, name);
    if (armed && !swapped && id === 1 && name === COMPONENT.Alive) {
      swapped = true;
      f.world.addComponent(2, COMPONENT.Alive, createAliveComponent());
    }
    return value;
  }) as typeof f.world.getComponent;
  await expect(
    f.resolve({
      async getAction(request) {
        if (!request.allowedTools.includes("shoot"))
          return { name: "speak", args: { text: "literal" } };
        deferRequestDelivery(request, (accepted) => delivered.push(accepted));
        return { name: "shoot", args: { target_id: 2 } };
      },
    }),
  ).rejects.toThrow("awakened_claw_target_stale");
  expect(swapped).toBe(true);
  expect(f.stock().units.map((u) => u.status)).toEqual(["ready", "ready"]);
  expect(delivered).toEqual([false]);
  expect(f.events.some((e) => e.type === "awakened_claw_spent")).toBe(false);
  expect(f.events.some((e) => e.type === "player_shot")).toBe(false);
  expect(f.world.activeDeathActionCount).toBe(0);
});

test("last target query replacing the dead owner also rejects at stable first-write checks with zero payment", async () => {
  const f = fixture(),
    get = f.world.getComponent.bind(f.world),
    isOpen = f.world.isDeathActionOpen.bind(f.world),
    delivered: boolean[] = [];
  let armed = false,
    targetReads = 0,
    swapped = false;
  f.world.isDeathActionOpen = (...args) => {
    const result = isOpen(...args);
    if (result) armed = true;
    return result;
  };
  f.world.getComponent = ((id, name) => {
    const value = get(id, name);
    if (armed && !swapped && id === 2 && name === COMPONENT.Alive && ++targetReads === 2) {
      swapped = true;
      f.world.addComponent(1, COMPONENT.Alive, createAliveComponent(false));
    }
    return value;
  }) as typeof f.world.getComponent;
  await expect(
    f.resolve({
      async getAction(request) {
        if (!request.allowedTools.includes("shoot"))
          return { name: "speak", args: { text: "literal" } };
        deferRequestDelivery(request, (accepted) => delivered.push(accepted));
        return { name: "shoot", args: { target_id: 2 } };
      },
    }),
  ).rejects.toThrow("awakened_claw_commit_stale");
  expect(swapped).toBe(true);
  expect(getAwakenedClaws(f.role)!.units.map((u) => u.status)).toEqual(["ready", "ready"]);
  expect(delivered).toEqual([false]);
  expect(f.events.some((e) => e.type === "awakened_claw_spent")).toBe(false);
  expect(f.events.some((e) => e.type === "player_shot")).toBe(false);
  expect(f.lives[1]!.alive).toBe(true);
  expect(f.world.activeDeathActionCount).toBe(0);
});

test("explicit reduced fixture: first claw completes a real Hunter descendant before opening the second claw", async () => {
  const f = fixture(false, [hunterDeathHook]),
    hunter = createRoleComponent(Role.Hunter);
  setHunterState(hunter, { canShoot: true });
  f.world.addComponent(2, COMPONENT.Role, hunter);
  const asked: number[] = [],
    delivered: boolean[] = [];
  await f.resolve({
    async getAction(request) {
      if (!request.allowedTools.includes("shoot"))
        return { name: "speak", args: { text: "literal" } };
      asked.push(request.actorId);
      if (request.actorId === 1) {
        deferRequestDelivery(request, (accepted) => delivered.push(accepted));
        const second = asked.length === 3;
        if (second) {
          expect(f.lives[1]!.alive).toBe(false);
          expect(f.lives[2]!.alive).toBe(false);
          expect(request.context.shoot_candidates).toEqual([4, 5]);
        }
        return { name: "shoot", args: { target_id: second ? 4 : 2 } };
      }
      expect(request.context.stage).toBe("hunter_shot");
      return { name: "shoot", args: { target_id: 3 } };
    },
  });
  expect(asked).toEqual([1, 2, 1]);
  expect(delivered).toEqual([true, true]);
  expect(f.lives.map((life) => life.alive)).toEqual([false, false, false, false, true]);
  expect(
    f.events
      .filter((e) => e.type === "player_shot" || e.type === "hunter_shot")
      .map((e) => [
        e.type,
        e.type === "hunter_shot" ? e.payload.hunterId : e.payload.actorId,
        e.payload.targetId,
      ]),
  ).toEqual([
    ["player_shot", 1, 2],
    ["hunter_shot", 2, 3],
    ["player_shot", 1, 4],
  ]);
  expect(f.world.activeDeathActionCount).toBe(0);
});

test("ordinary wolf received claw is a single source-owned unit; explicit pass pays once", async () => {
  const f = fixture(true),
    delivered: boolean[] = [];
  let asks = 0;
  await f.resolve({
    async getAction(request) {
      if (!request.allowedTools.includes("shoot"))
        return { name: "speak", args: { text: "literal" } };
      asks++;
      expect(request.context.ability_id).toBe("awakened_claw:bequest:9:1:1");
      deferRequestDelivery(request, (accepted) => delivered.push(accepted));
      return { name: "shoot", args: { target_id: null } };
    },
  });
  expect(asks).toBe(1);
  expect(delivered).toEqual([true]);
  expect(f.stock().units.map((u) => u.status)).toEqual(["spent"]);
  expect(f.events.some((e) => e.type === "player_shot")).toBe(false);
  expect(f.lives.slice(1).every((life) => life.alive)).toBe(true);
});

test.each(["protected_target", "dreamer_chain"] as const)(
  "original night source survives day display and a continuation: %s",
  async (mode) => {
    const f = fixture(),
      dreamer = createRoleComponent(Role.Dreamer);
    f.world.addComponent(4, COMPONENT.Role, dreamer);
    const dreams = new DreamNightFrame([
      {
        actorId: 4,
        targetId: 2,
        day: 2,
        consecutive: false,
        protectionPolicy: "awa_night_damage_v1",
        actorLife: f.lives[3]!,
        actorVersion: 0,
        targetLife: f.lives[1]!,
        targetVersion: 0,
      },
    ]);
    let asks = 0;
    await f.resolve(
      {
        async getAction(request) {
          if (!request.allowedTools.includes("shoot"))
            return { name: "speak", args: { text: "literal" } };
          asks++;
          expect(request.context.death_phase).toBe(Phase.Night);
          if (asks === 2 && mode === "dreamer_chain") {
            expect(f.lives[1]!.alive).toBe(false);
            expect(f.lives[3]!.alive).toBe(false);
            expect(request.context.shoot_candidates).toEqual([3, 5]);
          }
          return {
            name: "shoot",
            args: { target_id: asks === 1 ? (mode === "protected_target" ? 2 : 4) : 3 },
          };
        },
      },
      [DeathCause.WolfKill],
      dreams,
    );
    expect(asks).toBe(2);
    expect(f.stock().units.map((u) => u.status)).toEqual(["spent", "spent"]);
    if (mode === "protected_target") {
      expect(f.lives.map((l) => l.alive)).toEqual([false, true, false, true, true]);
      expect(
        f.events.filter((e) => e.type === "death_shot_blocked").map((e) => e.payload.targetId),
      ).toEqual([2]);
      expect(
        f.events.filter((e) => e.type === "player_shot").map((e) => e.payload.targetId),
      ).toEqual([3]);
    } else {
      expect(f.lives.map((l) => l.alive)).toEqual([false, false, false, false, true]);
      expect(f.events.filter((e) => e.type === "dream_death").map((e) => e.payload)).toEqual([
        { actorId: 4, targetId: 2, day: 2, reason: "linked" },
      ]);
      expect(
        f.events.filter((e) => e.type === "player_shot").map((e) => e.payload.targetId),
      ).toEqual([4, 3]);
    }
  },
);

test.each([[DeathCause.Poison], [DeathCause.Exile, DeathCause.Poison], [DeathCause.Dream]])(
  "unqualified sources expire all units without a request: %j",
  async (...causes) => {
    const f = fixture();
    let asks = 0;
    await f.resolve(
      {
        async getAction() {
          asks++;
          return { name: "speak", args: { text: "literal" } };
        },
      },
      causes as DeathCause[],
    );
    expect(f.stock().units.map((u) => u.status)).toEqual(["expired", "expired"]);
    expect(f.events.filter((e) => e.type === "awakened_claw_spent")).toEqual([]);
    expect(f.events.filter((e) => e.type === "awakened_claws_expired")).toHaveLength(1);
  },
);

test("replacing same-id target or source stock after request cannot spend or inherit the old permit", async () => {
  for (const mode of ["stock", "target"] as const) {
    const f = fixture(),
      delivered: boolean[] = [];
    let asks = 0;
    const failed = await f
      .resolve({
        async getAction(request) {
          if (!request.allowedTools.includes("shoot"))
            return { name: "speak", args: { text: "literal" } };
          asks++;
          deferRequestDelivery(request, (accepted) => delivered.push(accepted));
          if (mode === "stock")
            Object.defineProperty(f.role.privateState, "awakenedClaws", {
              value: JSON.parse(JSON.stringify(getAwakenedClaws(f.role))),
              writable: true,
            });
          else f.world.addComponent(2, COMPONENT.Alive, createAliveComponent());
          return { name: "shoot", args: { target_id: 2 } };
        },
      })
      .catch((error) => error);
    expect(failed).toBeInstanceOf(Error);
    expect(delivered.every((accepted) => !accepted)).toBe(true);
    expect(getAwakenedClaws(f.role)!.units.map((u) => u.status)).toEqual(["ready", "ready"]);
    expect(f.world.getComponent(2, COMPONENT.Alive)!.alive).toBe(true);
    expect(f.world.activeDeathActionCount).toBe(0);
  }
});

test("shorter legal deadline alias expires original delivery before payment; a copied stock never gains original owner identity", async () => {
  const f = fixture(),
    delivered: boolean[] = [];
  let originalNow = Date.now;
  try {
    expect(
      await f
        .resolve({
          async getAction(request) {
            if (!request.allowedTools.includes("shoot"))
              return { name: "speak", args: { text: "literal" } };
            const deadline = Date.now() + 100;
            const alias = deriveBoundedRequest(request, deadline);
            expect(deferRequestDelivery(alias, (accepted) => delivered.push(accepted))).toBe(true);
            Date.now = () => deadline;
            return { name: "shoot", args: { target_id: 2 } };
          },
        })
        .catch((error) => error),
    ).toBeInstanceOf(Error);
  } finally {
    Date.now = originalNow;
  }
  expect(delivered).toEqual([false]);
  expect(f.stock().units.map((u) => u.status)).toEqual(["ready", "ready"]);
  expect(f.lives[1]!.alive).toBe(true);
});
