/**
 * Owns the AST scan of application and shared presentation source literals.
 * Inputs are public source files and exact reviewed file/text/count exceptions;
 * outputs are unapproved Han literals and stale-exception diagnostics. Filesystem
 * reads stay within the fixed source roots, without following symbolic links;
 * private configuration and authentication are never source inputs. Only direct
 * Chinese translation values in registered owner objects are exempt, not nearby
 * code or whole directories. The CLI reports failures without changing files.
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
/** @typedef {{ file: string, text: string, line: number }} ChineseLiteral */
/** @typedef {{ file: string, text: string, count: number, reason: string }} LiteralException */
/** Comments and fixtures are excluded; strings, template segments, and JSX are scanned. */
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
      const translationValue =
        (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) &&
        ts.isPropertyAssignment(property) &&
        property.initializer === node &&
        ts.isObjectLiteralExpression(property.parent) &&
        translationObjects.has(property.parent);
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
  for (const [key, entry] of expected)
    if (actual.get(key) !== entry.count)
      problems.push(`${entry.file}: stale or changed i18n exception`);
  return problems;
}
/** @param {string} publicRoot Only fixed public source subdirectories are read. */
export async function scanRepository(publicRoot = repositoryRoot) {
  /** @type {ChineseLiteral[]} */
  const found = [];
  const absoluteRoot = path.resolve(publicRoot);
  /** @param {string} directory @param {boolean} [optionalRoot] @returns {Promise<boolean>} */
  const sourceRootIsPresent = async (directory, optionalRoot = false) => {
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
    await readFile(path.join(repositoryRoot, "docs/expansion/i18n-source-exceptions.json"), "utf8"),
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
