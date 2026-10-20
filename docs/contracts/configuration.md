# 配置、默认值与有限支持

## 公开文件结构

正常配置只从显式 `configs-dir` 读取：`runtime/backends.json`、`runtime/agents.json`、`games/<name>.json`、`boards/<id>.json`，可选 `runtime/debug_summary.json`。两份 runtime 文件使用 `schemaVersion: 2`；板子独立使用 `version: 2`。正常运行不读取旧 `runtime/providers.json`，不搜索旧根路径、回退示例或覆盖本地秘密配置。

工作台的首次编辑允许两份 runtime 文件暂为 `{ "schemaVersion": 2, "items": {} }`：只补缺失文件，已有原文不覆盖。编辑目录解析器复用同一份条目校验，允许先保存连接、后保存首个 Agent；首个 Agent 由 GUI 写入 `default`。这些空骨架仅供配置阶段使用，正常 CLI／启动检查仍拒绝空连接或空 Agent，不把不完整目录视为可执行对局。

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
      "customInstructions": { "text": "保持独立判断，用简短句子发言。" }
    }
  }
}
```

Agent 的类别由引用的 backend 唯一决定，禁止重复写 `kind`／`provider` 或把参数平铺在顶层。`options` 未提供时视为 `{}`，显式 `null` 拒绝；LLM 仍必须提供 `options.model`。LLM 可设置 `temperature`、`maxTokens`、`reasoningEffort`、`thinkingEnabled`；ACP 可设置 `spawnArgs`、`sessionReuse`、`actionTransport`、`sessionConfigOptions`。Pi `options` 是原生 Settings 对象，保持原生字段结构，不将 LLM 的 `model` 等别名自动翻译成 Pi 设置。

`customInstructions` 是 LLM、ACP、Pi 共用的 Agent 顶层字段，不放入传输专属的 `options`。game 引用板子和 Agent；board 保存角色／机制参数；`debug_summary.agent.agentName` 引用既有 Agent，不能内联模型配置。内部 `RuntimeConfig.providers` 只是已解析连接表的兼容名称，不是第二份文件或备用配置来源。

## 解析、默认与组合是不同责任

工作台编辑原始文件及内容摘要，运行 parser 的环境解析结果不写回 JSON。表单与源码共用文档；保存前校验字段／引用／板子支持并检测外部修改。密钥保留标记仅属于编辑协议，不是可执行配置；服务端从同版本原文恢复后再校验。新增平台向导仍写入上述 backends／agents 结构，不增加第二套模型配置。操作流程见[工作台指南](../guides/workbench.md)。

纯shape／稳定枚举由共享契约拥有；生产有限支持、角色count、组合及政策分派由rulesets拥有；归档验证保独立的有限谓词。一个角色在Catalog有资料不表示任意板子支持它。多个角色共用一机制亦不等于可自由排列。

省略与空对象的默认值、未知字段／版本的拒绝、反向serialize次序都应由真实schema和贡献闭环。不能在提示里声明支持、运行时却忽略参数。normalizer按原贡献顺序调用；caller转换／getter可抛，前面的写入不统一回滚。

## 选择与限制

### 玩家编号与可选昵称

对局 `players` 按座位配置，`name` 与 `agent`、`customInstructions` 独立；普通对局无须填写任何名字：

```json
{
  "players": {
    "1": { "name": "苏茶茶" },
    "2": { "name": "沈砚舟", "agent": "pi_openai" },
    "3": { "agent": "pi_glm" }
  }
}
```

昵称缺省时，配置、身份组件、公开名册和新录制均保留字段缺席，不生成“玩家N”等默认昵称。姓名不可为空白、超过 120 个 UTF-16 码元或含控制字符／换行；合法原文与空格保留，允许重名。中文显示 `8号`／`8号·沈砚舟`，英文显示 `Player 8`／`Player 8·沈砚舟`；昵称本身不翻译。

公开身份契约 `PublicPlayerIdentity` 只包含 `id`、`seat` 和可选 `name`。ID 是行动和记录关联键，座位描述位置，昵称只供交流与展示；不能用昵称提交行动、定位目标或授予权限。更换 LLM／ACP／Pi 后端不改变玩家名字，单局内没有改名行动。

### 自定义指令与 Agent 选择

Agent 选择优先级为 `players.<seat>.agent` → `roles.<role>.agent` → 对局 `agent` → Agent 文件默认值。
`roles` 与 `players` 都使用对象形式，`agent` 可缺省；换模型不会跳过角色或全局指令。
`spawnArgs` 仅用于显式绑定 ACP Agent 的角色或席位，并追加到该 Agent 的启动参数。

自定义指令按以下顺序组合，作用于发牌后各玩家自己的提示：

```text
所选 Agent.customInstructions → game.customInstructions
  → game.roles.<role>.customInstructions → game.players.<seat>.customInstructions
```

每层使用同一种对象结构：

| 写法                                    | 行为                                     |
| --------------------------------------- | ---------------------------------------- |
| 字段缺省                                | 继承此前附加指令                         |
| `{ "text": "正文" }`                    | 默认 `append`，用空行追加正文            |
| `{ "mode": "append", "text": "正文" }`  | 显式追加                                 |
| `{ "mode": "replace", "text": "正文" }` | 清除此前附加指令，使用当前正文           |
| `{ "mode": "clear" }`                   | 清除此前附加指令；后续更具体的层仍可追加 |

`replace`／`clear` 只影响配置层的附加指令。基础系统提示中的身份、规则、可见信息和工具协议始终由系统生成。
指令可以描述表达风格、策略偏好和互动要求；必须强制执行的游戏机制由板子配置与引擎实现。
`append` 不分析文本冲突，互斥要求应显式使用 `replace`。

```json
{
  "board": "twelve_player_standard",
  "agent": "pi_default",
  "customInstructions": {
    "text": "本局是欢乐局，所有玩家都是猫娘，每个完整句子以‘喵’收尾。"
  },
  "roles": {
    "wolf": {
      "customInstructions": { "text": "喜欢把狼队夜聊演成猫猫秘密会议。" }
    }
  },
  "players": {
    "1": { "name": "奶糖", "customInstructions": { "text": "你的语气甜甜的。" } },
    "2": { "customInstructions": { "mode": "replace", "text": "使用简短冷静的表达。" } },
    "3": { "customInstructions": { "mode": "clear" } }
  }
}
```

上例 1 号追加个人风格，2 号只保留自己的附加指令（不再继承全局句尾要求），3 号没有附加指令。
完整中英示例见 `configs.example/games/twelve_player_pi_miao.json`；其他未单独配置的席位自动继承全局要求。
`game.roles` 是 Agent／指令绑定；`boards/*.json` 内的 `roles` 仍是角色机制参数，两者归属不同文件。

`text` 接受非空字符串或 `{ "zh-CN": "中文正文", "en": "English text" }`，语言表至少包含一种语言。
各层独立按对局 `locale` 选择文本，缺少目标语言时优先中文、再英文，并记录不含正文的字段路径诊断。
正文保留原文，不翻译、不解析 `${ENV}` 占位符；姓名同样保留原文。
`null`、空正文、未知模式、未知语言、`clear` 携带 `text` 均被拒绝。
正常加载器只接受当前写法，旧 `personalityPrompt`、`playerAgents`、`roleAgents` 会报未知字段。
配置检查摘要只输出指令存在状态与操作模式，不输出指令正文；全局玩家指令不注入审计 Agent。

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
bun run --cwd apps/game config:migrate --configs-dir ../../configs --runtime
# 核对预览后，显式应用
bun run --cwd apps/game config:migrate --configs-dir ../../configs --runtime --apply
# 旧板子迁移沿用原入口，不迁移 runtime
bun run --cwd apps/game config:migrate --configs-dir ../../configs
```

runtime 迁移先校验两个旧文件、全部 `games/*.json` 引用与可选审计配置；预检用合成环境值，不要求操作者交出真实 key。预览不写文件且报告不含名字、URL、命令、认证或人格。应用时独占创建 `providers.json.v1.bak`／`agents.json.v1.bak`，已有备份必须与本次源字节完全相同；随后独占发布 `backends.json`、替换 `agents.json`，最后移除已退役的 `providers.json`，原文保存在备份。已有 `backends.json` 一律拒绝覆盖，重复执行应先明确当前文件版本。

旧 ACP 连接的 `sessionConfigOptions` 默认值复制到每个引用 Agent 的 `options.sessionConfigOptions`，Agent 自己的同名键优先。key、环境占位符、命令、人格原文保持不变。迁移不改 boards、games 或 debug_summary 文件，也不会自动添加 Pi 连接。批量失败按原 owner 尽力补偿并保原错／回滚错，不承诺跨文件事务；备份可能在失败后保留。不能整目录复制 examples 覆盖现有密钥或人格。

config:check只给安全字段／来源与执行支持，不打印provider对象、认证、URL、命令参数或人格原文；未知输入拒绝也不回显JSON片段。运行方法见[本地指南](../guides/run-locally.md)；Pi 原生字段的有限映射、四模型示例、思考与 OAuth 内存边界见[Pi 接入指南](../guides/pi-agent.md)。
