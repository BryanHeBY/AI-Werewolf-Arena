# 配置、默认值与有限支持

## 公开文件结构

正常配置只从显式 `configs-dir` 读取：`runtime/backends.json`、`runtime/agents.json`、`games/<name>.json`、`boards/<id>.json`，可选 `runtime/debug_summary.json`。两份 runtime 文件使用 `schemaVersion: 2`；板子独立使用 `version: 2`。正常运行不读取旧 `runtime/providers.json`，不搜索旧根路径、回退示例或覆盖本地秘密配置。

### 连接：backends.json

```json
{
  "schemaVersion": 2,
  "items": {
    "gateway": {
      "kind": "llm",
      "config": {
        "type": "openai",
        "apiKey": "${MODEL_API_KEY}",
        "baseURL": "https://example.invalid/v1"
      },
      "limits": { "maxConcurrentRequests": 4 }
    },
    "native_pi": {
      "kind": "pi",
      "config": {
        "models": { "providers": {} },
        "auth": { "openai": { "type": "api_key", "key": "${PI_API_KEY}" } }
      }
    },
    "local_acp": {
      "kind": "acp",
      "config": {
        "transport": "stdio",
        "command": "your-isolated-acp-launcher",
        "args": [],
        "env": {},
        "initializeTimeoutMs": 45000
      }
    }
  }
}
```

`kind` 区分 SDK 网关、Pi 原生 Agent 与 ACP 进程。`llm.config.type` 为 `openai`（含兼容网关）或 `anthropic`；连接支持 `apiKey`、可选 `baseURL`／`userAgent`。ACP 的 `command`、`args`、`env`、`cwd`、`initializeTimeoutMs` 属于连接，`transport` 仅支持 `stdio`。本地请求并发只放 `limits.maxConcurrentRequests`，为正安全整数。连接表没有 `default`，每个 Agent 必须显式引用连接。

Pi 的 `config.models` 和 `config.auth` 分别是原生 `models.json` 和 `auth.json` 的 JSON **对象内容**，不是文件路径。`models: { "providers": {} }` 表示不增补 Pi 自带模型目录。AWA parser 校验外壳和 JSON 结构；adapter 复用已安装包的公开 model／compat schemas，并对支持的原生 models 字段做有限注册映射。未知模型字段和未开放的执行资源拒绝，不承诺覆盖原生全部功能；Settings 保持原生结构并另受宿主安全限制。具体支持范围见 [Pi 接入指南](../guides/pi-agent.md)。运行时不从宿主 Pi 目录补认证或设置。

认证既可以直接填字符串，也可以填整个值为 `${ENV_NAME}` 的占位符。LLM `apiKey`／`baseURL`、ACP `env` 和 Pi 两份原生对象及 Agent 原生设置中的字符串支持该解析。字符串片段 `prefix-${ENV_NAME}` 不插值；缺失或空环境值只报告配置字段路径，不输出变量名或原值。正常加载不自动读取 `.env`，环境由启动者传入。

### 执行参数：agents.json

```json
{
  "schemaVersion": 2,
  "default": "standard",
  "items": {
    "standard": {
      "backend": "gateway",
      "options": {
        "model": "your-model-id",
        "temperature": 0.2,
        "maxTokens": 512,
        "reasoningEffort": "high"
      }
    },
    "pi_player": {
      "backend": "native_pi",
      "options": {
        "defaultProvider": "openai",
        "defaultModel": "your-pi-model-id",
        "defaultThinkingLevel": "medium"
      }
    },
    "acp_player": {
      "backend": "local_acp",
      "options": {
        "sessionReuse": "per_player",
        "actionTransport": "mcp",
        "sessionConfigOptions": { "fast-mode": true }
      },
      "personalityPrompt": "保持独立判断，用简短句子发言。"
    }
  }
}
```

Agent 的类别由引用的 backend 唯一决定，禁止重复写 `kind`／`provider` 或把参数平铺在顶层。`options` 未提供时视为 `{}`，显式 `null` 拒绝；LLM 仍必须提供 `options.model`。LLM 可设置 `temperature`、`maxTokens`、`reasoningEffort`、`thinkingEnabled`；ACP 可设置 `spawnArgs`、`sessionReuse`、`actionTransport`、`sessionConfigOptions`。Pi `options` 是原生 Settings 对象，保持原生字段结构，不将 LLM 的 `model` 等别名自动翻译成 Pi 设置。

`personalityPrompt` 是跨传输的 Agent 顶层字段。game 引用板子和 Agent；board 保存角色／机制参数；`debug_summary.agent.agentName` 引用既有 Agent，不能内联模型配置。内部 `RuntimeConfig.providers` 只是已解析连接表的兼容名称，不是第二份文件或备用配置来源。

## 解析、默认与组合是不同责任

纯shape／稳定枚举由共享契约拥有；生产有限支持、角色count、组合及政策分派由rulesets拥有；归档验证保独立的有限谓词。一个角色在Catalog有资料不表示任意板子支持它。多个角色共用一机制亦不等于可自由排列。

省略与空对象的默认值、未知字段／版本的拒绝、反向serialize次序都应由真实schema和贡献闭环。不能在提示里声明支持、运行时却忽略参数。normalizer按原贡献顺序调用；caller转换／getter可抛，前面的写入不统一回滚。

## 选择与限制

玩家Agent选择优先级是席位→角色→对局默认。personalityPrompt缺席继承Agent；显式null清除；原字符串／双语字典按既有locale回退规则解析。原始人格与名字不是应翻译的维护注释，也不应输出到脱敏报告。

超时、并发、天数等按实际schema接纳有限正值；不要根据某篇早期文档的角色数量推导现行支持。实际运行枚举与资料目录状态分别核对，有限支持及未开放变体从[规则卡](../rules/README.md)进入。

## 常用有限政策

- Seer显式actionPolicy区分必选与可选；省略／空对象保持同一当前默认。
- Hunter／WolfKing原生deathActionPolicy与复制／赠予枪来源分开；不能从持有者角色配置改写受赠枪政策。
- Gargoyle／Psychic／Mirror的查验政策与身份／伪装／接刀时序分开。
- 警长、放逐PK、死亡持徽选择、公开死亡和遗言采用具名有限政策，详见[对应契约](voting-and-public-death.md)。

完整版本／来源／未支持范围在各规则卡和实际公开board示例。板子JSON文件名同时是加载ID，不能随feature目录改名。`time-wolf-consort`组织slug不改变`awa_time_consort_12_v1`文件／board身份。

## 迁移与安全报告

旧板子迁移与 runtime 迁移是两个显式入口：

```bash
# 只预览旧 runtime/providers.json + agents.json 的 V2 转换
bun run --cwd backend config:migrate --configs-dir ../configs --runtime
# 核对预览后，显式应用
bun run --cwd backend config:migrate --configs-dir ../configs --runtime --apply
# 旧板子迁移沿用原入口，不迁移 runtime
bun run --cwd backend config:migrate --configs-dir ../configs
```

runtime 迁移先校验两个旧文件、全部 `games/*.json` 引用与可选审计配置；预检用合成环境值，不要求操作者交出真实 key。预览不写文件且报告不含名字、URL、命令、认证或人格。应用时独占创建 `providers.json.v1.bak`／`agents.json.v1.bak`，已有备份必须与本次源字节完全相同；随后独占发布 `backends.json`、替换 `agents.json`，最后移除已退役的 `providers.json`，原文保存在备份。已有 `backends.json` 一律拒绝覆盖，重复执行应先明确当前文件版本。

旧 ACP 连接的 `sessionConfigOptions` 默认值复制到每个引用 Agent 的 `options.sessionConfigOptions`，Agent 自己的同名键优先。key、环境占位符、命令、人格原文保持不变。迁移不改 boards、games 或 debug_summary 文件，也不会自动添加 Pi 连接。批量失败按原 owner 尽力补偿并保原错／回滚错，不承诺跨文件事务；备份可能在失败后保留。不能整目录复制 examples 覆盖现有密钥或人格。

config:check只给安全字段／来源与执行支持，不打印provider对象、认证、URL、命令参数或人格原文；未知输入拒绝也不回显JSON片段。运行方法见[本地指南](../guides/run-locally.md)；Pi 原生字段的有限映射、四模型示例、思考与 OAuth 内存边界见[Pi 接入指南](../guides/pi-agent.md)。
