# 禁言长老公开示例

规则：[AWA 墨尔本禁言长老](../../rules/awa-melbourne-silence-elder-v1.md)。有限板采用四狼、四民、预言家、女巫、猎人与禁言长老；仅支持规则卡列明的原生组合。

## 可运行配置

[十二人 board](../../../configs.example/boards/awa_silence_elder_12_gestures_v1.json)、[LLM game](../../../configs.example/games/twelve_player_silence_elder.json)、[ACP game](../../../configs.example/games/twelve_player_silence_elder_acp.json)。只复制 board 与 game，保留现有 `configs/runtime/`，使用 `cp -n` 避免覆盖同名本地配置：

```bash
mkdir -p configs/boards configs/games
cp -n configs.example/boards/awa_silence_elder_12_gestures_v1.json configs/boards/
cp -n configs.example/games/twelve_player_silence_elder*.json configs/games/
```

LLM 示例引用 `deepseek_v4_flash`，ACP 示例引用 `acp_default`。将 game 中的 Agent 名改为现有 `runtime/agents.json` 中已配置的名字即可；沿用本地 Provider、模型、隔离启动器和认证，不复制公开示例的 runtime 或在命令行填写 API key。

中文与英文入口：

```bash
bun run --cwd apps/game run --configs-dir ../../configs --game-config-name twelve_player_silence_elder --locale zh-CN --display-locale zh-CN
bun run --cwd apps/game run --configs-dir ../../configs --game-config-name twelve_player_silence_elder --locale en --display-locale en
bun run --cwd apps/game run --configs-dir ../../configs --game-config-name twelve_player_silence_elder_acp --locale zh-CN --display-locale zh-CN
bun run --cwd apps/game run --configs-dir ../../configs --game-config-name twelve_player_silence_elder_acp --locale en --display-locale en
```

`roles.silence_elder` 只接受 `{ "policy": "awa_melbourne_gestures_v1" }`，省略时取同一默认政策。未知字段、任意死因开关或未交付的高级混板拒绝。

## 观察与展示

每夜必须选择一名存活目标，可自选或连选；可指定另一名存活玩家为译者，或明确不指定。匿名公告在实际夜死、遗言、警徽及首日选举之后、普通讨论开始前发布，不公开长老座位。仅当天普通讨论及放逐 PK 中，目标的发言被替换为文字动作；竞选、遗言、狼聊、技能和投票权不受限制。

译者看到已发表的动作原文，可自由作个人解读，或以 `text: null` 明确拒译。译文属于玩家观点，不是引擎验人；动作描述与译文保留用户原文，不随界面语言改写。没有译者或原译者已死亡时不会伪造拒译。每份动作与译文只改变时间线，不直接改变生命、公开角色、警徽或票权。

夜选只对长老本人可见；明确拒译只对译者本人可见；日末到期仅 God 可见。终端 `printPrivateEvents` 控制私有展示；实际玩家投影始终按事件受众隔离。God 回放包含秘密选择和角色牌，不可作为玩家授权档案发送。

## 两语真实教学归档

[中文回放](zh-CN.replay.json)、[英文回放](en.replay.json)来自固定三夜计划经本地 OpenAI 兼容合成服务、实际游戏工具和录制导出，不调用付费模型。三夜分别禁言第二只狼、第三只狼与长老本人，指定预言家、平民、预言家为译者；前两次发表个人译文，第三次明确拒译。三日实际放逐剩余狼人后好人胜利。种子为 `silence-elder-transport`，没有警长当选。

这是完整 God 视角教学样本，包含秘密夜选、拒译与到期，不是玩家授权档案。前端测试读取相同两份文件，核六类事实的自然语言、关联席位、逐帧状态和倒看；所有禁言事实本身不改变生命、公开身份与警徽。实际淘汰仍只响应对应死亡事实。
