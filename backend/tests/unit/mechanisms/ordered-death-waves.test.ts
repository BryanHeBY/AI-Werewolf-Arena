/**
 * Unit tests verify bounded death waves order original last words, badge and gun hooks while preserving causes and failure identity.
 * Input: Original fixed local worlds, explicit death sources, cyclic/compound hooks and controlled provider responses.
 * Output and oracle: Exact lives, action-window closure, returned source arrays and request/event ordering remain unchanged; no full PM cycle or recorded game runs.
 */
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { COMPONENT, DeathCause, Phase, Role, type ActionRequest, type GameEvent, type RoleComponent } from "../../../src/core";
import { sixPlayerMvpConfig } from "../../../src/runtime/scenarios/six_player_mvp";
import { DeathResolution } from "../../../src/game/engine/death_resolution";
import { EventRegistry } from "../../../src/game/engine/event_registry";
import { ToolGateway } from "../../../src/game/gateway/tool_gateway";
import { HookRegistry } from "../../../src/game/mechanisms/hooks/hook_registry";
import { LastWordsMechanism } from "../../../src/game/mechanisms/last_words/last_words_mechanism";

const scene = (locale: "zh-CN" | "en") =>
  bootstrapGame(
    {
      ...sixPlayerMvpConfig,
      enableSheriff: true,
      initialSheriffSeat: 2,
      sheriff: { voteWeight: 2.25 },
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

for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}: a whole wave is dead before last words; badge precedes guns and additional deaths receive no last words`, async () => {
    const { world } = scene(locale),
      events: GameEvent[] = [],
      asks: ActionRequest[] = [],
      tries = new Map<number, number>();
    const resolver = new DeathResolution(world, events, new ToolGateway(), new EventRegistry(), {
      day: 1,
      phase: Phase.Day,
      gameOver: false,
      result: null,
    });
    await resolver.resolve(
      [2, 2, 3],
      { 2: [DeathCause.WolfKill], 3: [DeathCause.WolfKill] },
      {
        async getAction(request) {
          asks.push(request);
          expect(world.getComponent<{ alive: boolean }>(2, COMPONENT.Alive)!.alive).toBe(false);
          expect(world.getComponent<{ alive: boolean }>(3, COMPONENT.Alive)!.alive).toBe(false);
          if (request.context.stage === "last_words")
            return { name: "speak", args: { text: `raw-${request.actorId}` } };
          const attempt = (tries.get(request.actorId) ?? 0) + 1;
          tries.set(request.actorId, attempt);
          if (request.actorId === 3)
            expect(world.getComponent<{ alive: boolean }>(4, COMPONENT.Alive)!.alive).toBe(false);
          return {
            name: "shoot",
            args: { target_id: request.actorId === 2 || attempt === 1 ? 4 : 5 },
          };
        },
      },
      Phase.Night,
      Phase.Day,
    );
    expect(world.getAliveEntityIds()).toEqual([1, 6]);
    expect(world.activeDeathActionCount).toBe(0);
    expect(
      asks
        .filter((request) => request.context.stage === "last_words")
        .map((request) => request.actorId),
    ).toEqual([2, 3]);
    expect(
      events.filter((event) => event.type === "hunter_shot").map((event) => event.payload),
    ).toEqual([
      { hunterId: 2, targetId: 4 },
      { hunterId: 3, targetId: 5 },
    ]);
    expect(tries.get(3)).toBe(2);
    const kinds = events.map((event) => event.type);
    expect(kinds.lastIndexOf("last_words_spoken")).toBeLessThan(
      kinds.indexOf("sheriff_badge_transferred"),
    );
    expect(kinds.indexOf("sheriff_badge_transferred")).toBeLessThan(kinds.indexOf("hunter_shot"));
    expect(
      events
        .filter((event) => event.type === "sheriff_badge_transferred")
        .map((event) => event.payload),
    ).toEqual([{ fromId: 2, toId: 1, reason: "night_death" }]);
  });

for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}: the same life is settled once; revival allows a new death and cyclic proposals terminate`, async () => {
    const { world } = scene(locale),
      events: GameEvent[] = [],
      state = { day: 2, phase: Phase.Voting, gameOver: false, result: null };
    let words = 0;
    const provider = {
      async getAction() {
        words++;
        return { name: "speak" as const, args: { text: "raw" } };
      },
    };
    const visits: number[] = [];
    const registry = new EventRegistry(
      new HookRegistry(
        [],
        [
          async (_world, ids) => {
            const id = ids[0];
            visits.push(id);
            return {
              extraDeaths: id === 5 ? [6, 6, 5, 4, 999] : id === 6 ? [5] : [],
              extraDeathSources: {
                4: [DeathCause.Shot],
                5: [DeathCause.Shot],
                6: [DeathCause.Shot],
              },
            };
          },
        ],
      ),
    );
    const resolver = new DeathResolution(world, events, new ToolGateway(), registry, state);
    await resolver.resolve([4], { 4: [DeathCause.Exile] }, provider, Phase.Voting, Phase.Voting);
    await resolver.resolve([4], { 4: [DeathCause.Exile] }, provider, Phase.Voting, Phase.Voting);
    expect(words).toBe(1);
    world.getComponent<{ alive: boolean }>(4, COMPONENT.Alive)!.alive = true;
    await resolver.resolve([4], { 4: [DeathCause.Exile] }, provider, Phase.Voting, Phase.Voting);
    expect(words).toBe(2);
    await resolver.resolve([5], { 5: [DeathCause.Exile] }, provider, Phase.Voting, Phase.Voting);
    expect(visits).toEqual([4, 4, 5, 6]);
    expect(world.getAliveEntityIds()).not.toContain(5);
    expect(world.getAliveEntityIds()).not.toContain(6);
  });

test("last words require explicit initial-night or exile facts; voting self-destruction and shot deaths remain silent", () => {
  const policy = new LastWordsMechanism();
  const table: Array<[Phase, number, DeathCause[], boolean]> = [
    [Phase.Night, 1, [DeathCause.WolfKill], true],
    [Phase.Night, 1, [DeathCause.Poison], true],
    [Phase.Night, 2, [DeathCause.WolfKill], false],
    [Phase.Voting, 2, [DeathCause.Exile], true],
    [Phase.Voting, 2, [DeathCause.SelfDestruct], false],
    [Phase.Voting, 2, [DeathCause.Shot], false],
    [Phase.Night, 1, [DeathCause.Shot], false],
    [Phase.Night, 1, [DeathCause.WolfKill, DeathCause.SelfDestruct], false],
    [Phase.Voting, 2, [], false],
  ];
  for (const [phase, day, causes, expected] of table)
    expect(policy.shouldGrantLastWords(phase, day, causes)).toBe(expected);
});

test("multiple hooks retain compound causes without aliasing their returned source arrays", async () => {
  const { world } = scene("en"),
    poison = [DeathCause.Poison];
  const registry = new HookRegistry(
    [],
    [
      async () => ({ extraDeaths: [4], extraDeathSources: { 4: [DeathCause.Shot] } }),
      async () => ({ extraDeaths: [4], extraDeathSources: { 4: poison } }),
    ],
  );
  const result = await registry.onDeath(
    world,
    [2],
    { 2: [DeathCause.Exile] },
    async () => ({ kind: "invalid" }),
    [],
  );
  poison.push(DeathCause.WolfKill);
  expect(result.extraDeathSources).toEqual({ 4: [DeathCause.Shot, DeathCause.Poison] });
});

test("a later hook failure keeps a completed gun death, original error and closed action windows", async () => {
  const { hunterDeathHook } = await import("../../../src/game/mechanisms/roles/hunter/death_hook");
  const { getHunterState } = await import("../../../src/game/mechanisms/roles/private_state");
  const { world } = scene("en"),
    events: GameEvent[] = [],
    error = new Error("synthetic-later-hook-error");
  let afterError = 0;
  const registry = new EventRegistry(
    new HookRegistry(
      [],
      [
        hunterDeathHook,
        async () => {
          throw error;
        },
        async () => {
          afterError++;
          return { extraDeaths: [], extraDeathSources: {} };
        },
      ],
    ),
  );
  const result = await new DeathResolution(world, events, new ToolGateway(), registry, {
    day: 2,
    phase: Phase.Voting,
    gameOver: false,
    result: null,
  })
    .resolve(
      [2],
      { 2: [DeathCause.Exile] },
      {
        async getAction(request) {
          return request.allowedTools.includes("shoot")
            ? { name: "shoot", args: { target_id: 4 } }
            : null;
        },
      },
      Phase.Voting,
      Phase.Voting,
    )
    .catch((failure) => failure);
  expect(result).toBe(error);
  expect(world.activeDeathActionCount).toBe(0);
  expect(
    events.filter((event) => event.type === "hunter_shot").map((event) => event.payload),
  ).toEqual([{ hunterId: 2, targetId: 4 }]);
  expect(world.getComponent<{ alive: boolean }>(4, COMPONENT.Alive)!.alive).toBe(false);
  expect(getHunterState(world.getComponent<RoleComponent>(2, COMPONENT.Role)!)!.canShoot).toBe(
    false,
  );
  expect(afterError).toBe(0);
});
