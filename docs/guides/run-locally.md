# 本地运行与配置检查

## 准备

使用根package.json声明的Bun版本安装依赖，先查看[配置契约](../contracts/configuration.md)。公开模板是configs.example，本地 configs、认证、ACP workspace 及 record 独立保存。

```bash
bun install
cp -R configs.example configs
# 仅在本地configs/runtime/providers.json填认证并核对Agent配置。
bun run --cwd backend config:check --configs-dir ../configs --game-config-name twelve_player_standard
```

检查输出是脱敏报告，不启动模型；错误不会回显原JSON。正常run不隐式fallback到examples或源码预设。没有授权时维护／验收工具不读取秘密配置，也不执行真实模型。

## 对局

```bash
bun run --cwd backend run:six
bun run --cwd backend run:twelve
bun run --cwd backend run:twelve:acp
```

这三条会按本地配置启动真实Agent，可能有网络／模型费用或外部进程。运行前需确认本地配置及预算。先确认provider、并发／初始化预算、Agent命令和输出根，再由操作者主动运行。

名字／人格与模型选择分开。选择优先级是席位→角色→默认；显式null清除人格，缺席继承，原字符串不翻译。不同玩家即使同provider也各有信息与工具权限，provider key不是整个机器的全局配额。

## 旧配置显式迁移

```bash
bun run --cwd backend config:migrate --configs-dir ../configs
# 核对预览后，操作者可加--apply；不复制examples覆盖本地认证。
```

先校验再备份，目标独占发布。备份存在且字节不同应拒绝，不通过删除别人的文件或重试丢弃错误。完整参数仍以CLI帮助／实际parser为准。

记录与关闭失败应保错误；初始化失败或必需replay写失败使命令失败，不能只看最后一行日志判成功。

## ACP 沙箱中的 MCP 依赖

使用本地 bwrap 启动器时，`ACP_READONLY_ROOTS` 必须覆盖 MCP 入口的实际运行依赖，包括 `packages/game-contract`、`packages/game-text` 及其依赖目录。`node_modules` 中的 workspace 符号链接不会把目标目录带入沙箱；新增共享包或调整模块归属后，需要同步更新每个隔离 provider 的只读挂载。

ACP 会话能回复文本，不代表注入的游戏 MCP 已启动成功。若模型提示缺少 `submit_action`，先在相同沙箱内检查 MCP 启动、工具发现与提交。`ENOENT reading .../@ai-werewolf-arena/game-contract` 表示缺少共享包挂载。正常工具列表应包含 `get_game_schema`、`submit_action`、`report_bug`；终端出现回退发言不代表模型完成了工具提交。

## 典狱长原十二人

[典狱长示例](../examples/warden/README.md)给出仅复制本族 board/game 的步骤、两语 LLM／ACP 命令、秘密双方选择与完整 God 教学档。原十二人仅支持具名 `awa_melbourne_warden_v1`＋`awa_warden_partner_native_v1`；保留操作者已有 runtime 和隔离认证配置。

## 觉醒狼王原十／十二人

[觉醒狼王示例](../examples/awakened-wolf-king/README.md)给出两份来源牌池、中文／英文 LLM 与 ACP 入口、亲传／双爪及失败前缀的真实归档说明。仅复制本族 board/game，保留已有 runtime 和隔离认证；角色参数为严格 `{}`，具体死因和梦保护按具名 `awa_awakened_wolf_king_v1`。觉醒女巫来源板在其独立交付前不开放。

## 觉醒女巫原十二人板

[完整配置与两语命令](../examples/awakened-witch/README.md)包含公开board、中文／英文LLM与ACP示例，以及四夜真实God教学档。只复制对应board／game，保留个人`configs/runtime/`及已配置Agent。SDK中文入口：

```bash
bun run --cwd backend run --configs-dir ../configs --game-config-name twelve_player_awakened_witch --locale zh-CN --display-locale zh-CN
```

当前精确牌池为三普狼、觉醒狼王、四民、预言家、守卫、猎人与觉醒女巫；三次调毒分别消耗1／2／3名新协助者。女巫看不到讨论、隐票或结果；终端私有显示与God回放不代表玩家可以获知这些秘密。其它牌池、复制、复活或任意药数开关仍拒绝。
