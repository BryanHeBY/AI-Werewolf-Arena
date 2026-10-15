/**
 * Engine recording/replay scenarios verify complete and faulted Demon Hunter causal tapes.
 * Input: Literal choices, fixed RNG, executed fault plans and real recorder/checkpoints.
 * Output and independent oracle: Handwritten poison/hunt/terminal prefixes and rejection of forged fault labels or coherent archive mutants.
 * The test never calls a billed model or rewrites expected fixture/Tape bytes.
 */
import { expect, test } from "bun:test";
import { promises as fs } from "node:fs";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import {
  createRandom,
  COMPONENT,
  Camp,
  PotionType,
  WinCondition,
  type ActionRequest,
  type ToolCall,
} from "../../../../src/domain";
import { SessionRecordManager } from "../../../../src/recording/session/recorder";
import { runWithSessionRecorder } from "../../../../src/recording/session/context";
import {
  beginGameReproduction,
  captureCheckpoint,
  currentEngineVersion,
} from "../../../../src/app/simulation/reproduction-context";
import {
  readReproduction,
  replayReproduction,
} from "../../../../src/app/simulation/replay-reproduction";
import {
  parseReproductionRecord,
  type RecordedCheckpoint,
} from "../../../../src/recording/reproduction/format";
import { GameEventRecorder } from "../../../../src/app/game-event-recorder";
import { demonHunterBoard, demonHunterDeck } from "../../../support/features/demon-hunter/builders/candidate-world";
import { demonNightChoice } from "../../../support/features/demon-hunter/drivers/actions";
import { createTestTempDirectory } from "../../../support/drivers/temp-directories";
let version: ReturnType<typeof currentEngineVersion> | undefined;
type Mode =
  | "normal"
  | "missing"
  | "late"
  | "fault_actor"
  | "fault_target"
  | "backlash"
  | "abstain"
  | "immunity"
  | "compound"
  | "guard_collision"
  | "gun"
  | "gun_invalid"
  | "gun_missing"
  | "gun_pass";
async function recordGame(
  size: 6 | 12 = 6,
  goal = WinCondition.SlaughterCity,
  locale: "zh-CN" | "en" = "zh-CN",
  mode: Mode = "normal",
) {
  const faultPlan = mode.startsWith("fault")
    ? {
        version: "awa_fault_plan_v1",
        steps: [
          {
            id: "late-life",
            at: {
              day: 2,
              point: "before_night_source_freeze",
              afterDecision: { actorId: size, stage: "demon_hunter", turn: 1 },
            },
            mutation: {
              kind: "replace_alive_component",
              playerId: mode === "fault_actor" ? size : 1,
              alive: true,
            },
          },
        ],
      }
    : undefined;
  const config = demonHunterBoard(size, goal),
    context = bootstrapGame(config, {
      fixedRoles: demonHunterDeck(size),
      locale,
      random: createRandom(`demon:${size}:${goal}:${locale}:${mode}`),
      faultPlan,
    }),
    root = await createTestTempDirectory("awa-demon-tape-"),
    manager = await SessionRecordManager.create(
      {
        sessionId: "game",
        board: `demon_${size}`,
        startedAtIso: new Date().toISOString(),
        locale,
        random: context.random.metadata,
      },
      root,
    ),
    recorder = new GameEventRecorder(
      { world: context.world, replayManager: manager },
      context.phaseManager.getSnapshot().phase,
    ),
    witch = size === 6 ? 5 : 9;
  let failure: unknown, last: RecordedCheckpoint | undefined;
  const provider = {
    async getAction(request: ActionRequest): Promise<ToolCall | null> {
      const day = request.context.day;
      if (request.allowedTools.includes("shoot") && mode.startsWith("gun_")) {
        if (mode === "gun_missing") return null;
        return { name: "shoot", args: { target_id: mode === "gun_pass" ? null : request.actorId } };
      }
      if (request.allowedTools.includes("check_identity"))
        return {
          name: "check_identity",
          args: {
            target_id: context.world.getAliveEntityIds().find((id) => id !== request.actorId)!,
          },
        };
      if (request.allowedTools.includes("demon_hunt")) {
        if (mode === "missing") return null;
        if (mode === "late") request.deadlineAtMs = Date.now() - 1;
        const target =
          mode === "abstain" && day === 2
            ? null
            : (mode === "backlash" || mode === "compound") && day === 2
              ? size === 6
                ? 3
                : 4
              : mode.startsWith("gun")
                ? 3
                : day === 2
                  ? 1
                  : 3;
        return { name: "demon_hunt", args: { target_id: target, abstain: target === null } };
      }
      if (
        request.allowedTools.includes("vote") &&
        day >= 2 &&
        [
          "backlash",
          "abstain",
          "immunity",
          "compound",
          "guard_collision",
          "gun_invalid",
          "gun_missing",
          "gun_pass",
        ].includes(mode)
      ) {
        const target =
          mode === "guard_collision" ? day : mode === "immunity" ? 2 : day === 2 ? 1 : 3;
        return {
          name: "vote",
          args: {
            target_id: request.actorId === target ? null : target,
            abstain: request.actorId === target,
          },
        };
      }
      const choices =
        mode === "immunity" && day === 1
          ? { potion: { target: size, type: PotionType.Poison } }
          : day === 2
            ? {
                ...([
                  "normal",
                  "backlash",
                  "abstain",
                  "compound",
                  "gun",
                  "gun_invalid",
                  "gun_missing",
                  "gun_pass",
                ].includes(mode)
                  ? { potion: { target: 2, type: PotionType.Poison } }
                  : {}),
                ...(mode === "compound" ? { knife: size } : {}),
                ...(mode === "guard_collision"
                  ? { knife: size, guard: size, potion: { target: size, type: PotionType.Heal } }
                  : {}),
                ...(mode.startsWith("gun") ? { knife: 10, shot: 1 } : {}),
              }
            : {};
      return demonNightChoice(request, witch, choices);
    },
  };
  await runWithSessionRecorder(manager, async () => {
    const trace = beginGameReproduction(manager, context, {
      engine: await (version ??= currentEngineVersion()),
      boardId: `demon_${size}`,
      ...(void config, {}),
      locale,
      maxDays: 8,
    });
    for (let cycle = 1; cycle <= 8 && !context.phaseManager.getSnapshot().gameOver; cycle++) {
      try {
        await context.phaseManager.runSingleCycle(
          { getAction: (r) => trace.decide(r, provider) },
          8,
        );
        last = captureCheckpoint(
          context.world,
          context.phaseManager.getSnapshot(),
          cycle,
          true,
          context.phaseManager.getEvents().length,
        );
      } catch (error) {
        failure = error;
        manager.noteReproductionFailure("cycle", error);
        last = captureCheckpoint(
          context.world,
          context.phaseManager.getSnapshot(),
          cycle,
          false,
          context.phaseManager.getEvents().length,
          error,
        );
      }
      trace.checkpoint(last, context.phaseManager.getEvents());
      recorder.flush(context.phaseManager.getEvents());
      if (failure) break;
    }
    const snapshot = context.phaseManager.getSnapshot();
    await manager.finalize({
      endedAtIso: new Date().toISOString(),
      winner: snapshot.result?.winner ?? null,
      finishReason: failure ? "runtime_error" : snapshot.result!.reason,
      ...(snapshot.result ? { gameResult: snapshot.result } : {}),
      players: last!.players.map((p) => ({
        player_id: p.id,
        role: p.role,
        camp: p.camp,
        alive: p.alive,
      })),
    });
  });
  return {
    record: await readReproduction(`${manager.sessionDir}/reproduction.json`),
    root,
    directory: manager.sessionDir,
    failure,
  };
}
for (const size of [6, 12] as const)
  for (const goal of [WinCondition.SlaughterCity, WinCondition.SlaughterSide])
    for (const locale of ["zh-CN", "en"] as const)
      test(`actual pure action Demon Tape ${size}/${goal}/${locale}: normal native poison and hunt complete victory`, async () => {
        const { record, root, failure } = await recordGame(size, goal, locale);
        expect(failure).toBeUndefined();
        expect(record.checkpoints.at(-1)!.snapshot.result!.winner).toBe(Camp.Good);
        expect(record.metadata.faultPlan).toBeUndefined();
        const result = await replayReproduction(record, root);
        expect(result.snapshot).toEqual(record.checkpoints.at(-1)!.snapshot);
      });
for (const size of [6, 12] as const)
  for (const locale of ["zh-CN", "en"] as const)
    for (const mode of ["missing", "late", "fault_actor", "fault_target"] as const)
      test(`actual ${mode} partial Demon Tape ${size}/${locale}: failed CP prefix and same real replay`, async () => {
        const { record, root, failure } = await recordGame(
          size,
          WinCondition.SlaughterCity,
          locale,
          mode,
        );
        expect(failure).toBeDefined();
        expect(record.checkpoints.at(-1)!.complete).toBe(false);
        expect(record.metadata.faultPlan !== undefined).toBe(mode.startsWith("fault"));
        expect(record.events.filter((e) => e.type === "demon_hunter_chosen")).toHaveLength(
          mode.startsWith("fault") ? 1 : 0,
        );
        const result = await replayReproduction(record, root);
        expect(result.snapshot).toEqual(record.checkpoints.at(-1)!.snapshot);
      });
test("fault-plan causal mutants cannot substitute labels for executed independent inputs", async () => {
  const { record } = await recordGame(6, undefined, "en", "fault_target");
  const patches: Array<(r: any) => void> = [
    (r) => delete r.metadata.faultPlan,
    (r) => (r.metadata.faultPlan.steps[0].mutation.playerId = 5),
    (r) => (r.metadata.faultPlan.steps[0].at.day = 3),
    (r) => (r.metadata.faultPlan.steps[0].at.point = "after_night_source_freeze"),
    (r) => (r.operations = r.operations.filter((o: any) => o.op !== "fault_applied")),
    (r) => (r.events = r.events.filter((e: any) => e.type !== "demon_hunter_cancelled")),
    (r) =>
      (r.events.find((e: any) => e.type === "demon_hunter_cancelled").payload.faultId = "invented"),
    (r) => {
      const s = r.operations.filter((o: any) => o.op === "demon_hunter_sources_frozen")[1].output;
      s.hunt.damage = { targetId: 1, cause: "demon_hunt" };
      s.deaths = [1];
      s.death_sources = { "1": ["demon_hunt"] };
    },
    (r) => (r.checkpoints.at(-1).players[5].privateState.demonHunter.history[0].targetId = 2),
    (r) => (r.events.find((e: any) => e.type === "demon_hunter_chosen").payload.camp = "wolf"),
    (r) => (r.events.find((e: any) => e.type === "demon_hunter_cancelled").audience = [6]),
  ];
  for (const patch of patches) {
    const bad = structuredClone(record);
    patch(bad);
    expect(() => parseReproductionRecord(bad)).toThrow();
  }
});

for (const locale of ["zh-CN", "en"] as const)
  for (const [size, mode] of [
    [6, "backlash"],
    [6, "abstain"],
    [6, "immunity"],
    [6, "compound"],
    [12, "guard_collision"],
    [12, "gun"],
  ] as const)
    test(`actual ${mode} causal Tape ${size}/${locale}: native matrix and complete Night roots`, async () => {
      const { record, root, directory, failure } = await recordGame(size, undefined, locale, mode);
      expect(failure).toBeUndefined();
      expect(record.checkpoints.at(-1)!.snapshot.result!.winner).toBe(Camp.Good);
      if (mode === "immunity")
        expect(record.events.filter((e) => e.type === "demon_hunter_poison_immune")).toHaveLength(
          1,
        );
      if (mode === "gun") {
        await fs.copyFile(
          `${directory}/replay.json`,
          `/tmp/awa-p9-demon-terminal-${locale}.replay.json`,
        );
        await fs.writeFile(
          `/tmp/awa-p9-demon-terminal-${locale}.checkpoint.json`,
          JSON.stringify(record.checkpoints.at(-1)),
        );
        expect(record.events.filter((e) => e.type === "hunter_shot").map((e) => e.payload)).toEqual(
          [{ hunterId: 10, targetId: 1 }],
        );
        expect(
          [
            ...(record.events.filter((e) => e.type === "night_resolved").at(-1)!.payload
              .deaths as number[]),
          ].sort((a, b) => a - b),
        ).toEqual([1, 2, 3, 10]);
      }
      expect((await replayReproduction(record, root)).snapshot).toEqual(
        record.checkpoints.at(-1)!.snapshot,
      );
    });
test("independent parser rejects native stock refunds/envelope forgery and all requested God-only facts", async () => {
  const { record } = await recordGame(12, undefined, "en", "gun");
  const patches: Array<(r: any) => void> = [
    (r) => (r.operations = r.operations.filter((o: any) => o.op !== "demon_hunter_sources_frozen")),
    (r) => delete r.checkpoints[0].players[8].privateState.abilities,
    (r) => (r.checkpoints[0].players[8].privateState.abilities["native:potion"].state.heal = 99),
    (r) =>
      (r.checkpoints.at(-1).players[8].privateState.abilities["native:potion"].state.poison = 1),
    (r) => (r.checkpoints.at(-1).players[7].privateState.abilities["native:seer_check"].uses = 0),
    (r) =>
      (r.checkpoints.at(-1).players[7].privateState.abilities["native:seer_check"].state.history =
        []),
    (r) => (r.checkpoints.at(-1).players[9].privateState.hunter.canShoot = true),
    (r) => {
      r.checkpoints[0].players[9].alive = false;
      r.checkpoints[0].players[9].privateState.hunter.canShoot = false;
    },
    (r) => (r.checkpoints[0].players[11].privateState.camp = "wolf"),
    (r) =>
      r.decisions
        .find((d: any) => d.stage === "seer")
        .request.context.visible_events.push({
          seq: 999,
          type: "demon_hunter_cancelled",
          payload: {
            policy: "awa_netease_demon_hunter_v1",
            actorId: 12,
            day: 2,
            targetId: 1,
            reason: "authority_revoked",
            faultId: null,
          },
        }),
    (r) =>
      r.decisions
        .find((d: any) => d.stage === "wolf_vote")
        .request.context.visible_events.push({
          seq: 999,
          type: "demon_hunter_chosen",
          payload: { policy: "awa_netease_demon_hunter_v1", day: 2, targetId: 1 },
        }),
  ];
  for (const patch of patches) {
    for (const finalized of [true, false]) {
      const bad = structuredClone(record);
      patch(bad);
      bad.finalized = finalized;
      if (!finalized) {
        bad.termination = null;
        bad.operations = [];
      }
      if (!finalized && patch === patches[0]) continue;
      expect(() => parseReproductionRecord(bad)).toThrow();
    }
  }
  const failed = await recordGame(6, undefined, "en", "missing"),
    bad = structuredClone(failed.record);
  const request = bad.decisions.find((d) => d.outcome.kind === "error")!.request;
  request.context.visible_events.push({
    seq: 999,
    type: "demon_hunter_poison_immune",
    payload: { policy: "awa_netease_demon_hunter_v1", actorId: 6, day: 1, witchId: 5 },
  } as any);
  expect(() => parseReproductionRecord(bad)).toThrow();
});

for (const mode of ["gun_invalid", "gun_missing", "gun_pass"] as const)
  test(`actual ${mode}: dead Hunter keeps unspent stock after invalid requests and spends only a valid pass`, async () => {
    const { record, root, failure } = await recordGame(12, undefined, "en", mode);
    expect(failure).toBeUndefined();
    const hunter = record.checkpoints.at(-1)!.players.find((p) => p.id === 10)!;
    expect(hunter.alive).toBe(false);
    expect(hunter.privateState.hunter).toEqual({
      canShoot: mode !== "gun_pass",
      deathActionPolicy: "awa_knife_or_exile_v1",
    });
    expect(record.decisions.filter((d) => d.stage === "hunter_shot")).toHaveLength(
      mode === "gun_pass" ? 1 : 3,
    );
    expect((await replayReproduction(record, root)).snapshot).toEqual(
      record.checkpoints.at(-1)!.snapshot,
    );
    const bad = structuredClone(record);
    (
      bad.checkpoints.at(-1)!.players.find((p) => p.id === 10)!.privateState.hunter as any
    ).canShoot = mode === "gun_pass";
    expect(() => parseReproductionRecord(bad)).toThrow();
  });
