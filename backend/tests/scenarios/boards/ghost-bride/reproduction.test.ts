/**
 * Wedding engine/replay scenarios verify full Ghost Bride inventory and precise failed setup/night prefixes.
 * Input: Scripted three-faction worlds, getter/field/fault mutations and actual recording.
 * Output and independent oracle: Manual winner/role/goal snapshots, no getter execution and exact causal failure prefixes.
 * The test never calls a billed model or rewrites expected fixture/Tape bytes.
 */
import { readFile, writeFile } from "node:fs/promises";
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import {
  COMPONENT,
  Camp,
  Role,
  PotionType,
  createRandom,
  type ActionRequest,
  type ToolCall,
  type RoleComponent,
} from "../../../../src/core";
import { SessionRecordManager } from "../../../../src/recording/session_recorder";
import { runWithSessionRecorder } from "../../../../src/recording/recording_context";
import {
  beginGameReproduction,
  captureCheckpoint,
  currentEngineVersion,
} from "../../../../src/runtime/simulation/reproduction_context";
import { GameEventRecorder } from "../../../../src/runtime/game_event_recorder";
import {
  readReproduction,
  replayReproduction,
} from "../../../../src/runtime/simulation/replay_reproduction";
import { parseReproductionRecord } from "../../../../src/recording/reproduction";
import {
  ghostBrideBoard,
  ghostBrideDeck,
} from "../../../support/features/ghost-bride/builders/scenario";
import { createTestTempDirectory } from "../../../support/drivers/temp-directories";

async function recordGame(
  winner: Camp,
  failure?:
    | "initial"
    | "chat"
    | "witness"
    | "disagreement"
    | "late_consent"
    | "complete_stock"
    | "proxy_stock"
    | "consumed_stock"
    | "night_win"
    | "all_dead"
    | "native_gods",
) {
  const config = ghostBrideBoard(),
    context = bootstrapGame(config, {
      fixedRoles: ghostBrideDeck,
      random: createRandom(`ghost-tape:${winner}:${failure ?? "full"}`),
    });
  const root = await createTestTempDirectory("awa-ghost-record-"),
    manager = await SessionRecordManager.create(
      {
        sessionId: "game",
        board: "ghost_bride_12",
        startedAtIso: new Date().toISOString(),
        locale: "en",
        random: context.random.metadata,
      },
      root,
    );
  const eventRecorder = new GameEventRecorder(
    { world: context.world, replayManager: manager },
    context.phaseManager.getSnapshot().phase,
  );
  let failureObserved: unknown;
  let getterReads = 0;
  const groom =
      failure === "native_gods" ? 11 : failure === "all_dead" ? 10 : winner === Camp.Wolf ? 5 : 2,
    witness =
      failure === "native_gods" ? 10 : failure === "all_dead" ? 2 : winner === Camp.Wolf ? 9 : 3;
  const good = ghostBrideDeck
    .map((role, i) => ({ role, id: i + 1 }))
    .filter(
      (p) => ![Role.GhostBride, Role.Wolf].includes(p.role) && ![groom, witness].includes(p.id),
    )
    .map((p) => p.id);
  let witnessTurns = 0,
    firstConsent: ActionRequest | undefined;
  const provider = {
    async getAction(request: ActionRequest): Promise<ToolCall | null> {
      const day = request.context.day;
      if (request.allowedTools.includes("choose_bridegroom"))
        return failure === "initial"
          ? null
          : { name: "choose_bridegroom", args: { target_id: groom } };
      if (request.allowedTools.includes("speak_to_partner"))
        return failure === "chat" ? null : { name: "speak_to_partner", args: { text: "" } };
      if (request.allowedTools.includes("choose_wedding_witness")) {
        witnessTurns++;
        if (witnessTurns === 1) firstConsent = request;
        if (failure === "witness" && witnessTurns === 2)
          throw new Error("synthetic_second_consent_failure");
        if (failure === "late_consent" && witnessTurns === 2)
          firstConsent!.deadlineAtMs = Date.now() - 1;
        return {
          name: "choose_wedding_witness",
          args: { target_id: failure === "disagreement" && witnessTurns === 2 ? 4 : witness },
        };
      }
      if (failure === "proxy_stock" && request.allowedTools.includes("guard")) {
        const abilities = (
          context.world.getComponent<RoleComponent>(10, COMPONENT.Role)!.privateState as {
            readonly abilities?: unknown;
          }
        ).abilities as Record<string, object>;
        abilities["native:potion"] = new Proxy(abilities["native:potion"]!, {
          ownKeys(target) {
            getterReads++;
            return Reflect.ownKeys(target);
          },
          getOwnPropertyDescriptor(target, key) {
            getterReads++;
            return Reflect.getOwnPropertyDescriptor(target, key);
          },
          getPrototypeOf(target) {
            getterReads++;
            return Reflect.getPrototypeOf(target);
          },
        });
        throw new Error("synthetic_nested_proxy_failure");
      }
      if (failure === "complete_stock" && request.allowedTools.includes("guard")) {
        const witchRole = context.world.getComponent<RoleComponent>(10, COMPONENT.Role)!;
        Object.defineProperty(witchRole.privateState, "abilities", {
          enumerable: true,
          configurable: true,
          get() {
            getterReads++;
            return {};
          },
        });
        throw new Error("synthetic_native_failure_after_complete");
      }
      if (request.allowedTools.includes("guard"))
        return { name: "guard", args: { target_id: null, abstain: true } };
      if (request.allowedTools.includes("speak_to_wolves"))
        return { name: "speak_to_wolves", args: { text: "", end_chat: true } };
      if (
        request.allowedTools.includes("kill_vote") ||
        request.allowedTools.includes("wedding_kill_vote")
      ) {
        const target =
          failure === "native_gods" && day === 1
            ? 11
            : failure === "all_dead"
              ? [5, 6, 7, 9, 11][day - 1]!
              : day === 1
                ? 1
                : winner === Camp.Good
                  ? null
                  : failure === "night_win" && day === 6
                    ? good[7]!
                    : (good[(day - 2) * 2] ?? null);
        return {
          name: request.allowedTools.includes("kill_vote") ? "kill_vote" : "wedding_kill_vote",
          args: { target_id: target, abstain: target === null },
        };
      }
      if (failure === "native_gods" && day === 1 && request.allowedTools.includes("use_potion"))
        return { name: "use_potion", args: { target_id: 3, potion_type: PotionType.Poison } };
      if (failure === "native_gods" && request.allowedTools.includes("shoot"))
        return { name: "shoot", args: { target_id: 2 } };
      if (failure === "all_dead" && day === 5 && request.allowedTools.includes("use_potion"))
        return { name: "use_potion", args: { target_id: 2, potion_type: PotionType.Poison } };
      if (failure === "all_dead" && request.allowedTools.includes("shoot"))
        return { name: "shoot", args: { target_id: 1 } };
      if (failure === "consumed_stock" && request.allowedTools.includes("check_identity"))
        throw new Error("synthetic_seer_failure_after_poison");
      if (failure === "consumed_stock" && request.allowedTools.includes("use_potion"))
        return { name: "use_potion", args: { target_id: 6, potion_type: PotionType.Poison } };
      if (request.allowedTools.includes("use_potion"))
        return {
          name: "use_potion",
          args: { target_id: request.actorId, potion_type: PotionType.None },
        };
      if (request.allowedTools.includes("check_identity")) {
        const target = context.world.getAliveEntityIds().find((id) => id !== request.actorId)!;
        return { name: "check_identity", args: { target_id: target } };
      }
      if (request.allowedTools.includes("shoot"))
        return { name: "shoot", args: { target_id: null } };
      if (request.allowedTools.includes("speak")) return { name: "speak", args: { text: "" } };
      if (request.allowedTools.includes("run_for_sheriff"))
        return { name: "run_for_sheriff", args: { run: false } };
      if (request.allowedTools.includes("vote")) {
        const target =
          failure === "all_dead"
            ? ([3, 4, 8, 12][day - 1] ?? null)
            : failure === "night_win" && day === 5
              ? null
              : day === 1
                ? winner === Camp.ThirdParty
                  ? 4
                  : witness
                : winner === Camp.Good
                  ? 4
                  : (good[(day - 2) * 2 + 1] ?? null);
        return {
          name: "vote",
          args: {
            target_id: request.actorId === target ? null : target,
            abstain: target === null || request.actorId === target,
          },
        };
      }
      return null;
    },
  };
  await runWithSessionRecorder(manager, async () => {
    const trace = beginGameReproduction(manager, context, {
      engine: await currentEngineVersion(),
      boardId: "ghost_bride_12",
      ...(void config, {}),
      locale: context.world.locale,
      maxDays: 15,
    });
    let cycle = 0;
    while (!context.phaseManager.getSnapshot().gameOver && cycle < 15) {
      cycle++;
      let complete = true;
      try {
        await context.phaseManager.runSingleCycle(
          { getAction: (r) => trace.decide(r, provider) },
          15,
        );
      } catch (e) {
        failureObserved = e;
        complete = false;
        manager.noteReproductionFailure("cycle", e);
      }
      trace.checkpoint(
        captureCheckpoint(
          context.world,
          context.phaseManager.getSnapshot(),
          cycle,
          complete,
          context.phaseManager.getEvents().length,
          failureObserved,
        ),
        context.phaseManager.getEvents(),
      );
      eventRecorder.flush(context.phaseManager.getEvents());
      if (!complete) break;
    }
    const snapshot = context.phaseManager.getSnapshot();
    await manager.finalize({
      endedAtIso: new Date().toISOString(),
      winner: snapshot.result?.winner ?? null,
      finishReason: failureObserved ? "runtime_error" : snapshot.result!.reason,
      ...(snapshot.result ? { gameResult: snapshot.result } : {}),
      players: context.playerIds.map((id) => {
        const role = context.world.getComponent<RoleComponent>(id, COMPONENT.Role)!;
        return {
          player_id: id,
          role: role.role,
          camp: role.camp,
          alive: context.world.getAliveEntityIds().includes(id),
        };
      }),
    });
  });
  const record = await readReproduction(`${manager.sessionDir}/reproduction.json`);
  if (["night_win", "all_dead"].includes(failure ?? "")) {
    await writeFile(
      `/tmp/awa-p9-ghost-bride-${failure}.checkpoint.json`,
      JSON.stringify(record.checkpoints.at(-1)!),
    );
    await writeFile(
      `/tmp/awa-p9-ghost-bride-${failure}.replay.json`,
      await readFile(`${manager.sessionDir}/replay.json`),
    );
  }
  return {
    record,
    failureObserved,
    getterReads,
  };
}
for (const winner of [Camp.Good, Camp.Wolf, Camp.ThirdParty])
  test(`${winner}: actual full three-faction engine recording passes strict Tape with original roles and goals`, async () => {
    const { record, failureObserved } = await recordGame(winner);
    expect(failureObserved).toBeUndefined();
    expect(record.checkpoints.at(-1)!.snapshot.result?.winner).toBe(winner);
    expect(record.metadata.players.map((p) => p.role)).toEqual(ghostBrideDeck);
    const output = await createTestTempDirectory("awa-ghost-tape-");
    const replay = await replayReproduction(record, output);
    expect(replay.snapshot).toEqual(record.checkpoints.at(-1)!.snapshot);
    expect(replay.eventCount).toBe(record.events.length);
    expect(replay.decisionCount).toBe(record.decisions.length);
    const leaked = structuredClone(record);
    leaked.events.find((e) => e.type === "ghost_bride_knife_vote")!.audience = [4];
    expect(() => parseReproductionRecord(leaked)).toThrow();
  }, 20000);
for (const failure of ["initial", "chat", "witness", "disagreement", "late_consent"] as const)
  test(`${failure}: actual finalized wedding failure reproduces the precise accepted prefix and operations`, async () => {
    const { record, failureObserved } = await recordGame(Camp.Good, failure);
    expect(failureObserved).toBeDefined();
    expect(record.checkpoints.at(-1)!.complete).toBe(false);
    expect(record.checkpoints.at(-1)!.ghostBrideSetup?.status).toBe("failed");
    expect(record.events.some((e) => e.type === "ghost_bride_group_chosen")).toBe(false);
    expect(record.decisions.every((d) => d.stage.startsWith("ghost_bride_"))).toBe(true);
    expect(record.events.filter((e) => e.type === "ghost_bride_witness_vote")).toHaveLength(
      failure === "disagreement" ? 2 : ["witness", "late_consent"].includes(failure) ? 1 : 0,
    );
    const output = await createTestTempDirectory("awa-ghost-failure-tape-");
    expect((await replayReproduction(record, output)).snapshot).toEqual(
      record.checkpoints.at(-1)!.snapshot,
    );
  }, 20000);

test("complete wedding native inventory getter failure records the last owned safe stock without executing getter, exact Tape", async () => {
  const { record, failureObserved, getterReads } = await recordGame(Camp.Good, "complete_stock");
  expect(failureObserved).toBeDefined();
  expect(getterReads).toBe(0);
  expect(record.checkpoints.at(-1)!.ghostBrideSetup?.status).toBe("complete");
  expect(record.checkpoints.at(-1)!.players.find((p) => p.id === 10)!.privateState).toEqual(
    record.checkpoints[0]!.players.find((p) => p.id === 10)!.privateState,
  );
  expect(
    (await replayReproduction(record, await createTestTempDirectory("awa-ghost-native-failure-")))
      .snapshot,
  ).toEqual(record.checkpoints.at(-1)!.snapshot);
});
test("strict failed record rejects unclosed setup, foreign visible facts, missing stocks and forged fourth wolf before replay", async () => {
  const { record } = await recordGame(Camp.Good, "initial");
  const tamper = (mutate: (r: typeof record) => void) => {
    const r = structuredClone(record);
    mutate(r);
    expect(() => parseReproductionRecord(r)).toThrow("reproduction_ghost_bride_state_invalid");
  };
  tamper((r) => {
    r.checkpoints.at(-1)!.ghostBrideSetup!.status = "active";
    (r.checkpoints.at(-1)!.players[0]!.privateState.ghostBride as { remaining: number }).remaining =
      1;
  });
  tamper((r) => {
    r.decisions[0]!.request.context.visible_events.push({
      seq: 3,
      type: "ghost_bride_witness_vote",
      payload: { invalid: true },
    });
  });
  tamper((r) => {
    for (const c of r.checkpoints) c.players.find((p) => p.id === 10)!.privateState = {};
  });
  tamper((r) => {
    const p = r.metadata.players.find((p) => p.id === 5)!;
    p.role = Role.Wolf;
    p.camp = Camp.Wolf;
    for (const c of r.checkpoints) {
      const q = c.players.find((p) => p.id === 5)!;
      q.role = Role.Wolf;
      q.camp = Camp.Wolf;
      q.victory.affiliations = [{ kind: "faction", faction: Camp.Wolf }];
    }
  });
});

test("native Witch consumption survives later Seer failure in the actual checkpoint and strict Tape", async () => {
  const { record, failureObserved } = await recordGame(Camp.Good, "consumed_stock");
  expect(failureObserved).toBeDefined();
  const stock = record.checkpoints.at(-1)!.players.find((p) => p.id === 10)!.privateState
    .abilities as Record<string, { uses: number; state: { poison: number } }>;
  expect(stock["native:potion"]!.uses).toBe(1);
  expect(stock["native:potion"]!.state.poison).toBe(0);
  expect(
    (await replayReproduction(record, await createTestTempDirectory("awa-ghost-consumed-failure-")))
      .snapshot,
  ).toEqual(record.checkpoints.at(-1)!.snapshot);
});
test("actual completed Night death chain seals its victory before Day and passes strict Tape", async () => {
  const { record, failureObserved } = await recordGame(Camp.ThirdParty, "night_win");
  expect(failureObserved).toBeUndefined();
  expect(record.checkpoints.at(-1)!.snapshot.result!.decidedAt).toEqual({
    day: 6,
    phase: "night",
    checkpoint: "night_settled",
  });
  expect(
    (await replayReproduction(record, await createTestTempDirectory("awa-ghost-night-win-")))
      .snapshot,
  ).toEqual(record.checkpoints.at(-1)!.snapshot);
});

test("nested Proxy native stock failure keeps owned cache with zero traps, exact Tape", async () => {
  const { record, failureObserved, getterReads } = await recordGame(Camp.Good, "proxy_stock");
  expect(failureObserved).toBeDefined();
  expect(getterReads).toBe(0);
  expect(record.checkpoints.at(-1)!.players.find((p) => p.id === 10)!.privateState).toEqual(
    record.checkpoints[0]!.players.find((p) => p.id === 10)!.privateState,
  );
  expect(
    (await replayReproduction(record, await createTestTempDirectory("awa-ghost-proxy-failure-")))
      .snapshot,
  ).toEqual(record.checkpoints.at(-1)!.snapshot);
});
test("pending first setup decision is a terminal prefix even in an unfinalized archive", async () => {
  const { record } = await recordGame(Camp.Good, "initial");
  const first = structuredClone(record);
  first.finalized = false;
  first.decisions[0]!.outcome = { kind: "pending" };
  first.checkpoints = [first.checkpoints[0]!];
  first.events = first.events.slice(0, first.checkpoints[0]!.eventCount);
  expect(() => parseReproductionRecord(first)).not.toThrow();
  const appended = structuredClone(first.decisions[0]!);
  appended.stage = "guard";
  appended.request.context.stage = "guard";
  first.decisions.push(appended);
  expect(() => parseReproductionRecord(first)).toThrow("reproduction_ghost_bride_state_invalid");
});

test("actual pair knife, native Witch poison and Hunter gun finish every wave before all-three-factions draw, exact Tape", async () => {
  const { record, failureObserved } = await recordGame(Camp.ThirdParty, "all_dead");
  expect(failureObserved).toBeUndefined();
  const final = record.checkpoints.at(-1)!;
  expect(final.players.every((p) => !p.alive)).toBe(true);
  expect(final.snapshot.result).toEqual({
    winner: null,
    reason: "three_factions_all_dead",
    outcome: { kind: "no_winner" },
    decidedAt: { day: 5, phase: "night", checkpoint: "night_settled" },
  });
  expect(record.events.filter((e) => e.type === "hunter_shot").map((e) => e.payload)).toEqual([
    { hunterId: 11, targetId: 1 },
  ]);
  expect(
    (await replayReproduction(record, await createTestTempDirectory("awa-ghost-all-dead-")))
      .snapshot,
  ).toEqual(final.snapshot);
});

test("native Hunter Groom and Witch Witness actually spend separate original gun and poison before Witness inherits knife, strict Tape", async () => {
  const { record, failureObserved } = await recordGame(Camp.ThirdParty, "native_gods");
  expect(failureObserved).toBeUndefined();
  const cp = record.checkpoints[1]!;
  expect(cp.players.find((p) => p.id === 11)!.privateState).toEqual({
    hunter: { canShoot: false, deathActionPolicy: "awa_knife_or_exile_v1" },
  });
  expect(cp.players.find((p) => p.id === 10)!.privateState).toMatchObject({
    abilities: { "native:potion": { uses: 1, state: { poison: 0 } } },
  });
  expect(
    record.events.filter((e) => e.type === "ghost_bride_knife_captured")[1]!.payload,
  ).toMatchObject({ owner: "witness", actorIds: [10] });
  expect(record.checkpoints.at(-1)!.snapshot.result!.outcome).toMatchObject({
    winningPlayerIds: [1, 10, 11],
  });
  expect(
    (await replayReproduction(record, await createTestTempDirectory("awa-ghost-native-gods-")))
      .snapshot,
  ).toEqual(record.checkpoints.at(-1)!.snapshot);
});

for (const [failure, day, deaths] of [
  ["night_win", 6, [12]],
  ["all_dead", 5, [1, 2, 10, 11]],
] as const)
  test(`${failure}: terminal Night publishes all original and derived deaths before GameOver without entering Day`, async () => {
    const { record } = await recordGame(Camp.ThirdParty, failure);
    const facts = record.events.filter((e) => e.type === "night_resolved");
    expect(facts).toHaveLength(day);
    expect(facts.at(-1)!.payload).toEqual({ deaths: expect.arrayContaining([...deaths]) });
    expect((facts.at(-1)!.payload.deaths as number[]).length).toBe(deaths.length);
    expect(record.events.indexOf(facts.at(-1)!)).toBeLessThan(
      record.events.findIndex((e) => e.type === "game_over"),
    );
    expect(
      record.events.some(
        (e) => e.type === "phase_changed" && e.payload.day === day && e.payload.phase === "day",
      ),
    ).toBe(false);
    expect(
      (
        await replayReproduction(
          record,
          await createTestTempDirectory("awa-ghost-public-terminal-"),
        )
      ).snapshot,
    ).toEqual(record.checkpoints.at(-1)!.snapshot);
  });
