/**
 * 失败场景验证流光／蚀日已付借用药剂在录制对局中止后仍保留，且不伪造夜间公开。
 * 输入为现有录制驱动、受控预言家失败、原两种语言及临时保存的复盘／checkpoint。
 * 输出与预期为检查真实失败前缀的字面库存和公开断言；源归档及预期 fixture 字节不变。
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
