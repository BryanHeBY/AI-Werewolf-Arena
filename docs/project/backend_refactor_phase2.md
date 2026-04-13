# Backend 目录重构（第二阶段）

## 目标
- 引入稳定的分层门面目录：`core/`、`game/`、`ai/`。
- 先统一“导入入口认知”，再做物理迁移。

## 本阶段范围
1. 新增门面目录与导出文件
   - `src/core/index.ts`
   - `src/game/index.ts`
   - `src/ai/index.ts`
2. 顶层 `src/index.ts` 以新门面为主导出
3. 入口模块（runtime/server/app）优先改用门面导入

## 兼容策略
- 保留原目录结构和原路径可用。
- 不移动真实实现文件，仅增加门面与部分导入替换。

## 验收标准
- `npm -C backend run build:v3` 通过。
- `npm -C backend run run:v3:mock` 通过。
- 运行行为与日志语义不变。

## 不在本阶段
- 不做 `engine/mechanisms/domain` 物理目录迁移。
- 不删除旧导出。
