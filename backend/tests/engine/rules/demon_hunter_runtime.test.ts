import { expect, test, spyOn } from "bun:test";
import {
  COMPONENT,
  Camp,
  Phase,
  PotionType,
  WinCondition,
  DeathCause,
  StatusMark,
  createAliveComponent,
  type AliveComponent,
  type ActionRequest,
  type RoleComponent,
  type StatusMarksComponent,
} from "../../../src/core";
import type { DeathResolution } from "../../../src/game/engine/death_resolution";
import { DamageResolutionSystem } from "../../../src/core/domain/systems/damage_resolution_system";
import {
  demonHunterFixture,
  demonNightChoice,
  type DemonNightChoices,
} from "../../support/demon_hunter_scenarios";
import { getWitchState } from "../../../src/game/mechanisms/roles/private_state";
import { projectDemonHunter } from "../../../src/game/mechanisms/roles/demon_hunter/authority";
function provider(
  f: ReturnType<typeof demonHunterFixture>,
  choices: DemonNightChoices = {},
  seen: ActionRequest[] = [],
) {
  return {
    getAction: async (request: ActionRequest) => {
      seen.push(request);
      return demonNightChoice(request, f.witchId, choices);
    },
  };
}
function nightDeaths(f: ReturnType<typeof demonHunterFixture>) {
  return f.phaseManager
    .getEvents()
    .filter((e) => e.type === "night_resolved")
    .at(-1)!.payload.deaths;
}
function history(f: ReturnType<typeof demonHunterFixture>) {
  return projectDemonHunter(
    f.world,
    f.world.getComponent<RoleComponent>(f.demonId, COMPONENT.Role)!,
  )!.history;
}
for (const size of [6, 12] as const)
  for (const goal of [WinCondition.SlaughterCity, WinCondition.SlaughterSide])
    for (const locale of ["zh-CN", "en"] as const)
      test(`actual private candidate ${size}/${goal}/${locale}: first-night poison immunity, no hunt, native stock spent`, async () => {
        const f = demonHunterFixture(size, goal, locale),
          seen: ActionRequest[] = [];
        await f.phaseManager.runSingleCycle(
          provider(f, { potion: { target: f.demonId, type: PotionType.Poison } }, seen),
          10,
        );
        expect(nightDeaths(f)).toEqual([]);
        expect(f.world.getAliveEntityIds()).toHaveLength(size);
        expect(seen.some((r) => r.context.stage === ("demon_hunter" as any))).toBe(false);
        expect(
          getWitchState(f.world.getComponent<RoleComponent>(f.witchId, COMPONENT.Role)!)!.poison,
        ).toBe(0);
        expect(history(f)).toEqual([]);
        expect(f.phaseManager.getSnapshot().day).toBe(2);
      });
for (const [title, choices, deaths] of [
  ["true Wolf and doomed hunter still acts", { knife: 6, hunt: 1 }, [1, 6]],
  ["Good target causes backlash plus ordinary knife", { knife: 6, hunt: 3 }, [6]],
  ["explicit abstention retains the response", { hunt: null }, []],
  [
    "native poison and knife remain distinct",
    { knife: 6, hunt: 1, potion: { target: 6, type: PotionType.Poison } },
    [1, 6],
  ],
] as const)
  test(`actual NightPipeline → PhaseManager: ${title}`, async () => {
    const f = demonHunterFixture(),
      seen: ActionRequest[] = [],
      damage = spyOn(f.damage, "resolve");
    await f.phaseManager.runSingleCycle(provider(f), 10);
    await f.phaseManager.runSingleCycle(provider(f, choices, seen), 10);
    expect(nightDeaths(f)).toEqual([...deaths]);
    expect(history(f)).toEqual([{ day: 2, targetId: choices.hunt }]);
    expect(damage).toHaveBeenCalledTimes(2);
    expect(seen.findIndex((r) => r.context.stage === "witch")).toBeLessThan(
      seen.findIndex((r) => r.context.stage === "seer"),
    );
    expect(seen.findIndex((r) => r.context.stage === "seer")).toBeLessThan(
      seen.findIndex((r) => r.context.stage === ("demon_hunter" as any)),
    );
    damage.mockRestore();
  });
test("new causes deny Hunter gun, including compound causes", async () => {
  const { permitsDeathShot } = await import("../../../src/core/domain/deaths");
  expect(permitsDeathShot([DeathCause.DemonHunt], "awa_knife_or_exile_v1")).toBe(false);
  expect(
    permitsDeathShot([DeathCause.WolfKill, DeathCause.DemonHuntBacklash], "awa_knife_or_exile_v1"),
  ).toBe(false);
});

for (const [title, choices, deaths, demonCauses] of [
  ["Guard cannot stop backlash", { guard: 12, hunt: 4 }, [12], [DeathCause.DemonHuntBacklash]],
  [
    "Heal stops knife but cannot stop backlash",
    { knife: 12, hunt: 4, potion: { target: 12, type: PotionType.Heal } },
    [12],
    [DeathCause.DemonHuntBacklash],
  ],
  ["ordinary Guard prevents knife while hunt survives", { guard: 12, knife: 12, hunt: 1 }, [1], []],
  [
    "ordinary Guard plus Heal collision remains lethal",
    { guard: 12, knife: 12, hunt: 1, potion: { target: 12, type: PotionType.Heal } },
    [1, 12],
    [DeathCause.WolfKill],
  ],
  [
    "doomed Witch still contributes original poison immunity",
    { knife: 9, hunt: 1, potion: { target: 12, type: PotionType.Poison } },
    [1, 9],
    [],
  ],
] as const)
  test(`actual twelve-seat protection/source matrix: ${title}`, async () => {
    const f = demonHunterFixture(12),
      resolver = (f.phaseManager as unknown as { deathResolution: DeathResolution })
        .deathResolution,
      calls = spyOn(resolver, "resolve");
    try {
      await f.phaseManager.runSingleCycle(provider(f), 10);
      await f.phaseManager.runSingleCycle(provider(f, choices), 10);
      expect(nightDeaths(f)).toEqual([...deaths]);
      const secondNight = calls.mock.calls.find(
        (call) => call[3] === Phase.Night && call[0].length,
      );
      expect(secondNight?.[1]?.[12] ?? []).toEqual([...demonCauses]);
    } finally {
      calls.mockRestore();
    }
  });
for (const position of ["before_native", "after_native", "after_ordinary_damage"] as const)
  test(`actual pipeline native immunity retains independent generic poison ${position}`, async () => {
    const f = demonHunterFixture(),
      marks = f.world.getComponent<StatusMarksComponent>(6, COMPONENT.StatusMarks)!;
    await f.phaseManager.runSingleCycle(provider(f), 10);
    let added = false;
    const add = () => {
      if (!added) {
        marks.add(StatusMark.PoisonMark);
        added = true;
      }
    };
    const originalResolve = f.damage.resolve.bind(f.damage),
      calls = spyOn(f.damage, "resolve").mockImplementation((world, effects) => {
        const damage = originalResolve(world, effects);
        if (position === "after_ordinary_damage") add();
        return damage;
      });
    try {
      await f.phaseManager.runSingleCycle(
        {
          getAction: async (request) => {
            if (position === "before_native" && request.context.stage === "wolf_discussion") add();
            if (position === "after_native" && request.context.stage === "seer") add();
            return demonNightChoice(request, f.witchId, {
              potion: { target: 6, type: PotionType.Poison },
              hunt: null,
            });
          },
        },
        10,
      );
      expect(nightDeaths(f)).toEqual([6]);
      expect(f.world.getAliveEntityIds()).toEqual([1, 2, 3, 4, 5]);
      expect(history(f)).toEqual([{ day: 2, targetId: null }]);
    } finally {
      calls.mockRestore();
    }
  });
for (const goal of [WinCondition.SlaughterCity, WinCondition.SlaughterSide])
  test(`actual ${goal} terminal Night publishes complete roots including dead winner before game_over`, async () => {
    const f = demonHunterFixture(6, goal),
      seen: ActionRequest[] = [];
    await f.phaseManager.runSingleCycle(provider(f), 10);
    await f.phaseManager.runSingleCycle(
      provider(f, { knife: 6, hunt: 1, potion: { target: 2, type: PotionType.Poison } }, seen),
      10,
    );
    expect(nightDeaths(f)).toEqual([1, 2, 6]);
    const snap = f.phaseManager.getSnapshot();
    expect(snap.gameOver).toBe(true);
    expect(snap.result?.winner).toBe(Camp.Good);
    expect(snap.result?.outcome.kind).toBe("victory");
    if (snap.result?.outcome.kind === "victory")
      expect(snap.result.outcome.winningPlayerIds).toContain(6);
    expect(seen.every((r) => r.phase === Phase.Night)).toBe(true);
    const events = f.phaseManager.getEvents(),
      resolved = events.findLastIndex((e) => e.type === "night_resolved"),
      over = events.findLastIndex((e) => e.type === "game_over");
    expect(over).toBeGreaterThan(resolved);
    expect(f.world.getAliveEntityIds()).toEqual([3, 4, 5]);
  });
for (const goal of [WinCondition.SlaughterCity, WinCondition.SlaughterSide])
  test(`actual ${goal} Hunter additional wave eliminates last Wolf before victory and public complete deaths`, async () => {
    const f = demonHunterFixture(12, goal),
      seen: ActionRequest[] = [];
    await f.phaseManager.runSingleCycle(provider(f), 10);
    await f.phaseManager.runSingleCycle(
      provider(
        f,
        { knife: 10, hunt: 1, potion: { target: 2, type: PotionType.Poison }, shot: 3 },
        seen,
      ),
      10,
    );
    expect(nightDeaths(f)).toEqual([1, 2, 10, 3]);
    expect(f.phaseManager.getSnapshot().result?.winner).toBe(Camp.Good);
    expect(seen.filter((r) => r.allowedTools.includes("shoot"))).toHaveLength(1);
    expect(seen.every((r) => r.phase === Phase.Night)).toBe(true);
    const events = f.phaseManager.getEvents();
    expect(events.findLastIndex((e) => e.type === "hunter_shot")).toBeGreaterThan(-1);
    expect(events.findLastIndex((e) => e.type === "hunter_shot")).toBeLessThan(
      events.findLastIndex((e) => e.type === "night_resolved"),
    );
    expect(f.world.getAliveEntityIds()).toEqual([4, 5, 6, 7, 8, 9, 11, 12]);
  });
test("actual knife plus poison Hunter is dead without gun despite another independent hunt", async () => {
  const f = demonHunterFixture(12),
    seen: ActionRequest[] = [];
  await f.phaseManager.runSingleCycle(provider(f), 10);
  await f.phaseManager.runSingleCycle(
    provider(f, { knife: 10, hunt: 1, potion: { target: 10, type: PotionType.Poison } }, seen),
    10,
  );
  expect(nightDeaths(f)).toEqual([1, 10]);
  expect(seen.filter((r) => r.allowedTools.includes("shoot"))).toHaveLength(0);
});

for (const phase of [
  "before_night",
  "after_seer_request",
  "after_hunt_request",
  "after_damage",
] as const)
  test(`actual engine rejects foreign Alive getter without execution ${phase}`, async () => {
    const f = demonHunterFixture(),
      original = f.world.getComponent<AliveComponent>(3, COMPONENT.Alive)!;
    await f.phaseManager.runSingleCycle(provider(f), 10);
    let reads = 0;
    const revoke = () =>
      f.world.addComponent(3, COMPONENT.Alive, {
        get alive() {
          reads++;
          throw new Error("foreign_alive_read");
        },
        renderPrompt: () => "",
      });
    if (phase === "before_night") revoke();
    const realResolve = f.damage.resolve.bind(f.damage),
      calls = spyOn(f.damage, "resolve").mockImplementation((world, effects) => {
        const damage = realResolve(world, effects);
        if (phase === "after_damage") revoke();
        return damage;
      });
    try {
      await expect(
        f.phaseManager.runSingleCycle(
          {
            getAction: async (request) => {
              if (
                (phase === "after_seer_request" && request.context.stage === "seer") ||
                (phase === "after_hunt_request" &&
                  request.context.stage === ("demon_hunter" as any))
              )
                revoke();
              return demonNightChoice(request, f.witchId, { hunt: 1 });
            },
          },
          10,
        ),
      ).rejects.toThrow(
        phase === "before_night"
          ? "demon_hunter_original_roster_revoked"
          : "demon_hunter_unreadable_world",
      );
      expect(reads).toBe(0);
      expect(original.alive).toBe(true);
      expect(history(f)).toEqual(phase === "after_damage" ? [{ day: 2, targetId: 1 }] : []);
    } finally {
      calls.mockRestore();
    }
  });
for (const target of [1, 6])
  test(`actual postcommit replacement ${target} cancels hunt without erasing history or poisoning new body`, async () => {
    const f = demonHunterFixture(),
      original = f.world.getComponent<AliveComponent>(target, COMPONENT.Alive)!;
    await f.phaseManager.runSingleCycle(provider(f), 10);
    const realResolve = f.damage.resolve.bind(f.damage),
      replacement = createAliveComponent(),
      calls = spyOn(f.damage, "resolve").mockImplementation((world, effects) => {
        const damage = realResolve(world, effects);
        world.addComponent(target, COMPONENT.Alive, replacement);
        return damage;
      });
    try {
      await f.phaseManager.runSingleCycle(provider(f, { hunt: 1 }), 10);
      expect(nightDeaths(f)).toEqual([]);
      expect(original.alive).toBe(true);
      expect(replacement.alive).toBe(true);
      expect(history(f)).toEqual([{ day: 2, targetId: 1 }]);
      await expect(f.phaseManager.runSingleCycle(provider(f), 10)).rejects.toThrow(
        "demon_hunter_original_roster_revoked",
      );
    } finally {
      calls.mockRestore();
    }
  });
test("actual recursive cycle and jump reject while the original hunt window is open", async () => {
  const f = demonHunterFixture();
  await f.phaseManager.runSingleCycle(provider(f), 10);
  await f.phaseManager.runSingleCycle(
    {
      getAction: async (request) => {
        if (request.context.stage === ("demon_hunter" as any)) {
          expect(() => f.phaseManager.jumpTo(Phase.Day)).toThrow("demon_hunter_phase_reentry");
          await expect(f.phaseManager.runSingleCycle(provider(f), 10)).rejects.toThrow(
            "demon_hunter_cycle_reentry",
          );
        }
        return demonNightChoice(request, f.witchId, { hunt: 1 });
      },
    },
    10,
  );
  expect(history(f)).toEqual([{ day: 2, targetId: 1 }]);
  expect(nightDeaths(f)).toEqual([1]);
});
test("actual missing hunt preserves native Witch consumption prefix and denies retry of the same night", async () => {
  const f = demonHunterFixture();
  await f.phaseManager.runSingleCycle(provider(f), 10);
  await expect(
    f.phaseManager.runSingleCycle(
      {
        getAction: async (request) =>
          request.context.stage === ("demon_hunter" as any)
            ? null
            : demonNightChoice(request, f.witchId, {
                potion: { target: 6, type: PotionType.Poison },
              }),
      },
      10,
    ),
  ).rejects.toThrow("demon_hunter_required_action_invalid");
  expect(getWitchState(f.world.getComponent<RoleComponent>(5, COMPONENT.Role)!)!.poison).toBe(0);
  expect(f.world.getAliveEntityIds()).toHaveLength(6);
  expect(history(f)).toEqual([]);
  await expect(f.phaseManager.runSingleCycle(provider(f), 10)).rejects.toThrow(
    "demon_hunter_cycle_reentry",
  );
  expect(() => f.phaseManager.jumpTo(Phase.Day)).toThrow("demon_hunter_phase_reentry");
});

for (const size of [6, 12] as const)
  for (const guarded of size === 12 ? [false, true] : [false])
    for (const at of ["seer", "after_damage"] as const)
      test(`actual Heal source revoked ${size}/${guarded}/${at}: real stock stays spent and ordinary matrix recomputes`, async () => {
        const f = demonHunterFixture(size);
        await f.phaseManager.runSingleCycle(provider(f), 10);
        const realResolve = f.damage.resolve.bind(f.damage);
        let revoked = false;
        const revoke = () => {
          if (!revoked) {
            f.world.addComponent(f.witchId, COMPONENT.Alive, createAliveComponent());
            revoked = true;
          }
        };
        const calls = spyOn(f.damage, "resolve").mockImplementation((world, effects) => {
          const damage = realResolve(world, effects);
          if (at === "after_damage") revoke();
          return damage;
        });
        try {
          await f.phaseManager.runSingleCycle(
            {
              getAction: async (request) => {
                if (at === "seer" && request.context.stage === "seer") revoke();
                return demonNightChoice(request, f.witchId, {
                  knife: size,
                  guard: guarded ? size : null,
                  hunt: null,
                  potion: { target: size, type: PotionType.Heal },
                });
              },
            },
            10,
          );
          expect(nightDeaths(f)).toEqual(guarded ? [] : [size]);
          expect(
            getWitchState(f.world.getComponent<RoleComponent>(f.witchId, COMPONENT.Role)!)!.heal,
          ).toBe(0);
          expect(history(f)).toEqual([{ day: 2, targetId: null }]);
        } finally {
          calls.mockRestore();
        }
      });
test("actual Night→PM microtask handoff rejects external getter before read and retains committed choice", async () => {
  const f = demonHunterFixture();
  await f.phaseManager.runSingleCycle(provider(f), 10);
  const original = f.world.getComponent<AliveComponent>(3, COMPONENT.Alive)!,
    realResolve = f.damage.resolve.bind(f.damage);
  let reads = 0;
  const calls = spyOn(f.damage, "resolve").mockImplementation((world, effects) => {
    const damage = realResolve(world, effects);
    queueMicrotask(() =>
      Object.defineProperty(original, "alive", {
        get() {
          reads++;
          return true;
        },
        set() {},
        enumerable: true,
        configurable: true,
      }),
    );
    return damage;
  });
  try {
    await expect(
      f.phaseManager.runSingleCycle(provider(f, { knife: 6, hunt: 1 }), 10),
    ).rejects.toThrow("demon_hunter_unreadable_world");
    expect(reads).toBe(0);
    expect(history(f)).toEqual([{ day: 2, targetId: 1 }]);
    const { demonHunterFreezeDay } =
      await import("../../../src/game/mechanisms/roles/demon_hunter/authority");
    expect(() => demonHunterFreezeDay(f.world)).toThrow("demon_hunter_freeze_unavailable");
  } finally {
    calls.mockRestore();
  }
});
test("actual selected knife never authorizes a generic WolfKill mark on another target", async () => {
  const f = demonHunterFixture();
  await f.phaseManager.runSingleCycle(provider(f), 10);
  await f.phaseManager.runSingleCycle(
    {
      getAction: async (request) => {
        if (request.context.stage === "seer")
          f.world
            .getComponent<StatusMarksComponent>(3, COMPONENT.StatusMarks)!
            .add(StatusMark.WolfKillMark);
        return demonNightChoice(request, f.witchId, { knife: 6, hunt: null });
      },
    },
    10,
  );
  expect(nightDeaths(f)).toEqual([6]);
  expect(f.world.getAliveEntityIds()).toEqual([1, 2, 3, 4, 5]);
});
test("direct actual NightPipeline reentry cannot close the already waiting original Witch request", async () => {
  const f = demonHunterFixture();
  await f.phaseManager.runSingleCycle(provider(f), 10);
  const pipeline = (
    f.phaseManager as unknown as {
      nightPipeline: import("../../../src/game/engine/phase_pipeline/night_pipeline").NightPipeline;
    }
  ).nightPipeline;
  const { assertRequestDelivery } = await import("../../../src/core");
  await f.phaseManager.runSingleCycle(
    {
      getAction: async (request) => {
        if (request.context.stage === "witch") {
          expect(() => assertRequestDelivery(request)).not.toThrow();
          await expect(pipeline.execute(f.config, provider(f), 2)).rejects.toThrow(
            "demon_hunter_night_unavailable",
          );
          expect(() => assertRequestDelivery(request)).not.toThrow();
        }
        return demonNightChoice(request, f.witchId, { hunt: 1 });
      },
    },
    10,
  );
  expect(nightDeaths(f)).toEqual([1]);
  expect(history(f)).toEqual([{ day: 2, targetId: 1 }]);
});

for (const position of ["before_native", "after_native", "after_ordinary_damage"] as const)
  test(`actual Heal source revocation retains independent generic Heal ${position}`, async () => {
    const f = demonHunterFixture(),
      marks = f.world.getComponent<StatusMarksComponent>(6, COMPONENT.StatusMarks)!;
    await f.phaseManager.runSingleCycle(provider(f), 10);
    let added = false;
    const add = () => {
      if (!added) {
        marks.add(StatusMark.HealMark);
        added = true;
      }
    };
    const realResolve = f.damage.resolve.bind(f.damage),
      calls = spyOn(f.damage, "resolve").mockImplementation((world, effects) => {
        const damage = realResolve(world, effects);
        f.world.addComponent(5, COMPONENT.Alive, createAliveComponent());
        if (position === "after_ordinary_damage") add();
        return damage;
      });
    try {
      await f.phaseManager.runSingleCycle(
        {
          getAction: async (request) => {
            if (position === "before_native" && request.context.stage === "wolf_discussion") add();
            if (position === "after_native" && request.context.stage === "seer") add();
            return demonNightChoice(request, f.witchId, {
              knife: 6,
              hunt: null,
              potion: { target: 6, type: PotionType.Heal },
            });
          },
        },
        10,
      );
      expect(nightDeaths(f)).toEqual([]);
      expect(getWitchState(f.world.getComponent<RoleComponent>(5, COMPONENT.Role)!)!.heal).toBe(0);
    } finally {
      calls.mockRestore();
    }
  });
test("actual pure-data Heal refund cannot renew the consumed source or protect the original knife target", async () => {
  const f = demonHunterFixture();
  await f.phaseManager.runSingleCycle(provider(f), 10);
  await f.phaseManager.runSingleCycle(
    {
      getAction: async (request) => {
        if (request.context.stage === "seer")
          getWitchState(f.world.getComponent<RoleComponent>(5, COMPONENT.Role)!)!.heal = 1;
        return demonNightChoice(request, f.witchId, {
          knife: 6,
          hunt: null,
          potion: { target: 6, type: PotionType.Heal },
        });
      },
    },
    10,
  );
  expect(nightDeaths(f)).toEqual([6]);
  const { demonHunterAuditPlayer } =
    await import("../../../src/game/mechanisms/roles/demon_hunter/authority");
  expect((demonHunterAuditPlayer(f.world, 5)!.abilities as any)["native:potion"].state.heal).toBe(
    0,
  );
});

for (const trigger of ["last_words", "hunter_shot"] as const)
  test(`actual death-chain provider ${trigger} rejects unrelated foreign Alive without reads or public completion`, async () => {
    const f = demonHunterFixture(trigger === "last_words" ? 6 : 12);
    if (trigger === "hunter_shot") await f.phaseManager.runSingleCycle(provider(f), 10);
    const unrelated = trigger === "last_words" ? 4 : 8,
      life = f.world.getComponent<AliveComponent>(unrelated, COMPONENT.Alive)!;
    let reads = 0;
    await expect(
      f.phaseManager.runSingleCycle(
        {
          getAction: async (request) => {
            if (request.context.stage === trigger)
              Object.defineProperty(life, "alive", {
                get() {
                  reads++;
                  return true;
                },
                set() {},
                enumerable: true,
                configurable: true,
              });
            return demonNightChoice(request, f.witchId, {
              knife: trigger === "last_words" ? 3 : 10,
              hunt: 1,
              shot: 3,
            });
          },
        },
        10,
      ),
    ).rejects.toThrow("demon_hunter_unreadable_world");
    expect(reads).toBe(0);
    expect(f.phaseManager.getEvents().filter((e) => e.type === "night_resolved")).toHaveLength(
      trigger === "last_words" ? 0 : 1,
    );
    expect(history(f)).toEqual(trigger === "last_words" ? [] : [{ day: 2, targetId: 1 }]);
  });
test("actual completed death-chain handoff rejects microtask getter before public death scan or victory", async () => {
  const f = demonHunterFixture();
  await f.phaseManager.runSingleCycle(provider(f), 10);
  const resolver = (f.phaseManager as unknown as { deathResolution: DeathResolution })
      .deathResolution,
    realResolve = resolver.resolve.bind(resolver),
    life = f.world.getComponent<AliveComponent>(3, COMPONENT.Alive)!;
  let reads = 0;
  const calls = spyOn(resolver, "resolve").mockImplementation(async (...args) => {
    const result = await realResolve(...args);
    queueMicrotask(() =>
      Object.defineProperty(life, "alive", {
        get() {
          reads++;
          return true;
        },
        set() {},
        enumerable: true,
        configurable: true,
      }),
    );
    return result;
  });
  try {
    await expect(
      f.phaseManager.runSingleCycle(provider(f, { knife: 6, hunt: 1 }), 10),
    ).rejects.toThrow("demon_hunter_unreadable_world");
    expect(reads).toBe(0);
    expect(history(f)).toEqual([{ day: 2, targetId: 1 }]);
    expect(f.phaseManager.getEvents().filter((e) => e.type === "night_resolved")).toHaveLength(1);
    expect(f.phaseManager.getSnapshot().gameOver).toBe(false);
    const { demonHunterFreezeDay } =
      await import("../../../src/game/mechanisms/roles/demon_hunter/authority");
    expect(() => demonHunterFreezeDay(f.world)).toThrow("demon_hunter_freeze_unavailable");
  } finally {
    calls.mockRestore();
  }
});
