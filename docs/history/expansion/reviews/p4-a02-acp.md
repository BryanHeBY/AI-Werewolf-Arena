# P4 A02 ACP 会话与物理资源交叉审查

日期：2026-10-08。接续 SDK 子批，交付 ACP session/control/process/audit 所有权；混合装配与 runner 多错误收尾继续下一笔。[资源契约与 API 兼容](../runtime-resources.md)。

## 三路修正

- **A（资源/错误）**：发现 cancel 的 settleWithin 吞掉真实拒绝。ProcessSession.cancel 改为有界等待保留原错；provider 保留合法选择，将 cancel 原错误交 pool，强制 discard 后由最终 close 汇总。常规取消超时触发强制回收，回收失败仍报告。随后发现全回合与局部取消计时器同截止时错误类型不同，导致正常超时有时被误判清理错误；统一 owner 的 TurnDeadlineElapsed，12次同截止与局部先超时回归通过。强制信号可以到达正在 closing 的进程，已经回收后不再重复发送。审计自身晚到/清理错误有独立回归。最终 0 阻断。
- **R（权限/记录）**：发现 takeAuditTrace 同步关闭后私有 round 仍可写入丢弃的动作。trace、fallback trace、记录入口/自定义提示回调后与最终调用前补 closed guard。原独立 probe 现在公有 null、关闭后记录0、所有逻辑 owner0。namespace 不入玩家/记录；同 actor 并发与迟到动作/报告拒绝；即时 Baseline 例外沿用 SDK 冻结语义。最终 0 阻断。
- **L（语言/兼容/审计）**：发现 promptTask 拒绝转 null 后丢失原 prompt 错误，遇到 close 错误只返回后者。现在保存首个 prompt 原错；单独运行失败仍返回 null，双错误聚合保原实例，晚到拒绝不覆盖取消。wire/internal key、短 tN、任务 locale/env/权限、DTO/Tape/错误诊断均核对；文档说明严格 cleanup throw、alias 与非合作创建限制。最终代码、文字与兼容复查均为 0 阻断。

实现均由主代理完成，子代理只读审查。A 独立取消/审计12测试53断言与新增同截止1测试39断言；R 独立12测试51断言及旧记录竞态/并发/截止/请求不变 probe；L 独立审计双错误 identity probe 闭环。

## 主代理证据

- 最终后端 release：**371 测试通过、0 失败**；type、deps/import boundary、i18n scan、所有测试与 smoke。`/tmp/awa-p4-a02-acp-release-final.log`。
- 最后错误归属专项：24测试/140断言；12个同截止分支与局部取消先超时、慢 fallback、原错/双错及SDK回归。`/tmp/awa-p4-a02-acp-final-race.log`。
- 实际物理专项18测试/236断言：同 wire ID 的两个玩家在中英实际 ACP/MCP 独立行动与复用；初始化挂起与 stubborn prompt 进程组回收；agent/MCP/nested PID ESRCH、控制面端口失联，以及真实双语审计通路。`/tmp/awa-p4-a02-acp-physical.log`。这些路径随最终release重新运行。
- 既有18个实际双语 SDK/ACP 整局与严格 Tape 重放、两板各25固定seed受限模拟回归均通过。前端/视频契约未改变，沿用P3门槛。
- `git diff --check` 通过。所有服务、进程与凭据为隔离本地合成fixture，没有访问外部模型或私有认证。

关闭失败仍尝试后续清理并保留错误，不靠逻辑零计数假称释放。不配合取消的自定义 factory 超过清理预算时明确报未完成、creating 可非零；晚到回收仍由原 owner 处理。内置 ProcessClient 的物理资源有上述证据。当前批不宣称 A02/P4 或角色扩展已全部完成。
