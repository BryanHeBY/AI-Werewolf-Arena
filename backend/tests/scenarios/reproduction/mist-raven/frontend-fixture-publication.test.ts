/**
 * Opt-in reproduction scenarios verify Mist/Raven frontend fixture publication finalizes actual manual recordings and exact replay.
 * Input: The original explicit output-directory environment condition, recording variants and locale matrix.
 * Output and oracle: Literal finalized/game-over checks cover published recordings only when enabled; the original conditional skip and source fixture bytes remain unchanged in this migration.
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
