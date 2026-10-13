/**
 * 单元测试验证狼王白天来源开枪资格、精确政策 DTO 与有界来源／保护／权限行为。
 * 输入保留原政策／来源／死因／语言／时点矩阵及直接 hook／死亡结算调用；手写开枪资格、
 * 受保护目标、赠予枪及只读来源拒绝是预期，不运行完整 PhaseManager 周期或记录流程。
 */
import { captureNativeRolePresentation } from "../../../../src/game/observation/native-role-presentation-capture";
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import {
  COMPONENT,
  DeathCause,
  Phase,
  Role,
  permitsDeathShot,
  type BoardConfig,
  type DeathActionPolicy,
  type RoleComponent,
  type GameEvent,
} from "../../../../src/core";
import { sixPlayerMvpConfig } from "../../../../src/runtime/scenarios/six_player_mvp";
import { magicianTwelveConfig } from "../../../../src/runtime/scenarios/magician_twelve";
import {
  boardDefinitionFromConfig,
  parseBoardDefinition,
} from "../../../../src/runtime/config/board_definition";
import { boardConfigSchema } from "../../../../src/core/domain/board_schema";
import { DeathResolution } from "../../../../src/game/engine/death_resolution";
import { EventRegistry } from "../../../../src/game/engine/event_registry";
import {
  HookRegistry,
  type DeathHookContext,
} from "../../../../src/game/mechanisms/hooks/hook_registry";
import { ToolGateway } from "../../../../src/game/gateway/tool_gateway";
import { getWolfKingState } from "../../../../src/game/mechanisms/roles/wolf_king/state";
import {
  projectHunterState,
  projectWolfKingState,
} from "../../../../src/game/mechanisms/roles/player_state";
import { WOLF_KING_ROLE_PROFILE } from "../../../../src/game/mechanisms/roles/wolf_king/profile";
import { getDefaultConfigRenderRegistry } from "../../../../src/game/mechanisms/prompt/config_render_registry";
import { grantDeathGun, armDeathGun } from "../../../../src/game/mechanisms/roles/death_abilities";

const policy = "awa_day_deaths_v1" as const;

const roles = [Role.Wolf, Role.Hunter, Role.WolfKing, Role.Villager, Role.Villager, Role.Villager];

function fixture(selected: DeathActionPolicy = policy, registry = new EventRegistry()) {
  const config: BoardConfig = {
    ...sixPlayerMvpConfig,
    roleSetups: [...new Set(roles)].map((role) => ({
      role,
      count: roles.filter((r) => r === role).length,
    })),
    wolfKing: { deathActionPolicy: selected },
  };
  const game = bootstrapGame(config, { fixedRoles: roles });
  const events: GameEvent[] = [];
  const state = { day: 2, phase: Phase.Day, gameOver: false, result: null };
  const gateway = new ToolGateway();
  const resolver = new DeathResolution(game.world, events, gateway, registry, state, config);
  const king = game.world.getComponent<RoleComponent>(3, COMPONENT.Role)!;
  return {
    ...game,
    config,
    events,
    state,
    gateway,
    resolver,
    king,
    stock: getWolfKingState(king)!,
  };
}

test("Wolf King day policy uses both an explicit origin and the complete qualified cause list", () => {
  const qualified = [
    DeathCause.WolfKill,
    DeathCause.MechanicalKnife,
    DeathCause.AwakenedHiddenKnife,
    DeathCause.Exile,
    DeathCause.Shot,
    DeathCause.WhiteWolfBlast,
  ];
  for (const origin of [undefined, Phase.Night, Phase.Day, Phase.Voting]) {
    for (const cause of Object.values(DeathCause)) {
      const allowed =
        (origin === Phase.Day || origin === Phase.Voting) && qualified.includes(cause);
      expect(permitsDeathShot([cause], policy, origin)).toBe(allowed);
      expect(permitsDeathShot([DeathCause.WolfKill, cause], policy, origin)).toBe(allowed);
    }
    expect(permitsDeathShot([], policy, origin)).toBe(false);
  }
  expect(permitsDeathShot([DeathCause.WolfKill])).toBe(true);
  expect(permitsDeathShot([DeathCause.Shot], "awa_knife_or_exile_v1", Phase.Day)).toBe(false);
});

test("Wolf King policy roundtrips; Hunter rejects it in public and internal schemas", () => {
  const f = fixture();
  const raw = boardDefinitionFromConfig("day_king", f.config);
  expect(parseBoardDefinition(raw).config.wolfKing).toEqual({ deathActionPolicy: policy });
  expect(f.stock).toEqual({ canShoot: true, deathActionPolicy: policy });
  expect(
    boardConfigSchema.safeParse({ ...f.config, hunter: { deathActionPolicy: policy } }).success,
  ).toBe(false);
  const invalid = structuredClone(raw);
  invalid.roles.hunter = { deathActionPolicy: policy };
  expect(() => parseBoardDefinition(invalid)).toThrow();
  for (const firstNight of [1, 2] as const)
    for (const mapping of ["original", "exchanged"] as const) {
      const board = structuredClone(magicianTwelveConfig);
      board.magician!.firstNight = firstNight;
      board.magician!.deathShotTargetPolicy = mapping;
      board.wolfKing = { deathActionPolicy: policy };
      expect(
        bootstrapGame(parseBoardDefinition(boardDefinitionFromConfig("day_magic", board)).config)
          .playerIds,
      ).toHaveLength(12);
    }
});

test("only Wolf King DTO carries the new policy and no private property accessor is evaluated", () => {
  let reads = 0;
  const state = {
    canShoot: true,
    deathActionPolicy: policy,
    get secret() {
      reads++;
      throw new Error("private getter");
    },
  };
  expect(projectWolfKingState(state)).toEqual({ canShoot: true, deathActionPolicy: policy });
  expect(projectHunterState(state)).toEqual({ canShoot: true });
  const accessor = {
    canShoot: false,
    get deathActionPolicy() {
      reads++;
      return policy;
    },
  };
  expect(projectWolfKingState(accessor)).toEqual({ canShoot: false });
  expect(reads).toBe(0);
});

for (const locale of ["zh-CN", "en"] as const)
  test(`configured personal and public rules explain the AWA day policy/${locale}`, () => {
    const f = fixture();
    for (const prose of [
      captureNativeRolePresentation(WOLF_KING_ROLE_PROFILE.presentation!.id, f.king, locale),
      getDefaultConfigRenderRegistry().renderBoardConfigPrompt(f.config, locale),
    ]) {
      expect(prose).toContain(
        locale === "en" ? "Night deaths announced by day" : "夜死即使白天公布",
      );
      expect(prose).toContain(locale === "en" ? "last wolf" : "最后一狼");
      expect(prose).toContain("LAL");
    }
  });

for (const selected of ["awa_qualified_sources_v1", policy] as const)
  test(`night source remains night when announced during Day/${selected}`, async () => {
    const f = fixture(selected),
      calls: number[] = [];
    await f.resolver.resolve(
      [3],
      { 3: [DeathCause.WolfKill] },
      {
        async getAction(r) {
          if (!r.allowedTools.includes("shoot")) return { name: "speak", args: { text: "Words" } };
          calls.push(r.actorId);
          expect(r.phase).toBe(Phase.Day);
          expect(r.context.death_phase).toBe(Phase.Night);
          return { name: "shoot", args: { target_id: 4 } };
        },
      },
      Phase.Night,
      Phase.Day,
      {},
      { nightOriginIds: [3] },
    );
    expect(calls).toEqual(selected === policy ? [] : [3]);
    expect(f.world.getAliveEntityIds().includes(4)).toBe(selected === policy);
    expect(f.stock.canShoot).toBe(false);
    expect(f.world.activeDeathActionCount).toBe(0);
  });

test("a night-origin Hunter shot cannot grant the new Wolf King a daytime gun", async () => {
  const f = fixture(),
    origins: Array<[number, Phase | undefined]> = [];
  await f.resolver.resolve(
    [2],
    { 2: [DeathCause.WolfKill] },
    {
      async getAction(r) {
        if (!r.allowedTools.includes("shoot")) return { name: "speak", args: { text: "Words" } };
        origins.push([r.actorId, r.context.death_phase]);
        return { name: "shoot", args: { target_id: r.actorId === 2 ? 3 : 4 } };
      },
    },
    Phase.Night,
    Phase.Day,
    {},
    { nightOriginIds: [2] },
  );
  expect(origins).toEqual([[2, Phase.Night]]);
  expect(f.world.getAliveEntityIds()).toEqual([1, 4, 5, 6]);
  expect(f.events.some((e) => e.type === "wolf_king_shot")).toBe(false);
});

for (const selected of ["awa_qualified_sources_v1", policy] as const)
  for (const origin of [Phase.Day, Phase.Voting])
    test(`explicit daytime eligibility retains the pending night's protection in later waves/${selected}/${origin}`, async () => {
      const f = fixture(selected),
        origins: Array<[number, Phase | undefined]> = [];
      await f.resolver.resolve(
        [3],
        { 3: [DeathCause.WolfKill, DeathCause.WhiteWolfBlast] },
        {
          async getAction(r) {
            if (!r.allowedTools.includes("shoot"))
              return { name: "speak", args: { text: "Words" } };
            origins.push([r.actorId, r.context.death_phase]);
            return { name: "shoot", args: { target_id: r.actorId === 3 ? 2 : 4 } };
          },
        },
        Phase.Night,
        Phase.Day,
        { 3: origin },
        { nightOriginIds: [3], blocksPassiveNightShot: (id) => id === 4 },
      );
      expect(origins).toEqual([
        [3, origin],
        [2, Phase.Day],
      ]);
      expect(f.world.getAliveEntityIds()).toEqual([1, 4, 5, 6]);
      expect(
        f.events.filter((e) => e.type === "death_shot_blocked").map((e) => e.payload.actorId),
      ).toEqual([2]);
    });

test("same-wave night Hunter and daytime Wolf King keep separate protection semantics", async () => {
  const f = fixture(),
    origins: Array<[number, Phase | undefined]> = [];
  await f.resolver.resolve(
    [2, 3],
    { 2: [DeathCause.WolfKill], 3: [DeathCause.WhiteWolfBlast] },
    {
      async getAction(r) {
        if (!r.allowedTools.includes("shoot")) return { name: "speak", args: { text: "Words" } };
        origins.push([r.actorId, r.context.death_phase]);
        return { name: "shoot", args: { target_id: r.actorId === 2 ? 4 : 5 } };
      },
    },
    Phase.Night,
    Phase.Day,
    { 3: Phase.Day },
    { nightOriginIds: [2], blocksPassiveNightShot: () => true },
  );
  expect(origins).toEqual([
    [2, Phase.Night],
    [3, Phase.Day],
  ]);
  expect(f.world.getAliveEntityIds()).toEqual([1, 4, 6]);
  expect(
    f.events.filter((e) => e.type === "death_shot_blocked").map((e) => e.payload.actorId),
  ).toEqual([2]);
});

test("a mixed-origin Hunter grants daytime Wolf King eligibility while retaining night protection", async () => {
  const f = fixture(),
    observed: Array<[number, Phase | undefined, Phase | undefined]> = [];
  await f.resolver.resolve(
    [2],
    { 2: [DeathCause.WolfKill, DeathCause.WhiteWolfBlast] },
    {
      async getAction(r) {
        if (!r.allowedTools.includes("shoot")) return { name: "speak", args: { text: "Words" } };
        observed.push([r.actorId, r.context.death_phase, r.context.death_origin_phase]);
        return { name: "shoot", args: { target_id: r.actorId === 2 ? 3 : 4 } };
      },
    },
    Phase.Night,
    Phase.Day,
    { 2: Phase.Day },
    { nightOriginIds: [2], blocksPassiveNightShot: (id) => id === 4 },
  );
  expect(observed).toEqual([
    [2, Phase.Day, undefined],
    [3, Phase.Day, Phase.Day],
  ]);
  expect(
    f.events.filter((e) => e.type === "death_shot_blocked").map((e) => e.payload.actorId),
  ).toEqual([3]);
  expect(f.stock.canShoot).toBe(false);
  expect(f.world.getAliveEntityIds()).toEqual([1, 4, 5, 6]);
});

test("day origin cannot override a poison component", async () => {
  const f = fixture();
  let shots = 0;
  await f.resolver.resolve(
    [3],
    { 3: [DeathCause.WolfKill, DeathCause.WhiteWolfBlast, DeathCause.Poison] },
    {
      async getAction(r) {
        if (r.allowedTools.includes("shoot")) shots++;
        return { name: "speak", args: { text: "Words" } };
      },
    },
    Phase.Night,
    Phase.Day,
    { 3: Phase.Day },
    { nightOriginIds: [3] },
  );
  expect(shots).toBe(0);
  expect(f.world.getAliveEntityIds()).toContain(4);
});

for (const timing of ["await", "deferred"] as const)
  for (const field of ["policy", "cause"] as const)
    test(`native authority is revoked on ${field} change/${timing}`, async () => {
      let mutate = () => {};
      const registry = new EventRegistry(
        new HookRegistry(
          [],
          [
            async (...args) => {
              const [world, , sources] = args;
              const state = getWolfKingState(
                world.getComponent<RoleComponent>(3, COMPONENT.Role)!,
              )!;
              mutate = () => {
                if (field === "policy")
                  (
                    state as {
                      deathActionPolicy:
                        | "awa_qualified_sources_v1"
                        | "awa_knife_or_exile_v1"
                        | "awa_day_deaths_v1"
                        | undefined;
                    }
                  ).deathActionPolicy = "awa_knife_or_exile_v1";
                if (field === "cause") sources[3] = [DeathCause.Poison];
              };
              const result = await WOLF_KING_ROLE_PROFILE.runtime.deathHook!(...args);
              if (timing === "deferred" && result.pendingShots?.length) mutate();
              return result;
            },
          ],
        ),
      );
      const f = fixture(policy, registry);
      await f.resolver.resolve(
        [3],
        { 3: [DeathCause.Exile] },
        {
          async getAction(r) {
            if (!r.allowedTools.includes("shoot"))
              return { name: "speak", args: { text: "Words" } };
            if (timing === "await") {
              mutate();
              expect(
                f.gateway.validateAndSanitize(
                  f.world,
                  3,
                  { name: "shoot", args: { target_id: 4 } },
                  {
                    phase: r.phase,
                    day: r.context.day,
                    deathActionId: r.context.death_action_id,
                  },
                ).ok,
              ).toBe(false);
            }
            return { name: "shoot", args: { target_id: 4 } };
          },
        },
        Phase.Voting,
        Phase.Day,
      );
      expect(f.world.getAliveEntityIds()).toContain(4);
      expect(f.events.some((e) => e.type === "wolf_king_shot")).toBe(false);
      expect(f.stock.canShoot).toBe(timing === "await");
      expect(f.world.activeDeathActionCount).toBe(0);
    });

test("resolver-owned origin cannot be rewritten through a hook context", async () => {
  let context: DeathHookContext | undefined;
  const registry = new EventRegistry(
    new HookRegistry(
      [],
      [
        async (...args) => {
          context = args[5];
          expect(Object.isFrozen(context)).toBe(true);
          return WOLF_KING_ROLE_PROFILE.runtime.deathHook!(...args);
        },
      ],
    ),
  );
  const f = fixture(policy, registry);
  await f.resolver.resolve(
    [3],
    { 3: [DeathCause.Exile] },
    {
      async getAction(r) {
        if (!r.allowedTools.includes("shoot")) return { name: "speak", args: { text: "Words" } };
        expect(() =>
          Object.assign(context!, { deathOriginPhase: Phase.Night, nightEffect: true }),
        ).toThrow();
        expect(context!.deathOriginPhase).toBe(Phase.Voting);
        return { name: "shoot", args: { target_id: 4 } };
      },
    },
    Phase.Voting,
    Phase.Day,
  );
  expect(f.world.getAliveEntityIds()).not.toContain(4);
});

for (const timing of ["await", "deferred"] as const)
  test(`legacy direct hook origin mutation invalidates its result/${timing}`, async () => {
    const f = fixture();
    f.world.getComponent<{ alive: boolean }>(3, COMPONENT.Alive)!.alive = false;
    const context: DeathHookContext = {
      deathOriginPhase: Phase.Day,
      nightEffect: false,
      blocksNightShot: () => false,
      deferShotCommit: true,
    };
    const permit = f.world.openDeathAction(3, "shoot", Phase.Day, 2);
    try {
      const result = await WOLF_KING_ROLE_PROFILE.runtime.deathHook!(
        f.world,
        [3],
        { 3: [DeathCause.Exile] },
        async () => {
          if (timing === "await") Object.assign(context, { deathOriginPhase: Phase.Night });
          return { kind: "shot", targetId: 4, deathActionId: permit.id };
        },
        f.events,
        context,
      );
      if (timing === "await") expect(result.extraDeaths).toEqual([]);
      else {
        expect(result.pendingShots).toHaveLength(1);
        Object.assign(context, { deathOriginPhase: Phase.Night });
        expect(result.pendingShots![0]!.isCurrent!()).toBe(false);
      }
    } finally {
      permit.close();
    }
  });

test("direct hooks with no origin reject only the new policy", async () => {
  for (const selected of ["awa_qualified_sources_v1", policy] as const) {
    const f = fixture(selected);
    f.world.getComponent<{ alive: boolean }>(3, COMPONENT.Alive)!.alive = false;
    let requests = 0;
    const result = await WOLF_KING_ROLE_PROFILE.runtime.deathHook!(
      f.world,
      [3],
      { 3: [DeathCause.Exile] },
      async () => {
        requests++;
        return { kind: "invalid" };
      },
      f.events,
    );
    expect(requests).toBe(selected === policy ? 0 : 1);
    expect(result.extraDeaths).toEqual([]);
  }
});

test("a legal good recipient's gifted gun keeps night eligibility under the Wolf King day policy", async () => {
  const f = fixture();
  expect(() => grantDeathGun(f.world, 5, 3, 2, f.events)).toThrow("death_ability_grant_invalid");
  const gun = grantDeathGun(f.world, 5, 4, 2, f.events);
  armDeathGun(f.world, 4, gun, 2, f.events);
  const requested: string[] = [];
  await f.resolver.resolve(
    [3, 4],
    { 3: [DeathCause.WolfKill], 4: [DeathCause.WolfKill] },
    {
      async getAction(r) {
        if (!r.allowedTools.includes("shoot")) return { name: "speak", args: { text: "Words" } };
        expect(r.context.ability_id).toBe(gun.id);
        expect(r.context.death_phase).toBe(Phase.Night);
        requested.push(r.context.ability_id!);
        return { name: "shoot", args: { target_id: 6 } };
      },
    },
    Phase.Night,
    Phase.Day,
    {},
    { nightOriginIds: [3, 4] },
  );
  expect(requested).toEqual([gun.id]);
  expect(f.events.some((e) => e.type === "wolf_king_shot")).toBe(false);
  expect(f.events.filter((e) => e.type === "player_shot").map((e) => e.payload.targetId)).toEqual([
    6,
  ]);
  expect(f.stock.canShoot).toBe(false);
  expect(f.world.getAliveEntityIds()).not.toContain(6);
});
