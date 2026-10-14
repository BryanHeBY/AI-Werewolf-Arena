/**
 * 核对本族完整状态、四个实际数据程序和十三个旧源；输入为真实 Git before、当前槽及精确编辑。
 * 输出只证明迁移范围与全部原程序，不替代资源／回执 oracle，不运行游戏、类型或架构门禁。
 */
const fs = require("node:fs"), cp = require("node:child_process"), path = require("node:path"), assert = require("node:assert/strict"), crypto = require("node:crypto");
const ts = require("../../../backend/node_modules/typescript");
const prefix = "docs/refactor/generated/time-consort-state-slot-";
const before = JSON.parse(fs.readFileSync(prefix + "before.json", "utf8"));
const mapping = JSON.parse(fs.readFileSync(prefix + "edits.json", "utf8"));
const slot = fs.readFileSync(mapping.newPath, "utf8"), hash = s => crypto.createHash("sha256").update(s).digest("hex");
const parse = text => ts.createSourceFile("input.ts", text, ts.ScriptTarget.Latest, true);
const statements = (text, name) => { const source = parse(text), fn = source.statements.find(n => ts.isFunctionDeclaration(n) && n.name.text === name); assert(fn?.body); return fn.body.statements.map(n => n.getText(source)); };
const normalize = text => ts.createPrinter({ removeComments: true }).printFile(parse(text));
const baseFrame = before.source.find(r => r.path.endsWith("/night_frame.ts")).text;
const baseProfile = before.source.find(r => r.path.endsWith("/profile.ts")).text;
const producer = [];
function compare(name, actual, expected) { assert.equal(normalize(actual), normalize(expected)); producer.push({ name, actualSHA256: hash(actual), originalSHA256: hash(expected), fullNormalizedProgramSame: true }); }
compare("install", statements(slot, "installTimeConsortState").join("\n").replace("privateState()", "role.privateState"), "role.privateState.timeConsort = createTimeConsortState(value.reflectionScope);");
assert(baseProfile.includes("role.privateState.timeConsort = createTimeConsortState(value.reflectionScope);"));
compare("appendHistory", statements(slot, "appendTimeConsortHistory").join("\n").replaceAll("state()", "b.state"), mapping.oldAppend);
assert(baseFrame.includes(mapping.oldAppend));
compare("trigger", statements(slot, "triggerTimeConsortState").join("\n").replace("state()", "b.state"), '(b.state as Pick<TimeConsortState, "triggeredDay">).triggeredDay = day;');
assert(baseFrame.includes('(b.state as Pick<TimeConsortState, "triggeredDay">).triggeredDay = day;'));
const source = parse(slot), encoded = source.statements.find(n => ts.isFunctionDeclaration(n) && n.name.text === "encodeTimeConsortStateIdentity");
compare("identity", encoded.getText(source).replace("encodeTimeConsortStateIdentity", "stateIdentity"), mapping.identity);
assert(baseFrame.includes(mapping.identity));
const oldState = before.source.find(r => r.path === mapping.oldPath).text;
const oldFunctions = parse(oldState).statements.filter(ts.isFunctionDeclaration).map(n => n.name.text);
assert.equal(oldFunctions.length, 8);
for (const name of oldFunctions) compare(name, statements(slot, name).join("\n"), statements(oldState, name).join("\n"));
assert.deepEqual(source.statements.filter(ts.isFunctionDeclaration).map(n => n.name.text), [...oldFunctions, "installTimeConsortState", "appendTimeConsortHistory", "triggerTimeConsortState", "encodeTimeConsortStateIdentity"]);
const programs = [];
for (const row of before.source) {
  assert.equal(cp.execFileSync("git", ["show", before.baseCommit + ":" + row.path], { encoding: "utf8" }), row.text);
  const target = row.path === mapping.oldPath ? mapping.newPath : row.path;
  const fullCurrent = fs.readFileSync(target, "utf8");
  // 新槽的原八函数与常量全文位于确定分界之前；新增程序全部已独立比对，不用原 body 覆盖新实现。
  const current = target === mapping.newPath ? fullCurrent.slice(0, fullCurrent.indexOf("\n/** 原初始化")) : fullCurrent;
  const edits = mapping.edits.filter(e => e.path === target);
  let forward = row.text, inverse = current;
  for (const e of edits) { assert.equal(forward.split(e.before).length - 1, 1); forward = forward.replace(e.before, e.after); }
  assert.equal(forward, current);
  for (const e of [...edits].reverse()) {
    // 原 identity 整函数移走后 after 为空；只在其原紧邻 ownData 的明确位置恢复，不做空字符串全局替换。
    if (e.after === "") { assert.equal(e.before, mapping.identity); assert.equal(inverse.split("function ownData(").length - 1, 1); inverse = inverse.replace("function ownData(", e.before + "function ownData("); }
    else { assert.equal(inverse.split(e.after).length - 1, 1); inverse = inverse.replace(e.after, e.before); }
  }
  assert.equal(inverse, row.text);
  const outputs = [];
  for (const module of [ts.ModuleKind.ESNext, ts.ModuleKind.CommonJS]) {
    const emit = text => ts.transpileModule(text, { fileName: row.path, compilerOptions: { target: ts.ScriptTarget.ES2022, module, removeComments: true } }).outputText;
    assert.equal(emit(inverse), emit(row.text)); outputs.push(hash(emit(row.text)));
  }
  programs.push({ path: target, beforePath: row.path, finalSHA256: hash(fullCurrent), wholeExactForwardSame: true, wholeExactInverseSame: true, mappedOutputSHA256: outputs });
}
assert(!fs.existsSync(mapping.oldPath));
for (const row of before.controls) { assert.equal(hash(fs.readFileSync(row.path)), row.sha256); assert.equal(hash(cp.execFileSync("git", ["show", before.baseCommit + ":" + row.path])), row.sha256); }
const ports = fs.readFileSync("backend/src/game/mechanisms/roles/time_wolf_consort/ports.ts", "utf8");
assert(ports.includes('export { getTimeConsortState, projectTimeConsortState } from "./state-slot";'));
assert(!ports.includes("TIME_CONSORT_STATE_SLOT"));
const roots = ["backend/src", "backend/tests", "frontend/src", "frontend/tests", "packages", "tooling"], retired = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.posix.join(dir, entry.name);
    if (entry.isDirectory() && !["node_modules", "dist"].includes(entry.name)) walk(file);
    else if (entry.isFile() && /\.[cm]?[jt]sx?$/.test(file)) {
      const source = ts.createSourceFile(file, fs.readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
      function visit(node) { if (ts.isStringLiteralLike(node) && /\/time_wolf_consort\/state$/.test(node.text)) retired.push({ path: file, literal: node.text }); ts.forEachChild(node, visit); }
      visit(source);
    }
  }
}
for (const root of roots) walk(root);
assert.equal(retired.length, 0);
const report = { approved: true, baseCommit: before.baseCommit, programs, producers: producer, controls: before.controls, retired, summary: { wholePrograms: programs.length, mappedOutputs: programs.length * 2, preservedStateFunctions: oldFunctions.length, movedDataPrograms: 4, exactEdits: mapping.edits.length }, limitations: ["完整程序输出在精确迁移逆展开后对照；不冒新方法表／额外调用／模块路径全部raw不变。", "公开ports仅实际get/project，库存、used／revision／expectedState及回执权限仍原owner；槽不创建镜像。", "新槽value依赖保持原state的node:util与core，没有反导frame；此局部方向不冒全图冷初始化证明。", "六当前源码根仅字面旧入口扫描，不覆盖计算路径、仓外或历史generated。"] };
fs.writeFileSync(prefix + "proof.json", JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report.summary));
