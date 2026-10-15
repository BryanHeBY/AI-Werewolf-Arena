# P4 A02 SDK 队列、预算与关闭基础交叉审查

日期：2026-10-08。仅交付 A02 的 SDK 子批，不宣称 ACP/mixed/runner 全部完成。[资源与预算契约](../runtime-resources.md)。

## 审查发现与修正

- **A（架构/资源/测试）**：发现合法异步 fallback 挂起时 close 无限等待。修正落在 FallbackActionPolicy 本身：原 absolute deadline、关闭 signal、awaitWithAbort、取消后无日志/录制、清 timer/listener、迟到 Promise 有处理。随后发现按诊断 request_timeout 吞掉外来 TimeoutError；改为策略自身的 FallbackDeadlineElapsed 或本 owner 的原关闭 reason。外来 Timeout/Abort 原异常单次传播。close 聚合仍在途真实错误，lease/turns 清零。
- **R（规则/动作）**：发现 request_ok 的同步观察回调关闭 provider 时，success finalization 仍可能返回动作。修正成功记录前后、runNative await 后及 public 完成边界的 closed 检查。独立旧 probe 现在返回 null，零新 fallback、零逻辑 owner。请求副本只收紧 deadline；没有提前应用资源、扩大业务授权或增加领域验证日志。
- **L（语言/数据/兼容）**：核对 signal 未进入玩家协议/DTO/Tape，snapshot 仅计数；旧 SDK run 的可选 signal 参数兼容，factory SDK close 真正关闭。要求文档明确 llmTimeoutMs 从每 attempt 改为整轮、即时本地 Baseline 与异步等待边界、snapshot 不等于任意外部资源回收证明，以及 ACP/mixed 后续范围。

所有实现与修正由主代理完成；审查为只读。A 先后独立测试 11/46、14/60，并验证新增错误归属/聚合 3/10；R 最终 budget/scheduler 18 测试/74 断言与关闭窗口 probe 通过。最终 A/R/L 复查均为 **0 剩余阻断**；A 另独立执行 success finalization 新回归1项/4断言及 fallback 同步关闭 probe，L 确认文档与源码一致。

## 主代理验收

- 最终后端 release：**352 通过、0 失败、12908 断言**；type、deps/boundary lint、受控 i18n 扫描、全部测试与 smoke。`/tmp/awa-p4-a02-sdk-release-final.log`。
- 专项：21 测试/103 断言，包括队列取消/超时/公平交接、同一 retry 预算、active+queued close、慢 fallback close 与迟到结果、外来异常、聚合及 success finalization 关闭。`/tmp/awa-p4-a02-budget-final.log`。
- 真实 SDK HTTP 挂起 Response 在 provider close 后触发服务器 stream cancel；实际 SDK/MCP 两语动作反馈仍完全一致。
- 既有 18 个双语 SDK/ACP 完整对局及各自严格 Tape 重放、两板各25seed受限观察模拟随完整release回归通过。前端/视频契约与文本未变，沿用 P3 门槛。
- `git diff --check` 通过。初次测试因 Bun rejects matcher 在取消前开始等待而挂起，断言顺序已修、对应本轮测试进程已明确回收；后续完整门槛正常退出。

逻辑 SDK owner、队列/lease 与真实 SDK HTTP 已验证；ACP 进程组/MCP/迟到 session、混合装配、runner 多失败收尾仍由 A02 后续批完成。不将零计数泛化成任意自定义 Agent 的所有外部副作用已回收。
