/** 仅核活人名单失败前缀窄增量的整文本与两源双输出；不执行生产、单元、类型或原proof。 */
const fs = require("node:fs"), ts = require("../../../backend/node_modules/typescript"), { createHash } = require("node:crypto");
const prefix = "docs/refactor/generated/ordinary-death-history-", hash = x => createHash("sha256").update(x).digest("hex");
const check = (x, name) => { if (!x) throw Error(name); };
const before = JSON.parse(fs.readFileSync(prefix + "election-alive-prefix-before.json", "utf8")), edit = JSON.parse(fs.readFileSync(prefix + "election-alive-prefix-edits.json", "utf8")), ready = JSON.parse(fs.readFileSync(prefix + "source-ready.json", "utf8"));
for (const r of ready.source) check(hash(fs.readFileSync(r.path)) === r.sha256, "ready_changed");
const oldOwner = before.source.find(r => r.path === edit.owner).text, owner = fs.readFileSync(edit.owner, "utf8");
let forward = oldOwner;
for (const e of edit.ownerEdits) { check(forward.split(e.before).length - 1 === 1, "owner_forward_anchor"); forward = forward.replace(e.before, e.after); }
check(forward === owner, "owner_whole_forward");
let ownerInverse = owner;
for (const e of [...edit.ownerEdits].reverse()) { check(ownerInverse.split(e.after).length - 1 === 1, "owner_inverse_anchor"); ownerInverse = ownerInverse.replace(e.after, e.before); }
check(ownerInverse === oldOwner, "owner_whole_inverse");
const oldUnit = before.source.find(r => r.path === edit.unit).text, unit = fs.readFileSync(edit.unit, "utf8");
check(unit === oldUnit + edit.unitAppend, "unit_append_only");
function declarations(text, path) {
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS); check(!source.parseDiagnostics.length, "syntax");
  return source.statements.filter(n => ts.isExpressionStatement(n) && ts.isCallExpression(n.expression) && ts.isIdentifier(n.expression.expression) && n.expression.expression.text === "test").map(n => n.getText(source));
}
const oldCalls = declarations(oldUnit, edit.unit), newCalls = declarations(unit, edit.unit);
check(oldCalls.length === 8 && newCalls.length === 9 && oldCalls.every((v, i) => v === newCalls[i]), "eight_whole_declarations_same");
const emit = (text, path, module) => ts.transpileModule(text, { fileName: path, compilerOptions: { target: ts.ScriptTarget.ES2022, module, removeComments: true, strict: true } }).outputText;
const raw = [];
for (const [path, original, actual, inverse] of [[edit.owner, oldOwner, owner, ownerInverse], [edit.unit, oldUnit, unit, unit.slice(0, -edit.unitAppend.length)]]) {
  for (const module of [ts.ModuleKind.ESNext, ts.ModuleKind.CommonJS]) {
    const a = emit(original, path, module), b = emit(inverse, path, module), c = emit(actual, path, module);
    check(a === b, "inverse_raw"); check(a !== c, "actual_policy_or_newcase_difference");
    raw.push({ path, module: ts.ModuleKind[module], originalSHA256: hash(a), inverseSHA256: hash(b), actualSHA256: hash(c), inverseSame: true, actualSame: false });
  }
}
const assembly = before.source.find(r => r.path.endsWith("/assembly.ts")); check(fs.readFileSync(assembly.path, "utf8") === assembly.text, "assembly_same");
const report = { previousSourceReadySHA256: before.sourceReadySHA256, sourceReadySHA256: hash(fs.readFileSync(prefix + "source-ready.json")), source: ready.source, ownerDeltas: edit.ownerEdits.length, ownerWholeForward: true, ownerWholeInverse: true, oldDeclarations: 8, addedDeclarations: 1, unitWholeAppend: true, assemblySame: true, raw, limits: ["A real failed-prefix admission correction, not type-only or whole runtime-equivalence claim.", "No original eight runtime declarations, mainproof/head/types or compatibility data are rerun by this script.", "Prior-CP dead seats are skipped; uncertain source proposals keep only CP-compatible write or skip branches without exponential path expansion or whole-field waivers."] };
fs.writeFileSync(prefix + "election-alive-prefix-proof.json", JSON.stringify(report, null, 2) + "\n"); console.log(JSON.stringify(report));
