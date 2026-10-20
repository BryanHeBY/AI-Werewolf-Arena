/**
 * 观察驱动的整局场景运行恶夜骑士枪击策略与女巫自疗策略的组合。
 * 输入为公开策略变体、有限观察及固定种子录制。
 * 字面预期为二十局自然结束、无拒绝／回退及查验分支出现；逐局 Tape 结果与原录制对照，不冒充独立免疫／绕过规则预期。
 * 测试不调用付费模型，也不重写预期 fixture／Tape 字节。
 */
import { expect, test } from "bun:test";
import path from "node:path";
import {
  boardDefinitionFromConfig,
  parseBoardDefinition,
} from "../../../../src/app/config/board-definition";
import { evilKnightTwelveConfig } from "../../../../src/rulesets/presets/evil-knight-twelve";
import { WitchSelfHealRule } from "../../../../src/domain";
import { simulateGames } from "../../../../src/app/simulation/simulate-games";
import {
  readReproduction,
  replayReproduction,
} from "../../../../src/app/simulation/replay-reproduction";
import { createTestTempDirectory } from "../../../support/drivers/temp-directories";
for (const shotPolicy of ["night_shot_immune", "hunter_shot_bypasses"] as const)
  for (const selfHeal of [WitchSelfHealRule.Disabled, WitchSelfHealRule.FirstNightOnly])
    for (const locale of ["zh-CN", "en"] as const)
      test(`evil knight observed simulation ${shotPolicy}/${selfHeal}/${locale}`, async () => {
        const config = structuredClone(evilKnightTwelveConfig);
        config.evilKnight!.shotPolicy = shotPolicy;
        config.witch!.canSelfHeal = selfHeal;
        const board = parseBoardDefinition(boardDefinitionFromConfig("evil_knight_twelve", config));
        const report = await simulateGames(board, {
          locale,
          seeds: Array.from({ length: 20 }, (_, i) => `evil-knight:${i}`),
          styles: ["active", "conservative", "competitive", "random"],
          recordRoot: await createTestTempDirectory("awa-evil-knight-simulation-"),
          maxDays: 20,
        });
        expect(report.games).toHaveLength(20);
        expect(report.naturallyFinished).toBe(20);
        expect(report.rejects).toBe(0);
        expect(report.fallbacks).toBe(0);
        expect(report.branches.seer_checked).toBeGreaterThan(0);
        const root = await createTestTempDirectory("awa-evil-knight-replay-");
        for (const game of report.games) {
          const record = await readReproduction(path.join(game.recordDir, "reproduction.json"));
          expect((await replayReproduction(record, root)).snapshot.result).toEqual(game.result);
        }
      }, 120000);
