# Noble / Secret Body 请求撤权修正

## C18a 独立行为切片

P0 在固定基线观察到七种恢复行为：原请求 context 字段、context 引用、工具 body、deadline 四类失配，以及已登记别名 context 引用、body、deadline 三类失配。原实现返回失效，但恢复字段会恢复原 scope。旧输入与旧预期保存在 `e8de6dc` 的 `refactor-characterization.test.ts`，不能将此修正并入 C18 的机械等价证明。

## 政策

| 输入或状态                                         | 新政策                                            | 写入及完成边界                     |
| -------------------------------------------------- | ------------------------------------------------- | ---------------------------------- |
| 原绑定请求或已登记别名 current 检查失败            | 永久关闭它们共享的既有 turn；字段恢复不能重新授权 | 只设置原 turn.closed               |
| 原 lease 失效或已接受别名的最早期限到期            | 共享 turn 永久失效                                | 保留原 current 检查顺序            |
| 未登记副本、不同 World、错误 scope/actor/phase/day | 仅拒绝此次输入                                    | 不关闭有效原 turn                  |
| 原请求有效时，拟建别名 context/body/期限非法       | 不建立别名，不缩短 shared deadline                | 不关闭有效原 turn                  |
| 非法工具/目标、错误 ACP session/turn ID            | 保留原拒绝及重试政策                              | 不把外来错误解释为原 envelope 失配 |

拟建别名仍先按原顺序检查 source；若 source 本身已失配，观察到的是原授权失效，仍应永久撤权。不得为了拒绝非法提案而跳过这个检查。

`closed` 不花费角色库存、不修改既有事实或效果、不自动 settlement，也不替换 scope。实际 commit、close、失败 delivery 继续拥有完成回执。已付款效果不回滚。其它角色的独立撤权规则保持，包括已有单调撤权的 Fragrant Pair 与 Animal Dream。

## 实现与验证

实现只改变 Noble `current`：按原顺序计算 eligible，false 时设置既有 turn.closed，再返回原布尔值。Node Proxy 入口、body/context/原体校验、最早期限计算和错误码保持。

七个原 mutation 输入保留，显式新期望验证恢复后仍失效且库存/authority 快照不变。新增两项分别验证真实最早期限过期后的不可恢复，以及三种非法拟建别名不会污染原 turn。原 foreign World/scope、非法目标、ACP 错误 session/turn ID 与 Animal 对照仍通过。

局部共 21 项、166 次断言通过；两项测试为根的真实依赖类型项目 840 个文件、零诊断。全量对局/传输合并到 P3 阶段门禁。修改进入原源码精确指纹，旧构建的严格 Tape 仍通过 sourceHash 不匹配明确拒绝；外部归档 shape 不变，没有改写旧 Tape 或 golden。
