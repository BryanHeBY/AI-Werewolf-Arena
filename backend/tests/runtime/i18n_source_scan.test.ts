/**
 * Unit AST fixtures and source-scan integration tests check translation ownership
 * and the fixed application/shared presentation read boundary. Inputs are literal
 * source snippets, isolated temporary source trees and exact reviewed exceptions;
 * literal hit lists and native filesystem error codes are independent oracles.
 * The scanner never reads private configuration or follows fixture symlinks,
 * and these tests do not change repository exceptions to hide new findings.
 */
import { expect, test } from "bun:test";
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import {
  collectChineseLiterals,
  scanRepository,
  verifyLiteralExceptions,
} from "../../scripts/check_i18n_literals.mjs";

test("controlled source scan covers literals, all template segments and JSX while ignoring comments", () => {
  const found = collectChineseLiterals(
    "sample.tsx",
    '// 注释不检查\nconst a = "新增硬编码"; const b = `头${x}中${y}尾`; const c = <p>页面文本</p>; const d = "ASCII";',
  );
  expect(found.map((entry) => entry.text)).toEqual(["新增硬编码", "头", "中", "尾", "页面文本"]);
  expect(verifyLiteralExceptions(found, [])).toHaveLength(5);
  const documented = [
    { file: "sample.tsx", text: "新增硬编码", count: 1, reason: "explicit historical fixture" },
  ];
  expect(verifyLiteralExceptions(found.slice(0, 1), documented)).toEqual([]);
  expect(verifyLiteralExceptions([found[0], found[0]], documented).length).toBeGreaterThan(0);
  expect(verifyLiteralExceptions([], documented).length).toBeGreaterThan(0);
});

test("translation owner exemption covers direct zhCN values and no adjacent code", () => {
  const source = [
    'export const zhCN = { "common.none": "无", "common.player": `{id}号`, "中文键": "词条值", "nested": { label: "嵌套硬编码" } } as const satisfies Record<MessageKey, string>;',
    'const metadata = { label: "词典邻近硬编码" };',
    'function helper() { const zhCN = { key: "局部冒名" }; return "函数硬编码"; }',
    'export const en = { "common.none": "英文中夹中文" };',
    'export const definition = { parameters: { "common.none": ["参数硬编码"] } };',
  ].join("\n");
  expect(
    collectChineseLiterals("packages/game-text/src/messages/common.ts", source).map(
      (entry) => entry.text,
    ),
  ).toEqual([
    "中文键",
    "嵌套硬编码",
    "词典邻近硬编码",
    "局部冒名",
    "函数硬编码",
    "英文中夹中文",
    "参数硬编码",
  ]);
  for (const file of [
    "packages/game-text/src/messages/definition.ts",
    "packages/game-text/src/messages/catalog.ts",
    "packages/game-text/src/formatting.ts",
    "packages/game-text/src/messages/unregistered.ts",
  ])
    expect(collectChineseLiterals(file, 'export const zhCN = { key: "冒充词典" };')).toEqual([
      { file, text: "冒充词典", line: 1 },
    ]);
});

test("source discovery covers present shared code and only skips absent optional roots", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "awa-i18n-scan-"));
  const sourceFiles = {
    "backend/src/example.ts": 'export const label = "后端硬编码";',
    "frontend/src/example.tsx": "export const view = <p>前端硬编码</p>;",
    "frontend/scripts/example.ts": 'export const label = "脚本硬编码";',
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
      path.join(root, "backend/src/link.ts"),
    );
    expect(
      (await scanRepository(root)).map((entry) => `${entry.file}:${entry.text}`).sort(),
    ).toEqual([
      "backend/src/example.ts:后端硬编码",
      "frontend/scripts/example.ts:脚本硬编码",
      "frontend/src/example.tsx:前端硬编码",
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

async function isolatedApplicationRoots() {
  const root = await mkdtemp(path.join(tmpdir(), "awa-i18n-root-boundary-"));
  for (const directory of ["backend/src", "frontend/src", "frontend/scripts"])
    await mkdir(path.join(root, directory), { recursive: true });
  return root;
}

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
    await mkdir(path.join(root, "packages"));
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
      path.resolve(process.cwd(), "../docs/expansion/i18n-source-exceptions.json"),
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
}, 30_000); // Whole-repository AST I/O and parsing has its own budget; coverage and exact exceptions remain strict.
