# 本地运行与配置检查

## 准备

使用根package.json声明的Bun版本安装依赖，先查看[配置契约](../contracts/configuration.md)。公开模板是configs.example，本地 configs、认证、ACP workspace 及 record 独立保存。

```bash
bun install
# 首次可启动工作台，按 GUI 引导添加 Agent，再创建板子和游戏。
bun run workbench
# 已有配置原地保留；完成认证后可关闭工作台，独立运行 CLI。
# 在 configs/runtime/backends.json 填认证，agents.json 配置 options。
bun run --cwd apps/game config:check --configs-dir ../../configs --game-config-name twelve_player_standard
```

检查输出是脱敏报告，不启动模型；错误不会回显原JSON。正常run不隐式fallback到examples或源码预设。没有授权时维护／验收工具不读取秘密配置，也不执行真实模型。

## 对局

```bash
bun run --cwd apps/game run:six
bun run --cwd apps/game run:twelve
bun run --cwd apps/game run:twelve:acp
```

这三条会按本地配置启动真实Agent，可能有网络／模型费用或外部进程。运行前需确认本地配置及预算。先确认 backend、并发／初始化预算、Agent 命令和输出根，再由操作者主动运行。

名字／人格与模型选择分开。选择优先级是席位→角色→默认；显式null清除人格，缺席继承，原字符串不翻译。不同玩家即使同 backend 也各有信息与工具权限，backend key不是整个机器的全局配额。

## 旧配置显式迁移

```bash
# 旧 runtime/providers + agents → schemaVersion 2；先预览
bun run --cwd apps/game config:migrate --configs-dir ../../configs --runtime
# 核对预览后应用，两个旧文件各保留 .v1.bak，不覆写已有 backends.json
bun run --cwd apps/game config:migrate --configs-dir ../../configs --runtime --apply
# 旧板子迁移是独立入口（不带 --runtime）
bun run --cwd apps/game config:migrate --configs-dir ../../configs
```

先校验再备份，目标独占发布。备份存在且字节不同应拒绝，不通过删除别人的文件或重试丢弃错误。完整参数仍以CLI帮助／实际parser为准。

记录与关闭失败应保错误；初始化失败或必需replay写失败使命令失败，不能只看最后一行日志判成功。

## Pi 原生 Agent

公开模板包含 `pi_native` backend、`pi_default` 及 OpenAI／Anthropic／智谱／Kimi 四种 Agent。将 `backends.json` 的 `config.auth` 替换成自己的 Pi 原生认证对象，或用整值 `${ENV_NAME}` 注入认证字段；`config.models` 是 Pi 原生模型目录对象。`agents.json` 中修改 `pi_default.options.defaultProvider`、`defaultModel` 和 `defaultThinkingLevel`，再将需要的 game 的 `agent` 设为 `pi_default`。完整字段责任见[配置契约](../contracts/configuration.md)，四模型混用、思考记录、内存与 OAuth 边界见[Pi 原生接入](pi-agent.md)。

Pi 与 `llm`／`acp` 可按席位或角色混用；公开模板的默认 Agent 保持原 LLM 示例。Pi 接入不读取宿主 `.pi` 中的认证或设置，模型访问仍使用真实网络与账户配额。仅 `config:check` 不启动模型。

## ACP 沙箱中的 MCP 依赖

[公开bwrap模板与合成canary](../../configs.example/acp/README.md)提供独立文件／环境边界；示例provider的裸命令只是占位接入，不自动形成沙箱。不要把整个仓库或record挂进玩家沙箱。

使用本地 bwrap 启动器时，`ACP_READONLY_ROOTS` 必须覆盖 MCP 入口的实际运行依赖，包括 `packages/game-contract`、`packages/game-text` 及其依赖目录。`node_modules` 中的 workspace 符号链接不会把目标目录带入沙箱；新增共享包或调整模块归属后，需要同步更新每个隔离 provider 的只读挂载。

ACP 会话能回复文本，不代表注入的游戏 MCP 已启动成功。若模型提示缺少 `submit_action`，先在相同沙箱内检查 MCP 启动、工具发现与提交。`ENOENT reading .../@ai-werewolf-arena/game-contract` 表示缺少共享包挂载。正常工具列表应包含 `get_game_schema`、`submit_action`、`report_bug`；终端出现回退发言不代表模型完成了工具提交。

## 典狱长原十二人

[典狱长示例](../examples/warden/README.md)给出仅复制本族 board/game 的步骤、两语 LLM／ACP 命令、秘密双方选择与完整 God 教学档。原十二人仅支持具名 `awa_melbourne_warden_v1`＋`awa_warden_partner_native_v1`；保留操作者已有 runtime 和隔离认证配置。

## 觉醒狼王原十／十二人

[觉醒狼王示例](../examples/awakened-wolf-king/README.md)给出两份来源牌池、中文／英文 LLM 与 ACP 入口、亲传／双爪及失败前缀的真实归档说明。仅复制本族 board/game，保留已有 runtime 和隔离认证；角色参数为严格 `{}`，具体死因和梦保护按具名 `awa_awakened_wolf_king_v1`。觉醒女巫来源板的独立政策与入口见下一节。

## 觉醒女巫原十二人板

[完整配置与两语命令](../examples/awakened-witch/README.md)包含公开board、中文／英文LLM与ACP示例，以及四夜真实God教学档。只复制对应board／game，保留个人`configs/runtime/`及已配置Agent。SDK中文入口：

```bash
bun run --cwd apps/game run --configs-dir ../../configs --game-config-name twelve_player_awakened_witch --locale zh-CN --display-locale zh-CN
```

当前精确牌池为三普狼、觉醒狼王、四民、预言家、守卫、猎人与觉醒女巫；三次调毒分别消耗1／2／3名新协助者。女巫看不到讨论、隐票或结果；终端私有显示与God回放不代表玩家可以获知这些秘密。其它牌池、复制、复活或任意药数开关仍拒绝。

## 原十／十二人暗夜星辰

[完整两语 LLM／ACP 入口](../examples/awakened-dark-stars/README.md)包含两份原 board、六份 game 和真实 God 教学帧。只复制所选 board／game，保留个人 runtime、模型认证与隔离启动器；`roles.awakened_wolf_beauty`／`roles.awakened_hunter`均严格 `{}`。十人中文 SDK 入口：

```bash
bun run --cwd apps/game run --configs-dir ../../configs --game-config-name ten_player_dark_stars --locale zh-CN --display-locale zh-CN
```

魅惑只给本人，原伤害替死付款只给God；巡猎给模型完整座位环和方向，不给隐藏狼候选。公开结果以实际死者为准，God回放不可作为玩家授权档发送。
