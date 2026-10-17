/**
 * 负责验证 CI 所依赖的 Bun 耗时分片确实覆盖且只覆盖当前测试集合；输入为独立临时仓库和陈旧耗时。
 * 输出由字面测试身份核对，包含新增文件、删除文件、片内串行及各片写回互不影响的边界。
 * 不运行生产对局，不把耗时数据当测试发现清单，不允许空片或失败被静默计为通过。
 */
import { expect, test } from "bun:test";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

test("eight timing-balanced shards run every current test exactly once despite stale or missing timings", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "awa-ci-shards-"));
  try {
    await mkdir(path.join(root, "tests"));
    const timings: Record<string, number> = { "tests/deleted.test.ts": 999999 };
    for (let i = 0; i < 17; i++) {
      const file = `tests/case-${String(i).padStart(2, "0")}.test.ts`;
      await writeFile(
        path.join(root, file),
        `import { test, expect } from "bun:test"; test("ci-case-${i}", () => expect(true).toBe(true));\n`,
      );
      // 最后一个文件故意不登记耗时，验证新测试仍被自动发现。
      if (i !== 16) timings[file] = (i + 1) * 100;
    }
    await writeFile(
      path.join(root, "outside.test.ts"),
      'throw new Error("a filtered test outside the explicit root must never execute");\n',
    );
    const seed = JSON.stringify({ version: 1, files: timings });
    const seen: string[] = [];
    for (let shard = 1; shard <= 8; shard++) {
      // 和工作流一样，每片从同一不可变输入复制，各片只写自己的输出。
      const file = path.join(root, `timings-${shard}.json`);
      await writeFile(file, seed);
      const result = Bun.spawnSync(
        [
          process.execPath,
          "--no-env-file",
          "test",
          "./tests",
          `--shard=${shard}/8`,
          "--timings",
          file,
          "--update-timings",
        ],
        { cwd: root, stdout: "pipe", stderr: "pipe", env: { ...process.env, NO_COLOR: "1" } },
      );
      const output = `${result.stdout}\n${result.stderr}`;
      expect(result.exitCode, output).toBe(0);
      const cases = [...output.matchAll(/^\(pass\) (ci-case-\d+)/gm)].map((match) => match[1]!);
      expect(cases.length).toBeGreaterThan(0);
      seen.push(...cases);
      const written = JSON.parse(await readFile(file, "utf8"));
      expect(Object.keys(written.files).length).toBe(cases.length);
      expect(Object.hasOwn(written.files, "tests/deleted.test.ts")).toBe(false);
    }
    expect(seen.length).toBe(17);
    expect(new Set(seen).size).toBe(17);
    for (let i = 0; i < 17; i++) expect(seen).toContain(`ci-case-${i}`);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("fast gate rejects an unknown group before starting checks", () => {
  const result = Bun.spawnSync(
    [process.execPath, "--no-env-file", path.join(import.meta.dir, "fast.ts"), "not-a-suite"],
    { stdout: "pipe", stderr: "pipe" },
  );
  expect(result.exitCode).toBe(2);
  expect(result.stderr.toString()).toContain("Usage:");
  expect(result.stdout.toString()).not.toContain("$ bun");
});
