# 运行时配置文件规范（Runtime Config）

## 1. 目标

把运行时配置解耦为三层：

1. `providers`：大模型供应商连接配置
2. `agents`：可复用的智能体配置（每个 agent 显式绑定 provider）
3. `games`：每局只引用已有 agent，不再内联定义模型参数

## 2. 读取规则

- 配置根目录：`GAME_CONFIGS_DIR`
- 优先读取拆分目录：
  - `${GAME_CONFIGS_DIR}/runtime/providers.json`
  - `${GAME_CONFIGS_DIR}/runtime/agents.json`
  - `${GAME_CONFIGS_DIR}/runtime/debug_summary.json`（可选）
  - `${GAME_CONFIGS_DIR}/games/<name>.json`（`GAME_CONFIG_NAME`，默认 `default`）
- 兼容旧文件：
  - `runtime/provider.json`（单 provider）
  - `runtime/agent.json`（单 default agent）
  - `${GAME_CONFIGS_DIR}/runtime_config.json`（单文件）

## 3. 拆分文件结构

### 3.1 providers.json

```json
{
  "default": "openrouter",
  "items": {
    "openrouter": {
      "type": "openai",
      "apiKey": "${OPENROUTER_API_KEY}",
      "baseURL": "https://openrouter.ai/api/v1",
      "userAgent": "AWA-Werewolf/1.0"
    }
  }
}
```

### 3.2 agents.json

```json
{
  "default": "qwen35_flash",
  "items": {
    "qwen35_flash": {
      "provider": "openrouter",
      "model": "qwen/qwen3.5-flash-02-23",
      "temperature": 0.2,
      "maxTokens": 512,
      "forceJsonResponse": true,
      "reasoningEnabled": false,
      "thinkingEnabled": false,
      "personalityPrompt": "以规则约束为最高优先级，简洁地完成本回合工具调用。"
    }
  }
}
```

### 3.3 games/default.json

```json
{
  "board": "six_player_mvp",
  "agent": "qwen35_flash",
  "maxDays": 2,
  "maxRuntimeMs": 240000,
  "llmTimeoutMs": 30000,
  "trace": false,
  "printAllEvents": false,
  "printChat": false,
  "streamEvents": true,
  "color": true,
  "printLlmIo": false,
  "printThinking": false,
  "printPrivateEvents": true
}
```

说明：
- `agent`：本局默认 agent 名称
- `roleAgents`：按角色覆写 agent（值为 agent 名称）
- `playerAgents`：按玩家编号覆写 agent（值为 agent 名称，优先级最高）
- `debugSummaryAgent`：debug_summary 专用 agent（可选）

### 3.4 debug_summary.json（可选）

```json
{
  "llmTimeoutMs": 30000,
  "llmMaxAttempts": 3,
  "agent": {
    "enabled": false,
    "agentName": "qwen35_flash",
    "profile": {
      "temperature": 0.1,
      "maxTokens": 1200
    },
    "timeoutMs": 15000,
    "maxAttempts": 2,
    "concurrency": 4,
    "publicMaxItems": 200,
    "maxItems": 200,
    "playerMaxItems": 120
  }
}
```

说明：
- `agent.agentName` 直接引用 `agents.items` 中已有 agent
- `agent.profile` 为可选临时覆盖（只覆盖本次 debug_summary）
- `thinkingEnabled` 控制是否向兼容网关下发 `extra_body.thinking={type:\"enabled\"}`。

## 4. 兼容与迁移

- 新结构优先：`providers.json + agents.json`
- 旧结构可继续读取，但建议迁移：
  - `provider.json` -> `providers.json`
  - `agent.json` -> `agents.json`
  - game 中内联模型参数 -> 引用 agent 名称

## 5. 字段约束

- provider `type` 当前仅支持 `openai`
- `apiKey` 支持完整环境变量占位符（例如 `${OPENROUTER_API_KEY}`）；缺少该环境变量时加载会失败
- `agents.items.<name>.provider` 必须存在于 `providers.items`
- `games.*.agent / roleAgents / playerAgents / debugSummaryAgent` 必须引用已定义 agent 名称
