# C37 完整 checkpoint 形成链的贡献所有权

基线 Git `927c650e`，真正入口仍 `backend/src/runtime/simulation/reproduction_context.ts`。7 路径及摘要见 [固定证据](generated/checkpoint-contributions-evidence.json)，工作区其它 PhaseRevision、Clock、Beauty 改动不在本批。

## 实际职责与执行消费者

1. `authority-snapshots.ts`：完整原 Animal起始authority快照/可用性拒绝，以及原 Animal→Fragrant→Noble schema编码与三录制游标贡献。保留原重复isBoard、authority读取、schema.parse method lookup与 mandatory失败序。
2. `identity-setups.ts`：原 Wedding→LonelyGirl→Thief→Shapeshifter四次setup查询，返回原对象引用；归档presence字段仍LonelyGirl→Wedding→Thief→Shapeshifter。
3. `animal-audit.ts`：原完整own descriptor/key名单检查、undefined省略、snapshotPlainData encoder；不新设Proxy／shape／序列化政策。
4. `player-snapshots.ts`：原整个玩家形成表达式，Demon替代优先→Animal原审计名单／身份、婚约与孤女审计覆盖→普通fallback。所有Role/camp/alive/privateState/WallNote/debate/Lovers/victory/vote/badge/marks属性与读取序留原位；Animal/Fragrant专用checkpoint与普通structuredClone不可互换。
5. `contributions.ts`：明确固定 assembly；先原Animal审计准备，再四setup查询；权威schema/counter与setup字段在原capture return前半部，players仍在原failure字段之后调用。没有动态registry、能力上下文、第二World或mirrored状态store。
6. `captureCheckpoint`原导出/API位置不变，所有已有实际runner/simulation/replay与checkpoint消费者同笔得到新有序贡献；currentEngineVersion与beginGameReproduction整函数执行程序不改。不新建空recording/context门面。

## 接受、引用、失败与归档

本批无行为／schema政策加强。既有schema2/未知customprivateState/JSON/native structuredClone/原体descriptor守卫/recordedErrorName/失败传播程序完整保留。snapshot参数仍原同对象；机制已生成setup/Animal快照引用不新freeze/clone；原player复制仅原位置原策略。seq/cursor查询与事件读取时点不变。独立verifier不导入写方贡献，15个实际schema/authority/copier控制文件原Git bytes同；另Noble authority并行NightUnit作者有新import/开启/expiry变更，不在本scope，两个实际checkpoint/query函数原完整字节同 (`controls-proof.json`)。

`sourceHash`自动覆盖新recording/checkpoint TS目录，严格旧构建拒绝政策未改，不生成golden或改版本字段。本批完成当前整个capture形成链职责迁移，不声称全55角色schema/codec或独立verifier装配已经完成（这些为后续阶段）。

## 有限证明与实际终态

- `originals.json` 对actualGit927全文/hash同。
- `program-proof-final.json`：新assembly两个完整body符合固定手写调用/参数顺序；五leaf module顶层仅导入/导出/函数声明无新增IO/field初始化；新实际players表达式与原完整players表达式same；将五实际完整贡献inline回原入口，整个源非import执行程序 ESNext/CJS都同。原有意义bindings保其同目标/alias/typeOnly（未用AliveComponent删除、World type改directCanonical路线单列）。
- 首`program-proof-first.json`的两个red为harness把hoisted原audit helper插到currentEngineVersion之后以及打印return表达式多一层括号；`first-{original,inverse}.ESNext.js`保留，最后仅校正该旧helper位置与新return外层一对括号，不忽略数组/字段、生产代码未改。
- `headers.json`7个中文实际责任头0violations。
- 新unit首轮Animal审计case1pass/4assert，另外3case因作者误用新fixtureVictoryAffiliation string失败；第二拟camp也非法，进一步修正为契约真实`{kind:'faction',faction:'good'}`。生产未因fixture红改动，原首/二日志保留。
- 新其余3case最后仅重这3：3pass/0fail/13assert (`tests-fixed-fixture-final.log`)。验证keys/order/snapshotRef/普通customstate clone、组件重复reads、完整失败cause与clone时点。与首Animal audit1case分别合为新4，未宣单次全4绿。
- 原未改Animal bootstrap CP0 parse接受 + Demon actual badge transfer/destruction完整/失败原metadata：2pass/0fail/8assert (`original-bounded.log`)，无phase/game/model。
- finite最后同完整所列根 TS project session42285 **actualclosedexit0** (`types-final-second.log`)；两个之前编译项目红均只新增fixtureaffiliation错误，source贡献无type诊断。
- 两个fresh进程直接cold旧Context（actualGit原文件仅module import rebase）/新真实Context：均success，同3exports；`cold-{baseline,current}.json`。未调用fingerprint I/O或运行完整游戏。

Root 与独立审查核对固定七路径，当前无阻断；不包含其它 phase/time 源。
