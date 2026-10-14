// 完整读取共同Git前稿，逐条还原本批显式输入差分；不加载角色、不执行测试或类型门禁。
const fs = require("node:fs");
const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");
const ts = require("../../../backend/node_modules/typescript");
const prefix = "docs/refactor/generated/camp-canonical-nine-families-";
const read = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const sha = (s) => crypto.createHash("sha256").update(s).digest("hex");
const assert = (yes, message) => { if (!yes) throw Error(message); };
const ready = read(prefix + "source-ready.json");
const before = read(prefix + "before.json");
const captures = new Map();
for (const p of [
  "docs/refactor/generated/camp-canonical-cohort-production-before.json",
  "docs/refactor/generated/camp-canonical-cohort-test-before.json",
]) for (const row of read(p).source) captures.set(row.path, row);
const edits = read(prefix + "edits.json");
const owned = [...ready.source, ...ready.unchangedCandidates];
const paths = new Set(owned.map((row) => row.path));
assert(paths.size === 83, "owned_path_count");
assert(edits.every((row) => paths.has(row.path)), "foreign_edit");
const tree = (source, p) => {
  const f = ts.createSourceFile(p, source, ts.ScriptTarget.Latest, true);
  let nodes = 0, leaves = 0;
  const walk = (n) => {
    nodes++;
    const children = [];
    ts.forEachChild(n, (child) => { children.push(walk(child)); });
    if (!children.length) { leaves++; return [n.kind, n.getText(f)]; }
    return [n.kind, children];
  };
  return { f, value: walk(f), nodes, leaves };
};
// 同一次Git批量读取每个原blob；不复制另一个全仓输入或依赖工作树HEAD继续前进。
const git = execFileSync("git", ["cat-file", "--batch"], {
  input: owned.map((row) => `${ready.baseCommit}:${row.path}\n`).join(""),
  maxBuffer: 10 * 1024 * 1024,
});
let offset = 0;
const report = [];
for (const row of owned) {
  const end = git.indexOf(10, offset), header = git.subarray(offset, end).toString();
  const [blob, type, size] = header.split(" ");
  assert(type === "blob" && Number.isSafeInteger(Number(size)), "git_blob_header:" + row.path);
  const raw = git.subarray(end + 1, end + 1 + Number(size));
  offset = end + 1 + Number(size) + 1;
  const old = captures.get(row.path), saved = before.source.find((x) => x.path === row.path);
  assert(old && saved && old.text === raw.toString("utf8"), "git_before_text:" + row.path);
  assert(sha(raw) === old.sha256 && old.sha256 === saved.sha256, "git_before_sha:" + row.path);
  const current = fs.readFileSync(row.path, "utf8");
  assert(sha(current) === row.sha256, "ready_drift:" + row.path);
  const changes = edits.filter((x) => x.path === row.path);
  let forward = old.text;
  for (const edit of changes) {
    assert(edit.before.length > 0 && forward.split(edit.before).length === 2, "forward_unique:" + row.path);
    forward = forward.replace(edit.before, edit.after);
  }
  assert(forward === current, "full_forward:" + row.path);
  let inverse = current;
  for (const edit of changes.toReversed()) {
    assert(edit.after.length > 0 && inverse.split(edit.after).length === 2, "inverse_unique:" + row.path);
    inverse = inverse.replace(edit.after, edit.before);
  }
  assert(inverse === old.text, "full_inverse:" + row.path);
  const originalTree = tree(old.text, row.path), restoredTree = tree(inverse, row.path);
  assert(JSON.stringify(originalTree.value) === JSON.stringify(restoredTree.value), "restored_tree:" + row.path);
  const nowTree = tree(current, row.path);
  const retainedBodies = [], changedBodies = [], declarations = [];
  const oldFunctions = new Map(originalTree.f.statements.filter(ts.isFunctionDeclaration).filter((n) => n.name).map((n) => [n.name.text, n]));
  for (const n of nowTree.f.statements.filter(ts.isFunctionDeclaration)) {
    if (!n.name) continue;
    const previous = oldFunctions.get(n.name.text);
    if (previous?.body && n.body) {
      const a = tree(previous.body.getText(originalTree.f), row.path);
      const b = tree(n.body.getText(nowTree.f), row.path);
      (JSON.stringify(a.value) === JSON.stringify(b.value) ? retainedBodies : changedBodies).push(n.name.text);
    }
    const source = n.parameters.find((p) => p.name.getText(nowTree.f) === "currentCamp");
    if (source) {
      assert(!source.questionToken && !source.initializer && source.type?.getText(nowTree.f) === "CurrentCampSource", "required_source:" + row.path + ":" + n.name.text);
      declarations.push({ name: n.name.text, parameterIndex: n.parameters.indexOf(source), requiredType: "CurrentCampSource" });
    }
  }
  report.push({ path: row.path, sha256: row.sha256, beforeSHA256: old.sha256, gitBlob: blob, changed: current !== old.text, editRecords: changes.length, completeForward: true, completeInverse: true, restoredTypedNodes: originalTree.nodes, restoredLeafTexts: originalTree.leaves, retainedTopFunctionBodies: retainedBodies, explicitPolicyChangedTopFunctionBodies: changedBodies, requiredSources: declarations });
}
assert(offset === git.length, "unconsumed_git_batch");
const rootCamp = fs.readFileSync("backend/src/core/domain/components/camp.ts", "utf8");
const sourceType = tree(rootCamp, "camp.ts").f.statements.filter(ts.isTypeAliasDeclaration).filter((n) => n.name.text === "CurrentCampSource");
assert(sourceType.length === 1, "unique_current_camp_type");
const imports = [];
for (const row of ready.source.filter((x) => x.path.startsWith("backend/src/"))) {
  const f = tree(fs.readFileSync(row.path, "utf8"), row.path).f;
  for (const n of f.statements.filter(ts.isImportDeclaration)) {
    const elements = n.importClause?.namedBindings;
    if (!elements || !ts.isNamedImports(elements)) continue;
    for (const e of elements.elements) if ((e.propertyName?.text ?? e.name.text) === "CurrentCampSource") {
      assert(n.importClause.isTypeOnly || e.isTypeOnly, "camp_source_runtime_edge:" + row.path);
      imports.push({ path: row.path, module: n.moduleSpecifier.text, imported: "CurrentCampSource", typeOnly: true });
    }
  }
}
const result = {
  baseCommit: ready.baseCommit, sourceReadySHA256: sha(fs.readFileSync(prefix + "source-ready.json")), source: report,
  summary: { paths: report.length, changed: report.filter((x) => x.changed).length, unchanged: report.filter((x) => !x.changed).length, exactEditRecords: edits.length, completeProgramsRestored: report.length, restoredTypedNodes: report.reduce((s, x) => s + x.restoredTypedNodes, 0), restoredLeafTexts: report.reduce((s, x) => s + x.restoredLeafTexts, 0) },
  currentSourceType: { path: "backend/src/core/domain/components/camp.ts", sha256: sha(rootCamp), declarations: 1, imports },
  limits: ["F05b changes input API and actual current Camp lookup intentionally; current JS is not claimed equal to old JS.", "Complete source inverse includes authored full-file edit records, including fixture/input and oracle deltas. It proves actual program provenance, not all post-policy behavior or all 55 roles.", "Retained top-level bodies and required-source declarations are read from actual TS AST. This is not a type checker, whole dependency graph or arbitrary callback exception equivalence proof.", "Root-owned shared production and other owner inputs are not immutable controls here. No role implementation is loaded."]
};
fs.writeFileSync(prefix + "proof.json", JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify(result.summary));
