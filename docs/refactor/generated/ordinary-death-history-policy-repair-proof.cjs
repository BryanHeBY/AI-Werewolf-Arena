/** 只核首次执行全文到政策／擦除类型修正的完整正逆；不加载生产、不跑类型或测试。 */
const fs = require("node:fs"), { createHash } = require("node:crypto"), ts = require("../../../backend/node_modules/typescript");
const prefix = "docs/refactor/generated/ordinary-death-history-";
const hash = x => createHash("sha256").update(x).digest("hex");
const check = (x, tag) => { if (!x) throw Error(tag); };
const first = JSON.parse(fs.readFileSync(prefix + "first-executed-source-snapshot.json", "utf8"));
const repair = JSON.parse(fs.readFileSync(prefix + "policy-repair-edits.json", "utf8"));
const typed = JSON.parse(fs.readFileSync(prefix + "type-repair-stage.json", "utf8"));
const ready = JSON.parse(fs.readFileSync(prefix + "source-ready.json", "utf8"));
for (const r of ready.source) check(hash(fs.readFileSync(r.path)) === r.sha256, "current_sha");
const ownerFirst = first.source.find(r => r.path === repair.owner).text, owner = fs.readFileSync(repair.owner, "utf8");
check(ownerFirst === typed.firstText, "type_first_text");
let repaired = ownerFirst;
check(repaired.split(typed.before).length - 1 === 1, "type_anchor"); repaired = repaired.replace(typed.before, typed.after);
check(repaired === typed.typeOnlyText, "type_complete_forward");
for (const e of repair.policyEdits) { check(repaired.split(e.before).length - 1 === 1, "policy_forward_anchor"); repaired = repaired.replace(e.before, e.after); }
check(repaired === owner, "owner_whole_forward");
let inverse = owner;
for (const e of [...repair.policyEdits].reverse()) { check(inverse.split(e.after).length - 1 === 1, "policy_inverse_anchor"); inverse = inverse.replace(e.after, e.before); }
check(inverse === typed.typeOnlyText, "policy_whole_inverse"); inverse = inverse.replace(typed.after, typed.before); check(inverse === ownerFirst, "owner_full_first_inverse");
function emit(text, name, module) { return ts.transpileModule(text, { fileName: name, compilerOptions: { target: ts.ScriptTarget.ES2022, module, removeComments: true, strict: true } }).outputText; }
const raw = [ts.ModuleKind.ESNext, ts.ModuleKind.CommonJS].map(module => {
  const a = emit(ownerFirst, repair.owner, module), b = emit(typed.typeOnlyText, repair.owner, module), c = emit(owner, repair.owner, module);
  check(a === b, "type_erasure_raw"); check(a !== c, "policy_actual_expected_difference");
  return { module: ts.ModuleKind[module], firstSHA256: hash(a), typeOnlySHA256: hash(b), currentSHA256: hash(c), typeOnlySame: true, currentSame: false };
});
const oldUnit = first.source.find(r => r.path === repair.unit).text, unit = fs.readFileSync(repair.unit, "utf8");
check(unit === oldUnit + repair.unitAppend, "unit_append_only");
function declarations(text, file) {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  check(!source.parseDiagnostics.length, "syntax");
  return source.statements.filter(n => ts.isExpressionStatement(n) && ts.isCallExpression(n.expression) && ts.isIdentifier(n.expression.expression) && n.expression.expression.text === "test").map(n => n.getText(source));
}
const oldDeclarations = declarations(oldUnit, repair.unit), newDeclarations = declarations(unit, repair.unit);
check(oldDeclarations.length === 6 && newDeclarations.length === 7 && oldDeclarations.every((v, i) => v === newDeclarations[i]), "old_six_declarations_preserved");
const assembly = first.source.find(r => r.path.endsWith("/assembly.ts")); check(fs.readFileSync(assembly.path, "utf8") === assembly.text, "assembly_same");
const report = { firstSourceReadySHA256: first.sourceReadySHA256, finalSourceReadySHA256: hash(fs.readFileSync(prefix + "source-ready.json")), source: ready.source, ownerPolicyDeltas: repair.policyEdits.length, ownerErasedTypeDeltas: 1, ownerWholeForward: true, ownerWholeInverse: true, raw, unitWholeAppend: true, oldDeclarations: oldDeclarations.length, addedDeclarations: 1, assemblySame: true, limits: ["Policy repair is a real new JS candidate association, not an erased type-only claim.", "Gift blocked can use gift policy; gift miss is not a legal producer branch and remains rejected.", "All first outputs remain historical; this script does not rerun runtime, type, head, main proof or compatibility probe."] };
fs.writeFileSync(prefix + "policy-repair-proof.json", JSON.stringify(report, null, 2) + "\n"); console.log(JSON.stringify(report));
