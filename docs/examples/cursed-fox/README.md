# 咒狐公开配置示例

完整规则见[网易来源咒狐](../../rules/netease-cursed-fox-v1.md#cursed_fox)。固定独胜目标为 `netease_cursed_fox_last_faction_v1`，公开字段 `roles.cursed_fox` 只接受 `{}`；不提供刀免疫开关、提前独胜或不同计数方式。以下复用既有测试中的十／十二人 AWA 牌池，不据角色来源宣称完整官方赛事原板。

| 人数与牌池                       | 公开 board                                                                  | 中文／英文／ACP game                                                                                                                                                                                                      |
| -------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 10：咒狐、三狼、三民、预女猎     | [十人](../../../configs.example/boards/awa_netease_cursed_fox_10_v1.json)   | [中文](../../../configs.example/games/ten_player_cursed_fox.json)／[English](../../../configs.example/games/ten_player_cursed_fox_en.json)／[ACP](../../../configs.example/games/ten_player_cursed_fox_acp.json)          |
| 12：咒狐、四狼、三民、预女猎白痴 | [十二人](../../../configs.example/boards/awa_netease_cursed_fox_12_v1.json) | [中文](../../../configs.example/games/twelve_player_cursed_fox.json)／[English](../../../configs.example/games/twelve_player_cursed_fox_en.json)／[ACP](../../../configs.example/games/twelve_player_cursed_fox_acp.json) |

咒狐是真第三方，不认狼队、无夜聊／狼刀／自爆，正常参与发言、投票和警徽。免普通狼刀，但不免毒、放逐、枪或其它已说明的致死来源；预言家实际合法查验给非狼报告并在黎明使原生命死亡。咒狐没有主动工具或额外行动请求。

两板仅屠城。任何一个普通阵营全部实际出局且咒狐仍活时，由咒狐一人独胜；咒狐已死后沿普通屠城。先完成夜伤、死亡枪和全部连锁再检查，不能看原提案数组提前封盘。魔镜／幸运儿／摄梦等其它已交付交互遵规则卡的有限支持，未放进这两个示例不等于任意混搭都已验证。

## 运行

只复制 board／game，保留个人 runtime、认证及 ACP 隔离启动器：

```bash
mkdir -p configs/boards configs/games
cp -n configs.example/boards/awa_netease_cursed_fox_{10,12}_v1.json configs/boards/
cp -n configs.example/games/{ten,twelve}_player_cursed_fox*.json configs/games/
bun run --cwd apps/game run --configs-dir ../../configs --game-config-name ten_player_cursed_fox --locale zh-CN --display-locale zh-CN
bun run --cwd apps/game run --configs-dir ../../configs --game-config-name twelve_player_cursed_fox_en --locale en --display-locale en
bun run --cwd apps/game run --configs-dir ../../configs --game-config-name ten_player_cursed_fox_acp --locale zh-CN --display-locale zh-CN
bun run --cwd apps/game run --configs-dir ../../configs --game-config-name twelve_player_cursed_fox_acp --locale en --display-locale en
```

LLM 引用 `deepseek_v4_flash`，ACP 引用 `acp_default`，可换为个人 Agent 名；每板有中英 LLM 和可覆盖 locale 的 ACP game。不在 board／game 中写API key。

## 知情与验证来源

玩家只收到本人身份／独胜目标、依法授权的查验报告和公开死亡；狼刀免疫对象及查验致死因果不额外泄露给狼队或公开feed。God保留完整因果，不可把God回放作为玩家授权档案发送。中英显示改变系统语言，不改原话、事实、阵营或胜利成员。

本次仅补入口。两牌池直接取 `packages/game-runtime/tests/scenarios/boards/cursed-fox/simulation.test.ts` 的 `official_10`／`official_12` 已测声明，经原 `foxBoard` 生成；测试内部名字不作为本页官方原板的来源证据。既有死亡、原体验证和严格归档测试保持原合同，公开JSON另经parse及中英bootstrap校验，阶段矩阵逐局strict另验收。
