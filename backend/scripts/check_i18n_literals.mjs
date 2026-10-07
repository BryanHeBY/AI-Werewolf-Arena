import ts from "typescript";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFile, readdir } from "node:fs/promises";

export const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const han = /\p{Script=Han}/u;
/** Comments and fixtures are excluded; strings, template segments, and JSX are scanned. */
export function collectChineseLiterals(file, source) {
  const parsed = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const found = [];
  const visit = node => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node) || ts.isJsxText(node)) {
      if (han.test(node.text)) found.push({ file, text: node.text, line: parsed.getLineAndCharacterOfPosition(node.getStart(parsed)).line + 1 });
    }
    ts.forEachChild(node, visit);
  };
  visit(parsed); return found;
}
export function verifyLiteralExceptions(found, exceptions) {
  const expected = new Map();
  for (const entry of exceptions) {
    if (!entry.reason || !Number.isSafeInteger(entry.count) || entry.count < 1) throw new Error("i18n_scan_exception_invalid");
    const key = JSON.stringify([entry.file, entry.text]);
    if (expected.has(key)) throw new Error("i18n_scan_exception_duplicate"); expected.set(key, entry);
  }
  const actual = new Map();
  for (const entry of found) { const key = JSON.stringify([entry.file, entry.text]); actual.set(key, (actual.get(key) ?? 0) + 1); }
  const problems = [];
  for (const entry of found) {
    const key = JSON.stringify([entry.file, entry.text]);
    if (!expected.has(key) || actual.get(key) > expected.get(key).count) problems.push(`${entry.file}:${entry.line}: unapproved Chinese literal`);
  }
  for (const [key, entry] of expected) if (actual.get(key) !== entry.count) problems.push(`${entry.file}: stale or changed i18n exception`);
  return problems;
}
export async function scanRepository() {
  const found = [];
  const walk = async directory => {
    for (const entry of await readdir(path.join(repositoryRoot, directory), { withFileTypes: true })) {
      const file = `${directory}/${entry.name}`;
      if (entry.isDirectory()) await walk(file);
      else if (/\.(?:ts|tsx)$/.test(entry.name)) found.push(...collectChineseLiterals(file, await readFile(path.join(repositoryRoot, file), "utf8")));
    }
  };
  for (const directory of ["backend/src", "frontend/src", "frontend/scripts"]) await walk(directory);
  return found;
}
if (import.meta.main) {
  const found = await scanRepository();
  const exceptions = JSON.parse(await readFile(path.join(repositoryRoot, "docs/expansion/i18n-source-exceptions.json"), "utf8"));
  const problems = verifyLiteralExceptions(found, exceptions);
  if (problems.length) { for (const problem of problems) console.error(problem); process.exitCode = 1; }
  else console.log(`i18n source scan passed (${found.length} documented compatibility/native-language literals)`);
}
