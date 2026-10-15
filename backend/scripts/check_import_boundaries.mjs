#!/usr/bin/env node
/**
 * 负责旧层级导入规则的命令行扫描。输入为工作目录相对源码根，默认 src；输出为字面路径违规列表或成功，失败退出 1。
 * 按文件系统目录项递归读取 .ts，AST 识别导入、导出、require、动态 import、import type 和 import equals 的字面模块名。
 * 扫描只调用本地路径判定器，不执行被扫模块或写源码；非字面拼接路径不在检查范围，角色／共享包约束另由架构门禁负责。
 */
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { importBoundaryViolation } from "./import_boundaries.cjs";

// 维持原 cwd／argv 默认值；这里不对输入根额外 realpath，也不扩大 .ts 以外的发现范围。
const rootDir = path.resolve(process.cwd(), process.argv[2] ?? "src");
/** @type {string[]} */
const errors = [];

/** @param {string} dir */
function walk(dir) {
  // 只递归真实目录项和普通 .ts 文件；链接项不会作为目录继续枚举或作为文件读取。
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(abs);
    else if (entry.isFile() && abs.endsWith(".ts")) checkFile(abs);
  }
}

/** @param {string} filePath */
function checkFile(filePath) {
  const source = ts.createSourceFile(
    filePath,
    fs.readFileSync(filePath, "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
  /** @param {import("typescript").Node} node */
  function visit(node) {
    // 只读取原字面模块名；覆盖重导、运行调用和类型位置，不执行表达式来猜测动态路径。
    let specifier;
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      specifier = node.moduleSpecifier;
    } else if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) && node.expression.text === "require"))
    ) {
      specifier = node.arguments[0];
    } else if (ts.isExternalModuleReference(node)) {
      specifier = node.expression;
    } else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) {
      specifier = node.argument.literal;
    }
    if (
      specifier &&
      (ts.isStringLiteral(specifier) || ts.isNoSubstitutionTemplateLiteral(specifier))
    ) {
      const violation = importBoundaryViolation(rootDir, filePath, specifier.text);
      if (violation) errors.push(`${path.relative(process.cwd(), filePath)}: ${violation}`);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
}

walk(rootDir);

if (errors.length > 0) {
  console.error("[import-boundary] dependency violations:");
  for (const item of errors) console.error(`- ${item}`);
  process.exit(1);
}

console.log("[import-boundary] ok");
