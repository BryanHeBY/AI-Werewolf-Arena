# Backend 目录重构（第六阶段）

## 目标
- 收敛 AI 相关目录，消除根目录下分散的 `agents` 与 `memory`。
- 将智能体执行与记忆上下文统一归到 `src/ai/*`，提升可发现性。

## 本阶段范围
1. 物理迁移
   - `src/agents -> src/ai/agents`
   - `src/memory -> src/ai/memory`
2. 导入修复
   - 修复迁移后相对路径
   - 上层调用改用 `src/ai` 门面或新路径
3. 兼容策略
   - 不保留旧目录 shim，避免双入口长期共存

## 验收标准
- `npm -C backend run build:v3`
- `npm -C backend run run:v3:mock`
- `src` 根目录中不再出现 `agents`、`memory` 目录
