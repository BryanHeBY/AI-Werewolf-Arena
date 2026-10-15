# 暗夜星辰公开示例

规则：[觉醒狼美人](../../rules/awa-awakened-wolf-beauty-v1.md)、[觉醒猎人](../../rules/awa-awakened-hunter-v1.md)。这里只包括已核实的原十／十二人牌池：普通狼、觉醒狼美人、平民、预言家、普通女巫、普通守卫和觉醒猎人。觉醒守卫／骑士联合板有独立交付条件，不由本例自动开放。

## 可运行配置

[十人 board](../../../configs.example/boards/awa_netease_dark_stars_10_v1.json)、[十二人 board](../../../configs.example/boards/awa_netease_dark_stars_12_v1.json)，各有中文 LLM、英文 LLM 和 ACP game。只复制这两类文件，保留个人 runtime、认证与隔离启动器：

```bash
mkdir -p configs/boards configs/games
cp -n configs.example/boards/awa_netease_dark_stars_{10,12}_v1.json configs/boards/
cp -n configs.example/games/{ten,twelve}_player_dark_stars*.json configs/games/
```

LLM 示例引用 `deepseek_v4_flash`，ACP 示例引用 `acp_default`。可把 game 的 Agent 名换为个人 `runtime/agents.json` 中已配置的名字；无需覆盖个人 runtime 或把 API key 写入 board／game。ACP 继续使用个人隔离启动器。

十人入口：

```bash
bun run --cwd backend run --configs-dir ../configs --game-config-name ten_player_dark_stars --locale zh-CN --display-locale zh-CN
bun run --cwd backend run --configs-dir ../configs --game-config-name ten_player_dark_stars_en --locale en --display-locale en
bun run --cwd backend run --configs-dir ../configs --game-config-name ten_player_dark_stars_acp --locale zh-CN --display-locale zh-CN
bun run --cwd backend run --configs-dir ../configs --game-config-name ten_player_dark_stars_acp --locale en --display-locale en
```

十二人入口：

```bash
bun run --cwd backend run --configs-dir ../configs --game-config-name twelve_player_dark_stars --locale zh-CN --display-locale zh-CN
bun run --cwd backend run --configs-dir ../configs --game-config-name twelve_player_dark_stars_en --locale en --display-locale en
bun run --cwd backend run --configs-dir ../configs --game-config-name twelve_player_dark_stars_acp --locale zh-CN --display-locale zh-CN
bun run --cwd backend run --configs-dir ../configs --game-config-name twelve_player_dark_stars_acp --locale en --display-locale en
```

`roles.awakened_wolf_beauty` 和 `roles.awakened_hunter` 都严格只接受 `{}`，分别解析为固定政策 `awa_awakened_replacement_v1` 与 `awa_directional_patrol_v1`；不开放随意改冷却、替死次数、毒死资格或狼位公开的开关。

## 资源、方向与实际死亡

狼美人夜间独立选择另一活人，非空选择须隔一夜才能再次使用，旧关系在下一实际开夜到期。全局只有一次替死：在真实致死提交前把本次原提案替换为目标的新死亡来源，本人没有先死再复活。目标已死、换体或同波本来就会独立死亡时不能替死；夜根巡猎禁止这一次替死，日根巡猎保留替死可能。

觉醒猎人真实死亡后才选择巡猎方向或明确空过，毒死同样可用。顺时针沿请求给出的真实座位环前进，逆时针后退，跳过死者并命中当前最近真狼；给模型的是座位环，不能把它当作狼候选名单。空过也消耗唯一机会；缺失、迟到和撤权不是空过。无活狼时不创建请求或假命中。

秘密魅惑仅狼美人本人可见；原伤害、执行阶段和根阶段的替死付款只给 God。巡猎付款中的原命中及根仅本人可见；公开巡猎结果只报告真正死者或无人死亡，不泄露未杀死的原目标。终端私有开关只控制展示，玩家 feed 仍按历史受众隔离。God 回放包含全角色和秘密，不能当作玩家授权档案发送。

付款与公开结果都不直接改变 Web 存活或公开身份。真实 `night_resolved`、`voted_out`／`additional_deaths` 才推进画面；放逐命中狼美人但被替死时，保留原票摘要，实际死者由通用死亡事实表达。

## 两语真实教学归档

四份完整 God 档来自本地合成模型通过实际 SDK、正式引擎和录制导出，不调用付费服务：

| 案例               | 中文                                         | 英文                                        | 字面路线                                                                                                                              |
| ------------------ | -------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| 原十人，夜根巡猎   | [回放](10-night_patrol-zh-CN.replay.json)    | [Replay](10-night_patrol-en.replay.json)    | N1 的 4 号觉醒猎人被毒，顺时针巡到 5 号狼美人；夜根压制本次替死，5 号实际死亡。之后救人、放逐清除剩余普通狼。                         |
| 原十二人，日根替死 | [回放](12-day_replacement-zh-CN.replay.json) | [Replay](12-day_replacement-en.replay.json) | D1 放逐 2 号觉醒猎人，顺时针巡到 3 号狼美人；日根允许其一次替死，6 号实际死亡、3 号保活。D2 再放逐已耗技能的 3 号，之后由毒与票清狼。 |

两例覆盖五类新事实：秘密魅惑、God 替死付款、公开替死结果、本人巡猎付款和公开巡猎结果。它们分别表达原目标、已付资源与实际受害者，不能合为一个“命中即死亡”的布尔值。相同四份文件由前端测试读取，核自然标签、关联席位、真实死亡关键帧与倒看；缺失／迟到、付款后的记录失败和原体撤权由独立运行与严格归档反例覆盖，未把这些教学样本说成全部异常分支。
