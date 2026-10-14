"""只读核固定Git每个blob和完整输入；不再次调用架构检查、类型或测试。"""
from pathlib import Path
import json,hashlib,subprocess
prefix='docs/refactor/generated/architecture-checkpoint-033218f2-'
cap=json.loads(Path(prefix+'capture.json').read_text());fixed=cap['commit'];h=lambda b:hashlib.sha256(b).hexdigest()
raw=Path(cap['rawInput']['path']).read_bytes();assert len(raw)==cap['rawInput']['bytes'] and h(raw)==cap['rawInput']['sha256'];inp=json.loads(raw);manifest=cap['files'];assert len(manifest)==len(inp['files'])==len({x['path'] for x in manifest});assert [x['path'] for x in manifest]==sorted(x['path'] for x in manifest)==[x['path'] for x in inp['files']]
tree=subprocess.check_output(['git','ls-tree','-r','-z',fixed]);allentries=[]
for line in tree.split(b'\0'):
 if not line:continue
 meta,path=line.split(b'\t',1);mode,kind,blob=meta.decode().split(' ')
 if kind=='blob':allentries.append({'path':path.decode(),'mode':mode,'blob':blob})
# 原公共路径政策使用同Git已核工具，不另造过滤器；Bun只调用纯谓词，不执行inventory主入口。
paths=[x['path'] for x in allentries];filtered=subprocess.run(['bun','--no-env-file','-e','const fs=require("node:fs");const {isPublicInventoryPath}=require("./tooling/refactor/inventory.ts"); const a=JSON.parse(fs.readFileSync(0,"utf8"));process.stdout.write(JSON.stringify(a.filter(isPublicInventoryPath).sort()));'],input=json.dumps(paths,separators=(',',':')).encode(),stdout=subprocess.PIPE,check=True);public=json.loads(filtered.stdout);assert public==[x['path'] for x in manifest]
byname={x['path']:x for x in allentries};assert all({k:x[k] for k in ['path','mode','blob']}==byname[x['path']] for x in manifest);assert all(x['mode']!='120000' for x in manifest)
batch=subprocess.check_output(['git','cat-file','--batch'],input=('\n'.join(x['blob'] for x in manifest)+'\n').encode());offset=0
for m,f in zip(manifest,inp['files']):
 end=batch.index(b'\n',offset);blob,kind,length=batch[offset:end].decode().split(' ');assert blob==m['blob'] and kind=='blob';length=int(length);offset=end+1;b=batch[offset:offset+length];assert len(b)==length and batch[offset+length:offset+length+1]==b'\n';offset+=length+1
 assert h(b)==m['sha256']==f['sha256'];assert b.decode('utf8',errors='replace')==f['text']
assert offset==len(batch)
assert inp['documentationPaths']==cap['documentationPaths']==sorted(x['path'] for x in allentries if x['path']=='README.md' or x['path'].startswith('docs/') and x['path'].endswith('.md'))
metadata=[{'path':f['path'],'sha256':f['sha256']} for f in inp['files']];digest=h(json.dumps(metadata,ensure_ascii=False,separators=(',',':')).encode());assert digest==cap['sourceDigest']
report=json.loads(Path(prefix+'report.json').read_text());assert report['inputHash']==digest;assert report['counts']['files']==len(manifest)
for t in cap['gateModules']:
 b=subprocess.check_output(['git','show',fixed+':'+t['path']]);assert h(b)==t['sha256'] and b==Path(t['path']).read_bytes()
debtpath='docs/refactor/generated/architecture-debt.json';b=subprocess.check_output(['git','show',fixed+':'+debtpath]);assert b==Path(debtpath).read_bytes();assert h(b)==cap['debtSha256']=='297b945bcdc85873b1d44e9e0ae705cddc1af8fd3e2fa5acfdb443f036550e5d';debt=json.loads(b);assert len(debt['violations'])==cap['originalDebtCount']==1779
out={'fixedCommit':fixed,'files':len(manifest),'sameGitDocumentationPaths':len(cap['documentationPaths']),'rawInput':cap['rawInput'],'sourceDigest':digest,'allPublicPathsExactOriginalPolicy':True,'wholeGitTreeBlobModeManifestSame':True,'everyRawGitBlobSHAAndDecodedTextSame':True,'wholeInputOrderSame':True,'sixFixedGitAndCurrentToolBytesSame':True,'originalDebtCount':1779,'originalDebtSHA256':h(b),'originalDebtWholeGitAndCurrentSame':True,'sourceAndReportDigestSame':True,'mismatches':0,'scope':'纯读取输入/原工具/固定Git，不再次执行checkArchitecture或任何type/test/gate。'};Path(prefix+'input-verification.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n');print(json.dumps(out,ensure_ascii=False))
