/**
 * 文件系统工具集成测试以隔离临时源码树及真实已审例外文件为输入，核对公开源码发现、原生目录错误及根／祖先／悬空符号链接拒绝。字面路径、错误 ID 和精确例外为预期；私有来源探针均为测试创建字面量，不读取真实私配置或重写例外政策。
 */
import { expect, test } from "bun:test";
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { PROJECT_ROOT } from "@ai-werewolf-arena/project-paths";
import { tmpdir } from "node:os";
import { scanRepository, verifyLiteralExceptions } from "../../../scripts/check-i18n-literals.mjs";

async function isolatedApplicationRoots() {
  const root = await mkdtemp(path.join(tmpdir(), "awa-i18n-root-boundary-"));
  for (const directory of [
    "packages/game-runtime/src",
    "packages/game-media/src",
    "apps/game/src",
    "apps/replay/src",
    "apps/video/src",
    "apps/video/scripts",
  ])
    await mkdir(path.join(root, directory), { recursive: true });
  return root;
}

test("source discovery covers present shared code and only skips absent optional roots", async () => {
  const root = await isolatedApplicationRoots();
  const sourceFiles = {
    "packages/game-runtime/src/example.ts": 'export const label = "后端硬编码";',
    "packages/game-media/src/example.tsx": "export const view = <p>前端硬编码</p>;",
    "apps/video/scripts/example.ts": 'export const label = "脚本硬编码";',
    "apps/workbench/src/client/example.tsx": "export const view = <p>工作台硬编码</p>;",
    "apps/workbench/src/server/example.ts": 'export const label = "工作台服务硬编码";',
    "packages/game-text/src/messages/common.ts":
      'export const zhCN = { "common.none": "无" } as const; const label = "词典邻近硬编码";',
    "config/runtime/auth.json": '{"private":"不应读取"}',
  };
  try {
    for (const [file, source] of Object.entries(sourceFiles)) {
      await mkdir(path.dirname(path.join(root, file)), { recursive: true });
      await writeFile(path.join(root, file), source);
    }
    await symlink(
      path.join(root, "config/runtime/auth.json"),
      path.join(root, "packages/game-runtime/src/link.ts"),
    );
    expect(
      (await scanRepository(root)).map((entry) => `${entry.file}:${entry.text}`).sort(),
    ).toEqual([
      "apps/video/scripts/example.ts:脚本硬编码",
      "apps/workbench/src/client/example.tsx:工作台硬编码",
      "apps/workbench/src/server/example.ts:工作台服务硬编码",
      "packages/game-media/src/example.tsx:前端硬编码",
      "packages/game-runtime/src/example.ts:后端硬编码",
      "packages/game-text/src/messages/common.ts:词典邻近硬编码",
    ]);
    const presentation = path.join(root, "packages/game-presentation/src");
    await mkdir(presentation, { recursive: true });
    await writeFile(
      path.join(presentation, "view.tsx"),
      "export const view = <p>共享展示硬编码</p>;",
    );
    await writeFile(
      path.join(presentation, "helper.mjs"),
      'export const label = "共享脚本硬编码";',
    );
    expect(
      (await scanRepository(root))
        .filter((entry) => entry.file.startsWith("packages/game-presentation/"))
        .map((entry) => `${entry.file}:${entry.text}`)
        .sort(),
    ).toEqual([
      "packages/game-presentation/src/helper.mjs:共享脚本硬编码",
      "packages/game-presentation/src/view.tsx:共享展示硬编码",
    ]);
    await rm(presentation, { recursive: true });
    await writeFile(presentation, "not a directory");
    await expect(scanRepository(root)).rejects.toMatchObject({ code: "ENOTDIR" });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("source discovery rejects a workbench ancestor symlink before reading private files", async () => {
  const root = await isolatedApplicationRoots();
  try {
    const privateDirectory = path.join(root, "private");
    await mkdir(path.join(privateDirectory, "src/client"), { recursive: true });
    await writeFile(
      path.join(privateDirectory, "src/client/auth.ts"),
      'export const secret = "工作台链接私有金丝雀";',
    );
    await mkdir(path.join(root, "apps"), { recursive: true });
    await symlink(privateDirectory, path.join(root, "apps/workbench"));
    await expect(scanRepository(root)).rejects.toThrow("i18n_scan_source_symlink: apps/workbench");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("source discovery rejects a shared root symlink before reading its private target", async () => {
  const root = await isolatedApplicationRoots();
  try {
    const privateDirectory = path.join(root, "private");
    await mkdir(privateDirectory);
    await writeFile(
      path.join(privateDirectory, "auth.ts"),
      'export const secret = "根链接私有金丝雀";',
    );
    await mkdir(path.join(root, "packages/game-text"), { recursive: true });
    await symlink(privateDirectory, path.join(root, "packages/game-text/src"));
    await expect(scanRepository(root)).rejects.toThrow(
      "i18n_scan_source_symlink: packages/game-text/src",
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("source discovery rejects a shared ancestor symlink before traversing its private source", async () => {
  const root = await isolatedApplicationRoots();
  try {
    const privateDirectory = path.join(root, "private");
    await mkdir(path.join(privateDirectory, "src"), { recursive: true });
    await writeFile(
      path.join(privateDirectory, "src/agent.ts"),
      'export const secret = "上级链接私有金丝雀";',
    );
    await mkdir(path.join(root, "packages"), { recursive: true });
    await symlink(privateDirectory, path.join(root, "packages/game-presentation"));
    await expect(scanRepository(root)).rejects.toThrow(
      "i18n_scan_source_symlink: packages/game-presentation",
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("source discovery rejects a present dangling shared root instead of treating it as absent", async () => {
  const root = await isolatedApplicationRoots();
  try {
    await mkdir(path.join(root, "packages/game-presentation"), { recursive: true });
    await symlink(
      path.join(root, "missing-private"),
      path.join(root, "packages/game-presentation/src"),
    );
    await expect(scanRepository(root)).rejects.toThrow(
      "i18n_scan_source_symlink: packages/game-presentation/src",
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("repository Chinese literals have exact reviewed compatibility exceptions without broad directory skips", async () => {
  const exceptions = JSON.parse(
    await readFile(
      path.join(PROJECT_ROOT, "tooling/refactor/policies/i18n-source-exceptions.json"),
      "utf8",
    ),
  );
  expect(verifyLiteralExceptions(await scanRepository(), exceptions)).toEqual([]);
  expect(
    exceptions.every(
      (entry: { reason: string; file: string; text: string }) =>
        Boolean(entry.reason) && entry.file && entry.text,
    ),
  ).toBe(true);
}, 30_000);
