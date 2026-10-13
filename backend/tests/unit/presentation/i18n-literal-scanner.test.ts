/**
 * Unit tests check controlled AST literal discovery and exact translation ownership exemptions. Inputs are literal TS/JSX/template snippets and reviewed exception rows; handwritten hit lists and invalid exception counts are the oracle. No repository or temporary filesystem tree is scanned.
 */
import { expect, test } from "bun:test";
import { collectChineseLiterals, verifyLiteralExceptions } from "../../../scripts/check_i18n_literals.mjs";

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
