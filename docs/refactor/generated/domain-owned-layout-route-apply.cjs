/** 只应用已审阅的精确领域路径候选；先核整个前态，再写目标与消费者，最后退出旧路径。 */
const fs=require('node:fs'),cp=require('node:child_process'),path=require('node:path'),assert=require('node:assert/strict'),{createHash}=require('node:crypto');
const root='/home/hby/dev/AI-Werewolf-Arena',input='/tmp/awa-domain-layout-candidate.json',p=JSON.parse(fs.readFileSync(input,'utf8')),hash=b=>createHash('sha256').update(b).digest('hex');
process.chdir(root);assert.equal(cp.execFileSync('git',['rev-parse','HEAD']).toString().trim(),p.revision);assert.equal(p.stage,'prepared candidate only; no product writes');assert.deepEqual(p.unresolvedRelative,[]);
for(const r of p.changed){assert.equal(hash(fs.readFileSync(r.from)),r.beforeSHA256,r.from);assert.equal(hash(r.before),r.beforeSHA256);assert.equal(hash(r.after),r.afterSHA256);if(r.from!==r.to)assert.equal(fs.existsSync(r.to),false,r.to);}
const deleted=p.deletions.map(name=>({path:name,text:fs.readFileSync(name,'utf8'),mode:fs.statSync(name).mode&0o777}));
for(const r of p.changed){const mode=fs.statSync(r.from).mode&0o777;fs.mkdirSync(path.dirname(r.to),{recursive:true});fs.writeFileSync(r.to,r.after);fs.chmodSync(r.to,mode);}
for(const r of p.changed)if(r.from!==r.to)fs.unlinkSync(r.from);
for(const name of p.deletions)fs.unlinkSync(name);
fs.writeFileSync('/tmp/awa-domain-layout-application.json',JSON.stringify({revision:p.revision,inputSHA256:hash(fs.readFileSync(input)),changed:p.changed.map(({from,to,beforeSHA256,afterSHA256,edits})=>({from,to,beforeSHA256,afterSHA256,editCount:edits.length})),deleted,applied:true,limits:['Exact module literal rewrite and owned file movement only. Non-module paths are explicitly listed in candidate and require separate classified edits before validation.','No product modules, type checker, tests or architecture gate were executed.']},null,2)+'\n');
console.log(JSON.stringify({changed:p.changed.length,moves:p.moves.length,retiredFacades:p.deletions.length}));
