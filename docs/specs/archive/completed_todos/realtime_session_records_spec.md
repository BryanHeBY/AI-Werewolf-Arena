# Session Records 实时落盘方案

## 1. 目标

将当前“对局结束后统一写盘”改为“对局进行中实时写盘”，降低中断丢数风险，并支持边跑边复盘。

## 2. 范围

本次一次性覆盖全部 records 文件：

1. `public_timeline.json`
2. `logic_ops.json`
3. `players/player_*.json`
4. `debug_reports.json`
5. `manifest.json`（开局写入 in_progress，终局覆盖最终态）
6. `debug_summary.md`（仍在终局生成，因其是汇总产物）

## 3. 设计要点

## 3.1 写入策略

1. 采用“内存状态 + 脏标记 + 异步串行 flush 队列”。
2. 每次记录操作只做内存更新并标记 dirty，不阻塞主流程。
3. 通过短 debounce（如 100ms）合并写入，减少 I/O 放大。
4. `finalize()` 时强制 flush，并写入终局汇总文件。

## 3.2 并发与一致性

1. 所有落盘通过单一 Promise 链串行化，避免并发覆盖。
2. 文件写入继续使用 `tmp -> rename` 原子替换。
3. `players` 仅增量写脏玩家文件，避免全量重写。

## 3.3 manifest 策略

1. `create()` 后立即写入初始 manifest（`finish_reason: in_progress`）。
2. `finalize()` 重新写入最终 manifest（winner/ended_at/players）。

## 4. 风险与处理

1. 高频写入：
   - debounce + 脏文件增量写。
2. 进程异常退出：
   - 常驻实时刷盘可保留大部分已发生事件。
3. 终局竞态：
   - `finalize()` 先停定时器，再等待写队列清空，再写终局产物。

## 5. 验收标准

1. 对局进行中可观察到 records 文件持续变化（非终局一次性生成）。
2. `public_timeline` / `logic_ops` / `player_*.json` / `debug_reports` 在中途即有内容。
3. `manifest` 开局存在 in_progress，终局为最终态。
4. `debug_summary.md` 仅终局生成。
5. 现有核心测试通过，新增实时写盘测试通过。

## 6. TODO

- [x] 为 `SessionRecordManager` 增加脏标记与 flush 队列
- [x] 记录操作改为“内存更新 + 调度 flush”
- [x] 新增 `flushNow()` 并在 `finalize()` 中强制落盘
- [x] 开局写入初始 manifest
- [x] 终局写入最终 manifest + debug_summary
- [x] 增加实时写盘测试（中途可见文件内容）
- [x] 通过 build 与相关测试

## 7. 回合内多工具记录约定（新增）

1. 单个请求轮次内允许多次 `tool_call` 交互。
2. 玩家视角时间线中：
   - 保留最终可追溯的 `tool_call` 序列；
   - 不再把 `step N tool_call/tool_result` 文本拼接进 `llm_message` 内容。
3. 回合结束由 `finish_turn` 触发时，若约束未满足，需在日志中保留结构化拒绝结果（而非静默丢弃）。
