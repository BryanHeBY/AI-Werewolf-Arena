/**
 * 单元测试验证猎人死因资格、有界死亡结算及真实死亡回执消费。输入保留原死因／胜利条件／locale 表、本地原生命及受控 hook／provider 决策；精确许可、开枪／pass／撤权、阶段和追加原因断言是预期，不运行 PhaseManager 周期、记录器或模型。
 */
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../src/app/bootstrap";
import {
  COMPONENT,
  DeathCause,
  Phase,
  Role,
  WinCondition,
  permitsHunterShot,
  type GameEvent,
  type RoleComponent,
  type DeathSources,
} from "../../../src/domain";
import { twelvePlayerStandardConfig } from "../../../src/rulesets/presets/twelve-player-standard";
import { sixPlayerMvpConfig } from "../../../src/rulesets/presets/six-player-mvp";
import { getHunterState, setHunterState } from "../../../src/features/hunter/ports";
import { hunterDeathHook } from "../../../src/features/hunter/death-hook";
import { DeathResolution } from "../../../src/engine/death-resolution";
import { EventRegistry } from "../../../src/engine/events/event-registry";
import { ToolGateway } from "../../../src/engine/actions/tool-gateway";
import { ActionReception } from "../../../src/engine/actions/action-reception";
import { ActionTurn } from "../../../src/agents/player/action-turn";

const roles = [
  Role.Wolf,
  Role.Wolf,
  Role.Wolf,
  Role.Wolf,
  Role.Seer,
  Role.Witch,
  Role.Hunter,
  Role.Idiot,
  Role.Villager,
  Role.Villager,
  Role.Villager,
  Role.Villager,
];

const fixture = (locale: "zh-CN" | "en", winCondition = WinCondition.SlaughterCity) =>
  bootstrapGame(
    { ...twelvePlayerStandardConfig, winConditions: [winCondition] },
    { locale, fixedRoles: roles },
  );

const dead = (world: ReturnType<typeof fixture>["world"], id: number) => {
  world.getComponent(id, COMPONENT.Alive)!.alive = false;
};

const gun = (world: ReturnType<typeof fixture>["world"]) =>
  getHunterState(world.getComponent(7, COMPONENT.Role)!)!;

type UnboundSelection = { kind: "shot"; targetId: number } | { kind: "pass" } | { kind: "invalid" };

async function runHunterHook(
  world: ReturnType<typeof fixture>["world"],
  deadIds: number[],
  sources: DeathSources,
  choose: (actor: number) => Promise<UnboundSelection>,
  events: GameEvent[],
) {
  let permit: ReturnType<typeof world.openDeathAction> | undefined;
  try {
    return await hunterDeathHook(
      world,
      deadIds,
      sources,
      async (actor) => {
        permit = world.openDeathAction(actor, "shoot", Phase.Day, 1);
        const selection = await choose(actor);
        return selection.kind === "invalid"
          ? selection
          : { ...selection, deathActionId: permit.id };
      },
      events,
    );
  } finally {
    permit?.close();
  }
}

const examples: Array<[DeathCause[], boolean]> = [
  [[DeathCause.WolfKill], true],
  [[DeathCause.Exile], true],
  [[DeathCause.Shot], true],
  [[DeathCause.WolfKill, DeathCause.Shot], true],
  [[DeathCause.Poison], false],
  [[DeathCause.Poison, DeathCause.WolfKill], false],
  [[DeathCause.Lovers], false],
  [[DeathCause.Dream], false],
  [[DeathCause.Duel], false],
  [[DeathCause.SelfDestruct], false],
  [[DeathCause.Ability], false],
  [[], false],
  [[DeathCause.MechanicalKnife], true],
  [[DeathCause.MechanicalGuardFailure], false],
  [[DeathCause.MechanicalKnife, DeathCause.Poison], false],
  [[DeathCause.MechanicalKnife, DeathCause.MechanicalGuardFailure], false],
];

for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}: death causes explicitly permit or block Hunter actions without counting gods`, async () => {
    for (const [causes, eligible] of examples) {
      const { world } = fixture(locale),
        events: GameEvent[] = [];
      dead(world, 7);
      let asks = 0;
      expect(permitsHunterShot(causes)).toBe(eligible);
      const result = await runHunterHook(
        world,
        [7],
        { 7: causes },
        async () => {
          asks++;
          return { kind: "shot", targetId: 1 };
        },
        events,
      );
      expect(asks).toBe(eligible ? 1 : 0);
      expect(result.extraDeaths).toEqual(eligible ? [1] : []);
      expect(result.extraDeathSources).toEqual(eligible ? { 1: [DeathCause.Shot] } : {});
      expect(gun(world).canShoot).toBe(false);
    }
  });

for (const mode of [
  WinCondition.SlaughterCity,
  WinCondition.SlaughterSide,
  WinCondition.WolfReachHalf,
])
  test(`the last god is not excluded from the death hook (${mode})`, async () => {
    const { world } = fixture("en", mode),
      events: GameEvent[] = [];
    for (const id of [5, 6, 7, 8]) dead(world, id);
    let asked = 0;
    const result = await runHunterHook(
      world,
      [7],
      { 7: [DeathCause.WolfKill] },
      async () => {
        asked++;
        return { kind: "shot", targetId: 1 };
      },
      events,
    );
    expect(asked).toBe(1);
    expect(result.extraDeaths).toEqual([1]);
    expect(result.extraDeathSources[1]).toEqual([DeathCause.Shot]);
  });

test("a living Hunter cannot enter the death hook; invalid or thrown selection preserves the gun, while explicit pass spends it", async () => {
  const { world } = fixture("en"),
    events: GameEvent[] = [];
  let asks = 0;
  const choose = async (): Promise<UnboundSelection> => {
    asks++;
    return { kind: "shot", targetId: 999 };
  };
  await runHunterHook(world, [7], { 7: [DeathCause.Exile] }, choose, events);
  expect(asks).toBe(0);
  expect(gun(world).canShoot).toBe(true);
  dead(world, 7);
  await runHunterHook(world, [7], { 7: [DeathCause.Exile] }, choose, events);
  expect(asks).toBe(1);
  expect(gun(world).canShoot).toBe(true);
  await runHunterHook(
    world,
    [7],
    { 7: [DeathCause.Exile] },
    async () => ({ kind: "invalid" }),
    events,
  );
  expect(gun(world).canShoot).toBe(true);
  const error = new Error("synthetic-decision-failure");
  expect(
    await runHunterHook(
      world,
      [7],
      { 7: [DeathCause.Exile] },
      async () => {
        throw error;
      },
      events,
    ).catch((failure) => failure),
  ).toBe(error);
  expect(gun(world).canShoot).toBe(true);
  await runHunterHook(
    world,
    [7],
    { 7: [DeathCause.Exile] },
    async () => ({ kind: "pass" }),
    events,
  );
  expect(gun(world).canShoot).toBe(false);
  expect(events.some((event) => event.type === "hunter_shot")).toBe(false);
  await runHunterHook(world, [7], { 7: [DeathCause.Exile] }, choose, events);
  expect(asks).toBe(1);
});

for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}: the real death resolver bounds invalid decisions and accepts a corrected shot or explicit empty shot`, async () => {
    for (const corrected of [true, false]) {
      const { world } = fixture(locale),
        events: GameEvent[] = [],
        state = { day: 2, phase: Phase.Day, gameOver: false, result: null };
      const resolver = new DeathResolution(
        world,
        events,
        new ToolGateway(),
        new EventRegistry(),
        state,
      );
      let asks = 0;
      await resolver.resolve(
        [7],
        { 7: [DeathCause.WolfKill] },
        {
          async getAction(request) {
            expect(request.context.death_phase).toBe(Phase.Night);
            expect(request.context.death_sources).toEqual([DeathCause.WolfKill]);
            asks++;
            return { name: "shoot", args: { target_id: asks === 1 ? 999 : corrected ? 1 : null } };
          },
        },
        Phase.Night,
        Phase.Day,
      );
      expect(asks).toBe(2);
      expect(gun(world).canShoot).toBe(false);
      expect(
        events.filter((event) => event.type === "hunter_shot").map((event) => event.payload),
      ).toEqual(corrected ? [{ hunterId: 7, targetId: 1 }] : []);
    }
    const { world } = fixture(locale),
      events: GameEvent[] = [],
      state = { day: 2, phase: Phase.Day, gameOver: false, result: null };
    let asks = 0;
    await new DeathResolution(world, events, new ToolGateway(), new EventRegistry(), state).resolve(
      [7],
      { 7: [DeathCause.WolfKill] },
      {
        async getAction() {
          asks++;
          return { name: "shoot", args: { target_id: 999 } };
        },
      },
      Phase.Night,
      Phase.Day,
    );
    expect(asks).toBe(3);
    expect(gun(world).canShoot).toBe(true);
  });

for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}: shared reception accepts schema-valid null as an explicit gun pass and seals the turn once`, () => {
    const { world } = fixture(locale);
    dead(world, 7);
    const permit = world.openDeathAction(7, "shoot", Phase.Day, 1);
    const request = {
      actorId: 7,
      phase: Phase.Day,
      allowedTools: ["shoot" as const],
      context: {
        day: 1,
        stage: "hunter_shot" as const,
        trigger: "on_death",
        death_sources: [DeathCause.Exile],
        death_action_id: permit.id,
        visible_events: [],
        turn_constraints: { min_valid_actions: 1, max_valid_actions: 1 },
      },
    };
    const turn = new ActionTurn(new ActionReception(world), request, "t1");
    expect(turn.submit("t1", "shoot", { target_id: 999 })).toMatchObject({
      ok: false,
      error: "shoot_target",
    });
    expect(turn.submit("t1", "shoot", { target_id: null })).toEqual({
      ok: true,
      accepted: true,
      applied: false,
      action: "shoot",
    });
    expect(gun(world).canShoot).toBe(true); // Still owned by final application.
    expect(turn.submit("t1", "shoot", { target_id: 1 })).toMatchObject({
      ok: false,
      error: "turn_not_open_or_session_invalid",
    });
    permit.close();
    expect(world.activeDeathActionCount).toBe(0);
  });

for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}: an additional shot death carries its own cause and actual phase`, async () => {
    const game = bootstrapGame(
      {
        ...sixPlayerMvpConfig,
        roleSetups: [
          { role: Role.Wolf, count: 1 },
          { role: Role.Hunter, count: 2 },
          { role: Role.Villager, count: 3 },
        ],
      },
      {
        locale,
        fixedRoles: [
          Role.Wolf,
          Role.Hunter,
          Role.Hunter,
          Role.Villager,
          Role.Villager,
          Role.Villager,
        ],
      },
    );
    const events: GameEvent[] = [],
      state = { day: 2, phase: Phase.Day, gameOver: false, result: null },
      observed: unknown[] = [];
    await new DeathResolution(
      game.world,
      events,
      new ToolGateway(),
      new EventRegistry(),
      state,
    ).resolve(
      [2],
      { 2: [DeathCause.WolfKill] },
      {
        async getAction(request) {
          observed.push([
            request.actorId,
            request.phase,
            request.context.death_phase,
            request.context.death_sources,
          ]);
          return { name: "shoot", args: { target_id: request.actorId === 2 ? 3 : null } };
        },
      },
      Phase.Night,
      Phase.Day,
    );
    expect(observed).toEqual([
      [2, Phase.Day, Phase.Night, [DeathCause.WolfKill]],
      [3, Phase.Day, Phase.Day, [DeathCause.Shot]],
    ]);
    expect(
      events.filter((event) => event.type === "hunter_shot").map((event) => event.payload),
    ).toEqual([{ hunterId: 2, targetId: 3 }]);
    expect(game.world.getComponent(3, COMPONENT.Alive)!.alive).toBe(false);
    for (const id of [2, 3])
      expect(
        getHunterState(game.world.getComponent(id, COMPONENT.Role)!)!.canShoot,
      ).toBe(false);
  });

for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}: revoked, replaced or resurrected Hunter state discards a late selection`, async () => {
    for (const revoke of ["resource", "state", "role", "component", "alive"] as const) {
      const { world } = fixture(locale),
        events: GameEvent[] = [];
      dead(world, 7);
      const originalRole = world.getComponent(7, COMPONENT.Role)!,
        originalGun = gun(world);
      const result = await runHunterHook(
        world,
        [7],
        { 7: [DeathCause.Exile] },
        async () => {
          if (revoke === "resource") (originalGun as { canShoot: boolean }).canShoot = false;
          if (revoke === "state") setHunterState(originalRole, { canShoot: false });
          if (revoke === "role") originalRole.role = Role.Villager;
          if (revoke === "component") world.addComponent(7, COMPONENT.Role, { ...originalRole });
          if (revoke === "alive")
            world.getComponent(7, COMPONENT.Alive)!.alive = true;
          return { kind: "shot", targetId: 1 };
        },
        events,
      );
      expect(result).toEqual({ extraDeaths: [], extraDeathSources: {} });
      expect(world.getComponent(1, COMPONENT.Alive)!.alive).toBe(true);
      expect(events).toEqual([]);
      if (revoke !== "resource") expect(originalGun.canShoot).toBe(true);
    }
  });
