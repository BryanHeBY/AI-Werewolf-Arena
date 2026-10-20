# 觉醒狼王公开示例

规则：[AWA 觉醒狼王](../../rules/awa-awakened-wolf-king-v1.md)。此处提供网易原十人和原十二人两个有限板；十二人含摄梦人并采用夜伤保护，十人不含摄梦人。觉醒女巫组合见[独立规则与示例](../awakened-witch/README.md)。

## 可运行配置

[十人 board](../../../configs.example/boards/awa_awakened_wolf_king_10_v1.json)、[十二人 board](../../../configs.example/boards/awa_awakened_wolf_king_12_v1.json)，各有中文 LLM、英文 LLM 和 ACP game。只复制 board 与 game，保留现有 `configs/runtime/`；`cp -n` 避免覆盖同名本地配置：

```bash
mkdir -p configs/boards configs/games
cp -n configs.example/boards/awa_awakened_wolf_king_{10,12}_v1.json configs/boards/
cp -n configs.example/games/{ten,twelve}_player_awakened_wolf_king*.json configs/games/
```

LLM 示例引用 `deepseek_v4_flash`，ACP 示例引用 `acp_default`。将 game 的 Agent 名改为自己 `runtime/agents.json` 已配置名称即可，沿用本地模型、Provider 与隔离启动器。无需覆盖个人 runtime 或在命令中填写认证。

十人入口，中文、英文与 ACP 使用相同的规则和授权链：

```bash
bun run --cwd apps/game run --configs-dir ../../configs --game-config-name ten_player_awakened_wolf_king --locale zh-CN --display-locale zh-CN
bun run --cwd apps/game run --configs-dir ../../configs --game-config-name ten_player_awakened_wolf_king_en --locale en --display-locale en
bun run --cwd apps/game run --configs-dir ../../configs --game-config-name ten_player_awakened_wolf_king_acp --locale zh-CN --display-locale zh-CN
bun run --cwd apps/game run --configs-dir ../../configs --game-config-name ten_player_awakened_wolf_king_acp --locale en --display-locale en
```

十二人入口：

```bash
bun run --cwd apps/game run --configs-dir ../../configs --game-config-name twelve_player_awakened_wolf_king --locale zh-CN --display-locale zh-CN
bun run --cwd apps/game run --configs-dir ../../configs --game-config-name twelve_player_awakened_wolf_king_en --locale en --display-locale en
bun run --cwd apps/game run --configs-dir ../../configs --game-config-name twelve_player_awakened_wolf_king_acp --locale zh-CN --display-locale zh-CN
bun run --cwd apps/game run --configs-dir ../../configs --game-config-name twelve_player_awakened_wolf_king_acp --locale en --display-locale en
```

`roles.awakened_wolf_king` 严格只接受 `{}`，解析为固定政策 `awa_awakened_wolf_king_v1`。任意死因开关、重复角色、复制、复活或额外叠枪混板未开放。

## 资源、公开死亡与知情

狼聊后、狼刀前，狼王每夜可把一个原生爪亲传给另一存活普通狼，或明确空过。每次传出永久扣一个，受传者只有独立的一爪，不能转传。拥有者真实死亡且满足死因后，每一爪分别请求和消费；首枪的目标及其完整死亡连锁结束，才开放下一爪。空枪也消耗，迟到或缺失回复不等于空枪。

传授只给双方，消费只给本人，其余狼也不能看；失效仅 God 可见。终端私有开关只控制终端展示，玩家观察仍按历史受众隔离。公开枪击为中立 `player_shot`，不认证狼王或亲传来源。库存消费本身不造成死亡；实际枪命中、夜源梦保护及追加死亡由独立事件表达。God 回放包含角色与秘密库存，不可作为玩家授权档案。

## 两语真实教学归档

[中文回放](zh-CN.replay.json)、[英文回放](en.replay.json)来自固定亲传计划通过本地 OpenAI 兼容合成服务、实际游戏工具和正式录制导出，不调用付费模型。N1 的 10 号狼王传第一爪给 2 号普通狼；D1 狼王被放逐，以剩余原生爪枪击 8 号预言家。D2 受传的 2 号被放逐，消费亲传爪枪击 6 号女巫，狼队屠神获胜。这两份完整档案展示两种库存来源；原生双爪和第二爪失败前缀另有真实协议场景测试，不把本样本说成双爪演示。

前端测试直接读取两份文件，核自然语言、关联席位、时间线与帧倒看：私有库存事件不改变存活、公开身份或警徽，真正死亡仅由对应的中立枪击及淘汰事实推进。
