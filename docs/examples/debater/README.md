# 杠精文字版公开示例

完整来源与改编见[AWA墨尔本杠精](../../rules/awa-melbourne-debater-v1.md#debater)。政策 `awa_melbourne_2026_speech_gap_v1` 把线下打断／限时挑战改为有限文字请求；不会在另一Agent正在生成发言时抢占，也不伪造三分钟计时。

| 人数与牌池                                         | 公开 board                                                                 | 中文／英文／ACP game                                                                                                                                                                                             |
| -------------------------------------------------- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 6：杠精、猎人、狼、女巫、预言家、平民，AWA已测缩编 | [六人](../../../configs.example/boards/awa_melbourne_debater_6_v1.json)    | [中文](../../../configs.example/games/six_player_debater.json)／[English](../../../configs.example/games/six_player_debater_en.json)／[ACP](../../../configs.example/games/six_player_debater_acp.json)          |
| 12：杠精、预女猎、四狼、四民，来源十二人角色构成   | [十二人](../../../configs.example/boards/awa_melbourne_debater_12_v1.json) | [中文](../../../configs.example/games/twelve_player_debater.json)／[English](../../../configs.example/games/twelve_player_debater_en.json)／[ACP](../../../configs.example/games/twelve_player_debater_acp.json) |

两板关闭警长／自爆、使用现有AWA屠城及夜序，不能据十二人角色相同声称赛事整套流程完全复刻。`roles.debater.policy` 只接受上面的具名文字政策，不开放任意改人数阈值／计时／次数的开关。

## 挑战、匿名表决与权限

整局最多一次合法挑战，每名普通放逐发言者开始前可选当前待发言者作为目标；不是本人挑战窗口，也不插入PK。合法翻牌后挑战者先、目标后各一次公开辩论，再由当时冻结的全部活人匿名表决。支持必须严格大于冻结人数的一半；true／false／null分别是支持／反对／弃权，警长即使在其它已支持配置中也不加权。

成功使目标跳过本轮常规发言并失去本日常规放逐／PK票，失败或平票使杠精本人失票。挑战已合法接受后不退款；后续请求失败、撤权不能伪造通过或完成结果。禁票绑原生命与日次，不改变永久票权，下一日不继承。PK发言本身不因这次常规发言中止而被禁止。

## 运行

仅复制 board／game，保留个人 runtime、认证与 ACP 隔离：

```bash
mkdir -p configs/boards configs/games
cp -n configs.example/boards/awa_melbourne_debater_{6,12}_v1.json configs/boards/
cp -n configs.example/games/{six,twelve}_player_debater*.json configs/games/
bun run --cwd apps/game run --configs-dir ../../configs --game-config-name six_player_debater --locale zh-CN --display-locale zh-CN
bun run --cwd apps/game run --configs-dir ../../configs --game-config-name twelve_player_debater_en --locale en --display-locale en
bun run --cwd apps/game run --configs-dir ../../configs --game-config-name six_player_debater_acp --locale zh-CN --display-locale zh-CN
bun run --cwd apps/game run --configs-dir ../../configs --game-config-name twelve_player_debater_acp --locale en --display-locale en
```

中英LLM引用 `deepseek_v4_flash`，ACP引用 `acp_default`，可以换个人 `runtime/agents.json` 已有名字。无需公开API key，ACP继续沿个人隔离启动器。

## 知情与验证来源

公开翻牌／辩论原话和汇总支持／反对／弃权数自然渲染，God才持匿名票与投票人配对；逐玩家feed不显示别人隐票或收集中间总数。God回放不是玩家授权档案，locale不翻译玩家原话。

两板直接取 `packages/game-runtime/tests/support/features/debater/builders/scenario.ts` 的六／十二人声明，经既有成功／平票／弃权路线及受限观察整局覆盖。本次只补公开JSON和说明，经实际parse及中英bootstrap校验；不改匿名、库存、票权或既有严格Tape政策，阶段发布矩阵另做逐局strict。
