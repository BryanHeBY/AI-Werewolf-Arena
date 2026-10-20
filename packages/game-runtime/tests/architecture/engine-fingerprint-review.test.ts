/**
 * 负责精确引擎来源的架构与文件系统检查；输入为字面包导出、模块字节和独立模拟外部 canary。
 * 输出为遗漏来源及符号链接穿越的拒绝断言；临时目录只在 /tmp，不使用真实认证。
 * 录制集成只构造原生初始 checkpoint；原归档与 replay 输出前的拒绝为预期，不运行完整对局或模型。
 */
import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import {
  chmod,
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import {
  engineFingerprintInputs,
  fingerprintEngine,
} from "../../src/recording/reproduction/engine-fingerprint";
import { bootstrapGame } from "../../src/app/bootstrap";
import { Camp, createRandom, type Role } from "../../src/domain";
import { ReproductionTrace } from "../../src/recording/reproduction/trace";
import { sixPlayerMvpConfig } from "../../src/rulesets/presets/six-player-mvp";
import { captureCheckpoint } from "../../src/app/simulation/reproduction-context";
import { replayReproduction } from "../../src/app/simulation/replay-reproduction";
import { RULESET } from "@ai-werewolf-arena/game-catalog";

async function fixture() {
  const temporary = await mkdtemp("/tmp/awa-fingerprint-review-test-");
  const root = path.join(temporary, "root");
  const external = path.join(temporary, "external");
  for (const directory of [
    path.join(root, "packages/game-runtime/src"),
    path.join(root, "packages/a/src"),
    path.join(external, "packages/game-runtime/src"),
    path.join(external, "packages/a/src"),
  ])
    await mkdir(directory, { recursive: true });
  await writeFile(path.join(root, "bun.lock"), "literal-lock\n");
  await writeFile(
    path.join(root, "packages/game-runtime/src/main.ts"),
    'export { value } from "./.internal";\n',
  );
  await writeFile(path.join(root, "packages/a/src/index.ts"), "export const value = 1;\n");
  await writeFile(path.join(root, "packages/a/src/alternate.ts"), "export const value = 2;\n");
  await writeFile(
    path.join(root, "packages/a/package.json"),
    JSON.stringify({ name: "@awa/a", exports: { ".": "./src/index.ts" } }),
  );
  for (const name of ["packages/game-runtime/src/canary.ts", "packages/a/src/canary.ts"])
    await writeFile(path.join(external, name), "export const mockOutside = true;\n");
  return { temporary, root, external };
}

async function using(run: (input: Awaited<ReturnType<typeof fixture>>) => Promise<void>) {
  const input = await fixture();
  try {
    await run(input);
  } finally {
    await rm(input.temporary, { recursive: true, force: true });
  }
}

test("fingerprint refuses a backend ancestor symlink before hashing an external source", async () => {
  await using(async (f) => {
    await rename(path.join(f.root, "packages/game-runtime"), path.join(f.root, "original-backend"));
    await symlink(
      path.join(f.external, "packages/game-runtime"),
      path.join(f.root, "packages/game-runtime"),
    );
    await expect(engineFingerprintInputs(f.root)).rejects.toThrow("engine_source_symlink_rejected");
  });
});

test("fingerprint refuses a packages-root symlink before hashing an external package", async () => {
  await using(async (f) => {
    await rename(path.join(f.root, "packages"), path.join(f.root, "original-packages"));
    await symlink(path.join(f.external, "packages"), path.join(f.root, "packages"));
    await expect(engineFingerprintInputs(f.root)).rejects.toThrow("engine_source_symlink_rejected");
  });
});

test("lock fingerprint refuses a symlink instead of reading a foreign private canary", async () => {
  await using(async (f) => {
    await rename(path.join(f.root, "bun.lock"), path.join(f.root, "original-lock"));
    const canary = path.join(f.external, "lock-canary");
    await writeFile(canary, "MOCK_PRIVATE_SENTINEL_NOT_A_REAL_SECRET\n");
    await symlink(canary, path.join(f.root, "bun.lock"));
    await expect(fingerprintEngine(f.root)).rejects.toThrow();
  });
});

test("package entrypoint selection changes identity without changing source modules or lock", async () => {
  await using(async (f) => {
    const before = await fingerprintEngine(f.root);
    await writeFile(
      path.join(f.root, "packages/a/package.json"),
      JSON.stringify({ name: "@awa/a", exports: { ".": "./src/alternate.ts" } }),
    );
    const after = await fingerprintEngine(f.root);
    expect(after.lockHash).toBe(before.lockHash);
    expect(after.sourceHash).not.toBe(before.sourceHash);
  });
});

for (const metadata of [
  "packages/game-runtime/tsconfig.json",
  "packages/a/tsconfig.json",
  "bunfig.toml",
])
  test(`${metadata} resolution settings participate in identity without changing the lock`, async () => {
    await using(async (f) => {
      const filename = path.join(f.root, metadata);
      await writeFile(
        filename,
        metadata.endsWith(".toml") ? "[run]\nbun = true\n" : '{"compilerOptions":{"jsx":"react"}}',
      );
      const before = await fingerprintEngine(f.root);
      await writeFile(
        filename,
        metadata.endsWith(".toml")
          ? "[run]\nbun = false\n"
          : '{"compilerOptions":{"jsx":"react-jsx"}}',
      );
      const after = await fingerprintEngine(f.root);
      expect(after.lockHash).toBe(before.lockHash);
      expect(after.sourceHash).not.toBe(before.sourceHash);
    });
  });

test("an inherited local compiler resolution change cannot retain the old source identity", async () => {
  await using(async (f) => {
    await writeFile(
      path.join(f.root, "packages/game-runtime/tsconfig.json"),
      '{"extends":"./tsconfig.base.json"}',
    );
    const base = path.join(f.root, "packages/game-runtime/tsconfig.base.json");
    await writeFile(base, '{"compilerOptions":{"baseUrl":".","paths":{"alias":["src/main.ts"]}}}');
    const before = await fingerprintEngine(f.root);
    await writeFile(
      base,
      '{"compilerOptions":{"baseUrl":".","paths":{"alias":["src/alternate.ts"]}}}',
    );
    expect((await fingerprintEngine(f.root)).sourceHash).not.toBe(before.sourceHash);
  });
});

test("maintained dot-prefixed imported modules participate in exact source identity", async () => {
  await using(async (f) => {
    await writeFile(
      path.join(f.root, "packages/game-runtime/src/.internal.ts"),
      "export const value = 1;\n",
    );
    const before = await fingerprintEngine(f.root);
    await writeFile(
      path.join(f.root, "packages/game-runtime/src/.internal.ts"),
      "export const value = 2;\n",
    );
    expect((await fingerprintEngine(f.root)).sourceHash).not.toBe(before.sourceHash);
  });
});

test("module and schema membership is deterministic across file creation order", async () => {
  await using(async (f) => {
    const second = path.join(f.temporary, "second");
    const entries: ReadonlyArray<readonly [string, string]> = [
      ["packages/game-runtime/src/a/inside.ts", "inside"],
      ["packages/game-runtime/src/a.ts", "neighbor"],
      ["packages/game-runtime/src/client.tsx", "tsx"],
      ["packages/game-runtime/src/schema.json", '{"literal":true}'],
      ["packages/new-contract/src/value.cts", "cts"],
      ["packages/new-contract/src/value.mts", "mts"],
      ["packages/new-contract/src/value.mjs", "mjs"],
    ];
    for (const [root, ordered] of [
      [f.root, entries],
      [second, [...entries].reverse()],
    ] as const) {
      await mkdir(path.join(root, "packages"), { recursive: true });
      for (const [name, value] of ordered) {
        await mkdir(path.dirname(path.join(root, name)), { recursive: true });
        await writeFile(path.join(root, name), value);
      }
    }
    const first = (await engineFingerprintInputs(f.root)).filter((file) =>
      entries.some(([name]) => name === file),
    );
    expect(first).toEqual(await engineFingerprintInputs(second));
    expect(new Set(first)).toEqual(new Set(entries.map(([name]) => name)));
  });
});

test("private canary and generated dependency directory never join fingerprint membership", async () => {
  await using(async (f) => {
    const before = await fingerprintEngine(f.root);
    for (const [name, value] of [
      ["packages/game-runtime/src/.env.local", "MOCK_ENV_ONLY"],
      ["packages/game-runtime/src/auth.json", "MOCK_AUTH_ONLY"],
      ["packages/game-runtime/src/credentials.json", "MOCK_CREDENTIALS_ONLY"],
      ["packages/game-runtime/src/node_modules/injected.ts", "MOCK_DEPENDENCY_ONLY"],
      ["packages/game-runtime/src/.codex/config.json", "MOCK_CODEX_CONFIG_ONLY"],
      ["packages/game-runtime/src/.aws/config.json", "MOCK_AWS_CONFIG_ONLY"],
      ["packages/game-runtime/src/.git/config.json", "MOCK_GIT_CONFIG_ONLY"],
    ]) {
      await mkdir(path.dirname(path.join(f.root, name!)), { recursive: true });
      await writeFile(path.join(f.root, name!), value!);
      await chmod(path.join(f.root, name!), 0);
    }
    expect(await fingerprintEngine(f.root)).toEqual(before);
  });
});

/** 旧构建的真实指纹只作拒绝反例；不依赖迁移报告或在当前布局重算旧构建。 */
const HISTORICAL_SOURCE_HASH = "b603ece35929ad44b8dae7caf3738d8e2ca41e9f5ffd3020c3b105d1db55c8e0";

test("strict replay rejects a finalized initial archive with the historical narrower fingerprint without rewriting it", async () => {
  const temporary = await mkdtemp("/tmp/awa-old-fingerprint-rejection-");
  try {
    const repository = path.resolve(import.meta.dir, "../../../..");
    const oldSourceHash = HISTORICAL_SOURCE_HASH;
    const lockHash = createHash("sha256")
      .update(await readFile(path.join(repository, "bun.lock")))
      .digest("hex");
    const roles = sixPlayerMvpConfig.roleSetups.flatMap(({ role, count }) =>
      Array<Role>(count).fill(role),
    );
    const game = bootstrapGame(sixPlayerMvpConfig, {
      fixedRoles: roles,
      random: createRandom("fingerprint-rejection"),
    });
    const trace = new ReproductionTrace(
      {
        engine: { id: "awa-engine", sourceHash: oldSourceHash, lockHash },
        random: game.random.metadata,
        ruleset: RULESET,
        boardId: "fingerprint_rejection",
        normalizedBoard: sixPlayerMvpConfig,
        locale: "zh-CN",
        maxDays: 1,
        dealMode: "fixed",
        players: roles.map((role, index) => ({
          id: index + 1,
          name: `Player ${index + 1}`,
          role,
          camp: index < 2 ? Camp.Wolf : Camp.Good,
        })),
      },
      () => {},
    );
    trace.checkpoint(
      captureCheckpoint(game.world, game.phaseManager.getSnapshot(), 0, true, 0),
      [],
    );
    const record = trace.build({
      operations: [],
      termination: { reason: "runtime_timeout", winner: null },
    });
    const before = JSON.stringify(record);
    const output = path.join(temporary, "strict-replay");
    await expect(replayReproduction(record, output)).rejects.toThrow(
      "reproduction_engine_or_lock_incompatible",
    );
    expect(JSON.stringify(record)).toBe(before);
    await expect(readdir(output)).rejects.toThrow();
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});
