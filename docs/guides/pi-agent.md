# Pi 原生 Agent 接入

Pi 与现有 LLM SDK、ACP 共用玩家提示、工具权限、回合期限和 AWA 记录器。Pi 自己保存完整对话、工具结果与压缩摘要；AWA 只追加本轮行动提示和新可见事件，不另建一份 Pi 聊天历史。

本文对应锁定的 `@earendil-works/pi-coding-agent`／`pi-ai` **1.3.0**。配置外壳见[配置契约](../contracts/configuration.md)，初始化／旧配置迁移见[本地运行指南](run-locally.md)。模型 ID 是本次安装包内置目录的实际 chat 条目，不代表账户一定有权限、套餐限额或远端模型始终可用；本次实现没有调用付费 API 验证这些账户能力。

## 公开例子：一个连接、四种模型

[`runtime/backends.json`](../../configs.example/runtime/backends.json) 的 `pi_native` 连接保存原生模型／认证对象；[`runtime/agents.json`](../../configs.example/runtime/agents.json) 中的下列 Agent 都引用它：

| Agent                     | Pi provider ID  | Pi chat model ID    |
| ------------------------- | --------------- | ------------------- |
| `pi_default`／`pi_openai` | `openai`        | `gpt-6-luna`        |
| `pi_anthropic`            | `anthropic`     | `claude-sonnet-5-5` |
| `pi_glm`                  | `zai-coding-cn` | `glm-5.3-flash`     |
| `pi_kimi`                 | `kimi-coding`   | `k3`                |

`zai-coding-cn` 使用内置的智谱国内 Coding Plan 地址；`kimi-coding` 使用内置 Kimi Coding 地址。这些 ID 区分于其它通用 API provider；套餐 key 应填在对应的 `config.auth` 条目中。切换模型仅需调整 Agent 的原生 `options.defaultProvider`／`defaultModel`；推理档位使用 `defaultThinkingLevel`，由 Pi 按模型能力映射。

六人与十二人示例按座位循环选择以上四个 Agent，仍由原板子分配身份：

```bash
# 仅首次创建配置目录时复制整个模板；已有 configs 时手工合并 Pi runtime 条目及这两份 game。
# 填好 backends.json 中的占位认证后，先检查：
bun run --cwd backend config:check --configs-dir ../configs --game-config-name six_player_pi
bun run --cwd backend config:check --configs-dir ../configs --game-config-name twelve_player_pi
# 下列命令由操作者主动启动，会访问配置的模型服务：
bun run --cwd backend run --configs-dir ../configs --game-config-name six_player_pi --locale zh-CN --display-locale zh-CN
bun run --cwd backend run --configs-dir ../configs --game-config-name twelve_player_pi --locale en --display-locale en
```

只使用一个模型时，将 game 的 `agent` 设为相应 Pi Agent，并移除示例中的 `players` 绑定；否则席位选择优先于默认。也可按原有 `roleAgents`／`players.<seat>.agent` 与 LLM／ACP 混用。`pi_native.limits.maxConcurrentRequests` 在本局中由这个连接下的所有 Pi 玩家共享，各席位会话和可见事件仍隔离。

认证可直接填字符串，也可用整个值为 `${PI_API_KEY}` 的环境占位符。默认模板仅含 `YOUR_*` 合成占位字符串，不包含认证；没有填好的 provider 可删除其 auth 条目及未使用 Agent，再调整游戏绑定。`config:check` 执行无会话、无网络的静态验证，不证明 key 有效或模型有授权。

## 原生 models 与 Settings 的有限支持

`config.models` 使用原生 [models schema](https://pi.dev/schemas/models.schema.json) 的对象形状；`{"providers":{}}` 使用打包目录而不添加覆盖。Settings 字段说明对应原生 [settings schema](https://pi.dev/schemas/settings.schema.json)。无需为内置模型重复写 base URL、价格、上下文容量或工具兼容参数。

AWA 使用依赖包公开的 model／compat schemas 校验核心字段，再通过公开 `registerProvider` 做**显式有限映射**；没有导入包内部文件解析器，也不声称支持原生所有资源和插件能力。当前模型覆盖接受 provider 的 `baseUrl`、`api`、`apiKey`、`headers`、`authHeader`、`compat`、`models`、`modelOverrides`；模型条目支持 `id`、`name`、`api`、`baseUrl`、`reasoning`、`thinkingLevelMap`、`input`／`inputLimits`、`cost`、`promptCache`、`contextWindow`、`maxTokens`、`samplingParams`／`samplingParamsByThinkingLevel`、`headers`、`compat`。未知模型字段拒绝；没有设置的字段按本适配器与 SDK 的已实现默认值归一。

`modelOverrides` 合并已有模型；自定义 `models` 可声明兼容端点。不能用这个入口注入运行代码、provider 扩展或 `oauth: "radius"`；原生 `!command` 型 key／header 明确拒绝。OAuth 使用下面的 `config.auth` 原生凭据结构，不放进 models 的 provider 扩展字段。版本更新后新增原生字段，需先更新有限映射与测试，不能仅凭 SDK 接纳就绕过 AWA 边界。

## 内存、工具与思考

- `models`／`auth` 从已解析配置注入 SDK 内存 store；会话、Settings、压缩摘要也只在内存中。不会发现宿主／项目 Pi 目录、加载 AGENTS 文件或写 Pi session／认证／模型缓存。
- 玩家只启用 `get_game_schema`、`submit_action`、`report_bug`；审计使用独立工具和会话。默认文件／搜索／shell 工具关闭，原生资源发现返回空集合，不能通过模型添加工具取得文件或进程权限。
- `packages`、`extensions`、`skills`、`prompts`、`themes`、`defaultTools`、`mcpServers` 的非空配置拒绝；不支持原生插件／包／MCP 发现。`cacheWarming` 只接受 `off`，省略时也关闭，避免预热增加本局之外的请求。
- `printThinking`／`printLlmIo` 仅控制终端显示。上游实际发出的思考和消息始终进入 AWA 私有玩家轮次记录；未提供思考内容的模型不会被补造思考。公共 God 回放不包含这些私有思考正文。
- 超时、取消或失败会撤回本轮工具回调并退役会话；关闭等待实际 SDK、工具及已开始的凭据刷新工作结算。下一轮新会话重新取得当前可见事实，不继续使用失败会话的游标。

AWA 的 `record/<session>/players/player_*.json`、严格复现文件及调试产物仍按原记录政策落盘。Pi 不创建自己的持久化文件，不会关闭 AWA 已授权的记录；逐玩家档案及严格复现也不应当作公共回放分享。

## OpenAI OAuth 原生结构

将 `pi_native.config.auth.openai` 替换为已有 Pi 原生 OpenAI 凭据对象，结构例如：

```json
{
  "type": "oauth",
  "access": "YOUR_OPENAI_ACCESS_TOKEN",
  "refresh": "YOUR_OPENAI_REFRESH_TOKEN",
  "expires": 1900000000000,
  "clientId": "YOUR_PI_OPENAI_CLIENT_ID",
  "scopes": [
    "openid",
    "profile",
    "email",
    "offline_access",
    "resource.invoke",
    "chatgpt.tokens.use.direct"
  ]
}
```

以上是结构占位；`expires` 必须换成真实凭据的有效毫秒时间戳，不能照抄示意值。`clientId` 是发行方返回的安装客户端 ID，原生刷新要求它非空；`scopes` 按本地 SDK 的申请范围列示，实际应保留原凭据返回的字段和范围，不能手工添加授权。该对象是 provider `openai` 的条目，不是整份 backends 文件；本接入不自动读取或转换 `~/.codex/auth.json`／`~/.pi/agent/auth.json`，也不启动交互登录。

Pi 在需要时执行原生 token 刷新，并仅更新本次运行的内存凭据，不改写 `backends.json` 或源 auth JSON。关闭后刷新结果不会自动持久化；若服务轮换 refresh token，操作者需自行管理后续凭据，不能指望重启后原文件被自动更新。API key、access／refresh token 及个人配置不得提交到仓库。

## 复用本地 Codex 登录与 fast

已有 `~/.codex/auth.json` 的 ChatGPT 订阅登录应使用 Pi provider **`openai-codex`**。它与上一节的 `openai` OAuth 不同：原生凭据使用 `accountId`，从 Codex 的 `tokens.access_token`、`tokens.refresh_token`、`tokens.account_id` 导入，`expires` 使用 access token 的真实毫秒过期时间；不能把这组 token 当作普通 OpenAI API key。

当前接入将凭据导入本地 `configs/runtime/backends.json`，不自动发现或改写 Codex 的认证文件。导入的是当时的凭据快照，Pi 后续刷新仍仅保存在内存；Codex 重新登录或凭据失效后需重新同步。

原生 Settings 用 `defaultThinkingLevel: "medium"` 设置推理档位。fast 放在同一连接的原生模型覆盖中，例如：

```json
{
  "providers": {
    "openai-codex": {
      "modelOverrides": {
        "gpt-6-luna": { "samplingParams": { "service_tier": "fast" } },
        "gpt-6.1-sol": { "samplingParams": { "service_tier": "fast" } }
      }
    }
  }
}
```

上面是 backend 的 `config.models` 内容。Pi 1.3 的 Codex simple 传输不会自动使用该采样字段，AWA 通过公开 `onPayload` 钩子将其映射到实际请求的 `service_tier`。旧 Codex 订阅端点拒绝字面值 `fast`，因此只在 `openai-codex-responses` 传输中将其转换为等价的 `priority`；[官方说明](https://developers.openai.com/api/docs/guides/fast-mode)确认这两个名称代表相同服务档位。未配置时不补该字段，其它传输保持原生行为。

本地合成 HTTP 测试复现端点对 `fast` 的拒绝，核对两款模型都发送 `reasoning.effort: "medium"` 与 `service_tier: "priority"` 并正常完成响应。实际 fast 可用范围仍由[官方说明](https://learn.chatgpt.com/docs/agent-configuration/speed)和账户服务端决定，配置检查不验证账户权限。

## 日常对局的思考等级

公开 Pi Agent 示例统一使用 `defaultThinkingLevel: "low"`。本地 Codex、Claude Code 和 Pi 接入中已显式设置的推理等级也建议先用 `low`，缩短长思考占用；Pi 最终仍按模型原生能力映射等级。`printThinking` 只控制是否显示思考，不改变推理等级或请求期限。
