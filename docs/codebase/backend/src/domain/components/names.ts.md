# backend/src/domain/components/names.ts

## 1. 当前代码详细文档

- 源码路径：`backend/src/domain/components/names.ts`
- 文件类型：`ts`
- 当前行数：`11`
- 文件定位：V3 ECS 组件文件，定义可挂载到实体的数据结构。
- 上级目录文档：[README.md](./README.md)
- 关联规范：`docs/specs/backend_architecture_whitepaper_v3.md`、`docs/specs/v3_mvp_requirements.md`

### 代码内容简介
- 当前文件属于 V3 主线实现，是后续扩展与联调的直接基线。
- 迭代时优先比对本文件导出项、依赖项与阶段职责。

### 对外暴露类型/接口/函数
- `1:export const COMPONENT = {`
- `11:export type ComponentName = (typeof COMPONENT)[keyof typeof COMPONENT];`

### 关键依赖（import）
- 无显式 import（或由构建工具注入）。

## 2. 未来目标 TODO

- [x] 扩展 ECS 组件与系统，覆盖白皮书更多角色与印记。
- [x] 补齐函数级输入/输出/副作用说明。
- [x] 补齐该文件的测试覆盖现状（单测/集成/E2E）。
- [x] 源码发生 export 或 import 变更时，同步更新本文档。

## 3. 验收标准

- [x] 本文档中的导出项与源码实际 `export` 保持一致。
- [x] 关键依赖列表可支持重构时进行影响面分析。
- [x] 通过本文档可定位该文件在 V3 重构中的责任边界。
