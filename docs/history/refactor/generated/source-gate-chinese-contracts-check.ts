/**
 * 负责源码检查工具三源的纯注释对照。输入为实际 Git before、精确注释编辑与当前全文；
 * 输出完整 typed AST、全部非注释叶、两种 JS 输出及职责／中文首头检查。
 * 只逆已声明注释，不运行 World、类型编译、测试或架构门禁，也不靠空 JS 代替类型结构对照。
 */
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { compiler } from "../../../tooling/refactor/architecture/contracts";
import { checkComments } from "../../../tooling/refactor/architecture/comment-check";
const prefix = "docs/refactor/generated/source-gate-chinese-contracts-";
const before = JSON.parse(fs.readFileSync(prefix + "before.json", "utf8"));
const edits = JSON.parse(fs.readFileSync(prefix + "edits.json", "utf8"));
const ts = compiler(process.cwd());
const sha = (text: string) => createHash("sha256").update(text).digest("hex");
const parse = (text: string) => {
  const source = ts.createSourceFile("program.mjs", text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  if (source.parseDiagnostics.length) throw new Error("invalid_program");
  return source;
};
function tree(text: string) {
  let nodes = 0;
  function walk(node: import("typescript").Node): unknown {
    nodes++;
    const children: unknown[] = [];
    ts.forEachChild(node, child => { children.push(walk(child)); }, array => {
      children.push(["array", array.length, !!array.hasTrailingComma, ...array.map(walk)]);
    });
    return [node.kind, ...children];
  }
  return { value: walk(parse(text)), count: () => nodes };
}
function leaves(text: string) {
  const source = parse(text), result: unknown[] = [];
  function walk(node: import("typescript").Node): void {
    if (node.kind >= ts.SyntaxKind.FirstJSDocNode && node.kind <= ts.SyntaxKind.LastJSDocNode) return;
    const children = node.getChildren(source);
    if (!children.length) result.push([node.kind, node.getText(source)]);
    else for (const child of children) walk(child);
  }
  walk(source);
  return result;
}
const files = before.source.map((file: {path: string; text: string; sha256: string}) => {
  if (sha(file.text) !== file.sha256) throw new Error("false_before");
  const text = fs.readFileSync(file.path, "utf8"), fileEdits = edits.filter((edit: {path: string}) => edit.path === file.path);
  let inverse = text;
  for (const edit of [...fileEdits].reverse()) {
    if (inverse.split(edit.after).length !== 2) throw new Error("comment_count");
    inverse = inverse.replace(edit.after, edit.before);
  }
  if (inverse !== file.text) throw new Error("noncomment_source_delta");
  const a = tree(file.text), b = tree(text), A = leaves(file.text), B = leaves(text);
  const typedTreeSame = JSON.stringify(a.value) === JSON.stringify(b.value);
  const allNoncommentLeavesSame = JSON.stringify(A) === JSON.stringify(B);
  const wholeOutputs = [ts.ModuleKind.ESNext, ts.ModuleKind.CommonJS].map(module => {
    const options = {target: ts.ScriptTarget.ES2022, module, removeComments: true};
    const old = ts.transpileModule(file.text, {compilerOptions: options}).outputText;
    const current = ts.transpileModule(text, {compilerOptions: options}).outputText;
    return {module: ts.ModuleKind[module], wholeRawSame: old === current, originalSHA: sha(old), currentSHA: sha(current)};
  });
  if (!typedTreeSame || !allNoncommentLeavesSame || !wholeOutputs.every(output => output.wholeRawSame)) throw new Error("program_delta");
  return {path: file.path, text, sha256: sha(text), beforeSHA: file.sha256, commentEdits: fileEdits.length,
    exactCommentInverseWholeSourceSame: true, typedNodes: a.count(), typedTreeSame, noncommentLeafCount: A.length, allNoncommentLeavesSame, wholeOutputs};
});
const documentationPaths = execFileSync("git", ["ls-files", "docs/**/*.md", "README.md"], {encoding: "utf8"}).trim().split("\n").filter(Boolean);
const diagnostics = checkComments(ts, {files, documentationPaths});
const missingChineseHead = files.filter((file: {text: string}) => !/[\u4e00-\u9fff]/.test(file.text.slice(0, file.text.indexOf("*/") + 2))).map((file: {path: string}) => file.path);
const report = {baseCommit: before.baseCommit, source: files.map(({text, ...file}: {text: string; [key: string]: unknown}) => file), exactCommentEdits: edits.length,
  documentationPathCount: documentationPaths.length, diagnostics, missingChineseHead,
  limits: ["Three complete JavaScript programs, original JSDoc directives and all raw literals remain.", "Only explicit comments inverted; source/manifest fingerprints still change, historical archives/IDs untouched.", "No type compilation/runtime tests/whole gates/models; source semantics and comments still need independent review."]};
fs.writeFileSync(prefix + "proof.json", JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify({files: files.length, typedNodes: files.reduce((n: number, file: {typedNodes: number}) => n + file.typedNodes, 0), noncommentLeaves: files.reduce((n: number, file: {noncommentLeafCount: number}) => n + file.noncommentLeafCount, 0), wholeOutputs: files.length * 2, comments: edits.length, documentationPaths: documentationPaths.length, diagnostics: diagnostics.length, missingChineseHead: missingChineseHead.length}));
if (diagnostics.length || missingChineseHead.length) process.exitCode = 1;
