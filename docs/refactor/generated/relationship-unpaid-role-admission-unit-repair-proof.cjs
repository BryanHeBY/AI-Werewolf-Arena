/** 只读唯一单元的完整首执行原文和两精确增量，核正逆及两整 emit；不运行单元／类型／原主证明。 */
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const prefix = 'docs/refactor/generated/relationship-unpaid-role-admission-';
const ts = require(path.join(process.cwd(), 'backend/node_modules/typescript'));
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const before = JSON.parse(fs.readFileSync(prefix + 'unit-repair-before.json', 'utf8'));
const edits = JSON.parse(fs.readFileSync(prefix + 'unit-repair-edits.json', 'utf8')).edits;
const ready = JSON.parse(fs.readFileSync(prefix + 'source-ready-unit-repair.json', 'utf8'));
const current = fs.readFileSync(before.path, 'utf8');
if (sha(before.text) !== before.sha256) throw new Error('unit_before_drift');
if (sha(current) !== ready.source.find(row => row.path === before.path).sha256) throw new Error('unit_ready_drift');
function apply(text, edits, inverse) {
  for (const edit of inverse ? [...edits].reverse() : edits) {
    const from = inverse ? edit.after : edit.before, to = inverse ? edit.before : edit.after;
    if (!from || text.split(from).length - 1 !== edit.count) throw new Error('exact_delta_count');
    text = text.split(from).join(to);
  }
  return text;
}
if (apply(before.text, edits, false) !== current || apply(current, edits, true) !== before.text) throw new Error('whole_unit_delta');
const outputs = [ts.ModuleKind.ESNext, ts.ModuleKind.CommonJS].map(module => {
  const emit = text => ts.transpileModule(text, { fileName: before.path, compilerOptions: {target: ts.ScriptTarget.ES2022, module, removeComments: true} }).outputText;
  const old = emit(before.text), actual = emit(current);
  if (old !== actual) throw new Error('type_comment_emit_changed');
  return {module, oldSHA256:sha(old), actualSHA256:sha(actual), wholeSame:true};
});
const checked = JSON.parse(fs.readFileSync(prefix + 'source-ready-reflect.json', 'utf8'));
for (const row of checked.source.filter(row => row.path !== before.path)) if (sha(fs.readFileSync(row.path)) !== row.sha256) throw new Error('other_source_drift:' + row.path);
const report = {path:before.path, beforeSHA256:before.sha256, finalSHA256:sha(current), exactDelta:edits.length, wholeForwardInverse:true, outputs, otherSevenSameCheckedSource:true, limits:['Only one Chinese layer label and one erased factTypes annotation changed.', 'Literal expected arrays/assertions/control flow stay whole; runtime nine green declarations and seven original heads/mainproof are not repeated.', 'This bridge does not run type diagnostics, head checker or business.']};
fs.writeFileSync(prefix + 'unit-repair-proof.json', JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({unit:before.path,exactDelta:edits.length,wholeOutputs:outputs.length,wholeSame:true,otherSevenSame:true}));
