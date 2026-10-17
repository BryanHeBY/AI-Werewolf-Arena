/**
 * 架构测试负责核对视频编译、公开数据入口及准备命令的单向依赖。输入为源码运行时 import/export 和字面量加载，输出独立的禁入断言。
 * 数据消费者不得触达画面装配或 React；用户显式选择的动态项目模块属于插件边界，不作为静态依赖展开。
 */
import { expect, test } from "bun:test";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import ts from "typescript";

const root = path.resolve(import.meta.dir, "../../src");
function dependencies(entry: string) {
  const visited = new Set<string>();
  const externals = new Set<string>();
  function visit(file: string) {
    if (visited.has(file)) return;
    visited.add(file);
    const tree = ts.createSourceFile(
      file,
      readFileSync(file, "utf8"),
      ts.ScriptTarget.Latest,
      true,
    );
    function dependency(source: string) {
      if (!source.startsWith(".")) {
        externals.add(source);
        return;
      }
      const base = path.resolve(path.dirname(file), source);
      const target = [
        base,
        `${base}.ts`,
        `${base}.tsx`,
        path.join(base, "index.ts"),
        path.join(base, "index.tsx"),
      ].find((candidate) => existsSync(candidate) && /\.[jt]sx?$/.test(candidate));
      if (!target) throw new Error(`dependency_unresolved:${source}`);
      visit(target);
    }
    function walk(node: ts.Node): void {
      if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
        if (!node.moduleSpecifier || !ts.isStringLiteral(node.moduleSpecifier)) return;
        if (ts.isImportDeclaration(node)) {
          const clause = node.importClause;
          if (
            clause?.isTypeOnly ||
            (clause &&
              !clause.name &&
              clause.namedBindings &&
              ts.isNamedImports(clause.namedBindings) &&
              clause.namedBindings.elements.every((item) => item.isTypeOnly))
          )
            return;
        } else if (node.isTypeOnly) return;
        dependency(node.moduleSpecifier.text);
        return;
      }
      if (
        ts.isCallExpression(node) &&
        (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
          (ts.isIdentifier(node.expression) && node.expression.text === "require")) &&
        node.arguments[0] &&
        ts.isStringLiteral(node.arguments[0])
      )
        dependency(node.arguments[0].text);
      ts.forEachChild(node, walk);
    }
    walk(tree);
  }
  visit(path.join(root, entry));
  return {
    files: [...visited].map((file) => path.relative(root, file)),
    externals: [...externals],
  };
}

test("pure event view and video compiler never depend on the legacy video assembly", () => {
  for (const entry of [
    "replay/replay-event-view.ts",
    "video/compiler.ts",
    "video/plan/index.ts",
    "../scripts/prepare-video.ts",
    "../scripts/inspect-video.ts",
    "../scripts/audit-video.ts",
  ]) {
    const graph = dependencies(entry);
    expect(graph.files).not.toContain("replay/replay-frame.ts");
    expect(graph.files).not.toContain("video/index.ts");
    expect(graph.files).not.toContain("video/VideoComposition.tsx");
    expect(graph.files).not.toContain("video/render/index.ts");
    expect(
      graph.externals.filter((name) =>
        /^(?:react(?:-dom)?(?:\/|$)|remotion(?:\/|$)|@remotion\/)/.test(name),
      ),
    ).toEqual([]);
  }
  expect(
    dependencies("replay/replay-event-view.ts").files.filter((file) => file.startsWith("video/")),
  ).toEqual([]);
});
