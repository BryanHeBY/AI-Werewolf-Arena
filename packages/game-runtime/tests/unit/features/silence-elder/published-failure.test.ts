/**
 * 真实Trace与真实请求窗口验证“事件已追加、sink随后抛错”的失败归档。
 * 输入为固定原板、字面选择与原文，sink只在指定事实追加后抛错；不伪造pending候选。
 * 失败CP来自实际World/Trace；只测试严格解析，不把手动表达阶段当成完整对局重放证据。
 */
import { expect, test } from "bun:test";
import { Camp, Phase, Role, type GameEvent, type ToolCall } from "@ai-werewolf-arena/game-contract";
import { RULESET } from "@ai-werewolf-arena/game-catalog";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import { silenceElderTwelveConfig } from "../../../../src/rulesets/presets/silence-elder-twelve";
import { ReproductionTrace } from "../../../../src/recording/reproduction/trace";
import { parseReproductionRecord } from "../../../../src/recording/reproduction/format";
import { captureCheckpoint } from "../../../../src/app/simulation/reproduction-context";
import { SILENCE_ELDER_NIGHT_STAGE } from "../../../../src/features/silence-elder/night-stage";
import { announceSilenceDay } from "../../../../src/rulesets/silence-expression-plan";
import { openSilenceSpeech } from "../../../../src/features/silence-elder/expression-window";
import { GameActionRequestFactory } from "../../../../src/engine/actions/action-request-factory";
import { ToolGateway } from "../../../../src/engine/actions/tool-gateway";
import type { TrustedNightStageRuntime } from "../../../../src/engine/night/trusted-runtime";
for (const failedType of [
  "silence_gesture",
  "silence_translated",
  "silence_translation_declined",
] as const)
  test(`真实${failedType}发表后sink抛错保error候选与严格失败档`, async () => {
    const config = structuredClone(silenceElderTwelveConfig),
      roles = config.roleSetups.flatMap(({ role, count }) => Array<Role>(count).fill(role));
    const game = bootstrapGame(config, { fixedRoles: roles }),
      events: GameEvent[] = [],
      sentinel = new Error("literal_sink_after_append");
    const actor = 12,
      target = 1,
      translator = 9;
    const trace = new ReproductionTrace(
      {
        engine: { id: "awa-engine", sourceHash: "a".repeat(64), lockHash: "b".repeat(64) },
        random: game.random.metadata,
        ruleset: RULESET,
        boardId: "silence_published_failure",
        normalizedBoard: config,
        locale: "en",
        maxDays: 30,
        dealMode: "fixed",
        players: roles.map((role, i) => ({
          id: i + 1,
          name: `Player ${i + 1}`,
          role,
          camp: i < 4 ? Camp.Wolf : Camp.Good,
        })),
      },
      () => {},
      () => events,
    );
    trace.checkpoint(
      captureCheckpoint(game.world, game.phaseManager.getSnapshot(), 0, true, 0),
      events,
    );
    const requests = new GameActionRequestFactory(game.world, events, 1),
      gateway = new ToolGateway();
    const calls: ToolCall[] = [
      { name: "silence", args: { target_id: target, translator_id: translator } },
      { name: "gesture", args: { description: "  🐺 → ?  " } },
      {
        name: "translate_silence",
        args: {
          text:
            failedType === "silence_translation_declined" ? null : "  Personal interpretation.  ",
        },
      },
    ];
    const provider = {
      getAction: (request: Parameters<typeof trace.decide>[0]) =>
        trace.decide(request, { getAction: async () => calls.shift()! }),
    };
    await SILENCE_ELDER_NIGHT_STAGE.execute({
      world: game.world,
      events,
      currentDay: () => 1,
      isCurrent: () => true,
      getAliveByRole: (role) => game.world.getEntityIdsByRole(role),
      actionProvider: provider,
      toolGateway: gateway,
      makeRequest: (actorId, allowedTools, context) => {
        const { stage, requiresAction = true, ...extra } = context;
        return requests.create({
          actorId,
          allowedTools,
          phase: Phase.Night,
          stage,
          requiresAction,
          summary: { key: "request.summary.silence_elder" },
          context: extra,
        });
      },
    } as TrustedNightStageRuntime);
    events.push({ timestamp: 1, type: "phase_changed", payload: { day: 1, phase: Phase.Day } });
    announceSilenceDay(config, game.world, events, 1);
    Object.defineProperty(events, "push", {
      value: function (this: GameEvent[], ...rows: GameEvent[]) {
        const length = Array.prototype.push.apply(this, rows);
        if (rows.some((row) => row.type === failedType)) throw sentinel;
        return length;
      },
    });
    await expect(
      openSilenceSpeech(
        {
          world: game.world,
          events,
          requests,
          provider,
          gateway,
          day: 1,
          phase: Phase.Day,
          isCurrent: () => true,
        },
        target,
        "day",
      )!,
    ).rejects.toBe(sentinel);
    trace.noteFailure("cycle", sentinel);
    trace.checkpoint(
      captureCheckpoint(
        game.world,
        { day: 1, phase: Phase.Day, gameOver: false, result: null },
        1,
        false,
        events.length,
        sentinel,
      ),
      events,
    );
    const record = trace.build({
      operations: [],
      termination: { reason: "runtime_error", winner: null },
    });
    expect(() => parseReproductionRecord(record)).not.toThrow();
    const last = record.decisions.at(-1)!;
    expect(last.outcome.kind).toBe("error");
    expect(last.returnedCandidate).toEqual(
      failedType === "silence_gesture"
        ? { name: "gesture", args: { description: "  🐺 → ?  " } }
        : {
            name: "translate_silence",
            args: {
              text:
                failedType === "silence_translation_declined"
                  ? null
                  : "  Personal interpretation.  ",
            },
          },
    );
    expect(record.events.at(-1)!.type).toBe(failedType);
    const forged = structuredClone(record);
    forged.decisions.at(-1)!.returnedCandidate =
      failedType === "silence_gesture"
        ? { name: "gesture", args: { description: "Forged" } }
        : { name: "translate_silence", args: { text: "Forged" } };
    expect(() => parseReproductionRecord(forged)).toThrow("reproduction_silence_elder_invalid");
    const complete = structuredClone(record);
    complete.checkpoints.at(-1)!.complete = true;
    delete complete.checkpoints.at(-1)!.failure;
    expect(() => parseReproductionRecord(complete)).toThrow();
  });
