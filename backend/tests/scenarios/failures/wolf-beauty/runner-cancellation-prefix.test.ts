/**
 * Failure scenarios verify runner cancellation preserves a paid Wolf Beauty charm when recording fails during a held response.
 * Input: Original factory/recording injections and late or null Charm results on the real runner.
 * Output and oracle: Literal paid-relation snapshots, absent consuming skip and partial-replay equality are asserted; cancellation is not converted into a consuming role action.
 */
import { PotionType } from "../../../../src/core/domain/identity";
import { expect, spyOn, test } from "bun:test";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import * as factory from "../../../../src/runtime/player_agent_factory";
import { GameEventRecorder } from "../../../../src/runtime/game_event_recorder";
import { parseRuntimeConfig } from "../../../../src/runtime/config/parse_config";
import { resolveGameSetup } from "../../../../src/runtime/config/resolve_game_setup";
import {
  boardDefinitionFromConfig,
  parseBoardDefinition,
} from "../../../../src/runtime/config/board_definition";
import { runGame } from "../../../../src/runtime/game_runner";
import { sixPlayerMvpConfig } from "../../../../src/runtime/scenarios/six_player_mvp";
import {
  COMPONENT,
  Role,
  type ToolCall,
  type World,
  type RoleComponent,
} from "../../../../src/core";
import { getWolfBeautyState } from "../../../../src/game/mechanisms/roles/wolf_beauty/ports";
import { activeCharm } from "../../../../src/game/mechanisms/roles/wolf_beauty/relation";
import { createTestTempDirectory } from "../../../support/drivers/temp-directories";
import {
  readReproduction,
  replayReproduction,
} from "../../../../src/runtime/simulation/replay_reproduction";

for (const late of [null, { name: "charm", args: { target_id: null } }] as const)
  test(`runner recording failure during Charm never converts cancellation into a consuming skip (${late ? "late action" : "null"})`, async () => {
    const root = await createTestTempDirectory("awa-run-charm-stop-"),
      failure = new Error("synthetic-flush-failure");
    let world!: World,
      pending = false,
      failed = false,
      closed = 0,
      release!: (action: ToolCall | null) => void;
    const held = new Promise<ToolCall | null>((done) => {
      release = done;
    });
    const config = parseRuntimeConfig({
      providers: {
        default: "fake",
        items: { fake: { type: "openai", apiKey: "synthetic-unused" } },
      },
      agents: {
        default: "fake",
        items: { fake: { kind: "llm", provider: "fake", model: "synthetic" } },
      },
      game: { board: "six_player_charm_cancel", seed: "cancel-charm" },
      debugSummary: { agent: { enabled: false } },
    });
    const board = parseBoardDefinition(
      boardDefinitionFromConfig("six_player_charm_cancel", {
        ...sixPlayerMvpConfig,
        roleSetups: [
          { role: Role.WolfBeauty, count: 1 },
          { role: Role.Witch, count: 1 },
          { role: Role.Seer, count: 1 },
          { role: Role.Villager, count: 3 },
        ],
      }),
    );
    const create = spyOn(factory, "createPlayerAgentRuntime").mockImplementation(
      async (options) => {
        world = options.world;
        return {
          kind: "llm",
          runtimeState: { closed: false },
          async close() {
            closed++;
            release(late);
          },
          provider: {
            async getAction(request) {
              if (request.allowedTools.includes("charm")) {
                if (request.context.day === 2) {
                  pending = true;
                  return held;
                }
                return {
                  name: "charm",
                  args: { target_id: world.entityIds().find((id) => id !== request.actorId)! },
                };
              }
              if (request.allowedTools.includes("speak_to_wolves"))
                return { name: "speak_to_wolves", args: { text: "End", end_chat: true } };
              if (request.allowedTools.includes("kill_vote"))
                return { name: "kill_vote", args: { target_id: null, abstain: true } };
              if (request.allowedTools.includes("use_potion"))
                return {
                  name: "use_potion",
                  args: { target_id: request.actorId, potion_type: PotionType.None },
                };
              if (request.allowedTools.includes("check_identity"))
                return {
                  name: "check_identity",
                  args: { target_id: world.entityIds().find((id) => id !== request.actorId)! },
                };
              if (request.allowedTools.includes("speak"))
                return { name: "speak", args: { text: "Raw" } };
              if (request.allowedTools.includes("vote"))
                return { name: "vote", args: { target_id: null, abstain: true } };
              throw new Error(`unexpected:${request.context.stage}`);
            },
          },
        };
      },
    );
    const original = GameEventRecorder.prototype.flush;
    const flush = spyOn(GameEventRecorder.prototype, "flush").mockImplementation(function (
      this: GameEventRecorder,
      events,
    ) {
      if (pending && !failed) {
        failed = true;
        throw failure;
      }
      return original.call(this, events);
    });
    try {
      await expect(
        runGame(
          resolveGameSetup(
            config,
            {
              recordRootDir: root,
              maxDays: 10,
              maxRuntimeMs: 10000,
              streamEvents: false,
              color: false,
            },
            board,
          ),
        ),
      ).rejects.toBe(failure);
      expect(closed).toBe(1);
      expect(failed).toBe(true);
      const actor = world
        .entityIds()
        .find(
          (id) => world.getComponent<RoleComponent>(id, COMPONENT.Role)?.role === Role.WolfBeauty,
        )!;
      expect(
        getWolfBeautyState(world.getComponent<RoleComponent>(actor, COMPONENT.Role)!),
      ).toMatchObject({
        lastActedDay: 1,
        history: [{ day: 1, targetId: world.entityIds().find((id) => id !== actor)! }],
      });
      expect(activeCharm(world, actor)).not.toBeNull();
      const [session] = await readdir(root),
        record = JSON.parse(await readFile(path.join(root, session, "reproduction.json"), "utf8"));
      expect(
        record.decisions.find(
          (decision: any) =>
            decision.actorId === actor && decision.day === 2 && decision.stage === "wolf_beauty",
        ).outcome,
      ).toEqual({ kind: "error", code: "decision_failed", name: "AbortError" });
      const replay = JSON.parse(await readFile(path.join(root, session, "replay.json"), "utf8"));
      expect(replay.events.filter((event: any) => event.type === "charm_applied")).toHaveLength(1);
      const tape = await readReproduction(path.join(root, session, "reproduction.json"));
      expect(
        tape.checkpoints.at(-1)!.players.find((player) => player.id === actor)!.privateState
          .wolf_beauty,
      ).toEqual(getWolfBeautyState(world.getComponent<RoleComponent>(actor, COMPONENT.Role)!));
      expect(
        (await replayReproduction(tape, await createTestTempDirectory("awa-charm-cancel-replay-")))
          .snapshot,
      ).toEqual(tape.checkpoints.at(-1)!.snapshot);
    } finally {
      flush.mockRestore();
      create.mockRestore();
    }
  }, 15000);
