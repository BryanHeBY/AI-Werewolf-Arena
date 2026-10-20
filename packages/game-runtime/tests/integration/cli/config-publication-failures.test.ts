/**
 * CLI／文件系统集成测试以临时板子、注入的发布／恢复竞争及真实公开 config-check 入口为输入，验证配置独占发布、回滚及子进程失败。原竞争文件字节、备份内容和精确主错／回滚错为预期；不改变用户配置。
 */
import { expect, test, spyOn } from "bun:test";
import * as fs from "node:fs/promises";
import path from "node:path";
import {
  migrateBoardSource,
  migrateBoards,
} from "../../../../../apps/game/src/cli/migrate-configs";
import { BoardConfigurationError } from "../../../src/app/config/board-definition";
import { configDiagnostic } from "../../../../../apps/game/src/cli/check-config";
import { createTestTempDirectory } from "../../support/drivers/temp-directories";

test("exclusive migration preserves a competing target created after the initial check", async () => {
  const root = await createTestTempDirectory("awa-migration-race-");
  const source = path.join(root, "old.json");
  await fs.writeFile(source, '{"boardSize":12}');
  const target = path.join(root, "boards/custom_twelve.json");
  const collision = Object.assign(new Error("competing_target"), { code: "EEXIST" });
  const link = spyOn(fs, "link").mockImplementation(async (_from, to) => {
    await fs.writeFile(to, "COMPETING_BOARD", { flag: "wx" });
    throw collision;
  });
  try {
    await expect(
      migrateBoardSource(root, "custom_twelve", source, "twelve_player_standard", true),
    ).rejects.toBe(collision);
    expect(await fs.readFile(target, "utf8")).toBe("COMPETING_BOARD");
    expect((await fs.readdir(path.dirname(target))).some((name) => name.endsWith(".tmp"))).toBe(
      false,
    );
  } finally {
    link.mockRestore();
  }
});

test("single-source migration keeps the original and aggregates publication and rollback errors", async () => {
  const root = await createTestTempDirectory("awa-migration-rollback-");
  await fs.mkdir(path.join(root, "boards"));
  const source = path.join(root, "boards/twelve_player_standard.json");
  const original = '{"boardSize":12}';
  await fs.writeFile(source, original);
  const publication = new Error("publish_failed");
  const rollback = new Error("rollback_failed");
  let calls = 0;
  const rename = spyOn(fs, "rename").mockImplementation(async () => {
    throw ++calls === 1 ? publication : rollback;
  });
  try {
    let failure: unknown;
    try {
      await migrateBoardSource(root, "twelve_player_standard", source, undefined, true);
    } catch (error) {
      failure = error;
    }
    expect(failure).toBeInstanceOf(AggregateError);
    expect((failure as AggregateError).errors).toEqual([publication, rollback]);
    expect(await fs.readFile(source, "utf8")).toBe(original);
    expect((await fs.readdir(path.dirname(source))).some((name) => name.endsWith(".tmp"))).toBe(
      false,
    );
  } finally {
    rename.mockRestore();
  }
});

test("a failed later board publication restores earlier boards and retains backups", async () => {
  const root = await createTestTempDirectory("awa-bulk-rollback-");
  await fs.mkdir(path.join(root, "boards"));
  const names = ["six_player_mvp", "twelve_player_standard"];
  const original = '{"hooks":{"onPerSpeechGap":false}}';
  for (const name of names) await fs.writeFile(path.join(root, "boards", `${name}.json`), original);
  const realRename = fs.rename;
  const failure = new Error("second_publish_failed");
  let calls = 0;
  const rename = spyOn(fs, "rename").mockImplementation(async (from, to) => {
    if (++calls === 2) throw failure;
    await realRename(from, to);
  });
  try {
    await expect(migrateBoards(root, true)).rejects.toBe(failure);
    for (const name of names) {
      const file = path.join(root, "boards", `${name}.json`);
      expect(await fs.readFile(file, "utf8")).toBe(original);
      expect(await fs.readFile(`${file}.v1.bak`, "utf8")).toBe(original);
    }
  } finally {
    rename.mockRestore();
  }
});

test("configuration CLI preserves safe locations and never prints raw provider JSON", async () => {
  expect(
    configDiagnostic(
      new BoardConfigurationError("board_config_invalid_field", "roles.witch.selfHela"),
    ),
  ).toEqual({ code: "board_config_invalid_field", path: "roles.witch.selfHela" });
  expect(JSON.stringify(configDiagnostic(new Error("PRIVATE_UNKNOWN_EXCEPTION")))).not.toContain(
    "PRIVATE_UNKNOWN_EXCEPTION",
  );
  expect(
    configDiagnostic(
      new BoardConfigurationError("board_config_invalid_field", "roles.PRIVATE_SECRET_TEXT"),
    ),
  ).toEqual({ code: "board_config_invalid_field" });
  const root = await createTestTempDirectory("awa-safe-check-");
  await fs.mkdir(path.join(root, "runtime"));
  await fs.writeFile(
    path.join(root, "runtime/backends.json"),
    '{"key":"PRIVATE_SECRET_FRAGMENT",INVALID}',
  );
  const command = path.resolve(import.meta.dir, "../../../../../apps/game/src/cli/check-config.ts");
  const run = async (args: string[]) => {
    const process = Bun.spawn([Bun.env.BUN_RUNTIME_EXECUTABLE ?? "bun", command, ...args], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const [stdout, stderr, code] = await Promise.all([
      new Response(process.stdout).text(),
      new Response(process.stderr).text(),
      process.exited,
    ]);
    return { output: stdout + stderr, code };
  };
  const invalid = await run(["--configs-dir", root]);
  expect(invalid.code).toBe(1);
  expect(invalid.output).toContain("runtime_config_json_invalid");
  expect(invalid.output).not.toContain("PRIVATE_SECRET_FRAGMENT");
  expect(invalid.output).not.toContain("INVALID");
  const missing = await run(["--configs-dir", "--game-config-name", "default"]);
  expect(missing.code).toBe(1);
  expect(missing.output).toContain("config_check_usage");
});
