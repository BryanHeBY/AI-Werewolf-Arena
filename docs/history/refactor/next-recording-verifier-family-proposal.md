# 剩余归档验证器整族迁移方案

## 实际剩余与共同约束

只读盘点时当前 Git 为 `874030190c7b26980c1f82fe9a638caad3be99c6`；前批三验证器与 assembly 仍有候选层，实施 before 必须等待其真实提交再捕获。

此前 19 个纯 verifier／helper 叶减去已迁候选三叶，当前 recording 实际剩 **16 叶：8 个完整核验器、8 个 helper**。RedMoon 是 Demon 的真实嵌套完整核验器；assembly 直接调用其它七个。建议按两个完整边界收完16叶，不为每个 helper 单独跑装配测试。

所有完整算法、内部 helper、错误／字段／政策／接受面、原测试 title／输入／断言保持；只有物理路线与有效中文说明。记录类型仍 type-only 指向 recording/reproduction。三共享 checkpoint schema 以及 Trace、真实 checkpoint／Session／IO 写方不搬。历史 proof 与 fingerprint 不扫改。

## A：归档可见历史与请求证据完整家族（21 路径）

八个完整迁移叶（旧删除＋新增加共16路径）：

| recording 原叶 | verification/reproduction 新 owner |
| --- | --- |
| animal_dream_record.ts | animal-dream/validate.ts |
| animal_dream_feed_record.ts | animal-dream/feed-evidence.ts |
| fragrant_pair_seer_record.ts | fragrant-pair-seer/validate.ts |
| fragrant_pair_seer_feed_record.ts | fragrant-pair-seer/feed-evidence.ts |
| mist_raven_record.ts | mist-raven/validate.ts |
| mist_raven_requests.ts | mist-raven/requests.ts |
| mist_raven_feed_record.ts | mist-raven/feed-evidence.ts |
| mist_raven_sheriff_record.ts | mist-raven/sheriff-evidence.ts |

完整 **5,060 行**（三 verifier 与五 helper）。另5个实际消费源只改路线：

- `backend/src/verification/reproduction/assembly.ts`
- `backend/src/recording/noble_secret_body_record.ts`
- `backend/src/recording/radiant_eclipse_record.ts`
- `backend/tests/scenarios/boards/mist-raven/reproduction.test.ts`
- `backend/tests/scenarios/reproduction/mist-raven/incremental-settlement-forgery.test.ts`

互依赖：动物／寻香各自 feed 整体跟随本族；Mist root→requests／feed／sheriff，feed→requests／sheriff，sheriff→requests 的 `check`／`equal`。同一警长证据还被寻香、贵族、光蚀实际消费，所以贵族／光蚀原叶须本批精准接线，后批再整体搬；不复制或抽象成泛型 VoteEngine。当前只有 Mist 两个场景直接导入 verifier，其它本族场景通过既有装配运行，无需强加新直接消费。

中文说明按实际 publication cursor／incremental settlement／私人受众与独立请求重建核实：只算归档可见前缀，不授权 live audience；feed 副本不能被说明成原事件可写许可。动物头补真实输入／输出／边界，两个 English feed head 与 oracle 说明准确中文化；Mist 全体保原最低ID intent／逐轮警长／请求截止证据顺序，不堆模板说明。

## B：婚约、贵族／恶魔及光蚀原生因果核验（18 路径）

另八个完整迁移叶（旧删除＋新增加共16路径）：

| recording 原叶 | verification/reproduction 新 owner |
| --- | --- |
| ghost_bride_record.ts | ghost-bride/validate.ts |
| noble_secret_body_record.ts | noble-secret-body/validate.ts |
| demon_hunter_record.ts | demon-hunter/validate.ts |
| demon_hunter_stocks.ts | demon-hunter/native-stocks.ts |
| red_moon_record.ts | red-moon/validate.ts |
| radiant_eclipse_record.ts | radiant-eclipse/validate.ts |
| radiant_eclipse_requests.ts | radiant-eclipse/requests.ts |
| radiant_eclipse_night_requests.ts | radiant-eclipse/night-request-prefix.ts |

完整 **4,778 行**。另2个真实消费者只改路线：

- `backend/src/verification/reproduction/assembly.ts`
- `backend/tests/unit/recording/red-moon-record.test.ts`

互依赖：assembly 仍先取得 Noble audit，同一引用原点交给 Demon；Demon 原顺序调用 RedMoon／nativeStocks，stocks 原 type-only 消费 Noble／RedMoon audit。不能拆散为另一个通用 stock verifier 或变成原生运行算法。

Radiant root→requests→nightRequests 和 requests／nightRequests→root 是现有运行值依赖环，整体迁移并保持原顶层声明／底部 import 次序；不借迁移修冷初始化或重排执行。其 sheriff evidence 使用 A 的同一实体。婚约的关系／原生库存／发表前缀保持完整，无模型或 World。Ghost／Noble／Demon／Radiant board 场景当前未直接 import 本叶，不假装这些场景需改路线。

中文重点：Radiant 两 request 叶 English head／函数说明及缺首头，按序独立 request prefix、unfinished predecessor 不能开后继的实际算法翻译；Demon 角色名与反射／取消标签说明仅按真实归档语义审，不修改产品字典／machine IDs。错误和历史 fingerprint 保留。

## 最少验证与冻结

每批以实际前批功能 commit 捕获全部原源字节；独立核新叶完整本体、精确所有 route／comment 逆、全 AST／raw literals 和各完整 ESNext/CJS 输出、实际 import／reexport／动态字面消费与声明端点。A 13个现行 root、B 10个现行 root 各一次有限类型／实际职责与中文首头检查。每个旧叶显式保存原 SHA 与 expectedAbsent；不将删除路径要求为存在。

两批不新增动作、不重复此前已绿 assembly getter／parser，不跑 Tape／整局／旧全场景或全门禁。若实际完整对照发现新调用或拒绝风险，先报告具体证据，再决定一例必要原测试；不默认逐族重跑。原 Radiant 值环单列有限图／初始化路径边界，不宣称新路径与历史模块反射全等价。

全仓当前字面模块／函数查询未发现 namespace／export桥／dynamic字面／package入口；任意 computed 路径不作穷尽声明。两批合计移16叶，assembly各批一处受控源，遵照 Root 功能提交，不修改 progress。
