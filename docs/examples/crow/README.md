# 乌鸦公开示例

规则：[awa-netease-crow-v1](../../rules/awa-netease-crow-v1.md)。只支持规则卡列出的原生十二人牌组。

## 可运行配置

- 默认首轮附加一票：[board](../../../configs.example/boards/awa_crow_12_initial_ballot_only_v1.json)、[game](../../../configs.example/games/twelve_player_crow_initial_ballot_only.json)。
- 每轮附加一票的 AWA 变体：[board](../../../configs.example/boards/awa_crow_12_all_ballots_v1.json)、[game](../../../configs.example/games/twelve_player_crow_all_ballots.json)。

先只复制需要的 **board 与 game**，保留现有 `configs/runtime/`。以下命令使用 `cp -n` 避免覆盖同名本地配置：

```bash
mkdir -p configs/boards configs/games
cp -n configs.example/boards/awa_crow_12_*.json configs/boards/
cp -n configs.example/games/twelve_player_crow_*.json configs/games/
```

LLM 示例引用公开 Agent 名 `deepseek_v4_flash`；ACP 示例引用 `acp_default`。它们需在你现有 `runtime/agents.json` 中指向已配置的 Provider；若本地名称不同，只改对应 game 的 `agent` 引用。ACP 适配器和隔离启动器沿用本地已有接入。此处不复制 `runtime/backends.json`、不覆盖密钥、模型或认证，不需要在命令中传 API key。

默认首轮政策的两语入口：

```bash
# LLM，中文/英文玩家提示和终端。
bun run --cwd backend run --configs-dir ../configs --game-config-name twelve_player_crow_initial_ballot_only --locale zh-CN --display-locale zh-CN
bun run --cwd backend run --configs-dir ../configs --game-config-name twelve_player_crow_initial_ballot_only --locale en --display-locale en
# ACP，同一板子与规则；game只切换Agent和超时预算。
bun run --cwd backend run --configs-dir ../configs --game-config-name twelve_player_crow_initial_ballot_only_acp --locale zh-CN --display-locale zh-CN
bun run --cwd backend run --configs-dir ../configs --game-config-name twelve_player_crow_initial_ballot_only_acp --locale en --display-locale en
```

`all_ballots` AWA 变体的两语入口：

```bash
bun run --cwd backend run --configs-dir ../configs --game-config-name twelve_player_crow_all_ballots --locale zh-CN --display-locale zh-CN
bun run --cwd backend run --configs-dir ../configs --game-config-name twelve_player_crow_all_ballots --locale en --display-locale en
bun run --cwd backend run --configs-dir ../configs --game-config-name twelve_player_crow_all_ballots_acp --locale zh-CN --display-locale zh-CN
bun run --cwd backend run --configs-dir ../configs --game-config-name twelve_player_crow_all_ballots_acp --locale en --display-locale en
```

ACP game：[首轮政策](../../../configs.example/games/twelve_player_crow_initial_ballot_only_acp.json)、[全轮政策](../../../configs.example/games/twelve_player_crow_all_ballots_acp.json)。

`roles.crow` 的 `policy`、`ballotPolicy`、`actionPolicy`、`selfTarget` 均有严格解析与往返。省略角色参数时使用规则卡明确的默认；未知参数拒绝，不能借配置把乌鸦加入未支持的高级角色组合。

## 两语真实归档

[中文回放](zh-CN.replay.json)、[英文回放](en.replay.json)由固定脚本经本地 OpenAI 兼容合成服务、游戏工具接收与记录导出，不调用付费模型。场景为第1夜毒一狼、次日放逐一狼，第2／3日各再放逐一狼，乌鸦三夜分别诅咒当天被放逐的狼；最终好人胜利。使用种子 `crow-transport`，默认首轮政策，无警长当选。

这些是完整 God 视角教学样本，包含乌鸦秘密选择及底牌。授权玩家档案必须由运行导出器产生；不能把 God JSON 当作公开观众或普通玩家视角。秘密选择仅本人可见，公开附加票只带目标、日次、票轮和一票，不暴露乌鸦座位。

前端测试同时读取这两份真实样本，核时间线自然语言、逐帧状态与倒看：选择及附加票本身均不改变存活、警徽或公开身份；实际出局仍等放逐事实。
