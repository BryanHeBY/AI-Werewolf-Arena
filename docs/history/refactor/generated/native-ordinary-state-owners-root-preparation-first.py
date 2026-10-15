import pathlib,json,hashlib,subprocess
pre='native-ordinary-state-owners';g=pathlib.Path('docs/refactor/generated');base=subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip();prior=json.loads((g/(pre+'-before.json')).read_text());sha=lambda t:hashlib.sha256(t.encode()).hexdigest()
paths=['backend/src/game/mechanisms/roles/player_state.ts','backend/src/game/observation/player-observation-projector.ts','backend/tests/unit/engine/player-state-projection.test.ts','backend/src/game/mechanisms/roles/cupid/state-slot.ts','backend/src/game/mechanisms/roles/debater/state.ts','backend/src/game/mechanisms/roles/mist_raven/player_projection.ts']
old={p:subprocess.check_output(['git','show',base+':'+p],text=True) for p in paths};texts=dict(old);edits={p:[] for p in paths}
for p,t in texts.items():assert pathlib.Path(p).read_text()==t,p
for r in prior['source']:assert subprocess.check_output(['git','show',base+':'+r['path']],text=True)==r['text'],r['path']
def replace(p,a,b):
 assert texts[p].count(a)==1,(p,a);texts[p]=texts[p].replace(a,b);edits[p].append({'before':a,'after':b,'count':1})
p=paths[0]
ranges=[('/** 只读取声明的自身数据属性','function positiveInteger'),('function positiveInteger','function positiveOrNull'),('function rows','function nullableTarget'),('export function projectWhiteWolfKingState','export function projectKnightState'),('export function projectKnightState','export function projectIdiotState'),('export function projectIdiotState','export function projectDreamerState'),('export function projectBearState','export function projectSeerState')]
for a,b in ranges:
 start=texts[p].index(a);end=texts[p].index(b,start);replace(p,texts[p][start:end],'')
for t in ['PlayerWhiteWolfKingState','PlayerKnightState','PlayerIdiotState','PlayerBearState']:replace(p,'  '+t+',\n','')
replace(p,'import type { DeathGunReadView }','import { playerDataField, positiveInteger, rows } from "./player-state-data";\nimport type { DeathGunReadView }')
p=paths[1]
for t in ['projectWhiteWolfKingState','projectKnightState','projectIdiotState','projectBearState']:replace(p,'  '+t+',\n','')
for getter,projector in [('getWhiteWolfKingState','projectWhiteWolfKingState'),('getKnightState','projectKnightState'),('getIdiotState','projectIdiotState'),('getBearState','projectBearState'),('getGravekeeperState','projectGravekeeperState')]:
 if getter=='getGravekeeperState':replace(p,'import { getGravekeeperState }','import { projectGravekeeperState }')
 else:replace(p,'import { '+getter+' }','import { '+getter+', '+projector+' }')
replace(p,'  readGravekeeperReport,\n','')
a='''    const history = getGravekeeperState(role)?.history;
    ownState.gravekeeper = {
      history: Array.isArray(history)
        ? history.flatMap((item) => {
            const report = readGravekeeperReport(item);
            return report ? [report] : [];
          })
        : [],
    };'''
replace(p,a,'    ownState.gravekeeper = projectGravekeeperState(role);')
p=paths[2];replace(p,'  projectBearState,\n','');anchor='import { expect, test } from "bun:test";';replace(p,anchor,anchor+'\nimport { projectBearState } from "../../../src/game/mechanisms/roles/bear/ports";')
for p in paths[3:]:replace(p,'from "../player_state"','from "../player-state-data"')
for p,t in texts.items():assert pathlib.Path(p).read_text()==old[p];pathlib.Path(p).write_text(t)
# 后继实际Git是共享接线前的来源；旧16源逐字仍存在该Git，原4e0d捕获保留。
expanded={'baseCommit':base,'firstCaptureBaseCommit':prior['baseCommit'],'source':prior['source']+[{'path':p,'sha256':sha(t),'text':t} for p,t in old.items()],'controls':prior['controls'],'limits':['原16族内稿来自4e0d，逐字证实同在后继实际Git；六共享稿此刻来自后继Git，不覆盖原采样。']}
(g/(pre+'-before-expanded.json')).write_text(json.dumps(expanded,ensure_ascii=False,indent=2)+'\n')
(g/(pre+'-root-edits.json')).write_text(json.dumps({'baseCommit':base,'source':edits,'newHelper':{'path':'backend/src/game/mechanisms/roles/player-state-data.ts','sha256':sha(pathlib.Path('backend/src/game/mechanisms/roles/player-state-data.ts').read_text())}},ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'baseCommit':base,'oldPrograms':len(expanded['source']),'rootOldPaths':len(paths),'rootNewPaths':1,'exactEdits':sum(len(v) for v in edits.values())}))
