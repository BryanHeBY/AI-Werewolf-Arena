/**
 * Filesystem integration tests own existing replay export/version publication and
 * source-alias overwrite refusal. Fresh immutable legacy data and temporary
 * direct/hard/symbolic paths supply input; exact v2 output and unchanged source bytes are
 * the oracle. Native writes, links and cleanup remain with their original cases.
 */
import { expect, test } from "bun:test";
import { readFile, writeFile, mkdir, link, symlink } from "node:fs/promises";
import path from "node:path";
import { readReplayDocument } from "@ai-werewolf-arena/replay-contract";
import { exportReplayBundle } from "../../../src/replay/export_replay_bundle";
import { createTestTempDirectory } from "../../support/drivers/temp-directories";

async function fixture() {
  return JSON.parse(
    await readFile(
      path.resolve(process.cwd(), "../packages/replay-contract/fixtures/synthetic/legacy-localized/locale-unrecorded/god.replay.json"),
      "utf8",
    ),
  );
}

test("the existing exporter uses the same reader and writes v2 without rewriting the archived source", async () => {
  const root = await createTestTempDirectory("awa-replay-version-");
  await mkdir(path.join(root, "legacy"));
  const old = await fixture();
  const raw = JSON.stringify(old);
  const input = path.join(root, "legacy/replay.json");
  await writeFile(input, raw);
  const out = path.join(root, "exported/replay.json");
  const result = await exportReplayBundle({
    recordRoot: root,
    sessionId: "legacy",
    outputFile: out,
  });
  expect(result).toEqual(readReplayDocument(old));
  expect(JSON.parse(await readFile(out, "utf8"))).toEqual(result);
  expect(await readFile(input, "utf8")).toBe(raw);
});

test("export refuses direct and filesystem aliases of its source", async () => {
  const root = await createTestTempDirectory("awa-replay-source-guard-");
  await mkdir(path.join(root, "legacy"));
  const input = path.join(root, "legacy/replay.json");
  const raw = JSON.stringify(await fixture());
  await writeFile(input, raw);
  const hard = path.join(root, "hard.json");
  const soft = path.join(root, "soft.json");
  await link(input, hard);
  await symlink(input, soft);
  for (const outputFile of [input, hard, soft])
    await expect(
      exportReplayBundle({ recordRoot: root, sessionId: "legacy", outputFile }),
    ).rejects.toThrow("replay_export_overwrites_source");
  await expect(
    exportReplayBundle({ recordRoot: root, sessionId: "/legacy", outputFile: input }),
  ).rejects.toThrow("replay_export_overwrites_source");
  expect(await readFile(input, "utf8")).toBe(raw);
});
