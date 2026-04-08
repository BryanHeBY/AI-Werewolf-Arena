# dependency rules

## 1. 当前代码详细文档

本文定义 V3 后端代码分层依赖规则，作为重构期间的硬约束。

目标分层：

1. `app`：装配层（bootstrap/container），只负责组装对象与场景。
2. `domain`：核心模型、组件、系统、world，无上层依赖。
3. `engine`：阶段流转与事件拦截，依赖 `domain` 与 `gateway`。
4. `gateway`：tool schema 与鉴权，依赖 `domain`。
5. `memory`：记忆与 prompt 组装，依赖 `domain`。
6. `scenarios`：板子配置，依赖 `domain/model`。
7. `v3`：action provider 与运行时适配器，依赖 `domain` 与 `app`。

允许依赖方向：

1. `app -> domain/engine/gateway/scenarios`
2. `engine -> domain/gateway`
3. `gateway -> domain`
4. `memory -> domain`
5. `scenarios -> domain`
6. `v3 -> app/domain`

禁止依赖方向：

1. `domain -> engine/gateway/app/memory/scenarios/v3`
2. `gateway -> engine/app`
3. `engine -> app`
4. 任何 V3 目录直接依赖 `core/ecs/server/agent/llm` 的 V2 模块。

执行规则：

1. 新增文件前先判断所属分层，禁止“临时放置”。
2. 若必须跨层调用，优先通过接口/事件回调下沉依赖。
3. 评审时必须检查 import 路径是否违反上述方向。

## 2. 未来目标 TODO

- [ ] 增加自动化依赖检查脚本（扫描 `import` 关系并输出违规项）。
- [ ] 为每个分层补充“可对外暴露 API 白名单”。
- [ ] 将依赖规则接入 PR 模板与发布检查清单。

## 3. 验收标准

- [ ] 新增代码遵守允许依赖方向，无跨层反向依赖。
- [ ] 评审时可快速定位违反规则的 import。
- [ ] 依赖规则可独立指导新成员完成模块放置与引用决策。
