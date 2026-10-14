// 仅核已不使用的Camp import退出；保原调用与测试源码正文，不复类型／头／行为。
const fs = require("node:fs"), crypto = require("node:crypto"), ts = require("../../../backend/node_modules/typescript");
const prefix = "docs/refactor/generated/camp-canonical-shared-inputs-";
const stage = JSON.parse(fs.readFileSync(prefix + "unused-import-before.json", "utf8"));
const row = stage.source, actual = fs.readFileSync(row.path, "utf8");
const sha = (s) => crypto.createHash("sha256").update(s).digest("hex");
const before = "import {\n  Camp,\n  Phase,\n  Role,", after = "import {\n  Phase,\n  Role,";
if (row.text.replace(before, after) !== actual || actual.replace(after, before) !== row.text) throw Error("whole_import_inverse");
const outputs = [ts.ModuleKind.ESNext, ts.ModuleKind.CommonJS].map((module) => {
  const emit = (text) => ts.transpileModule(text, { fileName: row.path, compilerOptions: { target: ts.ScriptTarget.ES2022, module, removeComments: true } }).outputText;
  const original = emit(row.text), current = emit(actual);
  if (original !== current) throw Error("unused_import_actual_emit_changed");
  return { module: ts.ModuleKind[module], wholeActualRawSame: true, sha256: sha(current) };
});
fs.writeFileSync(prefix + "unused-import-proof.json", JSON.stringify({ source: { path: row.path, beforeSHA256: row.sha256, sha256: sha(actual) }, delta: { before, after }, completeForwardInverse: true, outputs, limits: "Only the unused named binding is removed; this emit bridge is not another runtime or type validation." }, null, 2) + "\n");
console.log(JSON.stringify({ programs: 1, wholeActualRawOutputsSame: outputs.length }));
