# Backend 目录重构（第七阶段）

## 目标
- 将运行时配置与场景装配统一归口到 `src/runtime/*`。
- 缩减 `src` 根目录横向模块数量，提升定位效率。

## 本阶段范围
1. 物理迁移
   - `src/config -> src/runtime/config`
   - `src/scenarios -> src/runtime/scenarios`
2. 导入修复
   - 修复 `runtime/server/app/observability` 等上层入口导入路径
3. 导出策略
   - `src/index.ts` 继续对外导出 `runtime` 门面

## 验收标准
- `npm -C backend run build:v3`
- `npm -C backend run run:v3:mock`
- `src` 根目录不再出现 `config`、`scenarios`
