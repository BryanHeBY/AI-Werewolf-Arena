# C31：阶段修订号的唯一所有者

原 `PhaseManager.phaseRevision` 数值归入同一执行实例的 `PhaseRevisionClock`。经理在原两个 `++` 时点调用 advance，夜晚、白天、投票三处捕获与比较均读取同一 owner；没有第二份 World 状态、时间服务或外部 snapshot 字段。

原正常 setPhase 先写阶段，同标签直接返回；真实标签变化才推进修订、关闭死亡窗口并发布事件。debug jumpTo 仍先推进：同阶段推进一次，不产生新 phase_changed；不同阶段推进两次。关闭失败保留此前阶段写入与修订，尚未发布新事件。真实业务日次、开夜、放逐与死亡波单位各自保持原所有者，此批不把修订号当 Night／Exile ID。

## 有限验收

新三个用例验证同阶段 debug、不同阶段 debug 的关闭失败前缀，以及真实首个夜间请求等待中被同阶段 debug 撤销。最终 3 通过、14 assertions。首轮仅新测试错误忽略 bootstrap 的既有 Night/day1 事件，按手写原初始 payload 修正；生产代码未因测试结果变化。

有限严格项目 session 23269 已实际退出 0。完整原经理程序只反移新 owner、两个 advance 和三处捕获／比较后同原 Git `927c650e`；三个中文职责头无问题。固定摘要与独立审查见 [证据](generated/phase-revision-owner-evidence.json)。新增注释说明计时归属、正常与 debug 区别及失败边界。

## 后续范围

NightId／ExileUnitId 的真实创建、交接与到期消费者，以及与已交付 DeathWave 的来源关联继续。此批不宣称 C31 全部完成，不重复全量游戏、发现、浏览器、模型或网络。
