# 鬼魂新娘资源与参与者私态数据归属

本批基于实际 Git `a6468c7749b62c76848d7437568ef8749677b20f`，只改四源：原 profile、原 authority、新本族 state 数据 owner 和新专属单元。两旧源及五控制文件的完整 Git blob／mode／SHA／正文保存在 [before](generated/ghost-bride-state-owner-before.json)，捕获时与工作区逐字相同。并行杠精、寻香魅影／猎魔人批次不属于本批。

## 实际职责

新 [state.ts](../../backend/src/game/mechanisms/roles/ghost_bride/state.ts) 完整拥有 11 个原数据算法片段：初始化、可写 descriptor、参与者数据捕获、Proxy／字段描述符准备、原字段引用比较、安全审计接受、关闭资源、两字段选择付款、已提交 JSON 更新、失败审计刷新和失败私态投影。数据仍放在原 Binding／Participant 字段上，没有第二个 WeakMap、镜像库存或新类。

共享 GC 的 `freshGhostBrideState`、`readGhostBrideState`、schema 与 inert reader 不复制或改动；新 owner 使用原工厂，并具名导出同一 reader 绑定。authority 的通用 `data`／`snapshot`／`json` 完整保留，数据命令只在实际需要编码处调用其原函数。原 roster、生命／身份、World、婚约、Victory、turn／request／night、当前性和回执仍由 authority 拥有。

## 原读取及失败顺序

- 初始化仍先求 `role.privateState` 左值，再调用原工厂和写入。capture 先按原序读取四个组件、生命版本／descriptor、私态与 Victory JSON；当前参与者原字段检查成功后才依次 `Object.entries`、原 snapshot 和两个 JSON 字段。返回原参与者上的字段，新增临时片段对象只用于装配。
- 身份复验先拒原私态 Proxy、捕获 descriptors，再核 Role／privateState 原身份，之后比较键数／原引用，最后 Camp／Victory。JSON 相同不能代替原引用。
- `validBinding` 仍先编码当前参与者私态，再核身体／身份，通过后才更新该参与者的安全审计串。设置期额外要求原 expected JSON 相等；非设置期保留 nested 库存自然变化。前面参与者已经更新、后面参与者失败时，前缀不会撤销。
- 选择先冻结 pair，再写 `remaining = 0`、`groomId`，之后才 pair、两次 Victory、status、expected JSON。两次 `b.state` 和 expected 更新的两次 Map lookup 保留原点；后写失败不退款。
- 关闭先结算原回执并写 status／清 turn 等字段，再条件耗尽 remaining。失败审计仍先逐参与者复验；新娘只合成耗尽视图，其他参与者解码最近安全串，不写回或修复被替换的资源。

原 `weddingBrideState`／`weddingAuditPlayer` 守卫和公开签名保留，Observation／recording 无需改路由。有限 checker 读取的 `weddingAuditPlayer` 前后返回形状相同。profile 原未消费的 `weddingBrideState` import 删除；该单独删除的两份完整默认 TS 输出相同。

## 有限验证与真实阶段

| 项目 | 实际收据 |
| --- | --- |
| 新风险测试 | 首次 3 pass / 0 fail / 15 assertions：左值→工厂→存储、已付 remaining→groom 抛错、设置期／非设置期审计和晚 Map／编码。 |
| 原精准测试 | 首次 2 pass / 0 fail / 19 assertions，73 filtered；只运行 foreign getter／failed audit 与 setup 后原库存变化两个真实标题。 |
| 合计 | 两次运行、5 个不同用例、34 个成功断言；未重已绿行为用例。 |
| 类型 | 首四根仅新 unit 字面 matcher 1 个诊断；保持预期 `0`，仅 `as typeof remaining` 后只失败 unit 根终态 0。两完整 JS 输出相同，非重测运行。 |
| 职责头 | 当前四源、652 个真实 Git 文档路径；原 `checkComments` 0，中文首头缺失 0。 |
| 完整程序 | 两旧程序精确正逆：8728 typed nodes、9877 非注释语法叶、四完整逆向输出相同。 |
| 实际迁移体 | 11 对原真实数据体：384 typed nodes、457 非注释叶；22 完整 emitted tree／leaf 同，其中 16 raw 同、6 因手写包装排版 raw 不同。12 原函数完整保留另核。 |
| 原绑定 | 47 原命名绑定中 43 模式／最终声明端点保留，reader 1 处同端点改 route；两处 fresh 迁出与一处 unused specifier 明列。当前四根合计 73 命名绑定。七源码根 AST 共 1911 文件，当前七项目标数据写入均归新 state。 |

第一次新测试 command 前的 Python 注释准备因 backend cwd 路径错误中止且未写；随后 Bun 的真实 3/0/15 日志与最终状态保留，准备改从仓库根执行。类型、head 和程序证据分别保留自己的源 SHA 阶段，原新测试只比末 authority 中文头更早，unit 静态 cast 不影响已跑正文。

程序证明工具四次红均保留原脚本与输出：空删除逆定位、包装换行 raw、重复条件锚点、选错 audit 初始 guard。仅修工具或明确完整输出树比较，没有更改玩法迎合证明。绑定工具首轮未带真实有限 config 的 Node typeRoots，补使用该 config 后正常解析，不改变源。

## 范围与限制

新数据函数、模块组织、调用栈和 capture 临时对象分配实际变化，不承诺任意 prototype／CJS namespace 重绑或全冷加载等价。新 state 的运行依赖只有原 GC facts 与 Node util；没有 authority／World 回边、额外 schema、JSON 预编码、await、RNG、回滚或付款。

有限类型／绑定的传递依赖采样为当时当前工作区，不是完整固定 a646 树。七根库存明确为 `backend/src`、`backend/tests`、`frontend/src`、`frontend/tests`、`packages`、`tooling`、`backend/scripts`，不计 generated／dist／node_modules；写入判据只针对本族目标字段，不宣称覆盖任意反射字符串写。

此批改变真实源 SHA，不改历史档案身份；不是全玩法、全类型、全结构门禁或 P9 最终验收。完整收据和执行脚本见 [receipts](generated/ghost-bride-state-owner-receipts.json)、[proof](generated/ghost-bride-state-owner-proof.json)、[bindings](generated/ghost-bride-state-owner-bindings.json) 和 [heads](generated/ghost-bride-state-owner-heads.json)。

末同行中文精度仅收窄 capture 的校验阶段：当前参与者字段先验后捕获，完整 12 人／counts／deck 阵容验收在整 Map 捕获之后。首 proof／heads／bindings 收据和 SHA 保原阶段；单源完整非注释程序与两完整输出的 comment bridge 承接最终源，不重绿。
