/**
 * 负责核对猎魔原生女巫交付与封存数据契约的纯注释改动。输入为真实 Git before 与当前文件，
 * 输出完整非注释程序、两种运行输出和职责说明的有界检查结果；不执行对局或授予权限。
 * 注释的规则真义仍交独立源码审查，本工具不把形状检查作为完整架构验收。
 */
import fs from "node:fs";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { compiler } from "../../../tooling/refactor/architecture/contracts";
import { checkComments } from "../../../tooling/refactor/architecture/comment-check";
const ts = compiler(process.cwd());
const beforePath = "docs/refactor/generated/demon-potion-contract-comments-before.json";
const before = JSON.parse(fs.readFileSync(beforePath, "utf8"));
const sha = (text: string) => createHash("sha256").update(text).digest("hex");
const after = fs.readFileSync(before.path, "utf8");
assert.equal(sha(before.text), before.sha256);
const parse = (text: string) => ts.createSourceFile(before.path, text, ts.ScriptTarget.Latest, true);
const count = { value: 0 };
const tree = (node: import("typescript").Node, source: import("typescript").SourceFile): unknown => {
  count.value++;
  const children = node.getChildren(source).filter(child => child.kind < ts.SyntaxKind.FirstJSDocNode || child.kind > ts.SyntaxKind.LastJSDocNode);
  return [node.kind, children.length ? children.map(child => tree(child, source)) : node.getText(source)];
};
const oldSource = parse(before.text);
const oldTree = tree(oldSource, oldSource);
const oldCount = count.value;
const source = parse(after); count.value = 0;
const newTree = tree(source, source);
assert.deepEqual(newTree, oldTree);
const outputs = [ts.ModuleKind.ESNext, ts.ModuleKind.CommonJS].map(module => {
  const emit = (text: string) => ts.transpileModule(text, { fileName: before.path,
    compilerOptions: { target: ts.ScriptTarget.ES2022, module, removeComments: true } }).outputText;
  const old = emit(before.text), current = emit(after);
  assert.equal(current, old);
  return { module: ts.ModuleKind[module], wholeRawEqual: true, sha256: sha(current) };
});
const diagnostics = checkComments(ts, {files: [{path: before.path,text:after,sha256:sha(after)}],documentationPaths:[]});
assert.deepEqual(diagnostics, []);
const result = {baseCommit:before.baseCommit,source:[{path:before.path,sha256:sha(after)}],
  beforeSha256:before.sha256,wholeProgramTokenNodes:oldCount,wholeProgramEqual:true,
  outputs,commentDiagnostics:diagnostics,
  limit:"只验证完整非注释程序和运行输出；不执行测试、类型、模型或全仓门禁，注释准确性另审。"};
fs.writeFileSync("docs/refactor/generated/demon-potion-contract-comments-evidence.json", JSON.stringify(result,null,2)+"\n");
process.stdout.write(JSON.stringify({nodes:oldCount,programSame:true,wholeOutputs:2,commentViolations:diagnostics.length})+"\n");
