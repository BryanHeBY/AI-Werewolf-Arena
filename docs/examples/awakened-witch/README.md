# 觉醒女巫公开示例

规则：[AWA 觉醒女巫](../../rules/awa-awakened-witch-v1.md)。当前只支持网易原十二人牌池：三普通狼、觉醒狼王、四平民、预言家、守卫、猎人与觉醒女巫；无摄梦人或其它复制、复活、替身组合。

## 可运行配置

[十二人 board](../../../configs.example/boards/awa_awakened_witch_12_v1.json)、[中文 LLM game](../../../configs.example/games/twelve_player_awakened_witch.json)、[英文 LLM game](../../../configs.example/games/twelve_player_awakened_witch_en.json)、[ACP game](../../../configs.example/games/twelve_player_awakened_witch_acp.json)。只复制 board 和 game，保留个人 runtime：

```bash
mkdir -p configs/boards configs/games
cp -n configs.example/boards/awa_awakened_witch_12_v1.json configs/boards/
cp -n configs.example/games/twelve_player_awakened_witch*.json configs/games/
```

LLM 引用 `deepseek_v4_flash`，ACP 引用 `acp_default`；可改成自己 `runtime/agents.json` 已有的 Agent 名，沿用个人模型、Provider、认证与隔离启动器。无需复制公开 runtime 或在命令行提供 API key。

```bash
bun run --cwd backend run --configs-dir ../configs --game-config-name twelve_player_awakened_witch --locale zh-CN --display-locale zh-CN
bun run --cwd backend run --configs-dir ../configs --game-config-name twelve_player_awakened_witch_en --locale en --display-locale en
bun run --cwd backend run --configs-dir ../configs --game-config-name twelve_player_awakened_witch_acp --locale zh-CN --display-locale zh-CN
bun run --cwd backend run --configs-dir ../configs --game-config-name twelve_player_awakened_witch_acp --locale en --display-locale en
```

`roles.awakened_witch` 只接受 `{}`，解析为固定政策 `awa_awakened_witch_v1`；不支持自行改变药数、参与次数或秘密范围的开关。

## 三次调毒与秘密边界

觉醒女巫有一瓶不可自救的解药、三次调毒机会。解药只救基础刀口；调毒依次需要一、二、三名未参与过的新协助者，可以把毒目标选为协助者，也可以毒自己；女巫不能自己协助。每个人整局只参与一次。发起先消耗次数及资格，否决不退款。

本组协助者只获知目标、组员座位和第几次调毒，逐个秘密讨论，再分别提交不可互看的同意或否决；全部同意才产生普通毒。没有回复是失败，不能当作否决。女巫本人只知道自己的已付选择和剩余资源，不知道协作发言、批准票或结果。God 保留完整历史及最终提案，实际夜死另行结算；不能凭调毒结果认证任何身份。

秘密选择、讨论和本人票均受历史受众隔离；God 结果不进入任一玩家 feed。终端 `printPrivateEvents` 仅控制私有显示。Web 的 God 回放含秘密组、隐藏票与角色，不可作为玩家授权回放发送。调毒事实不直接改生命、警徽或公开角色；原生猎人与狼爪仍只按真实死亡及完整死因决定是否可开枪，纯毒或混合带毒均禁枪。

## 两语真实教学归档

[中文回放](zh-CN.replay.json)、[英文回放](en.replay.json)为本地合成模型经实际 SDK 工具、正式引擎及录制导出的四夜完整 God 对局，不调用付费服务。

- N1，3 号觉醒女巫选 9 号协助，毒 4 号；独立同意后产生毒。
- N2，用 5、11 号协助，目标为 11 号；11 号自己否决，未产生毒，第二次机会和两人的资格仍消耗。
- N3，使用唯一解药救基础刀口 7 号。
- N4，6、10、12 号协助第三次调毒，全部同意毒 8 号觉醒狼王；其真实毒死后两爪失效，无伪造枪击，好人胜利。

相同两份文件由前端测试读取，核五类调毒事实的自然语言、原话保留、关联席位、时间线与帧倒看。该样本展示一／二／三人、否决、救人和禁枪；缺失／迟到及并发付款前缀由独立实际协议测试覆盖。
