# 行动选择与领域完成

## C19 的职责落点

`player/action-turn.ts` 直接持有既有 `ActionTurn`、`ActionReceipt` 与验证结果类型。SDK 工具循环和 ACP turn registry 直接导入这个唯一 owner；`ActionReception` 保留 schema、repair、合法性预检与具名兼容出口。

成功工具回执仍为 `accepted: true, applied: false`：这表示本次行动被选中，领域库存和效果尚未提交。错误 turn ID、session、deadline、三次非法行动及关闭的判断顺序不变。

## 完成端口

`ReproductionTrace.decide` 是生产中既有唯一的 delivery assertion 和 deferred completion 消费者；runner 已在真实 provider 外装配它。回调顺序仍为等待 provider、复制 action、检查原请求、登记同 scope 的待完成回执、返回 action。没有新增订阅或等待领域提交。

实际角色 commit/close 持有 `settleRequestDelivery`，提交或终止后才结束 reproduction decision。没有 completion 的原请求保留立即结束决策记录的行为。SDK/ACP 的玩家轮次记录保留行动选择证据和原时间戳，没有将其改为领域提交回执。

LLM/ACP 不能再登记同一 scope 的待完成回调，也不能等待领域 commit 后才返回 action，否则与引擎等待 provider 的路径互相阻塞。预检通过不触发 stock、事实或 settlement 写入。

## 证据与后续

ActionTurn 原类正文、回执类型、两个传输 consumer 与 reproduction 的非 import 程序保持。原类在两种模块格式下 type erase 后相同；Root 独立核对两个原类全文。九项原预检/trace 用例、60 次断言通过，backend 源码类型检查通过。没有重复全量测试。

旧 ActionReception 的 ActionTurn/receipt 具名出口登记在 bridges，C44 按剩余消费者清单退出。各 feature scope 的预检接线与复杂机制 state/lease 迁移继续按后续矩阵进行。
