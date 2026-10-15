/** 只读取本批真实Git前样、当前三个源码及原控制；核完整实际迁出body与精确接线，不加载生产或运行类型／行为。 */
const fs = require("node:fs"), crypto = require("node:crypto"), path = require("node:path");
const ts = require(path.join(process.cwd(), "backend/node_modules/typescript"));
const prefix = "docs/refactor/generated/demon-participant-state-data-owner-";
const sha = v => crypto.createHash("sha256").update(v).digest("hex");
const before = JSON.parse(fs.readFileSync(prefix + "before.json", "utf8"));
const ready = JSON.parse(fs.readFileSync(prefix + "source-ready-unit-repair.json", "utf8"));
const editDoc = JSON.parse(fs.readFileSync(prefix + "edits.json", "utf8"));
const kernelDoc = JSON.parse(fs.readFileSync(prefix + "moved-kernels.json", "utf8"));
const authorityPath = before.source[0].path;
const current = fs.readFileSync(authorityPath, "utf8");
const ownerPath = "backend/src/game/mechanisms/roles/demon_hunter/participant-state-data.ts";
const owner = fs.readFileSync(ownerPath, "utf8");
function check(ok, label) { if (!ok) throw Error(label); }
for (const s of ready.source) check(sha(fs.readFileSync(s.path)) === s.sha256, "source_drift:" + s.path);
for (const s of before.controls) check(sha(fs.readFileSync(s.path)) === s.sha256, "control_drift:" + s.path);
let forward = before.source[0].text;
const steps = [];
for (const edit of editDoc.source.edits) {
  const offset = forward.indexOf(edit.before);
  check(offset >= 0, "forward_missing:" + edit.label);
  if (!edit.sequentialOccurrence) check(forward.indexOf(edit.before, offset + 1) < 0, "forward_not_unique:" + edit.label);
  forward = forward.slice(0, offset) + edit.after + forward.slice(offset + edit.before.length);
  steps.push({ ...edit, offset });
}
check(forward === current, "whole_authority_forward");
let inverse = current;
for (const step of steps.slice().reverse()) {
  check(inverse.slice(step.offset, step.offset + step.after.length) === step.after, "inverse_delta:" + step.label);
  inverse = inverse.slice(0, step.offset) + step.before + inverse.slice(step.offset + step.after.length);
}
check(inverse === before.source[0].text, "whole_authority_inverse");
function parse(text, name = "actual.ts") { return ts.createSourceFile(name, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS); }
function shape(text) {
  const file = parse(text), parts = []; let nodes = 0, leaves = 0, arrays = 0;
  function visit(node) {
    if (ts.isJSDoc(node)) return;
    nodes++; parts.push(node.kind);
    let children = 0;
    ts.forEachChild(node, child => { children++; visit(child); }, arr => { arrays++; parts.push(["array", arr.length, !!arr.hasTrailingComma]); for (const child of arr) { children++; visit(child); } });
    if (!children) { leaves++; parts.push(["leaf", node.getText(file)]); }
  }
  visit(file);
  return { sha256: sha(JSON.stringify(parts)), nodes, leaves, arrays };
}
function emit(text, module) { return ts.transpileModule(text, { compilerOptions: { target: ts.ScriptTarget.ES2022, module, removeComments: true } }).outputText; }
const whole = shape(inverse), originalWhole = shape(before.source[0].text);
check(whole.sha256 === originalWhole.sha256, "whole_typed_program");
const wholeOutputs = [ts.ModuleKind.ESNext, ts.ModuleKind.CommonJS].map(module => {
  const old = emit(before.source[0].text, module), restored = emit(inverse, module);
  check(old === restored, "whole_emit_inverse:" + module);
  return { module, beforeSha256: sha(old), inverseSha256: sha(restored), same: true, actualCurrentSame: old === emit(current, module) };
});
const currentFile = parse(owner, ownerPath), originalFile = parse(before.source[0].text, authorityPath);
function fn(file, name) { const n = file.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === name); check(!!n && !!n.body, "function_missing:" + name); return n; }
const printer = ts.createPrinter({ removeComments: true });
function statements(node, file, count = node.body.statements.length) { return [...node.body.statements].slice(0, count).map(s => printer.printNode(ts.EmitHint.Unspecified, s, file)).join("\n"); }
function wrapper(body) { return "function actualKernel() {\n" + body + "\n}"; }
const compared = [];
function compare(name, oldBody, newBody) {
  const oldText = wrapper(oldBody), newText = wrapper(newBody), a = shape(oldText), b = shape(newText);
  check(a.sha256 === b.sha256, "actual_kernel_shape:" + name);
  const outputs = [ts.ModuleKind.ESNext, ts.ModuleKind.CommonJS].map(module => {
    // 完整内核经同一printer规范布局后比较运行输出；原布局raw结果另列，不冒未经映射raw等同。
    const printedOld = printer.printFile(parse(oldText)), printedNew = printer.printFile(parse(newText));
    const x = emit(printedOld, module), y = emit(printedNew, module);
    check(x === y, "actual_kernel_emit:" + name);
    return { module, mappedCompleteSha256: sha(x), same: true, unprintedRawSame: emit(oldText, module) === emit(newText, module) };
  });
  compared.push({ name, old: a, currentMapped: b, outputs });
}
const mappings = {
  "inventoryReferences": x => x,
  "originalInventory": x => x,
  "demonBadgeJson": x => x,
  "demonVoteJson": x => x,
  "privateAuditCurrent": x => x.replace("delegatedCurrent()", "delegatedCurrent(b)"),
  "committedPrivate": x => x.replace("readDelegated()", "checkpointNobleBodyAuthority(b.world, complete)"),
};
for (const [name, map] of Object.entries(mappings)) compare(name, statements(fn(originalFile, name), originalFile), map(statements(fn(currentFile, name), currentFile)));
const rows = [
  ["witch-capture", "captureDemonWitchAuditData", 1, x => x],
  ["witch-reset", "resetDemonWitchParticipantData", -1, x => x],
  ["witch-commit", "commitDemonWitchParticipantData", 0, x => x.replace("markCommitted(json);", "committed = true;\ncommittedJson = json;")],
  ["native-original", "captureDemonNativeAuditData", -1, x => x],
  ["native-commit", "commitDemonNativeParticipantData", 0, x => x.replace("readCamp(targetId)", "b.players.get(targetId)!.camp").replace("markCommitted();", "committed = true;")],
  ["hunter-capture", "captureDemonHunterAuditData", -1, x => x],
  ["hunter-consume", "consumeDemonHunterParticipantData", 0, x => x.replace("markCommitted();", "committed = true;")],
  ["checkpoint-record", "projectDemonParticipantCheckpoint", 0, x => x.replace("readAlive()", "p.lifeDescriptor.get!.call(p.life) === true").replace("committedPrivate(p, readDelegated)", "committedPrivate(b, p, complete)")],
  ["badge-audit-tail", "acceptDemonBadgeAudits", 0, x => x],
  ["redmoon-audit-tail", "acceptDemonRedMoonAudit", 0, x => x],
  ["idiot-data-commit", "commitDemonIdiotParticipantData", 0, x => x],
];
for (const [key, name, trim, map] of rows) {
  const kernel = kernelDoc.kernels.find(k => k.name === key); check(!!kernel, "old_kernel_missing:" + key);
  const n = fn(currentFile, name), count = trim === -1 ? n.body.statements.length - 1 : trim || n.body.statements.length;
  compare(key, kernel.oldBody, map(statements(n, currentFile, count)));
  if (trim) {
    const expected = { "witch-capture": "return { original, abilities, snapshot, state };", "witch-reset": "return { resetState, resetAbility, resetJson };", "native-original": "return { originalJson, original, abilities, snapshot, state };", "hunter-capture": "return { originalJson, original, hunter };" }[key];
    const actual = statements(n, currentFile).slice(statements(n, currentFile, count).length).trim();
    check(shape(wrapper(actual)).sha256 === shape(wrapper(expected)).sha256, "return_wrapper:" + key);
  }
}
const capture = fn(currentFile, "captureDemonParticipantPrivateData").body.statements[0];
check(ts.isReturnStatement(capture) && ts.isObjectLiteralExpression(capture.expression), "capture_object");
const oldCapture = fn(originalFile, "capture");
const pDecl = oldCapture.body.statements.find(s => ts.isVariableStatement(s) && s.declarationList.declarations.some(d => d.name.getText(originalFile) === "p"));
const oldObject = pDecl.declarationList.declarations.find(d => d.name.getText(originalFile) === "p").initializer;
const props = oldObject.properties.filter(p => ["privateState", "privateRefs", "inventoryRefs", "delegatedKey", "auditPrivateJson"].includes(p.name?.getText(originalFile)));
const oldCaptureText = props.map(p => printer.printNode(ts.EmitHint.Unspecified, p, originalFile)).join(",\n");
const actualCaptureText = capture.expression.properties.map(p => printer.printNode(ts.EmitHint.Unspecified, p, currentFile)).join(",\n");
compare("original-capture-fields", "return {" + oldCaptureText + "};", "return {" + actualCaptureText + "};");
compare("hunt-and-poison-refresh", "p.auditPrivateJson = demonJson(p.privateState)!;", statements(fn(currentFile, "refreshDemonParticipantAudit"), currentFile));
const originalRefs = `return Object.keys(descriptors).length === p.privateRefs.length && p.privateRefs.every(([key, value]) => descriptors[key] && "value" in descriptors[key]! && descriptors[key]!.value === value);`;
compare("top-descriptor-refs", originalRefs, statements(fn(currentFile, "demonPrivateRefsCurrent"), currentFile));
check(current.includes("const nativeArrayPush = Array.prototype.push;") && before.source[0].text.includes("const nativeArrayPush = Array.prototype.push;"), "native_push_original_capture");
check(!owner.includes('from "./authority"') && !owner.includes("new WeakMap") && !owner.includes("new Map"), "data_owner_no_authority_store");
const declarations = currentFile.statements.filter(n => ts.isFunctionDeclaration(n) && n.name).map(n => ({ name: n.name.text, sha256: sha(n.getText(currentFile)), line: currentFile.getLineAndCharacterOfPosition(n.getStart(currentFile)).line + 1 }));
// 首次 Guard fixture 误读的修正是实际JS输入变化；完整逆后比较，另两绿声明逐全文保持。
const unitRepair = JSON.parse(fs.readFileSync(prefix + "unit-input-repair.json", "utf8"));
const unitBefore = JSON.parse(fs.readFileSync(prefix + "unit-executed-before.json", "utf8"));
const unitCurrent = fs.readFileSync(unitRepair.path, "utf8");
let unitForward = unitBefore.text;
for (const e of unitRepair.edits) {
  check(unitForward.split(e.before).length === 2, "unit_repair_anchor");
  unitForward = unitForward.replace(e.before, e.after);
}
check(unitForward === unitCurrent, "whole_unit_input_forward");
let unitInverse = unitCurrent;
for (const e of unitRepair.edits.slice().reverse()) {
  check(unitInverse.split(e.after).length === 2, "unit_inverse_anchor");
  unitInverse = unitInverse.replace(e.after, e.before);
}
check(unitInverse === unitBefore.text, "whole_unit_input_inverse");
const suffix = 'test("safe private decoding resolves JSON before the audit getter and only then reads a delegated subtree"';
check(unitCurrent.slice(unitCurrent.indexOf(suffix)) === unitBefore.text.slice(unitBefore.text.indexOf(suffix)), "other_two_green_cases_unchanged");
const unitOutputs = [ts.ModuleKind.ESNext, ts.ModuleKind.CommonJS].map(module => {
  const original = emit(unitBefore.text, module), restored = emit(unitInverse, module), actual = emit(unitCurrent, module);
  check(original === restored, "unit_full_inverse_emit");
  return { module, beforeSha256: sha(original), inverseSame: true, currentSame: original === actual };
});
const unitInputRepair = { typeOnly: false, completeForward: true, completeInverse: true, otherTwoGreenDeclarationsSame: true, outputs: unitOutputs };
const report = { unitInputRepair, baseCommit: before.baseCommit, readySHA256: sha(fs.readFileSync(prefix + "source-ready-unit-repair.json")), wholeAuthority: { forward: true, inverse: true, ...whole, outputs: wholeOutputs }, completeActualKernels: compared, declarationBindings: declarations, originalNativePushCaptureRetained: true, controls: before.controls.map(({ text, ...x }) => x), limits: ["这三个实际源码／一个原程序及当前完整迁出数据body；不运行类型、行为或全门禁。", "节点/leaf来自forEachChild并排除JSDoc；内核emit经过明确runtime表达式映射和共同printer布局，原布局raw是否相同另列。", "新helper/thunk/返回对象/导出和调用栈有意变化，不承诺任意namespace/private/global monkeypatch初始化或事务等价。", "原nativeArrayPush仍在authority原module点捕获；committed回调只设置原局部旗，数据字段仍原Participant。"] };
fs.writeFileSync(prefix + "proof.json", JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify({ wholeNodes: whole.nodes, wholeLeaves: whole.leaves, completeKernels: compared.length, controls: before.controls.length, sameInverseWholeOutputs: wholeOutputs.length }));
