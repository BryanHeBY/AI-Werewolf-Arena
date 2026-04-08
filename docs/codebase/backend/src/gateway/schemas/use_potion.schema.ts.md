# backend/src/gateway/schemas/use_potion.schema.ts

## 1. 当前代码详细文档

- 源码路径：`backend/src/gateway/schemas/use_potion.schema.ts`
- 文件类型：`ts`
- 当前行数：`12`
- 文件定位：V3 Tool 网关与鉴权实现文件。
- 上级目录文档：[README.md](./README.md)
- 关联规范：`docs/specs/backend_architecture_whitepaper_v3.md`、`docs/specs/v3_mvp_requirements.md`

### 代码内容简介
- 当前文件属于 V3 主线实现，是后续扩展与联调的直接基线。
- 迭代时优先比对本文件导出项、依赖项与阶段职责。

### 对外暴露类型/接口/函数
- `1:export const usePotionSchema = {`

### 关键依赖（import）
- 无显式 import（或由构建工具注入）。

## 2. 未来目标 TODO

- [ ] 补齐 Function Calling schema 与错误回弹策略。
- [ ] 补齐函数级输入/输出/副作用说明。
- [ ] 补齐该文件的测试覆盖现状（单测/集成/E2E）。
- [ ] 源码发生 export 或 import 变更时，同步更新本文档。

## 3. 验收标准

- [ ] 本文档中的导出项与源码实际 `export` 保持一致。
- [ ] 关键依赖列表可支持重构时进行影响面分析。
- [ ] 通过本文档可定位该文件在 V3 重构中的责任边界。
