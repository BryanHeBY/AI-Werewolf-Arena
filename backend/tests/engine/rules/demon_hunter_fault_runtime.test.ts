import { expect, test, spyOn } from "bun:test";
import {
  COMPONENT,
  PotionType,
  type ActionRequest,
  type AliveComponent,
  type RoleComponent,
} from "../../../src/core";
import { DEMON_HUNTER_POLICY } from "@ai-werewolf-arena/game-text";
import { demonHunterFixture, demonNightChoice } from "../../support/demon_hunter_scenarios";
import { getWitchState } from "../../../src/game/mechanisms/roles/private_state";
import { captureCheckpoint } from "../../../src/runtime/simulation/reproduction_context";
import { SessionRecordManager } from "../../../src/recording/session_recorder";
import { runWithSessionRecorder } from "../../../src/recording/recording_context";
import { createTestTempDirectory } from "../../support/temp_directory";
function plan(actorId: number, playerId = actorId, day = 2) {
  return {
    version: "awa_fault_plan_v1",
    steps: [
      {
        id: "late-life",
        at: {
          day,
          point: "before_night_source_freeze",
          afterDecision: { actorId, stage: "demon_hunter", turn: 1 },
        },
        mutation: { kind: "replace_alive_component", playerId, alive: true },
      },
    ],
  };
}
function provider(witch: number, hunt?: number | null, poison = false) {
  return {
    getAction: async (request: ActionRequest) =>
      demonNightChoice(request, witch, {
        hunt,
        ...(poison ? { potion: { target: 3, type: PotionType.Poison } } : {}),
      }),
  };
}
for (const size of [6, 12] as const)
  for (const locale of ["zh-CN", "en"] as const)
    for (const replaced of ["actor", "target"] as const)
      test(`actual fault boundary ${size}/${locale}/${replaced}: committed prefix, one cancellation, no hunt damage`, async () => {
        const input = plan(size, replaced === "actor" ? size : 1),
          f = demonHunterFixture(size, undefined, locale, undefined, input),
          original = f.world.getComponent<AliveComponent>(
            input.steps[0]!.mutation.playerId,
            COMPONENT.Alive,
          );
        input.steps[0]!.mutation.playerId = 3; // Constructor retains independent input.
        await f.phaseManager.runSingleCycle(provider(f.witchId), 10);
        await f.phaseManager.runSingleCycle(provider(f.witchId, 1, true), 10);
        f.phaseManager.assertFaultPlanConsumed();
        expect(f.world.getComponent(replaced === "actor" ? size : 1, COMPONENT.Alive)).not.toBe(
          original,
        );
        expect(f.phaseManager.getFaultPlan()?.steps[0]!.mutation.playerId).toBe(
          replaced === "actor" ? size : 1,
        );
        const facts = f.phaseManager
          .getEvents()
          .filter((e) => e.type === "demon_hunter_chosen" || e.type === "demon_hunter_cancelled");
        expect(facts.map((e): [string, unknown] => [e.type, e.payload])).toEqual([
          [
            "demon_hunter_chosen",
            { policy: DEMON_HUNTER_POLICY, actorId: size, day: 2, targetId: 1 },
          ],
          [
            "demon_hunter_cancelled",
            {
              policy: DEMON_HUNTER_POLICY,
              actorId: size,
              day: 2,
              targetId: 1,
              reason: "authority_revoked",
              faultId: "late-life",
            },
          ],
        ]);
        expect(
          f.phaseManager
            .getEvents()
            .filter((e) => e.type === "night_resolved")
            .at(-1)!.payload.deaths,
        ).toEqual([3]);
        expect(() =>
          captureCheckpoint(
            f.world,
            f.phaseManager.getSnapshot(),
            2,
            true,
            f.phaseManager.getEvents().length,
          ),
        ).toThrow();
        const cp = captureCheckpoint(
          f.world,
          f.phaseManager.getSnapshot(),
          2,
          false,
          f.phaseManager.getEvents().length,
          new Error("original_life_replaced"),
        );
        expect(cp.players.find((p) => p.id === size)!.privateState.demonHunter).toEqual({
          policy: DEMON_HUNTER_POLICY,
          history: [{ day: 2, targetId: 1 }],
        });
        expect(
          getWitchState({
            privateState: cp.players.find((p) => p.id === f.witchId)!.privateState,
          } as RoleComponent)!.poison,
        ).toBe(0);
        expect(cp.players.find((p) => p.id === 1)!.alive).toBe(true);
        expect(cp.players.find((p) => p.id === 3)!.alive).toBe(false);
        await expect(f.phaseManager.runSingleCycle(provider(f.witchId), 10)).rejects.toThrow();
        expect(
          f.phaseManager.getEvents().filter((e) => e.type === "demon_hunter_cancelled"),
        ).toHaveLength(1);
      });
test("fault boundary requires a real nonempty committed choice and never fabricates cancellation", async () => {
  const f = demonHunterFixture(6, undefined, undefined, undefined, plan(6));
  await f.phaseManager.runSingleCycle(provider(5), 10);
  await expect(f.phaseManager.runSingleCycle(provider(5, null), 10)).rejects.toThrow(
    "fault_plan_decision_boundary_invalid",
  );
  expect(
    f.phaseManager.getEvents().filter((e) => e.type === "demon_hunter_cancelled"),
  ).toHaveLength(0);
  expect(() => f.phaseManager.assertFaultPlanConsumed()).toThrow("fault_plan_failed");
});
test("unused future fault cannot be accepted at end of a finite run", async () => {
  const f = demonHunterFixture(6, undefined, undefined, undefined, plan(6, 6, 3));
  await f.phaseManager.runSingleCycle(provider(5), 10);
  expect(() => f.phaseManager.assertFaultPlanConsumed()).toThrow("fault_plan_unconsumed");
});
test("actual session records fault input and source result once in order; accepted choice remains", async () => {
  const f = demonHunterFixture(6, undefined, undefined, undefined, plan(6, 1)),
    root = await createTestTempDirectory("awa-demon-fault-"),
    manager = await SessionRecordManager.create(
      {
        sessionId: "actual-fault",
        board: "private-candidate",
        startedAtIso: new Date(0).toISOString(),
      },
      root,
    );
  await runWithSessionRecorder(manager, async () => {
    await f.phaseManager.runSingleCycle(provider(5), 10);
    await f.phaseManager.runSingleCycle(provider(5, 1), 10);
  });
  const summary = await manager.finalize({
    endedAtIso: new Date(100).toISOString(),
    winner: null,
    finishReason: "candidate-test",
    players: [],
  });
  const ops = summary.logicOps ?? [],
    faults = ops.filter((o) => o.op === "fault_applied");
  expect(faults).toHaveLength(1);
  expect(faults[0]!.input).toEqual({ version: "awa_fault_plan_v1", step: plan(6, 1).steps[0] });
  expect(faults[0]!.output).toEqual({ originalVersion: 0, replacementVersion: 0 });
  const sources = ops.filter((o) => o.op === "demon_hunter_sources_frozen");
  expect(sources).toHaveLength(2);
  expect(ops.indexOf(faults[0]!)).toBeLessThan(ops.indexOf(sources[1]!));
  expect(sources[1]!.output?.hunt).toEqual({
    choice: { day: 2, targetId: 1 },
    damage: null,
    cancelled: {
      policy: DEMON_HUNTER_POLICY,
      actorId: 6,
      day: 2,
      targetId: 1,
      reason: "authority_revoked",
      faultId: "late-life",
    },
  });
  expect(
    ops.some(
      (o) => o.status === "ok" && o.op === "validate_tool_call" && o.input?.tool === "demon_hunt",
    ),
  ).toBe(true);
});
test("mandatory fault recorder failure keeps actual mutation and accepted history, prevents successful source op", async () => {
  const f = demonHunterFixture(6, undefined, undefined, undefined, plan(6)),
    root = await createTestTempDirectory("awa-demon-fault-fail-"),
    manager = await SessionRecordManager.create(
      {
        sessionId: "fault-write-fail",
        board: "candidate",
        startedAtIso: new Date(0).toISOString(),
      },
      root,
    ),
    original = manager.recordLogicOp.bind(manager),
    write = spyOn(manager, "recordLogicOp").mockImplementation((input) => {
      if (input.op === "fault_applied") throw new Error("fault_write_failed");
      original(input);
    }),
    before = f.world.getComponent(6, COMPONENT.Alive);
  try {
    await runWithSessionRecorder(manager, async () => {
      await f.phaseManager.runSingleCycle(provider(5), 10);
      await expect(f.phaseManager.runSingleCycle(provider(5, 1), 10)).rejects.toThrow(
        "fault_write_failed",
      );
    });
    expect(f.world.getComponent(6, COMPONENT.Alive)).not.toBe(before);
    expect(() => f.phaseManager.assertFaultPlanConsumed()).toThrow("fault_plan_failed");
    expect(
      f.phaseManager.getEvents().filter((e) => e.type === "demon_hunter_cancelled"),
    ).toHaveLength(0);
    const cp = captureCheckpoint(
      f.world,
      f.phaseManager.getSnapshot(),
      2,
      false,
      0,
      new Error("fault_write_failed"),
    );
    expect(cp.players.find((p) => p.id === 6)!.privateState.demonHunter).toEqual({
      policy: DEMON_HUNTER_POLICY,
      history: [{ day: 2, targetId: 1 }],
    });
  } finally {
    write.mockRestore();
    await manager.finalize({
      endedAtIso: new Date(100).toISOString(),
      winner: null,
      finishReason: "candidate-test",
      players: [],
    });
  }
});

for (const state of ["closing", "closed"] as const)
  test(`mandatory fault cannot silently append to ${state} recorder`, async () => {
    const f = demonHunterFixture(6, undefined, undefined, undefined, plan(6)),
      root = await createTestTempDirectory("awa-demon-fault-closed-"),
      manager = await SessionRecordManager.create(
        {
          sessionId: `fault-${state}`,
          board: "candidate",
          startedAtIso: new Date(0).toISOString(),
        },
        root,
      );
    await f.phaseManager.runSingleCycle(provider(5), 10);
    const before = f.world.getComponent(6, COMPONENT.Alive),
      finalization = manager.finalize({
        endedAtIso: new Date(100).toISOString(),
        winner: null,
        finishReason: "candidate-test",
        players: [],
      });
    if (state === "closed") await finalization;
    await runWithSessionRecorder(manager, async () => {
      await expect(f.phaseManager.runSingleCycle(provider(5, 1), 10)).rejects.toThrow(
        "mandatory_logic_op_recording_closed",
      );
    });
    expect(f.world.getComponent(6, COMPONENT.Alive)).not.toBe(before);
    expect(() => f.phaseManager.assertFaultPlanConsumed()).toThrow("fault_plan_failed");
    expect(
      f.phaseManager.getEvents().filter((e) => e.type === "demon_hunter_cancelled"),
    ).toHaveLength(0);
    expect((await finalization).logicOps?.filter((o) => o.op === "fault_applied") ?? []).toEqual(
      [],
    );
  });
