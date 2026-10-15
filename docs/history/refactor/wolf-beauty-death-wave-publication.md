# 狼美人死亡波贡献

## 本批职责

本批对应 C28，真实基线为 `354c935c3df0a784d8644bee53b0ec481e9a6934`。只改死亡结算器、本族端口、新贡献 owner 和一个新单元测试，共 4 个源码路径。

`WolfBeautyDeathWavePublication.prepare` 拥有原完整牵连准备：建立原领取列表，逐 proposal 尝试来源许可／关系领取，晚查夜梦保护，发布阻断事实或保留原 binding／receipt，再原地追加死亡目标、Charm 原因和夜间目标。`publish` 拥有目标实际标死之后的原应用提交及 `charm_death` 发布。

`relation.ts` 仍唯一持有绑定、原体资格与 `resolved/applied`；原 state、death hook 和已存在的精准测试均保持完整字节。结算器保有提案波、生命标死、枪、遗言、其他关系、事件关联、许可关闭和波次，阶段与胜负仍由原引擎负责。

## 原顺序与失败前缀

准备保持原 `result.charmLinks ?? []` 迭代及每个 `binding` 读取。先尝试原来源政策；不合格时不读 World 或保护。关系领取发生在梦阻断之前，因此阻断／保护或事件读取抛错仍保留已消费关系。

保护仍按 `proposal.nightEffect` 短路，原 `nightEffects.dreams`、方法 callee、World 和参数依次晚读取，保留原 receiver。阻断事件仍先取得 `events.push` callee，再求值时钟与原 payload。通过后领取列表、提案去重、死因 Set 和夜间目标写入顺序不变。

本族准备仍先于后续梦关系、婚约、情侣扩张和实际 mark。标死后的应用发布仍在原枪事件、必要关系／继承与可见追加死亡事实之后，梦记录及许可关闭之前。`commitCharmDeath` 原校验确认 applied 后才发布；发布失败不退款或清除 applied。原 finally 不迁移。

调用双方使用同一组 `proposed`、`proposedSources`、`nightTargets`、`allSources`、原猎人枪目标、`seen`、`nightEffects` 以及相同 binding／receipt 引用。不增加关系库存、schema、付款、时钟缓存或异步边界。

## 首个新增依赖环与实际修正

初稿新 owner 直接值导入 relation，同时经原角色端口公开 class，实际静态图发现：

```text
new owner → relation → role-catalog-assembly
          → native-role-presentation-capture → wolf_beauty/ports → new owner
```

该首失败保存在[初稿图](generated/wolf-beauty-death-wave-module-graph-first-cycle.json)，没有被覆盖为绿。

修正后 owner 只 type-import 原命令类型。结算器运行端口包含两个只读、延迟命令 getter，每次原 callee 点返回同一原 live binding；owner 先取得局部命令再裸调用，保持 callee 求值先于参数，且不跨 proposal 缓存。完整业务段仍在本族 owner，没有换成转发包装或放宽门禁。

最终 [49 模块有界值依赖图](generated/wolf-beauty-death-wave-module-graph.json) 中，new owner 只有公共契约根的值依赖，无返回自身／死亡结算器的路径，也无 AI。原 relation／catalog／capture／ports 的历史环不声称本批全消除；此图也不证明计算型导入、全仓冷启动或二进制初始化等价。

运行端口是可信同进程接线。readonly 只约束字段赋值，不冻结 World、事件数组或命令；命令、binding、opaque receipt 不是 JSON、玩家知识或新权限屏障，不进入归档。生产装配始终返回原 relation 命令。

## 完整证明与有限验证

[证据](generated/wolf-beauty-death-wave-evidence.json)、[真实 before](generated/wolf-beauty-death-wave-before.json)、[完整程序证明](generated/wolf-beauty-death-wave-source-proof.json)、[最终 SHA](generated/wolf-beauty-death-wave-scope-final.json) 可持久复核。

- 6 个原文件捕获时工作字节与真实 Git 相同；其中 relation、state、hook、原精准测试 4 个控制完整字节仍相同。
- 当前完整准备 185 个 AST 节点、发布 60 个节点，精确逆 getter 路径、原列表类型及两个 late 命令局部接线后，完整原段／全部非注释叶保持。
- 用当前实际 owner 展开两个调用点，明确核对两个裸 callee 位置及四个 getter，然后只还原新增 instance 字段和已验证 imports；完整结算器 5,006 节点及两份 ESNext／CommonJS 原始打印结果相同，没有用旧主体替代新 owner。
- 10 个实际命名绑定与类型端点保原物理 owner；端口旧绑定与顺序保持，只新增 class 与运行关联类型。
- 4 个职责头及中文头真实检查零诊断，输入文档路径为当时已跟踪且存在的 450 项。

[真实收据](generated/wolf-beauty-death-wave-receipts.json) 按执行阶段区分：

| 执行 | 结果与范围 |
| --- | --- |
| 首次新增 3 case | 3 通过／0 失败／29 断言；初稿直接 relation 接线 |
| 原真实 hook／DR 魅惑死亡精准 case | 1 通过／0 失败／7 断言；5 项过滤，旧源码未改 |
| 命令接线增量 | 只重复新增 3 case 中的阻断失败 1 项，1 通过／0 失败／14 断言；增加 late getter／裸 receiver 字面断言，另 2 项过滤 |
| 初稿有限类型 | 4 roots，实际 session `55600` 终止 `c6e378`，退出 0 |
| 闭环命令增量类型 | 仅改动的 DR 与新测试 2 roots，传递覆盖新 owner／ports；session `22070` 终止 `2d2a36`，退出 0 |

新增独立 case 始终为 3，不把重复执行的一项算作第 4 个新增 case；加上原精准 case，本批共 4 个独立 case。最终源码新增断言站点为 30，既有精准 case 为 7；执行断言之和 50 不当成独立 50 断言或最终新增三例重跑收据。首 dependency 环真实失败与后续修正分开记录。

原算法、绑定和容器前缀由完整最终源码证明覆盖；没有重复已绿整套、整局、模型、网络或全量门禁。一次增量执行重定向用了错误 cwd，发生在 Bun 启动之前；只修工具路径，未当成业务失败或伪造日志。

## 明确 API 差异与后续

新 class、运行关联类型和结算器新增自有实例字段改变内部／公共 API 形状。模块加载路线、局部接线及错误调用栈有意变化，不承诺任意反射、外部 monkey patch 或整构建二进制相同。

新路径、注释和模块接线进入新来源指纹；历史固定指纹保持，不新增跨构建复现豁免。本批只是完整狼美人死亡波切片，关系胜利、其他具体死亡资格和全 C28／P9 验收继续。

独立源审完成后按功能提交，避免混入并行 Noble、Mist 或其他死亡结算切片。
