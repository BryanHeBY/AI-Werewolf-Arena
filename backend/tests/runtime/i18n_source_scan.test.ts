import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import path from "node:path";
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
