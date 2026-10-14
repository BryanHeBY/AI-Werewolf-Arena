/**
 * 负责核对本批两份运行源码只有已登记的注释变化；输入为真实 Git 快照、精确编辑与当前源码。
 * 输出完整词法／两种无注释编译输出及职责头检查，不执行对局、网络、类型门禁或模型。
 */
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { compiler } from "../../../tooling/refactor/architecture/contracts";
import { checkComments } from "../../../tooling/refactor/architecture/comment-check";

const ts = compiler(process.cwd());
const prefix = "docs/refactor/generated/runtime-recording-contract-comments-";
const before = JSON.parse(fs.readFileSync(prefix + "before.json", "utf8")) as {
  baseCommit: string;
  source: Array<{ path: string; sha256: string; text: string }>;
};
const edits = JSON.parse(fs.readFileSync(prefix + "edits.json", "utf8")) as Record<
  string,
  Array<[string, string]>
>;
const sha = (value: string) => createHash("sha256").update(value).digest("hex");
const require = (condition: boolean, detail: string) => {
  if (!condition) throw new Error(detail);
};
function tokens(text: string): Array<[number, string]> {
  // 通过语法树取得完整 token；独立 scanner 不重扫模板字符串，会把模板内的斜杠误作注释。
  const source = ts.createSourceFile("scope.ts", text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const out: Array<[number, string]> = [];
  const visit = (node: import("typescript").Node) => {
    if (node.kind >= ts.SyntaxKind.FirstJSDocNode && node.kind <= ts.SyntaxKind.LastJSDocNode) return;
    const children = node.getChildren(source);
    if (children.length) children.forEach(visit);
    else out.push([node.kind, node.getText(source)]);
  };
  visit(source);
  return out;
}

const files: Array<{ path: string; text: string; sha256: string }> = [];
const rows = before.source.map((original) => {
  const git = execFileSync("git", ["show", before.baseCommit + ":" + original.path], {
    encoding: "utf8",
  });
  require(git === original.text && sha(git) === original.sha256, "before:" + original.path);
  let mapped = git;
  for (const [old, replacement] of edits[original.path]!) {
    require(mapped.split(old).length === 2, "edit:" + original.path);
    mapped = mapped.replace(old, replacement);
  }
  const current = fs.readFileSync(original.path, "utf8");
  require(current === mapped, "whole-forward:" + original.path);
  const originalTokens = tokens(git), currentTokens = tokens(current);
  require(JSON.stringify(originalTokens) === JSON.stringify(currentTokens), "tokens:" + original.path);
  const outputs = [ts.ModuleKind.ESNext, ts.ModuleKind.CommonJS].map((module) => {
    const emit = (source: string) => ts.transpileModule(source, {
      fileName: original.path,
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module,
        removeComments: true,
        sourceMap: false,
        inlineSourceMap: false,
      },
    }).outputText;
    const oldOutput = emit(git), newOutput = emit(current);
    require(oldOutput === newOutput, "whole-emit:" + original.path + ":" + module);
    return { module: ts.ModuleKind[module], sha256: sha(newOutput), same: true };
  });
  files.push({ path: original.path, text: current, sha256: sha(current) });
  return {
    path: original.path,
    beforeSHA256: sha(git),
    sha256: sha(current),
    wholeForwardSame: true,
    nonCommentTokenCount: currentTokens.length,
    outputs,
  };
});
const documentationPaths = execFileSync("git", ["ls-files", "docs/**/*.md", "README.md"], {
  encoding: "utf8",
}).trim().split("\n").filter(Boolean);
const diagnostics = checkComments(ts, { files, documentationPaths });
require(diagnostics.length === 0, JSON.stringify(diagnostics));
const report = {
  baseCommit: before.baseCommit,
  source: rows,
  preciseCommentEdits: Object.values(edits).reduce((count, values) => count + values.length, 0),
  diagnostics,
  documentationPathCount: documentationPaths.length,
  limits: [
    "完整词法与无注释输出保持；未执行对局、类型、全门禁或模型。",
    "头部检查只验证结构；中文契约语义另由作者和独立审查员阅读全文核对。",
    "源码注释参与新 sourceHash；不改写历史记录身份。",
  ],
};
fs.writeFileSync(prefix + "proof.json", JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report));
