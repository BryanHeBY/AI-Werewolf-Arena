/**
 * 观察驱动的整局场景运行纯白板的行动优先级与女巫自疗分支。
 * 输入为公开策略板子、受限机器人请求及保存的固定种子对局。
 * 字面预期为自然完成、无拒绝／回退、查验及跳过分支出现；逐局 Tape 结果与原录制做一致性对照，不独立计算全部策略资源结果。
 * 测试不调用付费模型，也不重写预期 fixture／Tape 字节。
 */
import { expect, test } from "bun:test";
import path from "node:path";
import {
  boardDefinitionFromConfig,
  parseBoardDefinition,
} from "../../../../src/app/config/board-definition";
import { pureWhiteTwelveConfig } from "../../../../src/rulesets/presets/pure-white-twelve";
import { WitchSelfHealRule } from "../../../../src/domain";
import { simulateGames } from "../../../../src/app/simulation/simulate-games";
import {
  readReproduction,
  replayReproduction,
} from "../../../../src/app/simulation/replay-reproduction";
import { createTestTempDirectory } from "../../../support/drivers/temp-directories";
for (const priority of ["awa_wolf_priority_v1", "awa_good_priority_v1"] as const)
  for (const selfHeal of [WitchSelfHealRule.Disabled, WitchSelfHealRule.FirstNightOnly])
    for (const locale of ["zh-CN", "en"] as const)
      test(`pure white observed simulation ${priority}/${selfHeal}/${locale}`, async () => {
        const config = structuredClone(pureWhiteTwelveConfig);
        config.pureWhite!.eliminationPriority = priority;
        config.witch!.canSelfHeal = selfHeal;
        const board = parseBoardDefinition(boardDefinitionFromConfig("pure_white_twelve", config));
        const report = await simulateGames(board, {
          locale,
          seeds: Array.from({ length: 20 }, (_, i) => `pure-white:${i}`),
          styles: ["active", "conservative", "competitive", "random"],
          recordRoot: await createTestTempDirectory("awa-pure-white-simulation-"),
          maxDays: 20,
        });
        expect(report.games).toHaveLength(20);
        expect(report.naturallyFinished).toBe(20);
        expect(report.rejects).toBe(0);
        expect(report.fallbacks).toBe(0);
        expect(report.branches.role_inspected).toBeGreaterThan(0);
        expect(report.branches.role_inspection_skipped).toBeGreaterThan(0);
        const root = await createTestTempDirectory("awa-pure-white-replay-");
        for (const game of report.games) {
          const record = await readReproduction(path.join(game.recordDir, "reproduction.json"));
          expect((await replayReproduction(record, root)).snapshot.result).toEqual(game.result);
        }
      }, 120000);
