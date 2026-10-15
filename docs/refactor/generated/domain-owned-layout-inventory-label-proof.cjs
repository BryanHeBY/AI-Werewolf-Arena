/** 只核同行审查后的三处历史指标说明；保留首证明和类型原始结果，不重复全仓程序证明。 */
const fs = require('node:fs'), assert = require('node:assert/strict'), { createHash } = require('node:crypto');
const prefix = 'docs/refactor/generated/domain-owned-layout-', sha = value => createHash('sha256').update(value).digest('hex');
const bridge = JSON.parse(fs.readFileSync(prefix + 'inventory-label-bridge.json', 'utf8'));
let text = bridge.beforeText;
assert.equal(sha(text), bridge.beforeSHA256);
for (const edit of bridge.edits) {
  assert.equal(text.split(edit.before).length - 1, 1);
  text = text.replace(edit.before, edit.after);
}
assert.equal(text, bridge.afterText);
assert.equal(sha(text), bridge.afterSHA256);
assert.equal(fs.readFileSync(bridge.path, 'utf8'), text);
for (const row of bridge.otherUnchangedSources) assert.equal(sha(fs.readFileSync(row.path)), row.sha256, row.path);
const ts = require('../../../backend/node_modules/typescript');
for (const value of [bridge.beforeText, text]) {
  const ast = ts.createSourceFile(bridge.path, value, ts.ScriptTarget.Latest, true);
  assert.equal(ast.parseDiagnostics.length, 0);
}
const result = { path: bridge.path, exactEdits: bridge.edits.length, otherUnchangedSources: bridge.otherUnchangedSources.length,
  historicalRootsAndAlgorithmUntouched: true, metadataValuesIntentionallyChanged: true,
  limits: ['只验证一个现行工具说明增量及其它1146源字节；未重跑首证明、类型或指标生成。'] };
fs.writeFileSync(prefix + 'inventory-label-proof.json', JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result));
