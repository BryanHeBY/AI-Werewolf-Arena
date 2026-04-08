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

## 2. 开发任务清单

- [ ] `T01` 在 `backend` 的 lint 配置中加入 `no-restricted-imports` 规则，显式限制跨层反向依赖。
- [ ] `T02` 在 `backend/src/{app,domain,engine,gateway,memory,scenarios,v3}/index.ts` 建立分层导出白名单。
- [ ] `T03` 在 `backend/package.json` 增加 `lint:deps` 前置命令，阻断依赖方向违规代码提交。

## 3. 验收标准（任务映射）

- [ ] `A01`（对应: `T01`） 本地执行 lint 时可直接报出违规 import 的文件与行号。
- [ ] `A02`（对应: `T02`） 新增模块只能通过分层 `index.ts` 导出访问，不再跨目录直连内部实现。
- [ ] `A03`（对应: `T03`） 本地执行 `npm run lint:deps` 时，依赖逆向引用必须失败并阻止继续测试/构建。
