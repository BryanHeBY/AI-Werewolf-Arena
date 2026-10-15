/** 负责准备应用／Agent／适配器目录迁移的精确文本和依赖目标映射；默认只写 /tmp，工作树应用必须另行明确调用。 */
const fs=require('node:fs'),cp=require('node:child_process'),path=require('node:path'),crypto=require('node:crypto');
const ts=require('/home/hby/dev/AI-Werewolf-Arena/backend/node_modules/typescript');
const root='/home/hby/dev/AI-Werewolf-Arena';const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const revision=cp.execFileSync('git',['rev-parse','HEAD'],{cwd:root}).toString().trim();
const names=cp.execFileSync('git',['ls-tree','-rz','--name-only',revision],{cwd:root}).toString().split('\0').filter(Boolean);
const sourceNames=names.filter(p=>/^(?:backend\/(?:src|tests|scripts)\/|frontend\/(?:src|tests|scripts)\/|packages\/[^/]+\/(?:src|tests)\/|tooling\/refactor\/)/.test(p)&&/\.[cm]?[jt]sx?$/.test(p));
const all=new Set(names),plan=JSON.parse(fs.readFileSync('/tmp/awa-owned-layout-map.json','utf8')),moves=new Map(plan.mapping.map(r=>[r.from,r.to]));
for(const from of moves.keys()) if(!all.has(from)) throw Error('mapped_source_missing:'+from);
const route=p=>moves.get(p)||p;
const resolve=(from,s)=>{if(!s.startsWith('.'))return null;const b=path.posix.normalize(path.posix.join(path.posix.dirname(from),s));return [b,b+'.ts',b+'.tsx',b+'.js',b+'.cjs',b+'.mjs',b+'.json',b+'/index.ts',b+'/index.tsx',b+'/index.js',...(b.endsWith('.js')?[b.slice(0,-3)+'.ts',b.slice(0,-3)+'.tsx']:[])].find(p=>all.has(p))||null;};
const report={stage:'prepared candidate only; no product writes',revision,moves:[...moves].map(([from,to])=>({from,to})),deletions:[],changed:[],unresolvedRelative:[],otherPathLiterals:[]};
// 一次读取固定 Git 的公开源 blob；不逐文件启动 Git，也不从迁移中的工作树拼前态。
if(sourceNames.some(n=>/[\r\n]/.test(n)))throw Error('line_delimited_git_source_path_rejected');
const rawSources=cp.execFileSync('git',['cat-file','--batch'],{cwd:root,input:sourceNames.map(n=>revision+':'+n).join('\n')+'\n',maxBuffer:128*1024*1024}),sourceBlobs=new Map();let sourceOffset=0;
for(const name of sourceNames){const end=rawSources.indexOf(10,sourceOffset),fields=rawSources.subarray(sourceOffset,end).toString().split(' '),size=Number(fields[2]);if(fields[1]!=='blob'||!Number.isSafeInteger(size))throw Error('git_source_blob_required');sourceOffset=end+1;const bytes=rawSources.subarray(sourceOffset,sourceOffset+size);if(crypto.createHash('sha1').update('blob '+size+'\0').update(bytes).digest('hex')!==fields[0])throw Error('git_blob_identity_mismatch');sourceBlobs.set(name,bytes.toString());sourceOffset+=size;if(rawSources[sourceOffset++]!==10)throw Error('git_batch_delimiter');}
if(sourceOffset!==rawSources.length)throw Error('git_batch_trailing_data');
for(const from of sourceNames){
 const before=sourceBlobs.get(from),to=route(from),sf=ts.createSourceFile(from,before,ts.ScriptTarget.Latest,true),edits=[],moduleLiterals=new Set();
 const visit=n=>{let literal;if(ts.isImportDeclaration(n)||ts.isExportDeclaration(n))literal=n.moduleSpecifier;else if(ts.isExternalModuleReference(n))literal=n.expression;else if(ts.isImportTypeNode(n)&&ts.isLiteralTypeNode(n.argument))literal=n.argument.literal;else if(ts.isCallExpression(n)&&(n.expression.kind===ts.SyntaxKind.ImportKeyword||(ts.isIdentifier(n.expression)&&n.expression.text==='require'||ts.isPropertyAccessExpression(n.expression)&&n.expression.name.text==='require')))literal=n.arguments[0];if(literal&&ts.isStringLiteralLike(literal)){
  moduleLiterals.add(literal);
  if(literal.text.startsWith('.')){const target=resolve(from,literal.text);if(!target)report.unresolvedRelative.push({from,specifier:literal.text});else if(to!==from||route(target)!==target){
   let next=path.posix.relative(path.posix.dirname(to),route(target));if(!next.startsWith('.'))next='./'+next;
   if(!/\.[cm]?[jt]sx?$|\.json$/.test(literal.text)) {next=next.replace(/\.[cm]?[jt]sx?$/,'');if(!literal.text.endsWith('/index'))next=next.replace(/\/index$/,'');}
   else if(literal.text.endsWith('.js')&&/\.tsx?$/.test(next))next=next.replace(/\.tsx?$/,'.js');
   if(next!==literal.text){const old=literal.getText(sf);const quote=old[0];if(!['\"',"'",'`'].includes(quote))throw Error('unexpected_literal_quote');const after=quote+next+quote;edits.push({start:literal.getStart(sf),end:literal.getEnd(),before:old,after,kind:'module-specifier',beforeTarget:target,afterTarget:route(target)});}
  }}
 }
 ts.forEachChild(n,visit);};visit(sf);
 const scan=n=>{if(ts.isStringLiteralLike(n)&&!moduleLiterals.has(n)&&/(?:runtime[\/\\]|ai[\/\\]|game[\/\\]|recording[\/\\]|verification[\/\\]|time-consort|werewolf_mcp_server|audit_mcp_server)/.test(n.text))report.otherPathLiterals.push({from,line:sf.getLineAndCharacterOfPosition(n.getStart(sf)).line+1,value:n.text});ts.forEachChild(n,scan);};scan(sf);
 let after=before;for(const e of edits.sort((a,b)=>b.start-a.start)) {if(after.slice(e.start,e.end)!==e.before)throw Error('offset_mismatch');after=after.slice(0,e.start)+e.after+after.slice(e.end);}
 if(from!==to||before!==after)report.changed.push({from,to,beforeSHA256:hash(before),afterSHA256:hash(after),before,after,edits});
}
report.dataMoves=[...moves].filter(([from])=>!sourceNames.includes(from)).map(([from,to])=>{const bytes=cp.execFileSync('git',['show',revision+':'+from],{cwd:root});return{from,to,beforeSHA256:hash(bytes),bytes:bytes.length};});
for(const to of moves.values())if(all.has(to))throw Error('destination_exists:'+to);
if(new Set(moves.values()).size!==moves.size)throw Error('target_collision');
fs.writeFileSync('/tmp/awa-owned-layout-candidate.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({revision,moves:moves.size,deleted:0,changedSources:report.changed.length,moduleSpecifierEdits:report.changed.reduce((n,r)=>n+r.edits.length,0),unresolved:report.unresolvedRelative,otherPathLiterals:report.otherPathLiterals},null,2));
