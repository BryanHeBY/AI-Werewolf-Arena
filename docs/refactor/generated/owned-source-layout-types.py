"""对已落地的模块迁移首跑受影响类型项目；输入前后冻结，日志不含环境认证值。"""
from pathlib import Path
import concurrent.futures,subprocess,json,hashlib,time,os
root=Path('/home/hby/dev/AI-Werewolf-Arena'); prefix=root/'docs/refactor/generated/owned-source-layout-'
routes=json.loads((root/'docs/refactor/generated/owned-source-layout-module-routes.json').read_text()); moves={r['from']:r['to'] for r in routes['moves']}
files=subprocess.check_output(['git','ls-tree','-rz','--name-only','6025b64bca6d57c1d0965fdecf5328a8b897ef4c'],cwd=root).decode().split('\0')
files=sorted({moves.get(p,p) for p in files if p and (p.startswith(('backend/src/','backend/tests/','backend/scripts/','frontend/src/','frontend/tests/','frontend/scripts/','packages/','tooling/')) or p in ['bun.lock','package.json']) and not p.endswith(('.md','.png','.mp4'))})
def digest(p):return hashlib.sha256((root/p).read_bytes()).hexdigest()
inputs=[{'path':p,'sha256':digest(p),'bytes':(root/p).stat().st_size} for p in files]
configs=['backend/tsconfig.json','backend/tsconfig.tests.json','frontend/tsconfig.json','packages/game-contract/tsconfig.json','packages/game-contract/tsconfig.tests.json','packages/game-presentation/tsconfig.json','packages/game-presentation/tsconfig.tests.json','tooling/tsconfig.json']
for p in ['backend/package.json','frontend/package.json','backend/tsconfig.json','backend/tsconfig.tests.json','frontend/tsconfig.json']:
 if p not in files:inputs.append({'path':p,'sha256':digest(p),'bytes':(root/p).stat().st_size})
Path(str(prefix)+'types-input.json').write_text(json.dumps({'baseCommit':'6025b64bca6d57c1d0965fdecf5328a8b897ef4c','stage':'672物理路由＋37/83运行适配已落地；fixture元数据尚因既有public package路由不匹配而未写，不称全源就绪或完整C47。','files':inputs,'configs':configs},ensure_ascii=False,indent=2)+'\n')
env={'PATH':'/usr/bin:/bin','LANG':'C.UTF-8','TZ':'UTC','TMPDIR':'/tmp'}
def run(config):
 tag=config.replace('/','-').replace('.json','');argv=['/usr/bin/bun','--no-env-file','backend/node_modules/typescript/bin/tsc','--noEmit','-p',config];start=time.time()
 with open(str(prefix)+'types-'+tag+'-output.txt','wb') as log:
  proc=subprocess.run(argv,cwd=root,env=env,stdout=log,stderr=subprocess.STDOUT)
 return {'config':config,'argv':argv,'cwd':str(root),'environmentAllowlist':list(env),'startedUnix':start,'endedUnix':time.time(),'exitCode':proc.returncode,'raw':'owned-source-layout-types-'+tag+'-output.txt'}
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:results=list(pool.map(run,configs))
drift=[r['path'] for r in inputs if digest(r['path'])!=r['sha256']]
Path(str(prefix)+'types-results.json').write_text(json.dumps({'results':results,'inputDrift':drift,'limits':['首轮受影响8项目；非完整14项目C47。','不读取私有配置、不执行产品或模型；本次实际输入不能与未来修改后的源码冒同一轮。']},ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'results':[{'config':r['config'],'exitCode':r['exitCode']} for r in results],'inputDrift':drift}))
raise SystemExit(1 if drift or any(r['exitCode'] for r in results) else 0)
