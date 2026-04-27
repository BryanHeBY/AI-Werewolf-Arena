# AI Werewolf Arena

AI Werewolf Arena 是一个面向“可观战 AI 多智能体狼人杀博弈”的全栈项目。

项目围绕狼人杀这一强规则、强博弈、强时序的场景展开，把 LLM Agent 决策、游戏引擎、实时通信、会话管理、复盘记录和观战前端整合在同一个工程中，用来探索“多 Agent 社交推理游戏”的完整产品化落地路径。

它不仅是一个前后端项目，也是一个同时包含：

1. 规则引擎设计
2. 多智能体 orchestration
3. 实时事件协议设计
4. 可观测性与复盘体系
5. 全栈联调与测试工程

的综合性系统。

## Project Highlights

这个项目的核心目标是让我们能够：

1. 运行一局由 AI 扮演玩家的狼人杀对局
2. 让不同角色在规则约束下进行发言、投票、夜间技能和策略博弈
3. 实时观看阶段推进、公共事件和玩家动作
4. 记录整局过程，并支持按公开视角、玩家视角和时间线复盘
5. 用统一文档体系持续演进协议、规范和任务驱动

从工程角度看，它体现的是一个复杂业务系统的完整闭环：

1. 后端不仅要“返回数据”，还要承担状态机、规则校验、事件翻译和广播分发
2. 前端不仅要“展示页面”，还要消费实时协议、处理状态恢复并承接观战体验
3. LLM 不只是文本生成器，而是通过 tool call 与受控动作网关参与规则内决策

项目的亮点主要体现在以下几个方面：

1. **注册式多角色机制架构**：角色能力不是硬编码散落在流程里，而是通过 `role profile / runtime / prompt / tool spec / event presenter` 多层注册表进行组合与扩展，便于持续加入新角色、新技能和新板子。
2. **配置驱动的规则加载能力**：后端支持按板子名解析配置，并通过 normalizer/override 机制将不同规则、钩子、自爆窗口、警长机制、女巫自救规则等装配成统一 `BoardConfig`。
3. **可见性分层的实时广播协议**：同一条对局内部事件会被翻译为带 `visibility`、`category`、`publicState` 的增强 `gameEvent`，用于同时服务公开观战、狼队私有信息和玩家私有反馈。
4. **多视角复盘与观测链路**：系统不仅记录公开 timeline，还保存玩家视角广播、LLM 请求消息、工具调用和调试摘要，方便做回放、回归测试与问题诊断。
5. **Agent 智能调试与缺陷上报机制**：玩家 Agent 在行动窗口内可通过 `report_bug` 实时工具调用主动上报疑似规则、状态、流程或日志问题；服务端会对上报做校验、限流、去重和结构化落盘。
6. **LLM 复盘总结流水线**：对局结束后，系统会基于 `debug_reports`、公开事件、逻辑操作和玩家视角记录生成 `debug_summary`，用于自动整理可疑问题、证据序号和后续排查线索。
7. **规则串行 + 请求并行的调度模型**：状态修改和结算保持严格串行，避免竞态；但在投票、自爆窗口等互不依赖的阶段允许并行采样，再按确定性规则合并，兼顾正确性与系统吞吐。
8. **文档驱动的协作与演进方式**：协议、规范、驱动和 handbooks 分层管理，减少“代码先行但契约缺失”的联调风险，适合多人协作开发。

## Core Capabilities

### 1. Multi-Agent Werewolf Engine

后端实现了一个可扩展的 V3 游戏引擎，用于驱动狼人杀完整生命周期，包括：

1. 夜晚 / 白天 / 投票的阶段切换
2. 角色技能执行与结算
3. 自爆、猎人开枪、白痴翻牌、警长机制等中断与钩子
4. 阵营胜负判定
5. 面向不同板子的规则配置与机制组合

这部分的一个关键亮点是：角色能力并不是简单 `if/else` 分支，而是通过注册式机制层来接入运行时初始化、prompt 渲染、工具定义、广播呈现和规则行为，因此整体结构更接近一个“可演化的规则引擎”。

### 2. Realtime Spectator Experience

项目通过 REST + Socket.IO 提供实时观战能力，支持：

1. 创建和管理一局对局会话
2. 通过统一 `gameEvent` 协议向前端广播实时事件
3. 区分公开事件、狼队私有事件和玩家私有事件
4. 前端按阶段、玩家、动作和终局状态进行可视化展示

### 3. Replay And Observability

项目内置了对局记录与复盘体系，能够：

1. 落盘整局公开时间线
2. 按玩家保存各自可见广播与回合信息
3. 记录 LLM 请求、动作轨迹和调试摘要
4. 支持后续复盘、回归测试和问题定位

这意味着项目不是只关注“跑完一局”，而是把“为什么这样跑、哪里出问题、如何复现问题”也纳入系统能力。

复盘链路里还包含一条面向 Agent 的智能调试流程：

1. Agent 可在行动过程中调用 `report_bug` 工具主动上报异常
2. 服务端会对上报做参数校验、频控、去重和结构化记录
3. 对局结束后再基于 `debug_reports`、timeline、logic ops 和玩家视角信息生成 `debug_summary`
4. 调试总结既可以走确定性规则，也可以接入 LLM/并行子 agent 做更高层汇总

### 4. Documentation-Driven Evolution

仓库使用 `docs/` 作为统一文档入口，并按 API / Spec / Driver / Handbook 分层组织，使协议设计、实现约束和执行任务可以长期维护、同步演进。

## Tech Stack

### Backend

1. `TypeScript`
2. `Node.js`
3. `Fastify`
4. `Socket.IO`
5. `OpenAI SDK`
6. `Jest`

后端侧包含：

1. ECS 风格的领域模型与组件系统
2. 阶段管理器与流水线式 phase pipeline
3. 角色机制注册表、工具网关与可见性控制
4. LLM prompt 装配、tool call 执行与上下文压缩
5. 实时广播协议翻译与会话管理
6. 配置驱动的板子解析与规则归一化

### Frontend

1. `Vue 3`
2. `TypeScript`
3. `Vite`
4. `Pinia`
5. `Socket.IO Client`
6. `Playwright`

前端侧包含：

1. 实时观战界面
2. 玩家状态面板与聊天流式展示
3. Socket 接入与前端状态归一化
4. 端到端联调测试

### Tooling

1. `npm workspaces`
2. `ts-jest`
3. `vue-tsc`
4. `Playwright`
5. `ESLint`

## System Complexity

项目复杂度主要来自这几层能力的叠加：

1. 领域建模能力
2. 可扩展插件/注册机制设计
3. 配置驱动系统设计
4. 实时系统协议设计
5. LLM 工程与防御式网关设计
6. 可观测性与回放系统设计
7. Agent 自诊断与自动化复盘总结能力

它不是单点 demo，而是把规则引擎、Agent 调度、实时广播、前端观战和复盘体系放进同一个完整工程里。

## Repository Structure

```text
.
├── backend/          # 后端服务、V3 引擎、API、实时广播、测试
├── frontend/         # 前端界面、Vite 工程、Playwright 测试
├── docs/             # 项目正式文档入口
├── configs.example/  # 示例运行时配置
├── configs/          # 本地配置
├── scripts/          # 辅助脚本
├── .env.example
└── package.json
```

## Documentation Entry

`docs/` 是本项目唯一的正式文档入口。

建议阅读顺序：

1. [`docs/README.md`](./docs/README.md)
2. [`docs/apis/readme.md`](./docs/apis/readme.md)
3. [`docs/specs/readme.md`](./docs/specs/readme.md)
4. [`docs/drivers/readme.md`](./docs/drivers/readme.md)
5. [`docs/handbook/readme.md`](./docs/handbook/readme.md)

核心协议与联机约束文档：

1. [`docs/apis/game_event_socket_v1_spec.md`](./docs/apis/game_event_socket_v1_spec.md)
2. [`docs/apis/session_rest_api_v1_spec.md`](./docs/apis/session_rest_api_v1_spec.md)
3. [`docs/specs/frontend/game_event_consumption_spec_v3.md`](./docs/specs/frontend/game_event_consumption_spec_v3.md)

## Quick Start

要求：

1. Node.js `>= 18`
2. npm workspace 环境可用

安装依赖：

```bash
npm install
cd backend && npm install
cd ../frontend && npm install
```

或直接使用：

```bash
npm run install:all
```

启动后端：

```bash
npm run dev:backend
```

启动前端：

```bash
npm run dev:frontend
```

## Useful Commands

后端：

```bash
cd backend
npm run build:v3
npm run test:v3
npm run smoke:v3
```

前端：

```bash
cd frontend
npm run build
npm run test
```

## Project Entry Points

核心代码入口：

1. 后端启动与装配：`backend/src/app/bootstrap.ts`
2. 板子配置解析：`backend/src/runtime/scenarios/board_config_resolver.ts`
3. 会话与实时广播：`backend/src/server/v3_session_manager.ts`
4. 实时协议映射：`backend/src/game/mechanisms/session/realtime_event_registry.ts`
5. 角色运行时注册：`backend/src/game/mechanisms/roles/role_runtime_registry.ts`
6. 工具规格注册：`backend/src/game/mechanisms/registries/tool_spec_registry.ts`
7. 会话记录与复盘：`backend/src/observability/session_record_manager.ts`
8. 领域模型：`backend/src/core/domain/model.ts`
9. 前端顶层入口：`frontend/src/App.vue`
10. 项目文档首页：[`docs/README.md`](./docs/README.md)

## Notes

1. 根目录 `README.md` 负责项目介绍、展示与导航。
2. 详细协议、实现规范和执行驱动统一写在 `docs/` 中。
