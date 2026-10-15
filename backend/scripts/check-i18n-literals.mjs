/**
 * 负责应用与共享展示源码的 AST 中文字面扫描。输入为固定公开源码根及已审查的文件／文本／次数例外；
 * 输出为未获准中文字面和过期例外诊断，CLI 只报告失败，不改源码、词典或例外清单。
 * 仓库入口逐段拒绝符号链接根，遍历时跳过链接项；私有配置与认证不作为扫描输入。
 * 消息词典只放行登记文件中 exported const zhCN 的直接值；角色名称只放行唯一 roleNames 表中 names["zh-CN"] 的直接值。
 * 两种许可均按 AST 数据位置识别，相邻业务、键名、其他字段和目录仍接受普通扫描。
 */
import ts from "typescript";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { lstat, readFile, readdir } from "node:fs/promises";

export const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const han = /\p{Script=Han}/u;
const translationOwners = new Set([
  "packages/game-text/src/messages/common.ts",
  "packages/game-text/src/messages/runtime.ts",
  "packages/game-text/src/messages/agents.ts",
  "packages/game-text/src/messages/replay.ts",
  "packages/game-text/src/messages/audit.ts",
  "packages/game-text/src/messages/features/classic.ts",
  "packages/game-text/src/messages/features/identity.ts",
  "packages/game-text/src/messages/features/gifts-relations.ts",
  "packages/game-text/src/messages/features/night-modifiers.ts",
  "packages/game-text/src/messages/features/mist-radiant.ts",
  "packages/game-text/src/messages/features/noble-fragrant.ts",
  "packages/game-text/src/messages/features/animal-dream.ts",
]);
// 扫描结果记录源码行；例外按文件／完整字面及精确次数匹配，reason 用于保留人工说明。
/** @typedef {{ file: string, text: string, line: number }} ChineseLiteral */
/** @typedef {{ file: string, text: string, count: number, reason: string }} LiteralException */
/** 检查所给源码的字符串、模板片段和 JSX；注释不作为字面，仓库入口不扫描测试／fixture。 */
/** @param {string} file @param {string} source */
export function collectChineseLiterals(file, source) {
  const parsed = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    /\.[jt]sx$/.test(file) ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  /** @type {Set<import("typescript").ObjectLiteralExpression>} */
  const translationObjects = new Set();
  if (translationOwners.has(file)) {
    for (const statement of parsed.statements) {
      if (
        !ts.isVariableStatement(statement) ||
        !(statement.declarationList.flags & ts.NodeFlags.Const) ||
        !statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)
      )
        continue;
      for (const declaration of statement.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name) || declaration.name.text !== "zhCN") continue;
        let value = declaration.initializer;
        while (value && (ts.isAsExpression(value) || ts.isSatisfiesExpression(value)))
          value = value.expression;
        if (value && ts.isObjectLiteralExpression(value)) translationObjects.add(value);
      }
    }
  }
  /** @type {Set<import("typescript").ObjectLiteralExpression>} */
  const roleNameObjects = new Set();
  // 名称唯一归 game-text：只识别该文件顶层 const roleNames 数组的直接条目及 names 对象。
  // 不把整个名称模块当词典，不放行 id、en、额外字段、局部同名变量或返回文案。
  if (file === "packages/game-text/src/role-names.ts") {
    for (const statement of parsed.statements) {
      if (
        !ts.isVariableStatement(statement) ||
        !(statement.declarationList.flags & ts.NodeFlags.Const)
      )
        continue;
      for (const declaration of statement.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name) || declaration.name.text !== "roleNames") continue;
        let value = declaration.initializer;
        while (value && (ts.isAsExpression(value) || ts.isSatisfiesExpression(value)))
          value = value.expression;
        if (!value || !ts.isArrayLiteralExpression(value)) continue;
        for (const entry of value.elements) {
          if (!ts.isObjectLiteralExpression(entry)) continue;
          for (const property of entry.properties) {
            if (
              ts.isPropertyAssignment(property) &&
              ts.isIdentifier(property.name) &&
              property.name.text === "names" &&
              ts.isObjectLiteralExpression(property.initializer)
            )
              roleNameObjects.add(property.initializer);
          }
        }
      }
    }
  }
  /** @type {ChineseLiteral[]} */
  const found = [];
  /** @param {import("typescript").Node} node */
  const visit = (node) => {
    if (
      ts.isStringLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node) ||
      ts.isTemplateHead(node) ||
      ts.isTemplateMiddle(node) ||
      ts.isTemplateTail(node) ||
      ts.isJsxText(node)
    ) {
      const property = node.parent;
      // 只放行登记消息对象的直接值，或唯一名称表 names 对象中静态 "zh-CN" 属性的直接值。
      // 字面必须仍是 initializer；键名、en 和相邻表达式均不继承词典许可。
      const translationValue =
        (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) &&
        ts.isPropertyAssignment(property) &&
        property.initializer === node &&
        ts.isObjectLiteralExpression(property.parent) &&
        (translationObjects.has(property.parent) ||
          (roleNameObjects.has(property.parent) &&
            ts.isStringLiteral(property.name) &&
            property.name.text === "zh-CN"));
      if (han.test(node.text) && !translationValue)
        found.push({
          file,
          text: node.text,
          line: parsed.getLineAndCharacterOfPosition(node.getStart(parsed)).line + 1,
        });
    }
    ts.forEachChild(node, visit);
  };
  visit(parsed);
  return found;
}
/** @param {readonly ChineseLiteral[]} found @param {readonly LiteralException[]} exceptions */
export function verifyLiteralExceptions(found, exceptions) {
  /** @type {Map<string, LiteralException>} */
  const expected = new Map();
  for (const entry of exceptions) {
    if (!entry.reason || !Number.isSafeInteger(entry.count) || entry.count < 1)
      throw new Error("i18n_scan_exception_invalid");
    const key = JSON.stringify([entry.file, entry.text]);
    if (expected.has(key)) throw new Error("i18n_scan_exception_duplicate");
    expected.set(key, entry);
  }
  /** @type {Map<string, number>} */
  const actual = new Map();
  for (const entry of found) {
    const key = JSON.stringify([entry.file, entry.text]);
    actual.set(key, (actual.get(key) ?? 0) + 1);
  }
  const problems = [];
  for (const entry of found) {
    const key = JSON.stringify([entry.file, entry.text]);
    const exception = expected.get(key);
    if (!exception || (actual.get(key) ?? 0) > exception.count)
      problems.push(`${entry.file}:${entry.line}: unapproved Chinese literal`);
  }
  // 例外的实际出现数必须精确等于登记数；消失或少于原数同样过期，不能留下长期宽豁免。
  for (const [key, entry] of expected)
    if (actual.get(key) !== entry.count)
      problems.push(`${entry.file}: stale or changed i18n exception`);
  return problems;
}
/** 只读取配置在本入口的公开源码子目录。
 * @param {string} publicRoot 仓库根或测试自有根路径。
 */
export async function scanRepository(publicRoot = repositoryRoot) {
  /** @type {ChineseLiteral[]} */
  const found = [];
  const absoluteRoot = path.resolve(publicRoot);
  /** @param {string} directory @param {boolean} [optionalRoot] @returns {Promise<boolean>} */
  const sourceRootIsPresent = async (directory, optionalRoot = false) => {
    // 在读取前逐段核父路径，避免公开子目录或其祖先被链接替换后逃离原输入边界。
    const absolute = path.join(absoluteRoot, directory),
      filesystemRoot = path.parse(absolute).root;
    let current = filesystemRoot;
    for (const segment of absolute.slice(filesystemRoot.length).split(path.sep)) {
      current = path.join(current, segment);
      let stats;
      try {
        stats = await lstat(current);
      } catch (error) {
        if (
          optionalRoot &&
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          error.code === "ENOENT"
        )
          return false;
        throw error;
      }
      const relative = path.relative(absoluteRoot, current) || ".";
      if (stats.isSymbolicLink()) throw new Error(`i18n_scan_source_symlink: ${relative}`);
      if (!stats.isDirectory())
        throw Object.assign(new Error(`i18n_scan_source_directory_invalid: ${relative}`), {
          code: "ENOTDIR",
        });
    }
    return true;
  };
  /** @param {string} directory @returns {Promise<void>} */
  const walk = async (directory) => {
    const entries = await readdir(path.join(absoluteRoot, directory), { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue;
      const file = `${directory}/${entry.name}`;
      if (entry.isDirectory()) await walk(file);
      else if (entry.isFile() && /\.(?:[jt]sx?|[cm]js)$/.test(entry.name))
        found.push(
          ...collectChineseLiterals(file, await readFile(path.join(absoluteRoot, file), "utf8")),
        );
    }
  };
  for (const directory of ["backend/src", "frontend/src", "frontend/scripts"]) {
    await sourceRootIsPresent(directory);
    await walk(directory);
  }
  for (const directory of ["packages/game-text/src", "packages/game-presentation/src"])
    if (await sourceRootIsPresent(directory, true)) await walk(directory);
  return found;
}
if (import.meta.main) {
  const found = await scanRepository();
  const exceptions = JSON.parse(
    await readFile(
      path.join(repositoryRoot, "tooling/refactor/policies/i18n-source-exceptions.json"),
      "utf8",
    ),
  );
  const problems = verifyLiteralExceptions(found, exceptions);
  if (problems.length) {
    for (const problem of problems) console.error(problem);
    process.exitCode = 1;
  } else
    console.log(
      `i18n source scan passed (${found.length} documented compatibility/native-language literals)`,
    );
}
