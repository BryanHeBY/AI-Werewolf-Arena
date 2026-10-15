# 模块与依赖的实际归属

## 目录表达已存在的职责

| 位置                               | 拥有                                                   | 不拥有                                                |
| ---------------------------------- | ------------------------------------------------------ | ----------------------------------------------------- |
| `backend/src/app`                  | 配置入口、装配、运行用例、会话生命周期                 | 角色规则或第二份状态                                  |
| `domain`                           | World／组件、原体引用、运行许可与明确提交数据          | UI、Agent、具体机制算法                               |
| `engine`                           | 阶段推进、动作接收、死亡波次、必要检查点和唯一终局提交 | 根据角色 ID 重写族内规则                              |
| `features/<feature>`               | 一个或多个角色的完整状态、请求、生命周期、效果与贡献   | 另建 World 或全角色分派器                             |
| `rulesets`                         | 有限组合、顺序、政策、闭包与真实装配                   | 另一份档案验证算法                                    |
| `agents`                           | 受限观察、提示、候选决策、回合协调                     | 真身份／完整God状态的隐式读取                         |
| `recording/session`                | 一局记录、刷盘、关闭和聚合                             | 领域付款、胜负重算                                    |
| `recording/reproduction`           | 严格格式、Trace、纯 checkpoint 格式／审计及来源身份    | 直接读取 World 的现场捕获装配、用公开回放替代精确执行 |
| `app/checkpoint`                   | 现场 World／机制查询的五个 checkpoint 捕获与装配 owner | 重新推导规则、拥有第二份状态、承担独立归档校验        |
| `recording/verification/<feature>` | 独立档案算术及因果校验                                 | 导入生产结算作oracle                                  |
| `adapters`                         | LLM、ACP、文件系统、终端的外部边界                     | 更改领域授权或恢复关闭的回合                          |
| `packages`                         | 明确的纯数据、语言、展示、目录与归档公共契约           | 反导backend运行owner                                  |

这不是允许所有同层互导的名单。跨族只消费实际公开端口；私有 state／frame／authority 的形状相似不等于共同不变量。

## 单一运行模块与公开面

World、枚举、class、WeakMap、默认 Catalog 和 RequestDelivery 都必须只有一个物理所有者。移动源码后不能保留旧实现副本；兼容 package key 若保留，只能指同一物理叶，不能制造第二份状态。根出口只保约定名字、类型与原条款顺序，不能用 star 让额外内部声明成为公共 API。

普通夜能力整体在 `features/night-abilities`；死亡枪整体在 `features/death-actions`。严格 `domain/original-player-scope.ts` 与较宽 `domain/original-participant.ts` 保独立接受规则，不能只因名字相近合并。

Catalog／contracts／assembly／builtin 同在 `rulesets/roles`，保原 lazy require 和默认实例。其真实 Catalog→observation late binding 是已知存在的边，不因改目录便宣称中立或结构完美；若新结构检查指出具体问题，再单独修真实 owner，不搭转发壳。

## 依赖检查

检查器必须识别 engine／features／agents／recording/verification 的真实位置，保原禁止依赖，不能让旧 game 目录退休后检查空跑。旧 synthetic 输入和历史路径仍有明确测试作用。旧 deep import 退休、模块名／缓存／堆栈及 sourceHash 改变应明示；不承诺未知外部消费者无影响。

## 现场 checkpoint 的实际归属

现场 World 和机制状态的捕获由 `app/checkpoint` 拥有，实际入口如下：

| 完整 owner               | 当前落点                                                                                                       |
| ------------------------ | -------------------------------------------------------------------------------------------------------------- |
| `contributions.ts`       | [`backend/src/app/checkpoint/contributions.ts`](../../backend/src/app/checkpoint/contributions.ts)             |
| `authority-snapshots.ts` | [`backend/src/app/checkpoint/authority-snapshots.ts`](../../backend/src/app/checkpoint/authority-snapshots.ts) |
| `identity-setups.ts`     | [`backend/src/app/checkpoint/identity-setups.ts`](../../backend/src/app/checkpoint/identity-setups.ts)         |
| `player-snapshots.ts`    | [`backend/src/app/checkpoint/player-snapshots.ts`](../../backend/src/app/checkpoint/player-snapshots.ts)       |
| `private-state-codec.ts` | [`backend/src/app/checkpoint/private-state-codec.ts`](../../backend/src/app/checkpoint/private-state-codec.ts) |

纯 animal-format、player-format、animal-audit、noble-body-format、fragrant-pair-format 五叶仍在 `recording/reproduction/checkpoint`，独立 verifier 仍在录制校验层。现场读取与纯格式的职责已分开；纯格式模块不反向取得现场状态写权。
