/**
 * 显式启用的复现场景验证迷雾组合板前端 fixture 导出会终结实际手工录制并精确重放。
 * 输入为原显式输出目录环境条件、录制分支和语言矩阵。
 * 输出与预期仅在启用时用字面 finalized／game-over 检查已导出的录制；本次维护保留原条件跳过和源 fixture 字节。
 */
import { expect, test } from "bun:test";
import { mistRecording } from "../../../support/features/mist-raven/drivers/recording";
const directory = process.env.AWA_MIST_RAVEN_FIXTURES;
test.skipIf(!directory)(
  "Mist actual finalized manual front fixtures with exact Tape",
  async () => {
    for (const variant of [
      "blast-pre-election",
      "blast-daybreak",
      "blast-speech-gap",
      "blast-pre-vote",
      "blast-raw-target",
      "blast-badge-chain",
      "blast-last-wolf",
      "blast-parallel-raw-loser",
      "blast-parallel-second-gap",
    ] as const)
      for (const locale of ["en", "zh-CN"] as const) {
        const record = await mistRecording(
          variant,
          locale,
          "mist-raven-real-runtime",
          undefined,
          directory,
        );
        expect(record.finalized).toBe(true);
        expect(record.checkpoints.at(-1)!.snapshot.gameOver).toBe(true);
      }
  },
  120000,
);
