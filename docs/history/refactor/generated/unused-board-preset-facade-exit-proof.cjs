/**
 * 负责只读核对一个零消费者兼容叶的退休证据；输入为实际固定 Git 与当前公开源码文本。
 * 输出字面 AST 引用、根重导可达集合、真实规则绑定和原文控制核对；不加载生产模块、运行类型或行为。
 * 只识别语法中的字面模块引用；未知外部深路径与非字面动态构造不在保证内。
 */
const fs = require("node:fs"), path = require("node:path"), cp = require("node:child_process");
const { createHash } = require("node:crypto");
const ts = require("../../../backend/node_modules/typescript");
const root = path.resolve(__dirname, "../../.."), prefix = path.join(__dirname, "unused-board-preset-facade-exit-");
const before = JSON.parse(fs.readFileSync(prefix + "before.json", "utf8"));
const leaf = before.source[0].path, owner = "backend/src/rulesets/board-support.ts";
const sha = b => createHash("sha256").update(b).digest("hex");
const git = (args, input) => cp.execFileSync("git", args, { cwd: root, input, maxBuffer: 256 * 1024 * 1024 });
const assert = (v, why) => { if (!v) throw Error(why); };
for (const row of [...before.source, ...before.controls]) {
  const b = git(["cat-file", "blob", before.baseCommit + ":" + row.path]);
  assert(sha(b) === row.sha256 && b.toString("utf8") === row.text, "actual_git_before:" + row.path);
  if (row.path !== leaf) assert(b.equals(fs.readFileSync(path.join(root, row.path))), "stable_control:" + row.path);
}
assert(!fs.existsSync(path.join(root, leaf)), "retired_leaf_still_present");
const oldLeaf = ts.createSourceFile(leaf, before.source[0].text, ts.ScriptTarget.Latest, true);
assert(oldLeaf.statements.length === 1 && ts.isExportDeclaration(oldLeaf.statements[0]), "old_leaf_not_single_reexport");
const oldExport = oldLeaf.statements[0];
assert(oldExport.moduleSpecifier.text === "../../../rulesets" && oldExport.exportClause && ts.isNamedExports(oldExport.exportClause) && oldExport.exportClause.elements.length === 1 && oldExport.exportClause.elements[0].name.text === "boardPresetViolation" && !oldExport.exportClause.elements[0].propertyName, "old_leaf_binding_changed");
const allowed = name => /^(?:backend|frontend|packages|tooling)\//.test(name) &&
  !name.split("/").some(s => ["node_modules", ".git", ".aws", ".codex", "configs", "records", "generated", "dist", "build", "coverage"].includes(s) || s.startsWith(".env")) &&
  (/\.[cm]?[jt]sx?$/.test(name) || /(?:^|\/)(?:package|tsconfig(?:\.[^/]+)?)\.json$/.test(name));
const listing = git(["ls-tree", "-r", "-z", before.baseCommit]).toString().split("\0").filter(Boolean);
const entries = listing.flatMap(row => {
  const m = /^(\d+) blob ([a-f0-9]+)\t(.+)$/.exec(row);
  return m && allowed(m[3]) ? [{ mode: m[1], blob: m[2], path: m[3] }] : [];
});
assert(entries.every(e => e.mode !== "120000"), "fixed_source_symlink");
const batch = git(["cat-file", "--batch"], entries.map(e => e.blob).join("\n") + "\n");
let offset = 0; const fixed = new Map();
for (const e of entries) {
  const end = batch.indexOf(10, offset), [blob, kind, size] = batch.subarray(offset, end).toString().split(" ");
  assert(blob === e.blob && kind === "blob", "blob_header");
  offset = end + 1; const n = Number(size), bytes = batch.subarray(offset, offset + n); offset += n + 1;
  fixed.set(e.path, bytes.toString("utf8"));
}
assert(offset === batch.length, "blob_batch_tail");
const currentNames = git(["ls-files", "--cached", "--others", "--exclude-standard", "-z"]).toString().split("\0").filter(allowed);
const current = new Map();
for (const name of [...new Set(currentNames)].sort()) {
  if (name === leaf) continue;
  const file = path.join(root, name); if (!fs.existsSync(file)) continue;
  assert(!fs.lstatSync(file).isSymbolicLink(), "current_source_symlink:" + name);
  current.set(name, fs.readFileSync(file, "utf8"));
}
function scan(files, label) {
  // 解析时补入已退叶的虚拟文本，使未迁移引用仍能解析至旧路径，不能因物理缺席漏报。
  const virtual = new Map(files); virtual.set(leaf, before.source[0].text);
  const vr = "/__public__", abs = name => vr + "/" + name;
  const directoryExists = directory => [...virtual.keys()].some(name => abs(name).startsWith(directory + "/"));
  const readFile = name => virtual.get(name.replace(vr + "/", ""));
  const host = { fileExists: name => virtual.has(name.replace(vr + "/", "")), readFile, directoryExists,
    realpath: x => x, getCurrentDirectory: () => vr, useCaseSensitiveFileNames: true };
  const configs = [...virtual.keys()].filter(n => /(?:^|\/)tsconfig(?:\.[^/]+)?\.json$/.test(n)).map(name => ({
    name, dir: path.posix.dirname(name), parsed: ts.getParsedCommandLineOfConfigFile(abs(name), {}, {
      ...host, readDirectory: (dir, exts) => [...virtual.keys()].map(abs).filter(n => n.startsWith(dir + "/") && (!exts || exts.some(x => n.endsWith(x)))),
      onUnRecoverableConfigFileDiagnostic: () => {},
    }),
  }));
  const resolve = (from, spec) => {
    const config = configs.filter(c => from.startsWith(c.dir + "/")).sort((a,b) => b.dir.length - a.dir.length || Number(!a.name.endsWith("/tsconfig.json")) - Number(!b.name.endsWith("/tsconfig.json")))[0];
    const found = ts.resolveModuleName(spec, abs(from), { module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler, allowJs: true, ...config?.parsed?.options }, host).resolvedModule?.resolvedFileName;
    if (found?.startsWith(vr + "/")) return found.slice(vr.length + 1);
    if (!spec.startsWith(".")) return null;
    const at = path.posix.normalize(path.posix.join(path.posix.dirname(from), spec)), stripped = at.replace(/\.[cm]?js$/, "");
    return [at, ...[".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs"].map(x => stripped + x), ...["index.ts", "index.tsx", "index.js", "index.mts", "index.cts"].map(x => at + "/" + x)].find(n => virtual.has(n)) ?? null;
  };
  const rows = [], forms = {}, strings = [], sourceRows = [];
  for (const [name,text] of [...files].sort((a,b) => a[0].localeCompare(b[0]))) {
    if (!/\.[cm]?[jt]sx?$/.test(name)) continue;
    sourceRows.push({ path: name, sha256: sha(text) });
    const sf = ts.createSourceFile(name, text, ts.ScriptTarget.Latest, true);
    const visit = node => {
      let expression, kind;
      if (ts.isImportDeclaration(node)) { expression = node.moduleSpecifier; kind = "import"; }
      else if (ts.isExportDeclaration(node) && node.moduleSpecifier) { expression = node.moduleSpecifier; kind = "reexport"; }
      else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) { expression = node.moduleReference.expression; kind = "import-equals"; }
      else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) { expression = node.argument.literal; kind = "import-type"; }
      else if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || ts.isIdentifier(node.expression) && node.expression.text === "require")) {
        expression = node.arguments[0]; kind = node.expression.kind === ts.SyntaxKind.ImportKeyword ? "dynamic-import" : "require";
      }
      if (expression && ts.isStringLiteralLike(expression)) {
        const specifier = expression.text; forms[kind] = (forms[kind] ?? 0) + 1;
        rows.push({ path: name, line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1, kind, specifier, target: resolve(name, specifier), namespace: ts.isImportDeclaration(node) && !!node.importClause?.namedBindings && ts.isNamespaceImport(node.importClause.namedBindings) });
      }
      if (ts.isStringLiteralLike(node) && /board[_-]presets/.test(node.text) && name !== leaf) strings.push({ path:name, line:sf.getLineAndCharacterOfPosition(node.getStart(sf)).line+1, text:node.text });
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }
  const incoming = rows.filter(r => r.target === leaf); assert(incoming.length === 0, label + ":incoming_to_retired_leaf");
  assert(strings.length === 0, label + ":literal_path_text_reference");
  const reachable = new Set(), visitRoot = name => {
    if (reachable.has(name)) return; reachable.add(name);
    for (const row of rows.filter(r => r.path === name && r.kind === "reexport" && r.target)) visitRoot(row.target);
  };
  visitRoot("backend/src/index.ts"); assert(!reachable.has(leaf), label + ":root_export_reaches_leaf");
  const expected = [
    ["backend/src/runtime/config/board_definition.ts", "../../rulesets", "backend/src/rulesets/index.ts"],
    ["backend/src/rulesets/board-parameters.ts", "./board-support", owner],
    ["backend/src/rulesets/supported-role-deck.ts", "./board-support", owner],
    ["backend/src/rulesets/index.ts", "./board-support", owner],
  ];
  for (const [from,spec,to] of expected) assert(rows.some(r => r.path === from && r.specifier === spec && r.target === to), label + ":owner_route:" + from);
  const declaration = ts.createSourceFile(owner, files.get(owner), ts.ScriptTarget.Latest, true).statements.filter(n => ts.isFunctionDeclaration(n) && n.name?.text === "boardPresetViolation");
  assert(declaration.length === 1, label + ":unique_function_owner");
  assert(!Object.hasOwn(JSON.parse(files.get("backend/package.json")), "exports"), label + ":unexpected_package_export_policy");
  return { label, sourceFiles:sourceRows.length, sourcePathSHADigest:sha(JSON.stringify(sourceRows)), forms, namespaceImports:rows.filter(r=>r.namespace).length, incoming, literalPathStrings:strings, rootReexportReachable:[...reachable].sort(), ownerRoutes:expected };
}
const previous = scan(fixed,"fixed-before"), successor = scan(current,"current-after-delete");
const docMatches = [];
for (const row of listing) {
  const m = /^(\d+) blob ([a-f0-9]+)\t(.+)$/.exec(row); if (!m || !(m[3] === "README.md" || /^docs\/.*\.md$/.test(m[3])) || m[3].startsWith("docs/refactor/generated/")) continue;
  const text = git(["cat-file","blob",m[2]]).toString("utf8");
  text.split("\n").forEach((line,index) => { if (/board[_-]presets/.test(line)) docMatches.push({path:m[3],line:index+1,text:line}); });
}
assert(docMatches.every(r=>r.path === "docs/refactor/architecture-baseline.md"), "unexpected_fixed_document_reference");
const report = { approved:true, baseCommit:before.baseCommit, source:[{path:leaf,change:"deleted",beforeSHA256:before.source[0].sha256}], deleted:[{path:leaf,sha256:before.source[0].sha256,expectedAbsent:true}], stableControls:before.controls.length, previous, successor, historicalDocumentMatches:docMatches,
  productionLoaded:false, typesTestsOrArchitectureExecuted:false,
  limits:["AST syntax and virtual literal resolution only; no production loading or arbitrary dynamic/external consumer guarantee.","Current parallel comment-only files are read as actual source and summarized, not falsely declared immutable whole controls.","Old deep-path API and new sourceHash membership are intentionally retired; original historical fingerprints are not rewritten."] };
fs.writeFileSync(prefix + "proof.json", JSON.stringify(report,null,2) + "\n");
console.log(JSON.stringify({approved:true,baseCommit:before.baseCommit,deleted:1,controls:before.controls.length,fixedSources:previous.sourceFiles,currentSources:successor.sourceFiles,incomingBefore:previous.incoming.length,incomingAfter:successor.incoming.length,rootReexportModules:successor.rootReexportReachable.length,actualConsumers:3,historicalDocumentMatches:docMatches.length,productionLoaded:false}));
