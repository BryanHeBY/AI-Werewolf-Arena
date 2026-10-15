/** 只核两个失败 owner 的可擦除函数类型修正；完整源码正逆、全 AST 元信息和四份实际 emit，不复主proof／行为／头／类型。 */
const fs = require("node:fs"), path = require("node:path"), crypto = require("node:crypto");
const ts = require(path.join(process.cwd(), "backend/node_modules/typescript"));
const pre = "docs/refactor/generated/cupid-hybrid-reproduction-verifiers-";
const before = JSON.parse(fs.readFileSync(pre + "types-first-source-before.json", "utf8"));
const ready = JSON.parse(fs.readFileSync(pre + "source-ready-type-repair.json", "utf8"));
const sha = value => crypto.createHash("sha256").update(value).digest("hex");
function check(ok, label) { if (!ok) throw Error(label); }
function parse(file, text) {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  check(source.parseDiagnostics.length === 0, "parse:" + file); return source;
}
function shape(file, text) {
  const source = parse(file, text), parts = [];
  let typedNodes = 0, nodeArrays = 0, leaves = 0;
  function visit(node) {
    if (node.kind >= ts.SyntaxKind.FirstJSDocNode && node.kind <= ts.SyntaxKind.LastJSDocNode) return;
    typedNodes++; parts.push(node.kind); let children = 0;
    ts.forEachChild(node, child => { children++; visit(child); }, array => {
      nodeArrays++; parts.push(["NodeArray", array.length, !!array.hasTrailingComma]);
      for (const child of array) { children++; visit(child); }
    });
    if (!children) { leaves++; parts.push(["leaf", node.getText(source)]); }
  }
  visit(source); return { typedNodes, nodeArrays, leaves, sha256: sha(JSON.stringify(parts)) };
}
function emit(file, text, module) { return ts.transpileModule(text, { fileName: file,
  compilerOptions: { target: ts.ScriptTarget.ES2022, module, removeComments: true } }).outputText; }
const reports = [];
for (const old of before.source) {
  const actual = fs.readFileSync(old.path, "utf8"), saved = ready.source.find(row => row.path === old.path);
  check(sha(old.text) === old.sha256 && sha(actual) === saved.sha256, "source_hash:" + old.path);
  const from = "const fail = (): never =>", to = "const fail: () => never = () =>";
  check(old.text.split(from).length === 2 && actual === old.text.replace(from, to), "single_type_forward:" + old.path);
  const inverse = actual.replace(to, from);
  check(inverse === old.text, "whole_inverse:" + old.path);
  check(shape(old.path, old.text).sha256 === shape(old.path, inverse).sha256, "complete_inverse_tree:" + old.path);
  const outputs = [ts.ModuleKind.ESNext, ts.ModuleKind.CommonJS].map(module => {
    const a = emit(old.path, old.text, module), b = emit(old.path, actual, module);
    check(a === b, "whole_actual_runtime_emit:" + old.path + ":" + module);
    const oldProgram = shape("output.js", a), currentProgram = shape("output.js", b);
    check(oldProgram.sha256 === currentProgram.sha256, "complete_runtime_program:" + old.path);
    return { module, beforeSHA256: sha(a), afterSHA256: sha(b), same: true, runtimeProgram: currentProgram };
  });
  reports.push({ path: old.path, beforeSHA256: old.sha256, currentSHA256: saved.sha256,
    exactTypeEdits: 1, beforeProgram: shape(old.path, old.text), currentProgram: shape(old.path, actual), inverseProgram: shape(old.path, inverse), outputs });
}
const otherTwo = ready.source.filter(row => !before.source.some(old => old.path === row.path)).map(row => {
  const first = JSON.parse(fs.readFileSync(pre + "source-ready.json", "utf8")).source.find(p => p.path === row.path);
  check(sha(fs.readFileSync(row.path)) === row.sha256 && first.sha256 === row.sha256, "unchanged_other_source:" + row.path);
  return { ...row, sameAsFirstChecked: true };
});
const report = { sourceReadySHA256: sha(fs.readFileSync(pre + "source-ready-type-repair.json")), reports, otherTwo,
  limits: ["只两个纯类型标注；typed AST本来有类型位置差异，不称当前typed树与旧相同。", "完整正逆与两owner四raw实际输出相同；不重13业务case、主proof、四头或类型检查。"] };
fs.writeFileSync(pre + "type-bridge.json", JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify({ failedOwners: reports.length, exactTypeEdits: 2, actualWholeOutputsSame: reports.flatMap(row => row.outputs).length, otherTwoSame: true }));
