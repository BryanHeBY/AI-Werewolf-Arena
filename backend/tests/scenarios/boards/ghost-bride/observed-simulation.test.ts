/**
 * 观察驱动的整局场景运行有限观察下鬼魂新娘的完整三阵营对局。
 * 输入为每种语言下一百个固定机器人种子及逐局捕获的归档。
 * 字面预期为一百局自然完成、无拒绝／回退及婚约开局完成；逐局严格重放与原末 checkpoint 对照，不另称独立关系／成员预期。
 * 测试不调用付费模型，也不重写预期 fixture／Tape 字节。
 */
import { expect, test } from "bun:test";
import { promises as fs } from "node:fs";
import path from "node:path";
import { ghostBrideBoard } from "../../../support/features/ghost-bride/builders/scenario";
import {
  boardDefinitionFromConfig,
  parseBoardDefinition,
} from "../../../../src/app/config/board-definition";
import { simulateGames } from "../../../../src/app/simulation/simulate-games";
import {
  readReproduction,
  replayReproduction,
} from "../../../../src/app/simulation/replay-reproduction";
import { createTestTempDirectory } from "../../../support/drivers/temp-directories";
for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}: one hundred restricted Ghost Bride robots each record and pass strict Tape`, async () => {
    const board = parseBoardDefinition(
      boardDefinitionFromConfig("ghost_bride_observed", ghostBrideBoard()),
    );
    const report = await simulateGames(board, {
      locale,
      seeds: Array.from({ length: 100 }, (_, i) => `ghost-observed:${i}`),
      styles: ["active", "conservative", "competitive", "random"],
      maxDays: 30,
      recordRoot: await createTestTempDirectory("awa-ghost-observed-"),
    });
    await fs.writeFile(`/tmp/awa-p9-ghost-bride-observed-${locale}.json`, JSON.stringify(report));
    for (const game of report.games.filter((g) => g.rejects || g.fallbacks))
      await fs.writeFile(
        `/tmp/awa-p9-ghost-bride-reject-${locale}-${game.seed.replace(/[^a-z0-9]/gi, "_")}.json`,
        await fs.readFile(path.join(game.recordDir, "logic_ops.json")),
      );
    expect(report.games).toHaveLength(100);
    // 逐行动者的私有开枪候选名单排除同夜死亡者，不暴露身份或死因。
    expect(report.rejects).toBe(0);
    expect(report.games.filter((game) => game.rejects)).toEqual([]);
    expect(report.fallbacks).toBe(0);
    expect(report.naturallyFinished).toBe(100);
    await fs.writeFile(`/tmp/awa-p9-ghost-bride-observed-${locale}.json`, JSON.stringify(report));
    const output = await createTestTempDirectory("awa-ghost-observed-tape-");
    for (const game of report.games) {
      const record = await readReproduction(path.join(game.recordDir, "reproduction.json"));
      expect(record.checkpoints.at(-1)!.ghostBrideSetup?.status).toBe("complete");
      expect(
        (await replayReproduction(record, path.join(output, game.seed.replace(/[^a-z0-9]/gi, "_"))))
          .snapshot,
      ).toEqual(record.checkpoints.at(-1)!.snapshot);
    }
  }, 180000);
