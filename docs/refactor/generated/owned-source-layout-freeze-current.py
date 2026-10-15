"""冻结机械迁移、有限运行适配和明确历史准入修复的实际文件，不执行产品。"""
from pathlib import Path
import json,hashlib,subprocess,os
root=Path('/home/hby/dev/AI-Werewolf-Arena');P=root/'docs/refactor/generated/owned-source-layout-'
load=lambda name:json.loads(Path(name).read_text());sha=lambda p:hashlib.sha256(Path(p).read_bytes()).hexdigest()
routes=load(str(P)+'module-routes.json');before=load(str(P)+'before.json');ops=load('/tmp/awa-owned-layout-operational-adaptations/operations.json');receipt=load('/tmp/awa-owned-layout-operational-adaptations/applied-receipt.json');history=load('/tmp/awa-owned-layout-fixture-history-repair/applied-receipt.json');meta=load('/tmp/awa-owned-layout-fixture-history-repair/metadata-receipt.json');fe=load(str(P)+'frontend-public-route.json')
expected={r['to']:r['afterSHA256'] for r in routes['changed']};expected.update({r['to']:r['beforeSHA256'] for r in routes['dataMoves']})
for source,key in [(receipt['files'],'afterSha256'),(history['files'],'afterSha256'),(meta['files'],'afterSha256'),(fe['rows'],'afterSHA256')]:
 for r in source:expected[r['path']]=r[key]
source=[]
for p,h in sorted(expected.items()):
 path=root/p;assert path.is_file() and not path.is_symlink(),p;assert sha(path)==h,p
 source.append({'path':p,'sha256':h,'bytes':path.stat().st_size,'mode':'100755' if path.stat().st_mode&0o111 else '100644'})
original={r['path']:r for r in before['source']};deleted=[]
for r in routes['moves']:
 assert not (root/r['from']).exists(),r['from'];deleted.append({'path':r['from'],'sha256':original[r['from']]['sha256'],'expectedAbsent':True})
for r in before['controls']:assert sha(root/r['path'])==r['sha256'],r['path']
ready={'baseCommit':before['baseCommit'],'stage':'实际672迁移＋37/83适配＋两源历史准入＋7份current元数据＋2FE遗漏导入修复均落地；尚未运行本轮新增6声明或tooling后继类型。','source':source,'deleted':deleted,'controls':before['controls'],'mechanicalSnapshotSHA256':sha(str(P)+'mechanical-ready.json'),'unresolvedKnownArchitecture':['16条原recording→game/features旧边待后继5live owner机械归app/checkpoint；不是放宽原policy或声称全门禁通过。'],'limits':['无源程序算法、工具ID、boardID、RNG或归档payload改动；历史fixture准入接受面单独声明。','此为该批检查前真实快照，不是最终C47同输入全套验收或55角色结论。']}
Path(str(P)+'source-ready.json').write_text(json.dumps(ready,ensure_ascii=False,indent=2)+'\n');print(json.dumps({'source':len(source),'deleted':len(deleted),'controls':len(before['controls']),'sourceReadySHA256':sha(str(P)+'source-ready.json')}))
