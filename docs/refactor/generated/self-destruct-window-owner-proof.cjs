/**
 * 负责自爆窗口完整迁移的实际文本、程序输出与字面入口核对；输入为真实 Git before、精确编辑与现行八根。
 * 输出为逐程序比较和退休入口引用；只核结构迁移，不推导游戏预期或运行模型。
 */
const fs = require("node:fs"), assert = require("node:assert/strict"), crypto = require("node:crypto"), path = require("node:path");
const ts = require("../../../backend/node_modules/typescript");
const prefix = "docs/refactor/generated/self-destruct-window-owner-", before = JSON.parse(fs.readFileSync(prefix+"before.json", "utf8")), edits = JSON.parse(fs.readFileSync(prefix+"edits.json", "utf8"));
const hash = text => crypto.createHash("sha256").update(text).digest("hex");
const oldPath = "backend/src/game/engine/self_destruct_window.ts", newPath = "backend/src/rulesets/self-destruct-window.ts";
const reports = [];
for (const row of before.source) {
  const target = row.path === oldPath ? newPath : row.path;
  const relevant = edits.filter(edit => edit.path === target);
  let expected = row.text;
  for (const edit of relevant) { assert(expected.includes(edit.before)); expected = expected.replaceAll(edit.before, edit.after); }
  const actual = fs.readFileSync(target, "utf8"); assert.equal(actual, expected);
  let restored = actual;
  for (const edit of [...relevant].reverse()) { assert(restored.includes(edit.after)); restored = restored.replaceAll(edit.after, edit.before); }
  assert.equal(restored, row.text);
  // 原工厂类型换为只有 create 的中立接口是显式声明变化；二者均被擦除，不伪称类型树完全相同。
  const outputs = [];
  for (const module of [ts.ModuleKind.ESNext, ts.ModuleKind.CommonJS]) {
    const emit = text => ts.transpileModule(text, {fileName:row.path, compilerOptions:{target:ts.ScriptTarget.ES2022,module,removeComments:true}}).outputText;
    assert.equal(emit(restored), emit(row.text)); outputs.push(hash(emit(row.text)));
  }
  reports.push({path:target,beforePath:row.path,wholeForwardEqual:true,wholeInverseEqual:true,mappedOutputSHA256:outputs});
}
assert(!fs.existsSync(oldPath));
const refs = [], roots = ["backend/src", "backend/tests", "frontend/src", "frontend/tests", "packages", "tooling"];
function walk(dir) { for (const e of fs.readdirSync(dir,{withFileTypes:true})) {const f=path.posix.join(dir,e.name); if(e.isDirectory()) walk(f); else if(e.isFile() && /\.[cm]?[jt]sx?$/.test(f)) {const text=fs.readFileSync(f,"utf8"), source=ts.createSourceFile(f,text,ts.ScriptTarget.Latest,true); function visit(node) { if(ts.isStringLiteralLike(node) && /(?:self_destruct_window|self-destruct-window)$/.test(node.text)) refs.push({path:f,specifier:node.text}); ts.forEachChild(node,visit); } visit(source);}}}
for (const root of roots) walk(root);
assert(!refs.some(x=>x.specifier.endsWith("self_destruct_window")));
const report={approved:true,baseCommit:before.baseCommit,source:reports,literalReferences:refs,scope:"六个当前源码根，非历史generated/私有配置/计算路径或仓外入口",explicitTypeChange:"GameActionRequestFactory 参数改为已有 ActionRequestConstructionPort；不暴露工厂私有状态，运行语句保持。",outputs:reports.length*2};
fs.writeFileSync(prefix+"proof.json",JSON.stringify(report,null,2)+"\n"); console.log(JSON.stringify({programs:reports.length,mappedOutputs:report.outputs,references:refs.length}));
