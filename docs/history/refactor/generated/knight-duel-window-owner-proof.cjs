/**
 * 核对骑士完整窗口迁移的实际 Git 原文、精确编辑、完整输出及公开绑定。
 * 输入为本批 before／编辑与当前六根；输出只证明迁移范围，不推导对局预期或运行模型。
 */
const fs = require("node:fs"), assert = require("node:assert/strict"), crypto = require("node:crypto"), path = require("node:path"), cp = require("node:child_process");
const ts = require("../../../backend/node_modules/typescript");
const prefix = "docs/refactor/generated/knight-duel-window-owner-";
const before = JSON.parse(fs.readFileSync(prefix + "before.json", "utf8"));
const { oldPath, newPath, edits } = JSON.parse(fs.readFileSync(prefix + "edits.json", "utf8"));
const hash = text => crypto.createHash("sha256").update(text).digest("hex");
const emit = (text, fileName, module) => ts.transpileModule(text, { fileName, compilerOptions: { target: ts.ScriptTarget.ES2022, module, removeComments: true } }).outputText;
const reports = [];
for (const row of before.source) {
  assert.equal(cp.execFileSync("git", ["show", before.baseCommit + ":" + row.path], { encoding: "utf8" }), row.text);
  const target = row.path === oldPath ? newPath : row.path;
  const relevant = edits.filter(edit => edit.path === target);
  const actual = fs.readFileSync(target, "utf8");
  let forward = row.text, restored = actual, mapped = actual;
  for (const edit of relevant) { assert.equal(forward.split(edit.before).length - 1, edit.count ?? 1); forward = forward.replaceAll(edit.before, edit.after); }
  assert.equal(actual, forward);
  for (const edit of [...relevant].reverse()) { assert.equal(restored.split(edit.after).length - 1, edit.count ?? 1); restored = restored.replaceAll(edit.after, edit.before); }
  assert.equal(restored, row.text);
  // 当前完整程序仅逆路线、显式类型和新增公开出口，保留全部中文说明；输出不能冒未逆路径 raw 相同。
  for (const edit of [...relevant].reverse()) {
    if (edit.before.startsWith("\".") || edit.before.startsWith("import ") || edit.before.startsWith("export ") || edit.before.trim() === "requests: GameActionRequestFactory,") mapped = mapped.replaceAll(edit.after, edit.before);
  }
  const outputs = [];
  for (const module of [ts.ModuleKind.ESNext, ts.ModuleKind.CommonJS]) {
    const originalOutput = emit(row.text, row.path, module);
    assert.equal(emit(mapped, row.path, module), originalOutput);
    outputs.push({ module: ts.ModuleKind[module], mappedRawSame: true, sha256: hash(originalOutput) });
  }
  reports.push({ path: target, beforePath: row.path, finalSHA256: hash(actual), wholeForwardSame: true, wholeInverseSame: true, outputs });
}
assert(!fs.existsSync(oldPath));
for (const row of before.controls) { assert.equal(hash(fs.readFileSync(row.path)), row.sha256); assert.equal(hash(cp.execFileSync("git", ["show", before.baseCommit + ":" + row.path])), row.sha256); }
const ports = fs.readFileSync("backend/src/game/mechanisms/roles/knight/ports.ts", "utf8");
assert(ports.includes('export { getKnightState } from "./state";'));
assert(ports.includes('export { KnightDuelWindow } from "./duel-window";'));
assert(fs.readFileSync(newPath, "utf8").includes('import { getKnightState } from "./state";'));
assert(!fs.readFileSync(newPath, "utf8").includes('from "./ports"'));
const references = [], roots = ["backend/src", "backend/tests", "frontend/src", "frontend/tests", "packages", "tooling"];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.posix.join(dir, entry.name);
    if (entry.isDirectory() && !["node_modules", "dist"].includes(entry.name)) walk(file);
    else if (entry.isFile() && /\.[cm]?[jt]sx?$/.test(file)) {
      const source = ts.createSourceFile(file, fs.readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
      function visit(node) { if (ts.isStringLiteralLike(node) && /\/knight_duel_window$/.test(node.text)) references.push({ path: file, specifier: node.text }); ts.forEachChild(node, visit); }
      visit(source);
    }
  }
}
for (const root of roots) walk(root);
assert.equal(references.length, 0);
const bindings = [
  { name: "getKnightState", actualOwner: "backend/src/game/mechanisms/roles/knight/state.ts", publicRoute: "backend/src/game/mechanisms/roles/knight/ports.ts", sameFunctionBinding: true },
  { name: "KnightDuelWindow", actualOwner: newPath, publicRoute: "backend/src/game/mechanisms/roles/knight/ports.ts", directReexport: true },
  { name: "ActionRequestConstructionPort", actualOwner: "backend/src/core/domain/actions.ts", explicitTypeAcceptanceChange: true }
];
const report = { approved: true, baseCommit: before.baseCommit, source: reports, deleted: [{ path: oldPath, sha256: before.source.find(row => row.path === oldPath).sha256 }], controls: before.controls, bindings, retiredPathReferences: references, summary: { wholePrograms: reports.length, mappedOutputs: reports.length * 2, edits: edits.length }, limitations: ["实际当前完整程序仅逆路线／新增出口／声明类型后输出相同，不称当前未逆源码 raw 全同。", "六当前源码根仅字面引用，非计算路径、私有配置、历史 generated 或仓外全覆盖。", "类型由具体工厂转已有 create-only 端口，静态接受面扩大；未宣称完整类型树相同或全图冷加载不变。"] };
fs.writeFileSync(prefix + "proof.json", JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report.summary));
