// 仅核同行末6源：原Role查询复位和5slot注释界限，不重首83程序或任何行为／类型／头检查。
const fs = require("node:fs"), crypto = require("node:crypto"), ts = require("../../../backend/node_modules/typescript");
const prefix = "docs/refactor/generated/camp-canonical-nine-families-";
const read = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const sha = (s) => crypto.createHash("sha256").update(s).digest("hex");
const assert = (yes, msg) => { if (!yes) throw Error(msg); };
const stage = read(prefix + "peer-repair-before.json"), first = read(prefix + "source-ready-first-snapshot.json");
const firstEditCount = read(prefix + "proof.json").summary.exactEditRecords;
const edits = read(prefix + "edits.json").slice(firstEditCount);
const emit = (text, module, fileName) => ts.transpileModule(text, { fileName, compilerOptions: { target: ts.ScriptTarget.ES2022, module, removeComments: true } }).outputText;
const programs = [];
for (const row of stage.source) {
  const current = fs.readFileSync(row.path, "utf8"), steps = edits.filter((e) => e.path === row.path);
  let forward = row.text, inverse = current;
  for (const e of steps) { assert(forward.split(e.before).length === 2, "forward_unique:" + row.path); forward = forward.replace(e.before, e.after); }
  for (const e of steps.toReversed()) { assert(inverse.split(e.after).length === 2, "inverse_unique:" + row.path); inverse = inverse.replace(e.after, e.before); }
  assert(forward === current && inverse === row.text && sha(row.text) === row.sha256, "complete_inverse:" + row.path);
  const commentOnly = row.path.endsWith("state-slot.ts");
  const outputs = [];
  for (const module of [ts.ModuleKind.ESNext, ts.ModuleKind.CommonJS]) {
    const original = emit(row.text, module, row.path), restored = emit(inverse, module, row.path), actual = emit(current, module, row.path);
    assert(original === restored, "inverse_emit:" + row.path);
    if (commentOnly) assert(actual === original, "comment_emit:" + row.path);
    outputs.push({ module: ts.ModuleKind[module], wholeInverseRawSame: true, actualRawSame: actual === original, actualSHA256: sha(actual) });
  }
  const head = (text) => text.match(/^\/\*\*[\s\S]*?\*\//)?.[0];
  assert(head(row.text) === head(current), "head_changed:" + row.path);
  programs.push({ path: row.path, beforeSHA256: row.sha256, sha256: sha(current), editRecords: steps.length, completeForwardInverse: true, commentOnly, firstHeadSame: true, outputs });
}
const frame = fs.readFileSync(stage.source[0].path, "utf8");
assert(frame.includes("targetId !== null && !!world.getComponent(targetId, COMPONENT.Role) &&\n    world.getComponent(targetId, COMPONENT.Camp)?.camp === Camp.Wolf;"), "actual_original_role_short_circuit");
const summary = { programs: programs.length, actualLogicPrograms: 1, commentOnlyPrograms: 5, exactEditRecords: edits.length, completeInverseRawOutputs: 12, commentOnlyRawOutputsSame: 10 };
fs.writeFileSync(prefix + "peer-repair-proof.json", JSON.stringify({ summary, source: programs, firstScopeSHA256: sha(fs.readFileSync(prefix + "scope-final-first-snapshot.json")), firstEvidenceSHA256: sha(fs.readFileSync(prefix + "evidence-first-snapshot.json")), limits: ["One actual Role-query omission is corrected after static peer review. There was no runtime failure observed for that omitted branch before correction.", "Five internal comments now exclude only Role/state field accessors; explicit Camp source is executable and may throw at its original field point.", "First main proof, runtime, type and heads are retained. Frame actual JS changes; no claim that the first and final frame programs are equal."] }, null, 2) + "\n");
console.log(JSON.stringify(summary));
