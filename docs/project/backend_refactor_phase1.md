# Backend 目录重构（第一阶段）

## 目标
- 提升目录直观性，降低新同学理解成本。
- 在不改变对局行为的前提下，先做低风险迁移。
- 保持命令兼容与构建可通过。

## 本阶段范围
1. `backend/src/session_recording` 迁移为 `backend/src/observability`
2. `backend/src/scripts` 迁移为 `backend/src/runtime`
3. 清理 `engine` 中仅做转发的 `sheriff_badge` 包装层

## 迁移映射
- `src/session_recording/*` -> `src/observability/*`
- `src/scripts/run_llm_game.ts` -> `src/runtime/run_llm_game.ts`
- `src/scripts/run_llm_dual.ts` -> `src/runtime/run_llm_dual.ts`
- `src/scripts/run_mock_game.ts` -> `src/runtime/run_mock_game.ts`
- 删除 `src/engine/sheriff_badge.ts`，直接引用 `mechanisms/sheriff/sheriff_badge`

## 兼容策略
- `package.json` 的 `run:v3*` 脚本更新到新路径。
- `src/run-test-v3.ts` 改为引用 `src/runtime/run_mock_game.ts`。
- 所有内部 import 统一重写到新目录。

## 验收标准
- `npm -C backend run build:v3` 通过。
- `npm -C backend run run:v3:mock` 可启动并输出对局结果。
- 现有记录与调试功能（record/debug summary）行为不变。

## 不在本阶段
- 领域层与机制层的大规模拆分（`domain/engine/mechanisms` 深层结构调整）。
- server API 协议与事件结构变更。
- LLM 提示词策略变更。
