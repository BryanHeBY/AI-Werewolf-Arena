/**
 * 负责固定构建快照的工具边界单元测试。独立输入为字面模拟包清单、锁定解析项和微型物理 Bun 仓库，
 * 预期字节、路径及拒绝类别均由手写断言给定。样本只建在 /tmp，不安装依赖或读取真实认证／配置。
 * 此处验证快照所有权与完整性，不代表玩法或模型通信验收。
 */
import { expect, test } from "bun:test";
import {
  mkdtemp,
  mkdir,
  readFile,
  realpath,
  rm,
  symlink,
  unlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { assertSnapshotUnchanged, dependencyDigest, freezeBuild } from "./build-snapshot";
import type { BuildLayout } from "./trace-game";

async function fixture() {
  // 从最小手写包与实际磁盘链接构造输入，原仓库后续变更不应修改快照中已复制的依赖。
  const temporary = await mkdtemp("/tmp/awa-refactor-snapshot-test-");
  const repository = path.join(temporary, "repository");
  const root = path.join(temporary, "build");
  const library = path.join(repository, "node_modules/.bun/external@1.0.0/node_modules/external");
  for (const directory of [
    "backend/src",
    "backend/node_modules",
    "frontend",
    "packages/game-contract/src",
    "node_modules/.bun/external@1.0.0/node_modules/external",
  ])
    await mkdir(path.join(repository, directory), { recursive: true });
  const inputs: ReadonlyArray<readonly [string, unknown]> = [
    [
      "package.json",
      {
        name: "mock-refactor-root",
        workspaces: ["backend", "frontend", "packages/*"],
        dependencies: { backend: "workspace:*", external: "1.0.0" },
      },
    ],
    [
      "backend/package.json",
      {
        name: "backend",
        dependencies: { external: "1.0.0", "@ai-werewolf-arena/game-contract": "workspace:*" },
      },
    ],
    ["frontend/package.json", { name: "frontend" }],
    ["packages/game-contract/package.json", { name: "@ai-werewolf-arena/game-contract" }],
    [
      "bun.lock",
      {
        packages: {
          external: ["external@1.0.0", "", "", { integrity: "literal-mock-integrity" }],
        },
      },
    ],
  ];
  for (const [file, data] of inputs)
    await writeFile(path.join(repository, file), JSON.stringify(data));
  await writeFile(path.join(repository, "backend/src/probe.ts"), "export const value = 1;\n");
  await writeFile(
    path.join(repository, "packages/game-contract/src/index.ts"),
    "export const stable = 1;\n",
  );
  await writeFile(
    path.join(library, "package.json"),
    JSON.stringify({ name: "external", version: "1.0.0" }),
  );
  await writeFile(path.join(library, "index.js"), "exports.version = 1;\n");
  await symlink(library, path.join(repository, "node_modules/external"));
  await symlink(library, path.join(repository, "backend/node_modules/external"));
  await symlink(path.join(repository, "backend"), path.join(repository, "node_modules/backend"));
  return { temporary, repository, root, library };
}

type Fixture = Awaited<ReturnType<typeof fixture>>;
async function withFixture(run: (input: Fixture) => Promise<void>) {
  const input = await fixture();
  try {
    await run(input);
  } finally {
    await rm(input.temporary, { recursive: true, force: true });
  }
}

test("snapshot detects an added production source file", async () => {
  await withFixture(async (f) => {
    const snapshot = await freezeBuild(f.repository, f.root, null);
    await writeFile(path.join(f.root, "backend/src/added.ts"), "export const newlyAdded = 1;\n");
    await expect(assertSnapshotUnchanged(snapshot)).rejects.toThrow(
      "snapshot_source_membership_changed",
    );
  });
});

test("snapshot detects source byte edits without changing membership", async () => {
  await withFixture(async (f) => {
    const snapshot = await freezeBuild(f.repository, f.root, null);
    await writeFile(path.join(f.root, "backend/src/probe.ts"), "export const value = 2;\n");
    await expect(assertSnapshotUnchanged(snapshot)).rejects.toThrow("snapshot_input_changed");
  });
});

test("snapshot physically owns dependency bytes after the original store changes", async () => {
  await withFixture(async (f) => {
    const snapshot = await freezeBuild(f.repository, f.root, null);
    const copied = await realpath(path.join(f.root, "backend/node_modules/external"));
    expect(copied.startsWith(`${f.root}${path.sep}`)).toBe(true);
    expect(copied).not.toBe(f.library);
    await writeFile(path.join(f.library, "index.js"), "exports.version = 2;\n");
    expect(await readFile(path.join(copied, "index.js"), "utf8")).toBe("exports.version = 1;\n");
    await expect(assertSnapshotUnchanged(snapshot)).resolves.toBeUndefined();
  });
});

test("snapshot detects edits to its copied dependency bytes", async () => {
  await withFixture(async (f) => {
    const snapshot = await freezeBuild(f.repository, f.root, null);
    const copied = await realpath(path.join(f.root, "backend/node_modules/external"));
    await writeFile(path.join(copied, "index.js"), "exports.version = 2;\n");
    await expect(assertSnapshotUnchanged(snapshot)).rejects.toThrow(
      "snapshot_dependencies_changed",
    );
  });
});

test("private env canary is excluded before copying source bytes", async () => {
  await withFixture(async (f) => {
    await writeFile(
      path.join(f.repository, "backend/src/.env"),
      "MOCK_PRIVATE_SENTINEL=not-a-real-secret\n",
    );
    const snapshot = await freezeBuild(f.repository, f.root, null);
    expect(snapshot.files.some((file) => file.path.endsWith("/.env"))).toBe(false);
    await expect(readFile(path.join(f.root, "backend/src/.env"))).rejects.toThrow();
  });
});

test("an output root symlink into the repository is rejected", async () => {
  await withFixture(async (f) => {
    await mkdir(path.join(f.repository, "internal"));
    await symlink(path.join(f.repository, "internal"), f.root);
    await expect(freezeBuild(f.repository, f.root, null)).rejects.toThrow(
      "snapshot_destination_symlink",
    );
  });
});

test("workspace app and package links both resolve to this build", async () => {
  await withFixture(async (f) => {
    await freezeBuild(f.repository, f.root, null);
    expect(await realpath(path.join(f.root, "node_modules/backend"))).toBe(
      path.join(f.root, "backend"),
    );
    expect(
      await realpath(path.join(f.root, "backend/node_modules/@ai-werewolf-arena/game-contract")),
    ).toBe(path.join(f.root, "packages/game-contract"));
  });
});

test("snapshot detects owner-local dependency links redirected into the checkout", async () => {
  await withFixture(async (f) => {
    const snapshot = await freezeBuild(f.repository, f.root, null);
    const link = path.join(f.root, "backend/node_modules/external");
    await unlink(link);
    await symlink(f.library, link);
    await expect(assertSnapshotUnchanged(snapshot)).rejects.toThrow();
  });
});

test("stale installed package version cannot claim the frozen resolved lock version", async () => {
  await withFixture(async (f) => {
    await writeFile(
      path.join(f.library, "package.json"),
      JSON.stringify({ name: "external", version: "2.0.0" }),
    );
    await expect(freezeBuild(f.repository, f.root, null)).rejects.toThrow();
  });
});

test("copied store preserves relative internal links without escaping the snapshot", async () => {
  await withFixture(async (f) => {
    const store = path.join(f.repository, "node_modules/.bun");
    await mkdir(path.join(store, "consumer@1.0.0/node_modules"), { recursive: true });
    await symlink(
      "../../external@1.0.0/node_modules/external",
      path.join(store, "consumer@1.0.0/node_modules/external"),
    );
    const snapshot = await freezeBuild(f.repository, f.root, null);
    expect(
      await realpath(path.join(f.root, "node_modules/.bun/consumer@1.0.0/node_modules/external")),
    ).toBe(path.join(f.root, "node_modules/.bun/external@1.0.0/node_modules/external"));
    await expect(assertSnapshotUnchanged(snapshot)).resolves.toBeUndefined();
  });
});

test("physical dependency store rejects an absolute link escaping to the checkout", async () => {
  await withFixture(async (f) => {
    await symlink(f.library, path.join(f.repository, "node_modules/.bun/unsafe-link"));
    await expect(freezeBuild(f.repository, f.root, null)).rejects.toThrow(
      "snapshot_dependency_escaped",
    );
  });
});

test("dependency digest distinguishes membership and symlink destination changes", async () => {
  await withFixture(async (f) => {
    const store = path.join(f.repository, "node_modules/.bun");
    const initial = await dependencyDigest(store);
    await writeFile(path.join(store, "added.js"), "exports.newMember = true;\n");
    expect(await dependencyDigest(store)).not.toBe(initial);
    await symlink("external@1.0.0", path.join(store, "alias"));
    const firstTarget = await dependencyDigest(store);
    await unlink(path.join(store, "alias"));
    await symlink("external@1.0.0/node_modules", path.join(store, "alias"));
    expect(await dependencyDigest(store)).not.toBe(firstTarget);
  });
});

async function withDriverFixture(
  run: (input: {
    root: string;
    output: string;
    temporary: string;
    layout: BuildLayout;
    invoke: () => Promise<{ code: number; stderr: string }>;
  }) => Promise<void>,
) {
  // 子进程只加载本临时根下的惰性探针模块，以独立错误／时钟文本核查入口边界。
  const temporary = await mkdtemp("/tmp/awa-refactor-driver-test-");
  const root = path.join(temporary, "root");
  const output = path.join(temporary, "output");
  await mkdir(root);
  const layout: BuildLayout = {
    bootstrap: "bootstrap.ts",
    core: "core.ts",
    recorder: "recorder.ts",
    recordingContext: "recording-context.ts",
    reproductionContext: "reproduction-context.ts",
    reproduction: "reproduction.ts",
    replay: "replay.ts",
  };
  for (const filename of Object.values(layout))
    await writeFile(path.join(root, filename), "export const inert = true;\n");
  const input = path.join(temporary, "scenario.json");
  const layoutPath = path.join(temporary, "layout.json");
  await writeFile(
    input,
    JSON.stringify({
      seed: "literal-driver-test",
      locale: "en",
      board: {},
      id: "literal-driver-test",
      boardId: "literal-driver-test",
      fixedRoles: [],
      maxDays: 1,
      transcript: { family: "basic", plan: "basic" },
    }),
  );
  const invoke = async () => {
    await writeFile(layoutPath, JSON.stringify(layout));
    const child = Bun.spawn(
      [
        process.execPath,
        "--no-env-file",
        path.join(import.meta.dir, "trace-game.ts"),
        root,
        input,
        output,
        layoutPath,
      ],
      {
        cwd: root,
        env: { PATH: process.env.PATH ?? "", TMPDIR: "/tmp" },
        stdout: "pipe",
        stderr: "pipe",
      },
    );
    const [code, , stderr] = await Promise.all([
      child.exited,
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
    ]);
    return { code, stderr };
  };
  try {
    await run({ root, output, temporary, layout, invoke });
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

test("trace driver rejects traversal layout entries before importing another build", async () => {
  await withDriverFixture(async (f) => {
    f.layout.core = "../outside.ts";
    const result = await f.invoke();
    expect(result.code).not.toBe(0);
    expect(result.stderr).toContain("differential_layout_invalid");
  });
});

test("trace driver rejects a layout symlink whose real target escapes the build", async () => {
  await withDriverFixture(async (f) => {
    const outside = path.join(f.temporary, "outside.ts");
    await writeFile(outside, "export const mockOutside = true;\n");
    await symlink(outside, path.join(f.root, "linked.ts"));
    f.layout.core = "linked.ts";
    const result = await f.invoke();
    expect(result.code).not.toBe(0);
    expect(result.stderr).toContain("differential_layout_escaped");
  });
});

test("trace driver fixes logical time before a build module captures Date.now", async () => {
  await withDriverFixture(async (f) => {
    await writeFile(
      path.join(f.root, f.layout.bootstrap),
      'const captured = Date.now.bind(Date); export function bootstrapGame() { throw Error("literal_clock:" + captured()); }\n',
    );
    await writeFile(
      path.join(f.root, f.layout.core),
      "export function createRandom(seed) { return { metadata: { seed } }; }\n",
    );
    const result = await f.invoke();
    expect(result.code).not.toBe(0);
    expect(result.stderr).toContain("literal_clock:1700000000000");
  });
});
