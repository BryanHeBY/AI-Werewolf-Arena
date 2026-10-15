/**
 * Complete scripted Tape scenarios verify AWA election/exile PK and night badge choice together.
 * Input: Public preset, fixed actions/RNG, both locales and real phase-manager records.
 * Output and independent oracle: Handwritten election/death/badge sequence and exact strict replay, not generated golden replacement.
 * The test never calls a billed model or rewrites expected fixture/Tape bytes.
 */
import { expect, test } from "bun:test";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { parseBoardDefinition } from "../../../../src/app/config/board-definition";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import {
  createRandom,
  Phase,
  Role,
  PotionType,
  type ActionRequest,
  type ActionProvider,
} from "../../../../src/domain";
import { SessionRecordManager } from "../../../../src/recording/session/recorder";
import { runWithSessionRecorder } from "../../../../src/recording/session/context";
import {
  beginGameReproduction,
  captureCheckpoint,
  currentEngineVersion,
} from "../../../../src/app/simulation/reproduction-context";
import { GameEventRecorder } from "../../../../src/app/game-event-recorder";
import {
  readReproduction,
  replayReproduction,
} from "../../../../src/app/simulation/replay-reproduction";
import { createTestTempDirectory } from "../../../support/drivers/temp-directories";

for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}: complete AWA preset combines election/exile PK and night badge choice in one strict Tape`, async () => {
    const root = await createTestTempDirectory("awa-preset-branch-record-");
    const output = await createTestTempDirectory("awa-preset-branch-replay-");
    const { config } = parseBoardDefinition(
      JSON.parse(
        await readFile(
          path.resolve(process.cwd(), "../configs.example/boards/awa_classic_pk_choice_12_v1.json"),
          "utf8",
        ),
      ),
    );
    const game = bootstrapGame(config, {
      locale,
      random: createRandom("preset-branch"),
      fixedRoles: [
        Role.Wolf,
        Role.Wolf,
        Role.Wolf,
        Role.Wolf,
        Role.Villager,
        Role.Villager,
        Role.Villager,
        Role.Villager,
        Role.Seer,
        Role.Witch,
        Role.Hunter,
        Role.Idiot,
      ],
    });
    const manager = await SessionRecordManager.create(
      {
        sessionId: "preset-branch",
        board: "awa_classic_pk_choice_12_v1",
        startedAtIso: "2026-10-09T00:00:00.000Z",
      },
      root,
    );
    const trace = beginGameReproduction(manager, game, {
      engine: await currentEngineVersion(),
      boardId: "awa_classic_pk_choice_12_v1",
      ...(void config, {}),
      locale,
      maxDays: 2,
    });
    const actions: ActionProvider = {
      async getAction(request) {
        const stage = request.context.stage;
        if (stage === "sheriff_nomination")
          return { name: "run_for_sheriff", args: { run: request.actorId <= 3 } };
        if (stage === "sheriff_withdraw")
          return { name: "run_for_sheriff", args: { run: request.actorId !== 3 } };
        if (stage === "sheriff_vote")
          return {
            name: "vote_for_sheriff",
            args: {
              target_id: request.actorId === 4 ? 1 : request.actorId === 5 ? 2 : null,
              abstain: request.actorId !== 4 && request.actorId !== 5,
            },
          };
        if (stage === "sheriff_pk_vote")
          return { name: "vote_for_sheriff", args: { target_id: 1, abstain: false } };
        if (request.allowedTools.includes("choose_badge_successor"))
          return { name: "choose_badge_successor", args: { target_id: 6 } };
        if (request.allowedTools.includes("choose_direction"))
          return { name: "choose_direction", args: { direction: "clockwise" } };
        if (request.allowedTools.includes("use_potion"))
          return { name: "use_potion", args: { target_id: 10, potion_type: PotionType.None } };
        if (request.allowedTools.includes("speak_to_wolves"))
          return { name: "speak_to_wolves", args: { text: "End", end_chat: true } };
        if (request.allowedTools.includes("kill_vote"))
          return {
            name: "kill_vote",
            args: {
              target_id: request.context.day === 2 ? 1 : null,
              abstain: request.context.day !== 2,
            },
          };
        if (request.allowedTools.includes("check_identity"))
          return { name: "check_identity", args: { target_id: 5 } };
        if (request.allowedTools.includes("speak")) return { name: "speak", args: { text: "Raw" } };
        if (request.allowedTools.includes("vote")) {
          const id = request.actorId;
          const target =
            request.context.day !== 1
              ? null
              : stage === "exile_pk_vote"
                ? [2, 6].includes(id)
                  ? 4
                  : [3, 7].includes(id)
                    ? 5
                    : null
                : [2, 3, 5].includes(id)
                  ? 4
                  : [4, 6, 7].includes(id)
                    ? 5
                    : null;
          return { name: "vote", args: { target_id: target, abstain: target === null } };
        }
        return null;
      },
    };
    const provider = { getAction: (request: ActionRequest) => trace.decide(request, actions) };
    const recorder = new GameEventRecorder(
      { world: game.world, replayManager: manager },
      Phase.Night,
    );
    await runWithSessionRecorder(manager, async () => {
      let cycle = 0;
      while (!game.phaseManager.getSnapshot().gameOver) {
        await game.phaseManager.runSingleCycle(provider, 2);
        trace.checkpoint(
          captureCheckpoint(
            game.world,
            game.phaseManager.getSnapshot(),
            ++cycle,
            true,
            game.phaseManager.getEvents().length,
          ),
          game.phaseManager.getEvents(),
        );
        recorder.flush(game.phaseManager.getEvents());
      }
      const snapshot = game.phaseManager.getSnapshot();
      await manager.finalize({
        endedAtIso: "2026-10-09T00:01:00.000Z",
        winner: snapshot.result?.winner ?? null,
        ...(snapshot.result ? { gameResult: snapshot.result } : {}),
        finishReason: snapshot.result?.reason ?? "completed",
        players: captureCheckpoint(game.world, snapshot, cycle, true, 0).players.map((player) => ({
          player_id: player.id,
          role: player.role,
          camp: player.camp,
          alive: player.alive,
        })),
      });
    });
    const record = await readReproduction(path.join(root, "preset-branch/reproduction.json"));
    expect(record.metadata.normalizedBoard.sheriff).toEqual(config.sheriff);
    expect(record.metadata.normalizedBoard.voting).toEqual(config.voting);
    expect(record.events.filter((event) => event.type === "sheriff_pk_started")).toHaveLength(1);
    expect(record.events.filter((event) => event.type === "exile_pk_started")).toHaveLength(1);
    expect(
      record.events
        .filter((event) => event.type === "sheriff_badge_transferred")
        .map((event) => event.payload),
    ).toEqual([{ fromId: 1, toId: 6, reason: "night_death" }]);
    expect(
      record.checkpoints.at(-1)?.players.find((player) => player.id === 6)?.badge,
    ).toMatchObject({ isSheriff: true, voteWeight: 1.5, handoffPolicy: "awa_holder_choice_v1" });
    const before = JSON.stringify(record);
    const replayed = await replayReproduction(record, output);
    expect(replayed.snapshot).toEqual(game.phaseManager.getSnapshot());
    expect(replayed.eventCount).toBe(record.events.length);
    expect(replayed.decisionCount).toBe(record.decisions.length);
    expect(JSON.stringify(record)).toBe(before);
  });
