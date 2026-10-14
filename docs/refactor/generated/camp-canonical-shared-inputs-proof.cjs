// 读取共同原稿和37条真实输入差分，核20整程序来源；实际JS改变不冒纯类型或注释等价。
const fs = require("node:fs"), crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");
const ts = require("../../../backend/node_modules/typescript");
const prefix = "docs/refactor/generated/camp-canonical-shared-inputs-";
const read = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const sha = (s) => crypto.createHash("sha256").update(s).digest("hex");
const assert = (yes, msg) => { if (!yes) throw Error(msg); };
const ready = read(prefix + "source-ready.json"), before = read(prefix + "before.json");
const capture = new Map(read("docs/refactor/generated/camp-canonical-cohort-test-before.json").source.map((x) => [x.path, x]));
const edits = read(prefix + "edits.json"), results = [];
assert(ready.source.length === 20 && edits.length === 37, "scope_count");
const git = execFileSync("git", ["cat-file", "--batch"], { input: ready.source.map((x) => `${ready.baseCommit}:${x.path}\n`).join(""), maxBuffer: 8 * 1024 * 1024 });
let offset = 0;
const emit = (text, kind, fileName) => ts.transpileModule(text, { fileName, compilerOptions: { target: ts.ScriptTarget.ES2022, module: kind, removeComments: true } }).outputText;
for (const row of ready.source) {
  const end = git.indexOf(10, offset), [blob, type, length] = git.subarray(offset, end).toString().split(" ");
  assert(type === "blob", "git_blob:" + row.path);
  const raw = git.subarray(end + 1, end + 1 + Number(length));
  offset = end + 1 + Number(length) + 1;
  const old = capture.get(row.path), saved = before.source.find((x) => x.path === row.path);
  assert(old && saved && old.text === raw.toString("utf8") && sha(raw) === old.sha256 && old.sha256 === saved.sha256, "actual_before:" + row.path);
  const current = fs.readFileSync(row.path, "utf8");
  assert(sha(current) === row.sha256, "ready_drift:" + row.path);
  const steps = edits.filter((x) => x.path === row.path);
  let forward = old.text, inverse = current;
  for (const e of steps) { assert(e.before.length && forward.split(e.before).length === 2, "forward_unique:" + row.path); forward = forward.replace(e.before, e.after); }
  for (const e of steps.toReversed()) { assert(e.after.length && inverse.split(e.after).length === 2, "inverse_unique:" + row.path); inverse = inverse.replace(e.after, e.before); }
  assert(forward === current && inverse === old.text, "whole_source_inverse:" + row.path);
  const outputs = [];
  for (const kind of [ts.ModuleKind.ESNext, ts.ModuleKind.CommonJS]) {
    const original = emit(old.text, kind, row.path), restored = emit(inverse, kind, row.path), actual = emit(current, kind, row.path);
    assert(original === restored, "whole_inverse_emit:" + row.path);
    outputs.push({ module: ts.ModuleKind[kind], completeInverseRawSame: true, actualRawSame: original === actual, originalSHA256: sha(original), actualSHA256: sha(actual) });
  }
  results.push({ path: row.path, sha256: row.sha256, beforeSHA256: old.sha256, gitBlob: blob, editRecords: steps.length, completeForward: true, completeInverse: true, outputs });
}
assert(offset === git.length && edits.every((x) => ready.source.some((y) => y.path === x.path)), "foreign_or_unconsumed_input");
const summary = { completePrograms: results.length, exactEditRecords: edits.length, wholeInverseRawOutputs: results.reduce((n, r) => n + r.outputs.length, 0), actualRawChangedOutputs: results.reduce((n, r) => n + r.outputs.filter((o) => !o.actualRawSame).length, 0) };
fs.writeFileSync(prefix + "proof.json", JSON.stringify({ baseCommit: ready.baseCommit, sourceReadySHA256: sha(fs.readFileSync(prefix + "source-ready.json")), source: results, summary, limits: ["The original complete sources are restored only after explicit constructor/context/source/key/oracle input deltas, including the post-first-type missing Camp import repair.", "The actual runtime input JS intentionally changes; no claim of original oracle byte identity for the policy-adjusted sites or of all old test cases passing.", "No production module, test suite, type checker or head gate is run here; module outputs are transpile-only provenance evidence, not cold initialization proof."] }, null, 2) + "\n");
console.log(JSON.stringify(summary));
