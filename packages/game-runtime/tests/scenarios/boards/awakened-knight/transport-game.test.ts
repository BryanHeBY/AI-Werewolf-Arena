/**
 * 场景测试负责觉醒骑士原十二人三方对照、四连决斗与延期词的双语真实SDK/ACP/MCP接入。
 * 输入独立手写路线，输出真实死亡、资源前缀、受众及逐局严格复现；本地合成模型不调用付费服务。
 */
import { expect, test } from "bun:test";
import { writeFile } from "node:fs/promises";
import {
  awakenedKnightScenario,
  awakenedKnightBlastScenario,
} from "../../../support/features/awakened-knight/builders/transport-plan";
import { runTransportGame } from "../../../support/drivers/transport/run-game";
for (const protection of ["body", "substitute", "none"] as const)
  for (const transport of ["llm", "acp", "mixed"] as const)
    test(`AwKnight/${protection}/${transport}/双语真实四连与三方结算`, async () => {
      for (const locale of ["zh-CN", "en"] as const) {
        const scenario = awakenedKnightScenario(protection),
          run = await runTransportGame(scenario, transport, locale),
          events = run.replay.events;
        expect(run.result.snapshot.result?.winner).toBe(scenario.winner);
        expect(run.manifest.players.filter((p) => p.alive).map((p) => p.player_id)).toEqual(
          scenario.alive,
        );
        expect(
          events.filter((e) => e.type === "awakened_duel_committed").map((e) => e.payload.targetId),
        ).toEqual([10, 8, 9, 12]);
        expect(
          events.filter((e) => e.type === "awakened_duel_resolved").map((e) => e.payload.deaths),
        ).toEqual([protection === "none" ? [2] : [], [8], [9], [12]]);
        expect(events.filter((e) => e.type === "awakened_beauty_replacement_paid")).toHaveLength(
          protection === "body" ? 0 : 1,
        );
        expect(events.filter((e) => e.type === "awakened_duel_chain_ended")).toHaveLength(1);
        expect(
          events.filter((e) => e.type === "last_words_spoken").map((e) => e.payload.playerId),
        ).toEqual([1, ...(protection === "none" ? [2] : []), 8, 9, 12]);
        const lastAttempt = events.findLastIndex((e) => e.type === "awakened_duel_committed"),
          deferred = events.findIndex(
            (e) => e.type === "last_words_spoken" && e.payload.playerId === 8,
          );
        expect(deferred).toBeGreaterThan(lastAttempt);
        for (const view of run.views) {
          const own = view.timeline.flatMap((row) => (row.kind === "event" ? [row.event] : []));
          expect(
            own.some((e) =>
              [
                "awakened_protection_block_detail",
                "awakened_protection_expired",
                "awakened_beauty_replacement_paid",
              ].includes(e.type),
            ),
          ).toBe(false);
          expect(own.filter((e) => e.type === "awakened_protection_chosen")).toHaveLength(
            view.player_id === 5 ? (protection === "body" ? 3 : 2) : 0,
          );
        }
        if (transport === "llm") {
          await writeFile(
            `/tmp/awa-awakened-knight-${protection}-${locale}.replay.json`,
            JSON.stringify(run.replay),
          );
          await writeFile(
            `/tmp/awa-awakened-knight-${protection}-${locale}.reproduction.json`,
            JSON.stringify(run.record),
          );
        }
      }
    }, 120000);

for (const stage of [
  "awakened_protection_night",
  "awakened_protection_day",
  "awakened_duel",
  "awakened_duel_continue",
] as const)
  for (const transport of ["llm", "acp"] as const)
    for (const failure of ["missing", "late"] as const)
      test(`AwKnight/${stage}/${transport}/${failure}/保真实消费及死亡前缀`, async () => {
        const scenario = awakenedKnightScenario(
            stage === "awakened_duel_continue" ? "none" : "body",
          ),
          actorId = stage.startsWith("awakened_protection") ? 5 : 7,
          turns = scenario.turns.get(actorId)!,
          first = turns.find((turn) => turn.day === 1 && turn.stage === stage)!;
        first.terminalFailure = failure;
        if (failure === "missing") {
          first.action = null;
          if (transport === "llm")
            turns.splice(
              turns.indexOf(first),
              1,
              ...Array.from({ length: 4 }, () => ({ ...first })),
            );
        }
        scenario.expectedFailure = { actorId, stage };
        const run = await runTransportGame(scenario, transport, "en"),
          cp = run.record.checkpoints.at(-1)!;
        expect(cp.complete).toBe(false);
        expect(run.record.events.some((e) => e.type === "awakened_duel_chain_ended")).toBe(false);
        expect(run.record.events.filter((e) => e.type === "awakened_duel_committed")).toHaveLength(
          stage === "awakened_duel_continue" ? 1 : 0,
        );
        expect(cp.players.find((p) => p.id === 2)!.alive).toBe(stage !== "awakened_duel_continue");
        expect(
          run.record.events.some((e) => e.type === "last_words_spoken" && e.payload.playerId === 2),
        ).toBe(false);
        if (transport === "llm" && failure === "missing")
          await writeFile(
            `/tmp/awa-awakened-knight-${stage}-missing.reproduction.json`,
            JSON.stringify(run.record),
          );
      }, 120000);

for (const protectedBlast of [false, true])
  for (const transport of ["llm", "acp"] as const)
    test(`AwKnight真实自爆/${protectedBlast}/${transport}/声明与实际死亡分开`, async () => {
      for (const locale of ["zh-CN", "en"] as const) {
        const scenario = awakenedKnightBlastScenario(protectedBlast),
          run = await runTransportGame(scenario, transport, locale),
          events = run.replay.events;
        expect(run.result.snapshot.result?.winner).toBe(scenario.winner);
        expect(run.manifest.players.filter((p) => p.alive).map((p) => p.player_id)).toEqual(
          scenario.alive,
        );
        expect(events.filter((e) => e.type === "awakened_self_destruct_declared")).toHaveLength(1);
        expect(
          events
            .filter((e) => e.type === "awakened_self_destruct_resolved")
            .map((e) => e.payload.deaths),
        ).toEqual([protectedBlast ? [] : [8]]);
        expect(events.some((e) => e.type === "wolf_self_destruct")).toBe(false);
        expect(events.filter((e) => e.type === "day_speech" && e.day === 1)).toEqual([]);
        expect(
          events.filter((e) => e.type === "awakened_duel_committed").map((e) => e.payload.targetId),
        ).toEqual([10, ...(protectedBlast ? [8] : []), 12]);
        expect(
          events.filter((e) => e.type === "last_words_spoken").map((e) => e.payload.playerId),
        ).toEqual([1, 9, 10, ...(protectedBlast ? [8] : []), 12]);
        if (transport === "llm")
          await writeFile(
            `/tmp/awa-awakened-knight-blast-${protectedBlast}-${locale}.reproduction.json`,
            JSON.stringify(run.record),
          );
      }
    }, 120000);
