/** 逐文件核真实 Git 输入、精确增量逆及完整迁移体；只解析公开源码，不执行产品或行为用例。 */
const fs = require("node:fs"), path = require("node:path"), cp = require("node:child_process"), crypto = require("node:crypto");
const ts = require("../../../backend/node_modules/typescript");
const prefix = "docs/refactor/generated/night-ability-inventory-owner-";
const read = name => JSON.parse(fs.readFileSync(prefix + name + ".json", "utf8"));
const hash = value => crypto.createHash("sha256").update(value).digest("hex");
const before = read("before"), author = read("author-edits"), root = read("root-edits"), rootBefore = read("root-before"), paths = read("paths");
const edits = { ...author, ...root.source };
const original = new Map(before.source.map(x => [x.path, x]));
const failures = [], checks = [];
const verify = (name, ok, detail) => { checks.push({name, ok, ...detail}); if (!ok) failures.push(name); };
const replace = (text, step) => {
  if (step.operation === "append") return { text: text + step.after, position: text.length };
  const matches = text.split(step.before).length - 1;
  if (matches !== step.count || step.count !== 1) throw Error("precise edit mismatch: " + step.before.slice(0, 70));
  const position = text.indexOf(step.before);
  return { text: text.slice(0, position) + step.after + text.slice(position + step.before.length), position };
};
const sf = (file, text) => ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
const printer = ts.createPrinter({ removeComments: true });
const printed = (file, text) => printer.printFile(sf(file, text));
// 完整 getChildren 包含标点和叶文本，跳过 JSDoc；另核 forEachChild 的 NodeArray 元信息。
const shape = (file, text) => {
  const source = sf(file, text), out = [], arrays = [];
  const walk = node => {
    if (ts.isJSDoc(node) || (node.kind >= ts.SyntaxKind.FirstJSDocNode && node.kind <= ts.SyntaxKind.LastJSDocNode)) return;
    const children = node.getChildren(source).filter(c => !(c.kind >= ts.SyntaxKind.FirstJSDocNode && c.kind <= ts.SyntaxKind.LastJSDocNode));
    out.push([node.kind, children.length ? null : node.getText(source)]);
    for (const child of children) walk(child);
  };
  const arrayWalk = node => {
    ts.forEachChild(node, child => { arrayWalk(child); }, array => {
      arrays.push([node.kind, array.length, !!array.hasTrailingComma]);
      for (const child of array) arrayWalk(child);
    });
  };
  walk(source); arrayWalk(source);
  return { nodes: out, arrays, leaves: out.filter(x => x[1] !== null).length };
};
const emit = (file, text, module) => ts.transpileModule(text, { fileName:file, compilerOptions:{ target:ts.ScriptTarget.ES2022, module, removeComments:true } }).outputText;
const functions = (file, text) => new Map(sf(file,text).statements.filter(ts.isFunctionDeclaration).map(x => [x.name?.text,x.getText(sf(file,text))]));
const whole = [];
for (const item of before.source) {
  const git = cp.execFileSync("git", ["show", before.baseCommit + ":" + item.path], { maxBuffer:32*1024*1024 });
  verify("Git:" + item.path, hash(git) === item.sha256 && git.toString("utf8") === item.text, {});
  if (item.change === "delete" || !fs.existsSync(item.path)) {
    verify("deleted:" + item.path, item.path.endsWith("/prepared-native-install.ts") && !fs.existsSync(item.path), {}); continue;
  }
  let expected = item.text;
  const history = [];
  for (const step of edits[item.path] ?? []) {
    const applied = replace(expected, step); history.push({step,position:applied.position}); expected = applied.text;
  }
  const current = fs.readFileSync(item.path,"utf8");
  verify("forward:" + item.path, expected === current, {});
  let inverse = current;
  for (const {step,position} of history.reverse()) {
    if (inverse.slice(position,position+step.after.length) !== step.after) throw Error("inverse edit position: " + item.path);
    inverse = inverse.slice(0,position)+step.before+inverse.slice(position+step.after.length);
  }
  const a=shape(item.path,item.text), b=shape(item.path,inverse);
  const outputs=[ts.ModuleKind.ESNext,ts.ModuleKind.CommonJS].map(module=>({ module:ts.ModuleKind[module],same:emit(item.path,item.text,module)===emit(item.path,inverse,module) }));
  const exact=inverse===item.text, typed=JSON.stringify(a)===JSON.stringify(b);
  verify("whole:"+item.path,exact&&typed&&outputs.every(x=>x.same),{});
  whole.push({path:item.path,beforeSHA256:item.sha256,currentSHA256:hash(current),edits:history.length,exactInverse:exact,typedNodes:a.nodes.length,nonCommentLeaves:a.leaves,nodeArrays:a.arrays.length,completeTypedTreeSame:typed,outputs});
}
for (const item of rootBefore.source) verify("Rootbefore:"+item.path, original.get(item.path)?.text===item.text && original.get(item.path)?.sha256===item.sha256,{});
const roles="backend/src/game/mechanisms/roles/", current=fs.readFileSync(roles+"abilities.ts","utf8"), currentFns=functions(roles+"abilities.ts",current);
const oldPrepared=original.get(roles+"prepared-native-install.ts").text, oldMetadata=original.get(roles+"ability_changes.ts").text;
const moved=[];
for(const [source,names] of [[oldPrepared,["commitPreparedNativeAbility"]],[oldMetadata,["setNightAbilityEnabled","retireBorrowedNightAbility","expireLuckyAbilitiesOnDeath","setNightAbilityStartDay","recordNightAbilityUse"]]]) {
  const old=functions("old.ts",source);
  for(const name of names) {
    const a=shape("body.ts",old.get(name)),b=shape("body.ts",currentFns.get(name));
    const ok=JSON.stringify(a)===JSON.stringify(b)&&printed("body.ts",old.get(name))===printed("body.ts",currentFns.get(name));
    verify("actual moved function:"+name,ok,{});moved.push({name,typedNodes:a.nodes.length,nonCommentLeaves:a.leaves,completeDeclarationAndBodySame:ok});
  }
}
const kernels=read("moved-body-inputs");
const bodyOf=name=>sf("owner.ts",currentFns.get(name)).statements[0].body.statements.map(x=>printer.printNode(ts.EmitHint.Unspecified,x,sf("owner.ts",currentFns.get(name)))).join("\n");
const bodyChecks=[];
for(const [name,key] of [["commitGrantedNightAbility","installTail"],["retireTransferredNightAbility","retireTail"],["initializeNightAbilityInventory","clear"]]) {
  const actual=bodyOf(name),old=sf("old.ts",`function original(){\n${kernels[key]}\n}`).statements[0].body.statements.map(x=>printer.printNode(ts.EmitHint.Unspecified,x,sf("old.ts",`function original(){\n${kernels[key]}\n}`))).join("\n");
  const ok=actual===old;verify("actual commit body:"+name,ok,{});bodyChecks.push({name,completeActualStatementsSame:ok,actualSHA256:hash(actual)});
}
for(const item of before.controls) verify("control:"+item.path,hash(fs.readFileSync(item.path))===item.sha256&&hash(cp.execFileSync("git",["show",before.baseCommit+":"+item.path],{maxBuffer:32*1024*1024}))===item.sha256,{});
const report={baseCommit:before.baseCommit,source:paths.filter(x=>x.change!=="delete").map(x=>({path:x.path,sha256:hash(fs.readFileSync(x.path))})),deleted:paths.filter(x=>x.change==="delete").map(x=>({path:x.path,sha256:original.get(x.path).sha256,expectedAbsent:true})),originalPrograms:whole.length,whole,movedFunctions:moved,actualCommitBodies:bodyChecks,rootSharedWholeInputCount:rootBefore.source.length,rootSharedExactEdits:Object.values(root.source).reduce((n,x)=>n+x.length,0),controls:before.controls.map(({text,...x})=>x),checks,failures};
fs.writeFileSync(prefix+"proof.json",JSON.stringify(report,null,2)+"\n");console.log(JSON.stringify({originalPrograms:whole.length,movedFunctions:moved.length,actualCommitBodies:bodyChecks.length,typedNodes:whole.reduce((n,x)=>n+x.typedNodes,0),nonCommentLeaves:whole.reduce((n,x)=>n+x.nonCommentLeaves,0),outputs:whole.length*2,failures}));if(failures.length)process.exitCode=1;
