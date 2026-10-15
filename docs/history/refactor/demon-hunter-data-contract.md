# 猎魔人纯数据契约收敛

## 范围

基线为实际 Git `2f5d94e5404067d7b3b8a9ce93cc8bebd31a643f`。四个生产文件及一个编译期单元构成本批独占范围：

- 公共 `facts/demon-hunter.ts`：新增原 `DemonHunterChoice`，复用原 `DemonHunterState` 和 `DemonHuntTool`。
- 后端 `demon_hunter/state.ts`：退出三个数据类型出口，直接消费公共类型，所有运行实现保留。
- `demon_hunter/authority.ts`：仅将原两个 named type imports 改指公共契约。
- `player-observation.ts`：仅将 `demonHunter` 一条 inline type 来源改指公共契约。
- `tests/unit/contracts/demon-hunter-data.types.ts`：只编译，不执行函数。

原状态和工具在后端／公共事实叶重复定义且形状相同，本批退休两份后端重复接口；选择行原由后端声明，迁入同一公共 owner。因此是一个声明迁移与两个重复退出。没有新增 subpath、依赖、运行常量、状态槽或 schema。包声明、锁及包根源码原字节保持；既有根 `export *` 自然公开新增 Choice type，旧后端三 type 入口明确退休。

## 保持的边界

三种结构的原可写、nullable、字面政策及工具字段完全保留。公共状态仍只有原 policy／history；它不附 World、原体、目标阵营、租约或资源权威。数据合法不授予行动、生命或库存权限。

公共事实 reader 的键、日期／历史限额、脱离复制、拒绝与返回算法原样。后端 Node snapshot、Proxy／descriptor 拒绝、factory、同引用槽查询与工具 reader 原样。authority 的原生命、请求、付款、封存、审计及阶段算法没有改动；观察消费者未获得额外私态字段。

全形式 AST 核对包含 1754 个选定 JS／TS 文件。原私有纯类型外部消费为 authority 两个 named imports 和 Observation 一条 inline 引用；现在三种数据声明只在公共事实叶。旧后端类型引用仅存在新编译期单元的三个明确拒绝反例；运行 import、原 alias 与 callee 不变。

## 有界证明

四个完整程序中，除三个明示 interface、import/export 及 Observation 一条类型来源精确逆之外，23176 个完整节点一致。值 import 逐 binding 保留。完整 ESNext／CommonJS 八份实际原始运行输出相同，未遮蔽函数、数组、回调、条件或机器字面。

首份证明保留了 Observation 有意变化的 ImportType 来源，产生一个 typed mismatch；八份运行输出当时已经相同。修正仅发生在 checker 的这一个精确逆，不改产品源；首报告保留。新公共三声明与原后端完整声明逐子树一致；原公共 State 的 inline history 行改用同形 Choice 数组，由独立类型预期检查。

有限五根类型检查一次实际退出 0（session 57078，完成 chunk 9678b2）。单元包括三个精确形状、Observation 原形状、六个双向赋值、三个旧出口拒绝和三个私态／权威字段拒绝；原字段可写与 nullable 有正例，旧类型负例实际用于 tuple。未执行此单元函数或旧 suite。

真实中文职责检查五份 TS、435 个已跟踪文档路径、诊断 0。独立审查后，仅三份首头按实际 Catalog／现行规则卡将旧中文角色名准确改为“猎魔人”；首头其余和整个执行／类型正文原字节保持，原类型、运行与职责回执未重跑。公共事实叶原英文头及自身选择的关键裁字段说明已中文化，明确数据、知识与权限的区别。原 Role／World 运行职责不转入共享包。

## 交付与限制

[冻结范围](generated/demon-hunter-data-contract-scope-final.json) 与[持久证据](generated/demon-hunter-data-contract-evidence.json) 保存实际 Git before、完整程序／绑定、首证明失配、类型收据、中文检查和 source SHA；独立交叉审查由 Root 汇合后提交。

本批不改 TimeConsort 的历史 `<= day` 与触发知识 `trigger < day`，不迁其他家族或运行投影。并行 O3／O4 与身份类型任务不属于本五源，也未证明其完整依赖图恒定。当前来源指纹会因类型归属、路径及中文注释变化；历史身份保留，不承诺旧严格 Tape 跨构建兼容。没有全量门禁、整局、模型或网络调用。
