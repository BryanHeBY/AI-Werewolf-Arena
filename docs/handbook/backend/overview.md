# 狼人杀竞技场 - 后端总览（当前）

## 1. 文档优先级

1. API 设计与迁移：`docs/apis/api_overview.md`
2. Session REST v1 规范：`docs/apis/session_rest_api_v1_spec.md`
3. 运行时配置规范：`docs/specs/backend/foundation/runtime/runtime_config_spec.md`

说明：
- 本文档仅给出“当前结构速览”；
- 字段级与接口级定义以以上三份文档为准。

## 2. 当前技术栈

1. 运行时：Node.js + TypeScript
2. HTTP：Fastify
3. 实时通信：Socket.IO
4. LLM 接入：OpenAI 兼容接口（位于 `backend/src/ai/integrations/llm`）

## 3. 当前目录结构（backend/src）

```text
ai/             # 智能体、记忆、LLM 适配
app/            # 启动装配（bootstrap/container）
core/           # 领域模型与核心组件
game/           # 引擎编排与机制实现
observability/  # 记录、回放、调试汇总
runtime/        # 运行入口与运行时配置/场景读取
server/         # REST/Socket 服务与会话管理
utils/          # 通用工具
```

## 4. 核心运行链路

1. `server/index.ts` 启动 Fastify 与 Socket.IO。
2. `server/v3_session_manager.ts` 管理会话生命周期（start/stop/status）。
3. `app/bootstrap.ts` 装配 `core + game` 运行上下文。
4. `game/engine/*` 驱动 phase 流转，`game/mechanisms/*` 提供机制实现。
5. `observability/*` 负责回放、记录与调试摘要。

## 5. 配置约定（重点）

当前以 `game` 为外部入口：

1. `configs/games/<game>.json` 定义单局配置。
2. 运行时通过 `GAME_CONFIG_NAME` 或参数选择目标 game。
3. 不再建议以独立 `board` 配置文件作为外部主入口。
