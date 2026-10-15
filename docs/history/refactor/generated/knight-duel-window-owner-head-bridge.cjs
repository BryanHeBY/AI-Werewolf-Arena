/** 精确核对公开入口两次中文时点补充；不重跑窗口、类型或整批已绿证明。 */
const fs = require("node:fs"), assert = require("node:assert/strict"), crypto = require("node:crypto");
const ts = require("../../../backend/node_modules/typescript");
const prefix = "docs/refactor/generated/knight-duel-window-owner-";
const file = "backend/src/game/mechanisms/roles/knight/ports.ts", text = fs.readFileSync(file, "utf8");
const hash = text => crypto.createHash("sha256").update(text).digest("hex");
const tokens = text => { const scanner = ts.createScanner(ts.ScriptTarget.Latest, true, ts.LanguageVariant.Standard, text); const result = []; for (let kind = scanner.scan(); kind !== ts.SyntaxKind.EndOfFileToken; kind = scanner.scan()) result.push([kind, scanner.getTokenText()]); return result; };
const source = [];
for (const suffix of ["ports-before-head-fix.json", "ports-before-head-second-fix.json"]) {
  const before = JSON.parse(fs.readFileSync(prefix + suffix, "utf8"));
  assert.equal(hash(before.text), before.sha256);
  assert.deepEqual(tokens(before.text), tokens(text));
  const outputs = [];
  for (const module of [ts.ModuleKind.ESNext, ts.ModuleKind.CommonJS]) {
    const emit = text => ts.transpileModule(text, { fileName: file, compilerOptions: { target: ts.ScriptTarget.ES2022, module, removeComments: true } }).outputText;
    assert.equal(emit(before.text), emit(text)); outputs.push(hash(emit(text)));
  }
  source.push({ beforePath: prefix + suffix, beforeSHA256: before.sha256, finalSHA256: hash(text), tokenCount: tokens(text).length, fullNonCommentSame: true, rawOutputSHA256: outputs });
}
fs.writeFileSync(prefix + "head-bridge.json", JSON.stringify({ approved: true, path: file, source, outputs: 4 }, null, 2) + "\n");
console.log(JSON.stringify({ file, stages: source.length, outputs: 4 }));
