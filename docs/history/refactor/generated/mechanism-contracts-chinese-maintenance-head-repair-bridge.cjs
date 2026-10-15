/** 负责首75采样之后仅实际comment变源的完整桥；输入真实前样、精确后继与最终ready，输出整程序正逆/AST/NodeArray/叶/JSDoc保护和两raw，不加载生产，不重复首75主证明。 */
const fs=require('node:fs'),assert=require('node:assert/strict'),{createHash}=require('node:crypto'),ts=require('../../../backend/node_modules/typescript');
const prefix='docs/refactor/generated/mechanism-contracts-chinese-maintenance-';
const before=JSON.parse(fs.readFileSync(prefix+'head-repair-final-before.json','utf8'));
const edits=JSON.parse(fs.readFileSync(prefix+'head-repair-final-edits.json','utf8'));
const ready=JSON.parse(fs.readFileSync(prefix+'source-ready-final.json','utf8'));
const first=JSON.parse(fs.readFileSync(prefix+'source-ready.json','utf8'));
const gitBefore=JSON.parse(fs.readFileSync(prefix+'before.json','utf8'));
const sha=x=>createHash('sha256').update(x).digest('hex');
function parse(text, path) {
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  assert.deepEqual(source.parseDiagnostics, [], 'parse:' + path);
  return source;
}
function program(text, path) {
  const source = parse(text, path);
  let nodes = 0, arrays = 0;
  function walk(node) {
    nodes++;
    const children = [];
    ts.forEachChild(node, (child) => { children.push(walk(child)); }, (array) => {
      arrays++;
      children.push(['array', array.length, !!array.hasTrailingComma, ...array.map(walk)]);
    });
    return [node.kind, children];
  }
  const typed = walk(source), leaves = [];
  function tokenTree(node) {
    const children = node.getChildren(source).filter((child) =>
      child.kind < ts.SyntaxKind.FirstJSDocNode || child.kind > ts.SyntaxKind.LastJSDocNode);
    if (!children.length) {
      const leaf = [node.kind, node.getText(source)]; leaves.push(leaf); return leaf;
    }
    return [node.kind, children.map(tokenTree)];
  }
  const completeNoncommentTree = tokenTree(source), jsdocTypesAndTags = [];
  function docs(node) {
    for (const doc of node.jsDoc ?? []) {
      for (const tag of doc.tags ?? []) {
        jsdocTypesAndTags.push({kind: tag.kind, name: tag.tagName.getText(source),
          nameNode: tag.name?.getText(source) ?? null,
          typeExpression: tag.typeExpression?.getText(source) ?? null,
          typeParameters: tag.typeParameters?.map((p) => p.getText(source)) ?? null});
      }
      if (doc.typeExpression) jsdocTypesAndTags.push({typeExpression: doc.typeExpression.getText(source)});
    }
    ts.forEachChild(node, (child) => { docs(child); });
  }
  docs(source);
  return {typed, completeNoncommentTree, nodes, arrays, leaves, jsdocTypesAndTags};
}
function protectedComments(text, path) {
  const source = parse(text, path), ranges = new Map();
  function add(items) { for (const item of items ?? []) ranges.set(item.pos, item); }
  function walk(node) {
    add(ts.getLeadingCommentRanges(text, node.getFullStart()));
    add(ts.getTrailingCommentRanges(text, node.end));
    for (const child of node.getChildren(source)) walk(child);
  }
  walk(source);
  const result = [...ranges.values()].sort((a,b) => a.pos-b.pos)
    .map((range) => text.slice(range.pos, range.end))
    .filter((value) => /@(?:ts-|jsx|license)|SPDX|copyright|eslint|prettier|noinspection|<reference|istanbul|\bc8\b/i.test(value));
  if (text.startsWith('#!')) result.unshift(text.split('\n', 1)[0]);
  return result;
}

assert.equal(sha(fs.readFileSync(prefix+'source-ready.json')),ready.firstReady.sha256);
assert.equal(sha(fs.readFileSync(prefix+'head-repair-final-before.json')),ready.finalRepairBefore.sha256);
assert.equal(sha(fs.readFileSync(prefix+'head-repair-final-edits.json')),ready.finalRepairEdits.sha256);
assert.deepEqual(before.source.map(x=>x.path),edits.source.map(x=>x.path));
assert.deepEqual(before.source.map(x=>x.path),ready.changedCommentPaths);
assert.equal(ready.failedHeadPaths.length,9);
const programs=before.source.map((original,index)=>{
 const entry=edits.source[index],current=fs.readFileSync(original.path,'utf8'),final=ready.source.find(x=>x.path===original.path);
 assert.equal(sha(original.text),original.sha256);assert.equal(original.sha256,first.source.find(x=>x.path===original.path).sha256);assert.equal(entry.beforeSHA256,original.sha256);assert.equal(sha(current),entry.afterSHA256);assert.equal(sha(current),final.sha256);
 let forward=original.text;const positions=[];
 for(const edit of entry.edits){assert.equal(forward.split(edit.before).length,2,original.path);const pos=forward.indexOf(edit.before);positions.push(pos);forward=forward.slice(0,pos)+edit.after+forward.slice(pos+edit.before.length);}
 assert.equal(forward,current);let inverse=current;
 for(let i=entry.edits.length-1;i>=0;i--){const edit=entry.edits[i],pos=positions[i];assert.equal(inverse.slice(pos,pos+edit.after.length),edit.after);inverse=inverse.slice(0,pos)+edit.before+inverse.slice(pos+edit.after.length);}
 assert.equal(inverse,original.text);const a=program(original.text,original.path),b=program(current,original.path);assert.deepEqual(b,a);const protectedBefore=protectedComments(original.text,original.path);assert.deepEqual(protectedComments(current,original.path),protectedBefore);
 const outputs=[ts.ModuleKind.ESNext,ts.ModuleKind.CommonJS].map(module=>{const emit=text=>ts.transpileModule(text,{fileName:original.path,compilerOptions:{target:ts.ScriptTarget.ES2022,module,removeComments:true}}).outputText;const old=emit(original.text),actual=emit(current);assert.equal(actual,old);return{module:ts.ModuleKind[module],wholeRawSame:true,sha256:sha(actual),bytes:Buffer.byteLength(actual)};});
 return{path:original.path,beforeSHA256:original.sha256,afterSHA256:sha(current),exactCommentEdits:entry.edits.length,wholeForwardInverse:true,completeTypedAndTokenTreeSame:true,typedNodes:a.nodes,nodeArrays:a.arrays,noncommentLeaves:a.leaves.length,jsdocTypesAndTags:a.jsdocTypesAndTags.length,protectedComments:protectedBefore.length,outputs};
});
const changed=new Set(programs.map(x=>x.path)),other=first.source.filter(x=>!changed.has(x.path));
for(const entry of other){assert.equal(sha(fs.readFileSync(entry.path)),entry.sha256);assert.equal(ready.source.find(x=>x.path===entry.path).sha256,entry.sha256);}
for(const control of gitBefore.controls)assert.equal(sha(fs.readFileSync(control.path)),control.sha256);
const summary={changedSources:programs.length,exactCommentEdits:programs.reduce((n,p)=>n+p.exactCommentEdits,0),otherSourcesSame:other.length,typedNodes:programs.reduce((n,p)=>n+p.typedNodes,0),nodeArrays:programs.reduce((n,p)=>n+p.nodeArrays,0),noncommentLeaves:programs.reduce((n,p)=>n+p.noncommentLeaves,0),wholeRawOutputs:programs.length*2};
assert.equal(summary.exactCommentEdits,ready.successorCommentEdits);
const result={approved:true,sourceReadySHA256:sha(fs.readFileSync(prefix+'source-ready-final.json')),programs,otherSource:other,controls:gitBefore.controls.map(({text,...x})=>x),summary,limits:['只后继实际comment变源的完整正逆/AST/NodeArray/叶/JSDoc保护/两raw；其余源只SHA对首ready，不重新转译首75或重头绿色。','原首75主proof/head真实采样保留；本桥不执行types、业务、生产加载、全门禁或模型。','节点/数组/叶为每前态一次累计，不冒distinct运行覆盖。']};
fs.writeFileSync(prefix+'head-repair-bridge.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(summary));
