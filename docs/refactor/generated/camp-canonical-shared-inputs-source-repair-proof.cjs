// 只核单源actualCamp接线后继，不重首20程序或原类型／职责／行为检查。
const fs = require("node:fs"), crypto = require("node:crypto"), ts = require("../../../backend/node_modules/typescript");
const prefix = "docs/refactor/generated/camp-canonical-shared-inputs-";
const stage = JSON.parse(fs.readFileSync(prefix + "source-input-repair-before.json", "utf8"));
const source = stage.source, current = fs.readFileSync(source.path, "utf8");
const sha = (s) => crypto.createHash("sha256").update(s).digest("hex");
const assert = (yes, msg) => { if (!yes) throw Error(msg); };
const oldCount = JSON.parse(fs.readFileSync(prefix + "proof.json", "utf8")).summary.exactEditRecords;
const edits = JSON.parse(fs.readFileSync(prefix + "edits.json", "utf8")).slice(oldCount);
let forward = source.text, inverse = current;
for (const e of edits) {
  assert(e.path === source.path && forward.split(e.before).length === 2, "forward_unique");
  forward = forward.replace(e.before, e.after);
}
for (const e of edits.toReversed()) {
  assert(inverse.split(e.after).length === 2, "inverse_unique");
  inverse = inverse.replace(e.after, e.before);
}
assert(forward === current && inverse === source.text && sha(source.text) === source.sha256, "complete_source_inverse");
const emit = (text, module) => ts.transpileModule(text, { fileName: source.path, compilerOptions: { target: ts.ScriptTarget.ES2022, module, removeComments: true } }).outputText;
const outputs = [ts.ModuleKind.ESNext, ts.ModuleKind.CommonJS].map((module) => {
  const original = emit(source.text, module), restored = emit(inverse, module), actual = emit(current, module);
  assert(restored === original, "whole_inverse_raw");
  return { module: ts.ModuleKind[module], wholeInverseRawSame: true, actualRawSame: actual === original, actualSHA256: sha(actual) };
});
const head = (text) => text.match(/^\/\*\*[\s\S]*?\*\//)?.[0];
assert(head(source.text) === head(current), "head_changed");
fs.writeFileSync(prefix + "source-repair-proof.json", JSON.stringify({ source: { path: source.path, beforeSHA256: source.sha256, sha256: sha(current) }, exactEditRecords: edits.length, completeForwardInverse: true, firstHeadSame: true, outputs, limits: ["The existing World actor uses the actually installed Camp reference and late World query; current JS really changes.", "No claim of old arbitrary getter/input equivalence or of all shared test cases passing. Earlier 20-program proof and named-import failure/repair stages are retained."] }, null, 2) + "\n");
console.log(JSON.stringify({ programs: 1, exactEditRecords: edits.length, completeInverseRawOutputs: outputs.length, actualChangedRawOutputs: outputs.filter((x) => !x.actualRawSame).length, firstHeadSame: true }));
