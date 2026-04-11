# 运行时配置文件规范（Runtime Config）

## 1. 目标

减少对环境变量的依赖，将 LLM 供应商与玩家 agent 配置统一收敛到 JSON 文件中，确保对局可复现。

## 2. 位置与加载规则

- 本地配置目录：由 `GAME_CONFIGS_DIR` 指定（默认入口）
- 运行时读取：
  - 拆分文件目录：`${GAME_CONFIGS_DIR}/runtime/`
  - 兼容单文件：`${GAME_CONFIGS_DIR}/runtime_config.json`（存在拆分目录时将被忽略）
  - 对局参数目录：`${GAME_CONFIGS_DIR}/games/`（通过 `GAME_CONFIG_NAME` 选择）
- 示例配置目录：`configs.example/`（仅示例，不参与运行时读取）
  - 拆分文件示例：`configs.example/runtime/`
  - 单文件示例：`configs.example/runtime_config.json`
  - 对局参数示例：`configs.example/games/`
- 可选运行参数：
  - `--configs-dir <path>`：临时覆盖 `GAME_CONFIGS_DIR`（优先级最高）
  - `--game-config-name <name>`：设置 `GAME_CONFIG_NAME`，选择 `${GAME_CONFIGS_DIR}/games/<name>.json`
- 环境变量：
  - `GAME_CONFIG_NAME`：指定对局参数名（读取 `${GAME_CONFIGS_DIR}/games/<name>.json`；未设置时默认为 `default`）
  - 读取到的对局参数会覆盖 `runtime/game.json`（可选）或单文件中的 `game` 配置
- 读取时机：后端启动或脚本运行时加载一次（缓存）。

## 3. 拆分文件结构

### 3.1 provider.json

```json
{
  "type": "openai",
  "apiKey": "YOUR_API_KEY",
  "baseURL": "https://api.openai.com/v1",
  "userAgent": "AWA-Werewolf/1.0"
}
```

### 3.2 agent.json

```json
{
  "default": {
    "model": "gpt-4o-mini",
    "temperature": 0.2,
    "maxTokens": 512,
    "forceJsonResponse": true,
    "reasoningEnabled": true,
    "reasoningEffort": "medium",
    "personalityPrompt": ""
  },
  "roles": {
    "wolf": {
      "model": "gpt-4o-mini",
      "temperature": 0.2,
      "personalityPrompt": ""
    }
  },
  "players": {
    "1": {
      "model": "gpt-4o-mini",
      "temperature": 0.3,
      "personalityPrompt": "更激进，优先带节奏"
    }
  }
}
```

### 3.3 game.json

```json
{
  "board": "six_player_mvp",
  "maxDays": 10,
  "maxRuntimeMs": 1800000,
  "llmTimeoutMs": 30000,
  "trace": false,
  "printAllEvents": false,
  "printChat": false,
  "streamEvents": true,
  "color": true,
  "printLlmIo": false,
  "printThinking": false,
  "printPrivateEvents": true,
  "recordRootDir": "./backend/data/records",
  "roleAgents": {
    "wolf": {
      "model": "gpt-4o-mini",
      "temperature": 0.3,
      "personalityPrompt": "更强势、更主动带节奏"
    }
  },
  "playerAgents": {
    "2": {
      "model": "gpt-4o-mini",
      "temperature": 0.4,
      "personalityPrompt": "更激进，偏好强推"
    }
  }
}
```

### 3.4 debug_summary.json

```json
{
  "llmTimeoutMs": 30000,
  "llmMaxAttempts": 3,
  "agent": {
    "enabled": true,
    "profile": {
      "model": "gpt-4o-mini",
      "temperature": 0.1,
      "maxTokens": 1200,
      "forceJsonResponse": false,
      "reasoningEnabled": true,
      "reasoningEffort": "medium"
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

## 4. 单文件结构（兼容）

```json
{
  "provider": {
    "type": "openai",
    "apiKey": "YOUR_API_KEY",
    "baseURL": "https://api.openai.com/v1",
    "userAgent": "AWA-Werewolf/1.0"
  },
  "agent": {
    "default": {
      "model": "gpt-4o-mini",
      "temperature": 0.2,
      "maxTokens": 512,
      "forceJsonResponse": true,
      "reasoningEnabled": true,
      "reasoningEffort": "medium",
      "personalityPrompt": ""
    },
    "roles": {
      "wolf": {
        "model": "gpt-4o-mini",
        "temperature": 0.2,
        "personalityPrompt": ""
      }
    }
  },
  "game": {
  "board": "six_player_mvp",
    "maxDays": 10,
    "maxRuntimeMs": 1800000,
    "llmTimeoutMs": 30000,
    "trace": false,
    "printAllEvents": false,
    "printChat": false,
    "streamEvents": true,
    "color": true,
    "printLlmIo": false,
    "printThinking": false,
    "printPrivateEvents": true,
    "recordRootDir": "./backend/data/records",
    "roleAgents": {
      "wolf": {
        "model": "gpt-4o-mini",
        "temperature": 0.3,
        "personalityPrompt": "更强势、更主动带节奏"
      }
    },
    "playerAgents": {
      "1": {
        "model": "gpt-4o-mini",
        "temperature": 0.4,
        "personalityPrompt": "更激进，优先带节奏"
      }
    }
  },
  "debugSummary": {
    "llmTimeoutMs": 30000,
    "llmMaxAttempts": 3,
    "agent": {
      "enabled": true,
      "profile": {
        "model": "gpt-4o-mini",
        "temperature": 0.1,
        "maxTokens": 1200,
        "forceJsonResponse": false,
        "reasoningEnabled": true,
        "reasoningEffort": "medium"
      },
      "timeoutMs": 15000,
      "maxAttempts": 2,
      "concurrency": 4,
      "publicMaxItems": 200,
      "maxItems": 200,
      "playerMaxItems": 120
    }
  }
}
```

## 5. 字段说明

### 4.1 provider
- `type`: 当前仅支持 `openai`
- `apiKey`: 必填
- `baseURL`: 可选
- `userAgent`: 可选

### 4.2 agent
- `default`: 所有角色的默认 LLM 配置
- `roles`: 角色级覆盖（wolf / villager / seer / witch / guard / hunter / idiot）
- `players`: 玩家级覆盖（key 为玩家编号字符串）
- `reasoningEnabled/reasoningEffort`: SDK reasoning 控制参数（可按 default/roles/players 逐级覆盖）

### 4.3 game
- `board`: 默认对局板子（可被 CLI 参数覆盖）
- `board` 同时作为板子配置文件名（对应 `${GAME_CONFIGS_DIR}/boards/${board}.json`）
- `roleAgents`: 本局角色级覆写（用于实现不同角色使用不同模型/性格）
- `playerAgents`: 本局玩家级覆写（优先级高于 roleAgents）
- `maxDays/maxRuntimeMs/llmTimeoutMs`: 对局与 LLM 调度参数
- `trace/printAllEvents/printChat/streamEvents/color/printLlmIo/printThinking/printPrivateEvents`: 运行输出开关
- `recordRootDir`: records 输出目录

### 5.4 debugSummary
- `llmTimeoutMs`: 汇总 LLM 超时
- `llmMaxAttempts`: 汇总 LLM 最大重试
- `agent`: 子 agent 并发调试参数
- `agent.profile`: debug agent 的模型参数覆盖（未配置则继承 `agent.default`）

## 6. 兼容策略

- 拆分目录存在时优先读取拆分文件
- 仅存在 `runtime_config.json` 时读取单文件
- 运行时仅读取 `GAME_CONFIGS_DIR` 指向的目录
- 若目录不存在或配置缺失，启动报错并退出
