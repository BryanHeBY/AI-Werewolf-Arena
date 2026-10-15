# C09：有限板子支持与独立归档检查

生产的 17 个完整板子谓词归 `backend/src/rulesets/support`，开局前的拒绝分派归 `rulesets/board-support`。严格 schema 只管字段形状，支持谓词负责完整牌组、政策组合和有限范围。原先首个拒绝的顺序不变。

归档核对有独立 owner：`verification/board-support`。它保留固定规则的原谓词，不调用生产判定或结算；14 个录制 verifier 改用这份独立实现。Demon 的 Red/Noble 组合、Magician 的 Sorcerer/Trickster 组合和 Order Prince 原归档 fallback 没有统一或缩窄。

两边作者互审，并由第三位代理检查集成。固定 `80ce15f` 算法正文保持；生产拒绝 dispatcher 的完整 4394 字符正文保持。40 个消费者或原测试的非 import 正文以及文案包 42 个 formatter 正文保持。

原 Demon Node 边界独立归 `node-board-support`：仍先用原 `snapshotPlainData`，fresh seen 集合、depth 0、array limit 256 和 `demon_hunter_data_invalid` 均保持，再进入纯谓词；任何失败返回 false。顶层、嵌套及 revoked Proxy 三个独立探针零 trap。规则检查不再反向导入角色实现。

文案包删除 17 个执行算法及对应出口；稳定政策标识仍具名转发契约。唯一前端 Scholar 支持测试迁到后端 unit/rulesets，29 个原展开 ID、字面牌组与动态用例表完整保留，默认后端 runner 继续发现。清单合计 4 次历史路径迁移、37 个原 ID。

必要类型：backend 源码和测试、frontend、game-contract、game-text 全部通过。选取配置支持、往返与 Node 状态入口七个原文件，138 项/321 断言通过；独立支持字面检查 7 项/105 断言及 Node 3 项/12 断言通过。全量游戏、通信与 Chromium 仍按大阶段集中执行，没有以局部检查替代最终验收。
