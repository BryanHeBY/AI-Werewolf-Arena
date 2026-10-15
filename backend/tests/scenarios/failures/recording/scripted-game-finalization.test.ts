/**
 * 故障场景测试：验证实际脚本对局 driver 保留请求、最终 flush 和持久化失败。输入为原动作、录制 scope 和注入错误；原失败身份及部分输出为字面预期，不重新生成 fixture 或调用模型。
 */
import { mapPlayerArchive } from "../../../support/drivers/recording/player-archive-handler";
import { readReplayManifest, readReplayPlayerView } from "@ai-werewolf-arena/replay-contract";
import { readReplayDocument } from "@ai-werewolf-arena/replay-contract";
import type { Locale } from "@ai-werewolf-arena/game-text";
import { PlayerPromptPolicy } from "../../../../src/agents/player/player-prompt-policy";
import { PlayerPromptSession } from "../../../../src/agents/llm/player-prompt-session";
import {
  getDefaultRoleCatalog,
  getDefaultToolSpecRegistry,
  getDefaultTargetHintRegistry,
  getDefaultPhaseStageLocalizationRegistry,
  getDefaultConfigRenderRegistry,
} from "../../../../src/rulesets/mechanism-api";
import { expect, spyOn, test } from "bun:test";
import { assertReplayDocument } from "@ai-werewolf-arena/replay-contract";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import {
  Camp,
  COMPONENT,
  Phase,
  Role,
  type ActionRequest,
  type BoardConfig,
  type RoleComponent,
} from "../../../../src/domain";
import { createRandom } from "../../../../src/domain/random";
import { sixPlayerMvpConfig } from "../../../../src/rulesets/presets/six-player-mvp";
import { GameEventRecorder } from "../../../../src/app/game-event-recorder";
import { SessionRecordManager } from "../../../../src/recording/session/recorder";
import { runWithSessionRecorder } from "../../../../src/recording/session/context";
import type { ReplayPlayerView } from "../../../../src/recording/contracts";
import { StrictScriptedPlayers, type ScriptStep } from "../../../support/drivers/scripted-players";
import { createTestTempDirectory } from "../../../support/drivers/temp-directories";

async function runRecorded(
  config: BoardConfig,
  fixedRoles: Role[],
  steps: ScriptStep[],
  locale: Locale = "zh-CN",
) {
  const root = await createTestTempDirectory("awa-scripted-game-");
  const context = bootstrapGame(config, {
    fixedRoles,
    random: createRandom("foundation"),
    locale,
    playerNames: Object.fromEntries(fixedRoles.map((_, index) => [index + 1, `Seat ${index + 1}`])),
  });
  const provider = new StrictScriptedPlayers(steps);
  const promptSession = new PlayerPromptSession({
    maxPromptEvents: 8,
    promptPolicy: new PlayerPromptPolicy(context.world, {
      boardConfig: config,
      roleCatalog: getDefaultRoleCatalog(),
      toolSpecRegistry: getDefaultToolSpecRegistry(),
      targetHintRegistry: getDefaultTargetHintRegistry(),
      phaseStageLocalizationRegistry: getDefaultPhaseStageLocalizationRegistry(),
      configRenderRegistry: getDefaultConfigRenderRegistry(),
    }),
  });
  const promptedProvider = {
    async getAction(request: ActionRequest) {
      const prompt = promptSession.build(request);
      expect(prompt.systemPrompt).toContain(locale === "en" ? "Use English" : "你必须使用中文");
      if (locale === "en") {
        expect(prompt.systemPrompt).not.toMatch(/[\u4e00-\u9fff]/);
        expect(prompt.userPrompt).not.toMatch(/[\u4e00-\u9fff]/);
      }
      return provider.getAction(request);
    },
  };

  const manager = await SessionRecordManager.create(
    {
      sessionId: "scripted",
      board: "scripted",
      startedAtIso: "2026-10-07T00:00:00.000Z",
      random: context.random.metadata,
    },
    root,
  );
  const recorder = new GameEventRecorder(
    { world: context.world, replayManager: manager },
    Phase.Night,
  );
  await runWithSessionRecorder(manager, async () => {
    const failures: unknown[] = [];
    try {
      while (!context.phaseManager.getSnapshot().gameOver) {
        await context.phaseManager.runSingleCycle(promptedProvider, 8);
        recorder.flush(context.phaseManager.getEvents());
      }
      provider.assertConsumed();
      const before = provider.trace.length;
      await context.phaseManager.runSingleCycle(promptedProvider, 8);
      expect(provider.trace.length).toBe(before);
      expect(context.phaseManager.getSnapshot().result?.reason).not.toBe("max_days_reached");
    } catch (error) {
      failures.push(error);
    } finally {
      try {
        recorder.flush(context.phaseManager.getEvents());
      } catch (error) {
        failures.push(error);
      }
      try {
        const snapshot = context.phaseManager.getSnapshot();
        await manager.finalize({
          endedAtIso: "2026-10-07T00:01:00.000Z",
          winner: snapshot.result?.winner ?? null,
          finishReason: failures.length ? "runtime_error" : snapshot.result!.reason,
          players: context.world.entityIds().map((id) => {
            const role = context.world.getComponent(id, COMPONENT.Role)!;
            return {
              player_id: id,
              role: role.role,
              camp: context.world.getComponent(id, COMPONENT.Camp)!.camp,
              alive: context.world.getAliveEntityIds().includes(id),
            };
          }),
        });
      } catch (error) {
        failures.push(error);
      }
    }
    if (failures.length === 1) throw failures[0];
    if (failures.length) throw new AggregateError(failures, "scripted_game_failed");
  });
  const replay = readReplayDocument(
    JSON.parse(await readFile(path.join(root, "scripted/replay.json"), "utf8")),
  );
  assertReplayDocument(replay);
  const manifest = readReplayManifest(
    JSON.parse(await readFile(path.join(root, "scripted/manifest.json"), "utf8")),
  );
  expect(replay.result.winner).toBe(Camp.Good);
  expect(manifest.winner).toBe(Camp.Good);
  expect(
    (manifest.players as Array<{ role: Role; camp: Camp }>).map(
      (player: { role: Role; camp: Camp }) => ({
        role: player.role,
        camp: player.camp,
      }),
    ),
  ).toEqual(fixedRoles.map((role) => ({ role, camp: role === Role.Wolf ? Camp.Wolf : Camp.Good })));
  expect(replay.players.map((player) => ({ role: player.role, camp: player.camp }))).toEqual(
    fixedRoles.map((role) => ({ role, camp: role === Role.Wolf ? Camp.Wolf : Camp.Good })),
  );
  const playerViews: ReplayPlayerView[] = await Promise.all(
    fixedRoles.map((_, index) =>
      readFile(path.join(root, "scripted/players", `player_${index + 1}.json`), "utf8").then(
        mapPlayerArchive(JSON.parse),
      ),
    ),
  );
  for (const view of playerViews) {
    const actorEvents = view.timeline
      .filter((entry) => entry.kind === "event")
      .map((entry) => entry.event);
    expect(actorEvents.some((event) => event.type === "god_private_game_info")).toBe(false);
    expect(actorEvents.map((event) => event.seq)).toEqual(actorEvents.map((_, index) => index + 1));
    for (const event of actorEvents) {
      if (
        ["seer_checked", "witch_potion_used", "witch_potion_skipped", "guard_applied"].includes(
          event.type,
        )
      )
        expect(event.payload.actorId).toBe(view.player_id);
      if (event.type.startsWith("wolf_") && event.type !== "wolf_self_destruct")
        expect(view.role).toBe(Role.Wolf);
    }
  }
  const logic = JSON.parse(await readFile(path.join(root, "scripted/logic_ops.json"), "utf8"));
  expect(
    logic.ops.filter(
      (op: { status: string }) => op.status === "fallback" || op.status === "rejected",
    ),
  ).toEqual([]);
  expect(
    replay.events.map((event: { type: string; payload: unknown }) => ({
      type: event.type,
      payload: event.payload,
    })),
  ).toEqual(context.phaseManager.getEvents().map(({ type, payload }) => ({ type, payload })));
  for (const { request } of provider.trace) {
    expect(
      request.context.visible_events.some((event) => event.type === "god_private_game_info"),
    ).toBe(false);
    if (request.context.stage !== "witch") expect(request.context.wolf_target).toBeUndefined();
    if (request.actorId !== 5 && fixedRoles.length === 12)
      expect(request.context.visible_events.some((event) => event.type === "seer_checked")).toBe(
        false,
      );
  }
  return { ...context, provider, replay, manifest, playerViews };
}

test("a final event flush failure still finalizes and preserves the script and persistence errors", async () => {
  const flushError = new Error("final_flush_failed");
  const persistError = new Error("final_record_failed");
  const flush = spyOn(GameEventRecorder.prototype, "flush").mockImplementation(() => {
    throw flushError;
  });
  const realFinalize = SessionRecordManager.prototype.finalize;
  let finalized = 0;
  const finalize = spyOn(SessionRecordManager.prototype, "finalize").mockImplementation(
    async function (this: SessionRecordManager, meta) {
      finalized++;
      await realFinalize.call(this, meta);
      throw persistError;
    },
  );
  try {
    let failure: unknown;
    try {
      await runRecorded(
        sixPlayerMvpConfig,
        [Role.Wolf, Role.Seer, Role.Villager, Role.Wolf, Role.Guard, Role.Villager],
        [],
      );
    } catch (error) {
      failure = error;
    }
    expect(finalized).toBe(1);
    expect(failure).toBeInstanceOf(AggregateError);
    expect((failure as AggregateError).errors[0].message).toContain("script_unexpected_request");
    expect((failure as AggregateError).errors.slice(1)).toEqual([flushError, persistError]);
  } finally {
    flush.mockRestore();
    finalize.mockRestore();
  }
});
