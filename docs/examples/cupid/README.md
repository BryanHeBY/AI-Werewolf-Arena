# 丘比特两来源配置示例

完整规则见[丘比特来源策略](../../rules/sourced-cupid-v1.md#cupid)。两板使用同一套已有受限观察与严格复现测试的 AWA 十二人配置：丘比特、三普通狼、猎人、预言家、女巫、守卫、三平民和白痴；仅来源策略不同，不宣称该十二人组合是两个来源的完整官方原板。

| 来源政策                               | 公开 board                                                                          | 中文／英文／ACP game                                                                                                                                                                                                                  |
| -------------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `netease_2017_cupid_follows_lovers_v1` | [网易来源十二人](../../../configs.example/boards/awa_cupid_netease_12_v1.json)      | [中文](../../../configs.example/games/twelve_player_cupid_netease.json)／[English](../../../configs.example/games/twelve_player_cupid_netease_en.json)／[ACP](../../../configs.example/games/twelve_player_cupid_netease_acp.json)    |
| `lui_meme_lovers_only_v1`              | [Lui-même来源十二人](../../../configs.example/boards/awa_cupid_lui_meme_12_v1.json) | [中文](../../../configs.example/games/twelve_player_cupid_lui_meme.json)／[English](../../../configs.example/games/twelve_player_cupid_lui_meme_en.json)／[ACP](../../../configs.example/games/twelve_player_cupid_lui_meme_acp.json) |

首夜狼行动前必须连接两名不同活人，可以包括自己。情侣保留底牌、原生技能与真实阵营；只互认玩家ID，不互看底牌。关系胜利归属独立于真实阵营，不能凭互认推知对方是狼。

两来源的主要分歧：网易版独立丘比特跟随情侣获胜，人狼恋时可与两人同存；Lui-même版未被选入情侣的丘比特仍随好人，人狼情侣独胜必须消灭他。只有Lui-même版禁止情侣相互放逐投票；网易来源未确认该限制，不把另一来源规则默默套入。两板都只使用屠城；先完成殉情和全部死亡链再检查关系独胜／阵营胜利。

## 运行

只复制 board／game，不覆盖个人 runtime、认证或 ACP 隔离启动器：

```bash
mkdir -p configs/boards configs/games
cp -n configs.example/boards/awa_cupid_{netease,lui_meme}_12_v1.json configs/boards/
cp -n configs.example/games/twelve_player_cupid*.json configs/games/
bun run --cwd apps/game run --configs-dir ../../configs --game-config-name twelve_player_cupid_netease --locale zh-CN --display-locale zh-CN
bun run --cwd apps/game run --configs-dir ../../configs --game-config-name twelve_player_cupid_lui_meme_en --locale en --display-locale en
bun run --cwd apps/game run --configs-dir ../../configs --game-config-name twelve_player_cupid_netease_acp --locale zh-CN --display-locale zh-CN
bun run --cwd apps/game run --configs-dir ../../configs --game-config-name twelve_player_cupid_lui_meme_acp --locale en --display-locale en
```

LLM 引用 `deepseek_v4_flash`，ACP 引用 `acp_default`；可替换为个人 `runtime/agents.json` 已配置的 Agent 名。每板均有中英 LLM 和一份可覆盖 locale 的 ACP game。

## 知情与验证来源

丘比特本人只知道所选两人；双方只获彼此ID。原阵营、秘密分组和显式胜利归属仅God保留，不进入玩家DTO。God回放不能当作玩家授权档案发送；终端私有开关不会改变feed受众，玩家原话不随系统locale翻译。

本次仅补公开配置与运行说明，不改已交付规则。牌池直接取 `packages/game-runtime/tests/scenarios/boards/cupid/observed-simulation.test.ts` 的两策略十二人声明，经 `cupidBoard` 生成；两来源均有既有受限观察、多种殉情／枪／梦交互及严格Tape覆盖。公开JSON另经实际parse及中英bootstrap校验，阶段总体逐局strict由发布矩阵验收。
