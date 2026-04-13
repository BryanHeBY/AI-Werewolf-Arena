# Backend 目录重构（第五阶段）

## 目标
- 收尾清理：移除兼容层、稳定新目录契约。

## 本阶段范围
1. 删除旧路径 shim 与重复导出
2. 更新项目文档与开发指南
   - 新增目录说明
   - 新增导入约束
3. 新增自动化约束检查
   - `lint:boundaries` 检查 `core` 层是否错误依赖外层目录

## 验收标准
- 全量构建与关键测试通过
- `src/index.ts` 与各子系统导出结构简洁无重复
- 新人可通过目录快速定位：`core/game/ai/runtime/server/observability`
- `npm -C backend run lint:boundaries` 通过
