/**
 * 场景测试负责原暗夜星辰两板的SDK/ACP/MCP实际通路及两语归档；手写路线为独立规则预期。
 * 对照夜毒巡猎无视替死和日根巡猎触发一次替死，所有死亡由正式引擎提交并严格重放。
 * 仅用本地合成模型，不读取个人配置或认证，不把God档或上帝状态交给受限策略。
 */
import { test, expect } from "bun:test";
import { writeFile } from "node:fs/promises";
import { darkStarsScenario } from "../../../support/features/awakened-dark-stars/builders/transport-plan";
import { runTransportGame } from "../../../support/drivers/transport/run-game";
for (const size of [10, 12] as const)
  for (const path of ["night_patrol", "day_replacement"] as const)
    for (const transport of ["llm", "acp", "mixed"] as const)
      test(`DarkStars/${size}/${path}/${transport}/两语真实闭环`, async () => {
        for (const locale of ["zh-CN", "en"] as const) {
          const scenario = darkStarsScenario(size, path),
            run = await runTransportGame(scenario, transport, locale);
          expect(run.result.snapshot.result?.winner).toBe(scenario.winner);
          expect(run.manifest.players.filter((p) => p.alive).map((p) => p.player_id)).toEqual(
            scenario.alive,
          );
          expect(run.replay.events.filter((e) => e.type === "awakened_charm_chosen")).toHaveLength(
            1,
          );
          expect(run.replay.events.filter((e) => e.type === "awakened_patrol_paid")).toHaveLength(
            1,
          );
          const replacements = run.replay.events.filter(
            (e) => e.type === "awakened_beauty_replacement_paid",
          );
          expect(replacements).toHaveLength(path === "night_patrol" ? 0 : 1);
          if (replacements.length)
            expect(replacements[0]!.payload.targetId).toBe(scenario.substitute);
          for (const view of run.views) {
            const events = view.timeline.flatMap((row) =>
              row.kind === "event" ? [row.event] : [],
            );
            expect(events.some((e) => e.type === "awakened_beauty_replacement_paid")).toBe(false);
            expect(events.filter((e) => e.type === "awakened_charm_chosen")).toHaveLength(
              view.player_id === scenario.beauty ? 1 : 0,
            );
            expect(events.filter((e) => e.type === "awakened_patrol_paid")).toHaveLength(
              view.player_id === scenario.hunter ? 1 : 0,
            );
          }
          if (transport === "llm") {
            await writeFile(
              `/tmp/awa-dark-stars-${size}-${path}-${locale}.replay.json`,
              JSON.stringify(run.replay),
            );
            await writeFile(
              `/tmp/awa-dark-stars-${size}-${path}-${locale}.reproduction.json`,
              JSON.stringify(run.record),
            );
          }
        }
      }, 120000);

// 真实工具缺失／截止只保留已提交前缀；未付魅惑与巡猎均不能凭超时补默认行动。
for (const stage of ["awakened_charm", "awakened_patrol"] as const)
  for (const transport of ["llm", "acp"] as const)
    for (const failure of ["missing", "late"] as const)
      test(`DarkStars/${stage}/${transport}/${failure}/保准确消费前缀`, async () => {
        const scenario = darkStarsScenario(10, "night_patrol"),
          actorId = stage === "awakened_charm" ? scenario.beauty : scenario.hunter,
          turns = scenario.turns.get(actorId)!,
          first = turns.find((t) => t.day === 1 && t.stage === stage)!;
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
          cp = run.record.checkpoints.at(-1)!,
          beauty = cp.players.find((p) => p.id === scenario.beauty)!.privateState
            .awakenedBeauty as { choices: unknown[]; replacement: unknown },
          hunter = cp.players.find((p) => p.id === scenario.hunter)!.privateState
            .awakenedPatrol as { payment: unknown };
        expect(cp.complete).toBe(false);
        expect(beauty.choices).toHaveLength(stage === "awakened_charm" ? 0 : 1);
        expect(beauty.replacement).toBe(null);
        expect(hunter.payment).toBe(null);
        expect(run.record.events.some((e) => e.type === "awakened_patrol_resolved")).toBe(false);
        expect(cp.players.find((p) => p.id === scenario.beauty)!.alive).toBe(true);
        expect(cp.players.find((p) => p.id === scenario.hunter)!.alive).toBe(
          stage === "awakened_charm",
        );
        if (transport === "llm" && failure === "missing")
          await writeFile(
            `/tmp/awa-dark-stars-${stage}-missing.reproduction.json`,
            JSON.stringify(run.record),
          );
      }, 120000);
