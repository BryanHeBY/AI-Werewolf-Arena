# release report

## 1. 发布概览

- 发布时间：2026-04-08
- 发布分支 / commit：`feature/v3-backend-new`（工作区验证）
- 目标范围：V3 后端机制补齐 + 前端协议对齐 + docs/guides 无人值守验收
- 执行人：Codex

## 2. 变更摘要

1. 后端核心变更：白天 4 窗口、狼人战术环、警徽流转、遗言规则、记忆压缩、开关回滚。
2. 测试新增/修改：新增 `day_interrupt_hooks`、`night_wolf_tactical_loop`、`sheriff_pipeline`、`memory_compression`、`cutover_rollback`、`last_words_rules`、`minimax_live_connectivity`。
3. 配置与发布链路变更：新增 `test:quick` / `test:full` / `smoke:v3` / `release:check` / `lint:deps`。

## 3. 检查结果

- `build:v3`：通过
- `test:quick`：通过
- `test:full`：通过
- `smoke:v3`：通过
- `lint:deps`：通过
- `release:check`：通过
- `RUN_LIVE_LLM_TEST=1`：通过

## 4. 异常与处理

1. 异常描述：曾出现 TODO 批量勾选违规。
2. 根因定位：未严格执行逐条验收勾选约束。
3. 修复动作（代码/测试）：已清空全部勾选并改为逐条验收后勾选。
4. 是否回滚：否。
5. 回写任务 ID：`docs/guides/backend_rebuild/03_task_backlog.md` 的 `R1/R2` 已记录。

## 5. 验收结论

- 是否满足本阶段验收标准：满足。
- 遗留风险：`vue-tsc` 在当前 Node 版本环境存在工具兼容问题（前端构建不受影响）。
- 下一步任务：继续按无人值守逐条清空剩余 docs/guides TODO。

