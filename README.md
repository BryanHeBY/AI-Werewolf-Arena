# AI Werewolf Arena

多智能体狼人杀对局引擎，以及用于离线复盘和视频生成的 React 工作台。

## 当前架构

- `backend/`：Bun + TypeScript 的对局引擎、LLM/ACP 调度、复盘落盘与导出 CLI。
- `frontend/`：React + Remotion Player 的离线复盘播放器；当前只读取导出的 `.replay.json` 文件。
- `packages/replay-contract/`：前端播放器与后端导出器共享的复盘数据类型。
- `packages/game-catalog/`：角色稳定ID、中英名称和计划／实现状态；资料登记不代表角色已可运行。
- `configs.example/`：本地运行配置模板，默认经 OpenRouter 使用 DeepSeek V4 Flash。

真实 Agent 对局由 `runtime/cli/run_game.ts` 启动，并将事件和最终结果写入 `record/<session>/replay.json`；`runtime/run_mock_game.ts` 只运行本地基线机器人对局并打印结果。前端直接加载 `replay.json` 进行播放。当前没有在线观战或多租户在线服务；引擎按玩家投影信息，ACP 会话和工具权限独立隔离。

运行配置只接受固定文件结构：`runtime/providers.json`、`runtime/agents.json`、`games/<name>.json`、`boards/<id>.json`，以及可选的 `runtime/debug_summary.json`。板子使用完整 `version: 2` 配置，正常运行不搜索旧路径或回退内置板子。每个 Agent 都必须显式声明 `kind: "llm"` 或 `kind: "acp"`；调试汇总通过 `agentName` 引用一个 Agent，不能内联覆盖模型参数。

玩家名字和模型选择可分开配置：`players.<seat>.name`、可选 `agent` 与 `personalityPrompt`。人格可用原字符串或中文／英文字典，`null` 清除继承值。配置格式、阶段执行限制与迁移说明见 [配置契约](docs/expansion/config-v2.md)。

LLM 和 ACP Agent 均支持 `personalityPrompt`，统一追加到玩家的身份与规则提示中。可以在 `runtime/agents.json` 中设置默认风格，也可在对局的 `roleAgents`、`playerAgents` 对象中覆盖，无需重复定义模型或进程配置。例如：

```json
{
  "board": "twelve_player_standard",
  "agent": "acp_default",
  "roleAgents": {
    "wolf": {
      "agent": "acp_default",
      "personalityPrompt": "善于分析公开信息，发言简洁，注意团队配合。"
    }
  },
  "playerAgents": {
    "11": {
      "agent": "acp_default",
      "personalityPrompt": "语气温和，每次发言先总结事实，再提出问题。"
    }
  }
}
```

选择优先级为序号配置 → 角色配置 → 对局默认 Agent。选中的配置没有填写 `personalityPrompt` 时，继承其引用 Agent 的提示词；填写时整体覆盖，不与角色或其他 Agent 的提示词拼接。身份、规则和工具约束仍由引擎生成，提示词通过共享的 `PlayerPromptPolicy` 注入，不放入 ACP 进程参数。

LLM Agent 的 `reasoningEffort` 可选，通过 AI SDK 的 `providerOptions` 发送；OpenAI 兼容接口可选 `none`、`minimal`、`low`、`medium`、`high`、`xhigh`，Anthropic 只接受 `low`、`medium`、`high`，具体档位仍取决于模型。不填则不主动指定推理档位。`thinkingEnabled` 仅在显式设为 `true` 时生效：支持该能力的 Anthropic 模型使用 SDK 的自适应 thinking，OpenAI 兼容网关沿用 `extra_body.thinking` 扩展。Anthropic 自适应 thinking 不支持同时指定 `temperature`。`maxTokens` 与 provider 的 `maxConcurrentRequests` 必须是正整数。

请求头的 `userAgent` 只从对应 provider 配置读取；未配置时使用 `AWA-Werewolf/1.0`。指定推理或 thinking 时不再自动补 `temperature`，如模型支持，可在 Agent 上显式设置。模型调用使用 AI SDK 自带的最多 3 次重试。

provider 的 `maxConcurrentRequests` 约束单局内同时执行的玩家回合，名额在整个工具调用与行动重试结束后才释放；多个进程使用同一密钥时，请求数仍会叠加。模型未遵守必须调用工具的要求时，会进入最多 3 次行动重试；API 错误和超时仍按异常回退。LLM 的 `turn_id` 不匹配会返回期望值与收到值，并写入 `logic_ops.json`，便于核查被拒绝的调用。

对局天数、超时、审计次数和并发数必须是正整数。审计的 `publicMaxItems` 与 `playerMaxItems` 至少为 60，`maxItems` 至少为 50；低于下限会在加载配置时明确报错。

旧配置中的 `forceJsonResponse` 从未控制实际请求，`reasoningEnabled` 曾对所有 OpenAI 兼容接口默认启用推理参数；这两个字段现已移除。升级已有配置时删除它们，并在需要指定推理档位的 Agent 上填写 `reasoningEffort`。

对局异常时仍会关闭 Agent 并保存带有 `runtime_error` 结束原因的部分复盘；初始化或最终 `replay.json` 写入失败会使运行命令失败，而不是仅打印警告。若对局和收尾同时失败，调用方会收到包含两者的 `AggregateError`。

首日警长选举后的夜间死亡链结算一旦满足胜利条件，会立即终局，不再请求白天发言或投票。配置的初始警长也会写入复盘事件。导出器和播放器共用运行时校验，拒绝损坏的玩家、事件结构及非连续事件序号；未结束的部分复盘仍可加载。

记录器仅负责持久化，调试摘要由运行入口在核心复盘写入后单独生成；摘要失败不影响已完成的复盘。记录作用域使用 `runWithSessionRecorder` 隔离异步对局，不再共享进程级活动记录器；单独装配规则引擎不会加载 AI SDK。

ACP 的初始化受 provider 的 `initializeTimeoutMs`（默认 45 秒）、当前回合超时和对局截止时间共同约束；超时会取消初始化并回收 Agent/MCP 资源，迟到建立的会话也会关闭。`maxConcurrentSessions` 过去未生效，现已移除并拒绝该配置字段；ACP 仍为每个玩家保留独立会话。

## 本地运行

```bash
bun install
cp -R configs.example configs
# 在 configs/runtime/providers.json 中填入 OpenRouter API key。

# 使用 DeepSeek V4 Flash 跑六人或十二人对局
bun run --cwd backend run:six
bun run --cwd backend run:twelve

# 已有旧板子先预览迁移，再加 --apply 转换并保留备份
bun run --cwd backend config:migrate --configs-dir ../configs
# 脱敏检查配置，不调用模型
bun run --cwd backend config:check --configs-dir ../configs --game-config-name twelve_player_standard

# 只读取板子、使用受限观察机器人跑固定seed回归
bun run --cwd backend simulate --configs-dir ../configs.example --board twelve_player_standard --count 25
# 通过实际动作离线复现一盘对局，不调用模型
bun run --cwd backend replay:actions --record ../record/<session-id>/reproduction.json

# 使用 configs 中配置的 Codex ACP agent 跑十二人局
bun run --cwd backend run:twelve:acp

# 导出复盘；将 <session-id> 替换为 record/ 下的对局目录名
bun run --cwd backend export:replay -- --session <session-id> --out ./<session-id>.replay.json

# 启动离线复盘播放器
bun run dev:frontend
```

## 验证

```bash
bun run check          # 后端源码/测试/脚本 + 前端源码/测试/脚本
bun run lint           # 后端依赖边界与i18n检查 + 前端ESLint
bun run format:check   # 统一Prettier格式检查
bun run test           # 离线单测；部分使用本机假HTTP/MCP与ACP夹具

# 需要整理格式时单独提交格式变更
bun run format
```

类型门禁覆盖测试与夹具，后端脚本的 JavaScript 实现也参与检查；不通过排除文件或关闭严格选项避开错误。格式配置与 `.editorconfig` 使用两空格、LF 和文件末尾换行；本地秘密配置、构建产物和历史复盘 JSON 夹具不参加自动格式写入。检查命令不会启动真实 Agent 对局。

已实现行为以代码和测试为准。玩法扩充的目标、64 项角色、中英双语支持、阶段验收、交叉审查和提交要求见 [扩充路线](docs/expansion/roadmap.md)；计划功能在实现并验证后才登记为支持。

已有默认板子保持兼容。`configs.example/boards/awa_classic_pk_choice_12_v1.json` 提供完整的AWA具名竞选PK、放逐PK与死亡持徽者选择组合：首轮仅未上警者投警长、最多一次PK、再次平票/全弃票无徽或无人放逐、死亡警长选择继任者或撕徽。它不是网易或赛事的完整规则镜像；详细边界与参数见[警徽/投票契约](docs/expansion/contracts/sheriff-voting-policies.md)。示例不覆盖本地configs或改变省略参数默认；双语12人离线录制与严格Tape复现覆盖完整组合。

现有角色配置复核：预言家省略/空对象统一保留必选默认；猎人/狼王原生deathActionPolicy和石像鬼/通灵师/魔镜少女inspectionPolicy已连通有限AWA版本策略及实际Tape，详见[策略契约](docs/expansion/contracts/role-policy-configuration.md)。原审查范围仍在逐项复核，历史门禁不表示全部配置需求已交付。

公开翻牌与遗言支持保留AWA默认或显式选择网易2017局部具名条款，参数及信息披露/死亡波次边界见[公开死亡策略](docs/expansion/contracts/public-death-policies.md)。六人示例仅采用该来源的角色构成、屠城和局部条款，不宣称完整平台镜像。
