/**
 * 架构测试负责核对视频编译和事件视图的单向依赖。输入为真实前端源码的静态运行时 import/export，输出独立的禁入路径断言。
 * 叶视图不得触达视频装配或 React，编译器不得回到旧兼容装配；本测试不执行游戏、渲染或修改源码以通过检查。
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
    for (const statement of tree.statements) {
      if (!(ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement))) continue;
      if (!statement.moduleSpecifier || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
      if (ts.isImportDeclaration(statement)) {
        const clause = statement.importClause;
        if (
          clause?.isTypeOnly ||
          (clause &&
            !clause.name &&
            clause.namedBindings &&
            ts.isNamedImports(clause.namedBindings) &&
            clause.namedBindings.elements.every((item) => item.isTypeOnly))
        )
          continue;
      } else if (statement.isTypeOnly) continue;
      const source = statement.moduleSpecifier.text;
      if (!source.startsWith(".")) {
        externals.add(source);
        continue;
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
  }
  visit(path.join(root, entry));
  return {
    files: [...visited].map((file) => path.relative(root, file)),
    externals: [...externals],
  };
}

test("pure event view and video compiler never depend on the legacy video assembly", () => {
  for (const entry of ["replay/replay-event-view.ts", "video/compiler.ts"]) {
    const graph = dependencies(entry);
    expect(graph.files).not.toContain("replay/replay-frame.ts");
    expect(graph.files).not.toContain("video/index.ts");
    expect(graph.files).not.toContain("video/VideoComposition.tsx");
    expect(graph.externals).not.toContain("react");
    expect(graph.externals).not.toContain("remotion");
  }
  expect(
    dependencies("replay/replay-event-view.ts").files.filter((file) => file.startsWith("video/")),
  ).toEqual([]);
});
