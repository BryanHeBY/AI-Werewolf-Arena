# Backend 重构路线图

## 总体原则
- 文档先行：每阶段先有目标、范围、回滚与验收标准。
- 小步可回滚：每阶段必须可独立发布，不跨阶段混改。
- 行为不变优先：先做目录与依赖边界整理，再做功能重构。

## 阶段列表
1. Phase 1（已完成）
   - `session_recording -> observability`
   - `scripts -> runtime`
   - 清理 `engine/sheriff_badge` 包装层
2. Phase 2
   - 新增 `core/game/ai` 门面目录与稳定导出
   - 上层入口优先改用门面导入
3. Phase 3
   - 物理迁移 `engine + mechanisms + gateway` 到 `game/*`
   - 维持兼容导出，逐步移除旧路径引用
4. Phase 4
   - 物理迁移 `domain` 到 `core/domain`
   - 把跨层依赖收敛为 `core -> game -> ai/runtime/server/observability`
5. Phase 5
   - 清理兼容层与废弃导出
   - 补充架构文档与开发约束（导入边界、目录规范）
6. Phase 6
   - 物理迁移 `agents + memory` 到 `ai/*`
   - 收敛 AI 目录，减少根目录分散模块

## 验收基线（每阶段）
- `npm -C backend run build:v3`
- `npm -C backend run run:v3:mock`
- 回放记录与调试摘要行为不回归
