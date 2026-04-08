# backend/src/agent/AgentController.ts

## 1. 当前代码详细文档

- 源码路径：`backend/src/agent/AgentController.ts`
- 文件类型：`ts`
- 当前行数：`273`
- 文件定位：Agent 行为链路文件，负责意图校验与对话上下文处理。
- 上级目录文档：[README.md](./README.md)
- 关联规范：`docs/specs/backend_architecture_whitepaper_v3.md`、`docs/specs/v3_mvp_requirements.md`

### 代码内容简介
- 当前文件参与 V2 现状实现，并将作为 V3 重构映射依据。
- 重构时优先比对本文件导出项、依赖项与阶段职责。

### 对外暴露类型/接口/函数
- `20:export class AgentController {`

### 关键依赖（import）
- `../broadcaster/Broadcaster`
- `../core/Environment`
- `../llm/OpenAIClient`
- `../llm/Retry`
- `./ActionValidator`
- `./PromptPipeline`

## 2. 未来目标 TODO

- [ ] 完成 Function Calling 网关鉴权与错误反弹重试策略。
- [ ] 补齐函数级输入/输出/副作用说明。
- [ ] 补齐该文件的测试覆盖现状（单测/集成/E2E）。
- [ ] 源码发生 export 或 import 变更时，同步更新本文档。

## 3. 验收标准

- [ ] 本文档中的导出项与源码实际 `export` 保持一致。
- [ ] 关键依赖列表可支持重构时进行影响面分析。
- [ ] 通过本文档可定位该文件在 V3 重构中的责任边界。
