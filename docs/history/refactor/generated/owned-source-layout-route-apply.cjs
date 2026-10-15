/** 只应用已准备的实际Git路径与模块字面；全部前态核验通过后再写，非module适配交独立后继。 */
const fs=require('node:fs'),cp=require('node:child_process'),path=require('node:path'),assert=require('node:assert/strict'),{createHash}=require('node:crypto');
const input='/tmp/awa-owned-layout-candidate.json',p=JSON.parse(fs.readFileSync(input,'utf8')),before=JSON.parse(fs.readFileSync('docs/refactor/generated/owned-source-layout-before.json','utf8')),original=new Map(before.source.map(r=>[r.path,r])),sha=b=>createHash('sha256').update(b).digest('hex');
assert.equal(cp.execFileSync('git',['rev-parse','HEAD']).toString().trim(),p.revision);assert.equal(before.baseCommit,p.revision);assert.deepEqual(p.unresolvedRelative,[]);
for(const row of p.changed){assert.equal(sha(fs.readFileSync(row.from)),row.beforeSHA256,row.from);assert.equal(sha(row.before),row.beforeSHA256);assert.equal(sha(row.after),row.afterSHA256);assert.equal(original.get(row.from).sha256,row.beforeSHA256);if(row.from!==row.to)assert(!fs.existsSync(row.to),row.to);}
for(const row of p.dataMoves){const bytes=fs.readFileSync(row.from);assert.equal(sha(bytes),row.beforeSHA256);assert.equal(bytes.length,row.bytes);assert(!fs.existsSync(row.to));assert(original.has(row.from));}
// 消费者和新所有者先写完整正文，最后一次移除旧物理文件；空目录不是第二份源实现。
for(const row of p.changed){fs.mkdirSync(path.dirname(row.to),{recursive:true});fs.writeFileSync(row.to,row.after);fs.chmodSync(row.to,original.get(row.from).mode==='100755'?0o755:0o644);}
for(const row of p.dataMoves){fs.mkdirSync(path.dirname(row.to),{recursive:true});fs.writeFileSync(row.to,fs.readFileSync(row.from));fs.chmodSync(row.to,original.get(row.from).mode==='100755'?0o755:0o644);}
for(const row of p.moves)fs.unlinkSync(row.from);
const report={baseCommit:p.revision,candidateSHA256:sha(fs.readFileSync(input)),moved:p.moves.length,routePrograms:p.changed.length,moduleEdits:p.changed.reduce((n,r)=>n+r.edits.length,0),dataMoves:p.dataMoves.length,applied:true,limits:['只写完整既有模块与原JSON字节，不执行任何产品、类型或门禁。','原固定Git前态保mode/blob/SHA，当前CLI/子进程/fixture及checker/Trace非module旧路径仍待已分类独立适配，不称SourceReady。']};
fs.writeFileSync('docs/refactor/generated/owned-source-layout-route-application.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
