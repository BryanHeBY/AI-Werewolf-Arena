/**
 * Failure scenarios verify paid Radiant Eclipse borrowed potions survive an aborted recorded game without false night disclosure.
 * Input: The existing recording driver, controlled Seer failure, two original locales and temporary saved replay/checkpoints.
 * Output and oracle: Literal stock and disclosure assertions inspect the actual failed prefix; source archives and expected fixture bytes remain unchanged.
 */
import { expect, test } from "bun:test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { radiantRecording } from "../../../support/features/radiant-eclipse/drivers/recording";
import { createTestTempDirectory } from "../../../support/drivers/temp-directories";
for (const locale of ["en", "zh-CN"] as const)
  test(`actual paid borrowed potion survives aborted archive without false night disclosure/${locale}`, async () => {
    const root = await createTestTempDirectory("awa-radiant-failed-front-");
    const record = await radiantRecording({
      locale,
      planName: "independent-stock-card16-card17",
      failureStage: "seer",
      failureMode: "error",
      artifactDirectory: root,
    });
    expect(record.checkpoints.at(-1)!.complete).toBe(false);
    expect(record.events.filter((e) => e.type === "night_resolved")).toHaveLength(1);
    expect(
      record.events.filter((e) => e.type === "witch_potion_used" && e.payload.actorId === 1),
    ).toHaveLength(1);
    expect(record.events.filter((e) => e.type === "eclipse_native_restored")).toEqual([]);
    expect(record.events.at(-1)).toMatchObject({
      type: "eclipse_lease_closed",
      payload: { day: 2, status: "aborted" },
    });
    if (process.env.AWA_RADIANT_FIXTURES) {
      const directory = process.env.AWA_RADIANT_FIXTURES,
        name = `radiant-failed-paid-potion-${locale}`;
      await mkdir(path.join(directory, "player-views"), { recursive: true });
      await writeFile(
        path.join(directory, `${name}.replay.json`),
        await readFile(path.join(root, "replay.json")),
      );
      await writeFile(
        path.join(directory, `${name}.checkpoint.txt`),
        JSON.stringify(record.checkpoints.at(-1), null, 2) + "\n",
      );
      for (const [label, actor] of [
        ["maid", 1],
        ["count", 2],
        ["seer", 3],
        ["witch", 4],
        ["dreamer", 5],
        ["pack", 11],
        ["villager", 6],
      ] as const)
        await writeFile(
          path.join(directory, "player-views", `${name}-${label}.player.json`),
          await readFile(path.join(root, `players/player_${actor}.json`)),
        );
    }
  });
