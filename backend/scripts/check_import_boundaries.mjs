#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { importBoundaryViolation } from "./import_boundaries.cjs";

const rootDir = path.resolve(process.cwd(), process.argv[2] ?? "src");
const errors = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(abs);
    else if (entry.isFile() && abs.endsWith(".ts")) checkFile(abs);
  }
}

function checkFile(filePath) {
  const source = ts.createSourceFile(filePath, fs.readFileSync(filePath, "utf8"), ts.ScriptTarget.Latest, true);
  function visit(node) {
    let specifier;
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      specifier = node.moduleSpecifier;
    } else if (ts.isCallExpression(node) && (
      node.expression.kind === ts.SyntaxKind.ImportKeyword ||
      (ts.isIdentifier(node.expression) && node.expression.text === "require")
    )) {
      specifier = node.arguments[0];
    } else if (ts.isExternalModuleReference(node)) {
      specifier = node.expression;
    } else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) {
      specifier = node.argument.literal;
    }
    if (specifier && (ts.isStringLiteral(specifier) || ts.isNoSubstitutionTemplateLiteral(specifier))) {
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
