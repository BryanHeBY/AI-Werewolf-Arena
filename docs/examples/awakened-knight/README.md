# 觉醒骑士与觉醒守卫公开示例

规则：[觉醒骑士](../../rules/awa-awakened-knight-v1.md)、[觉醒守卫](../../rules/awa-awakened-guard-v1.md)、[觉醒狼美人](../../rules/awa-awakened-wolf-beauty-v1.md)。本例只包括网易2026-08-11原十二人牌池：三普通狼、觉醒狼美人、四平民、预言家、普通女巫、觉醒骑士和觉醒守卫。不得换成普通守卫／狼美人而沿用本板名称；其它复制、赠予、复活、特殊狼和梦保护组合未开放。

本例的保护、替死、连续决斗和失败前缀见[联合规则与回归边界](../../rules/awa-awakened-knight-v1.md#示例与回归边界)。教学档通过本地合成模型通路生成，不代表真实模型策略质量。

## 可运行配置

[十二人 board](../../../configs.example/boards/awa_netease_awakened_knight_12_v1.json)、[中文 LLM game](../../../configs.example/games/twelve_player_awakened_knight.json)、[英文 LLM game](../../../configs.example/games/twelve_player_awakened_knight_en.json)、[ACP game](../../../configs.example/games/twelve_player_awakened_knight_acp.json)。只复制 board 和 game，保留个人 runtime、认证与隔离启动器：

```bash
mkdir -p configs/boards configs/games
cp -n configs.example/boards/awa_netease_awakened_knight_12_v1.json configs/boards/
cp -n configs.example/games/twelve_player_awakened_knight*.json configs/games/
```

LLM 示例引用 `deepseek_v4_flash`，ACP 引用 `acp_default`；可将 game 的 Agent 名换为个人 `runtime/agents.json` 中已有的配置。无需覆盖个人 runtime 或在 board／game 中填写 API key。ACP 沿用原隔离启动器。

```bash
bun run --cwd backend run --configs-dir ../configs --game-config-name twelve_player_awakened_knight --locale zh-CN --display-locale zh-CN
bun run --cwd backend run --configs-dir ../configs --game-config-name twelve_player_awakened_knight_en --locale en --display-locale en
bun run --cwd backend run --configs-dir ../configs --game-config-name twelve_player_awakened_knight_acp --locale zh-CN --display-locale zh-CN
bun run --cwd backend run --configs-dir ../configs --game-config-name twelve_player_awakened_knight_acp --locale en --display-locale en
```

`roles.awakened_guard`、`roles.awakened_knight`、`roles.awakened_wolf_beauty` 严格只接受 `{}`，分别解析为固定政策 `awa_awakened_guard_cycle_v1`、`awa_awakened_duel_chain_v1`、`awa_awakened_replacement_v1`。不提供无来源的无限保护、改变一次替死或取消目标尝试记录等开关。

## 保护周期与发言边界

每个实际夜晚及其后白天为一个保护周期。守卫夜晚可以保护、等待白天或明确放弃；白天在普通讨论／PK发言和开票前的有限边界，先问尚未用过且未放弃的守卫，再问骑士。等待仅保留到本周期下一个实际边界；未出现后继时随实际日终记为 unused，不造一次隐式放弃。相邻周期不能保护同一稳定座位，完整空周期打断连续。

同一边界不反复询问，不在正在进行的发言、警上、票中、遗言或死亡技能中插入保护。成功决斗的完整真实死亡链结束后，也先给新的守卫机会，再问骑士是否继续。实际PK仍是 Voting 阶段，不改成 Day 标签伪造权限。

有效全天盾先于致死判定；狼美人本体有盾时不消耗替死，只给替身盾时替死已消费但替身不死。守卫自己误被决斗且有盾时可存活，另一好人目标仍独立死亡，骑士误中仍恢复原未完成发言。有效盾也挡主动狼自爆的实际死亡；合法自爆仍结束当日，公开狼身份声明与真实死亡结果分开，保活时不把Web画死。保活普通狼在后续真实白天仍按既有资格与窗口行动，不额外新增整局一次自爆库存。

## 连续决斗与实际死亡

每个目标稳定座位全局只可尝试一次；受盾、替死或没有实际死亡都不退款。普通窗口的 null 只表示此边界不发动；连续决斗窗口的 null 表示结束成功链、完成延期遗言后入夜。缺失／迟到／错误不等于这两种明确选择。

成功分支按真实阵营判断，先完整提交死亡、警徽和后续能力，再给下一次选择；误中两人各自受保护与替死判定，停止本次链并恢复冻结的发言／PK游标。链内实际死者的遗言依真实死亡顺序延到链结束／误中后逐人一次。第二次请求失败保留首次尝试、已付盾／替死、真实死亡和未发遗言前缀，不补正常结束或正常夜晚。

`awakened_duel_committed` 表达已经支付的目标与分支，不直接更新Alive。`awakened_duel_resolved`、真实夜死／放逐／追加死亡和 `awakened_self_destruct_resolved` 才表达实际生命结果；保护抵挡和替死过程分别有中性公共结果与God明细。

## 知情与归档

夜间保护的选择／等待／放弃仅本人可见；白天非空保护公开守卫与目标。保护具体死因、替死付款和保护到期明细只给God。终端 `printPrivateEvents` 只影响显示，不放宽玩家feed；God回放含全角色和秘密，不可作为玩家授权档案发送。昵称／人格与玩家原话保持原文，中英文规则和系统结果使用共享自然语言。

## 两语真实教学归档

六份God回放来自同一精确牌池、本地合成模型经实际SDK工具、正式引擎及录制导出；SDK／ACP／mixed三通路都有同一路线对照，不调用付费模型。原严格Tape保留生成时的构建身份，未修改历史hash来冒充当前构建。

| 保护对象       | 中文                                 | 英文                                | 第一击字面结果                      |
| -------------- | ------------------------------------ | ----------------------------------- | ----------------------------------- |
| 狼美人本体10号 | [回放](body-zh-CN.replay.json)       | [Replay](body-en.replay.json)       | 本体有盾，无人死亡，替死尚未消费    |
| 原魅惑替身2号  | [回放](substitute-zh-CN.replay.json) | [Replay](substitute-en.replay.json) | 替死已消费，2号有盾，本体与替身都活 |
| 无盾           | [回放](none-zh-CN.replay.json)       | [Replay](none-en.replay.json)       | 替死已消费，2号真实死亡，10号保活   |

N1狼刀1号、10号魅惑2号。D1骑士7号依次决斗10、8、9、12号；10号按各案保活，8、9、12三名普通狼在各自完整提交时实际死亡。所有决斗都是真Wolf成功分支，实际死者到链尾按顺序各一次遗言；无盾案为2→8→9→12，其余为8→9→12。骑士明确null结束成功链，再入N2。N2狼刀11号，女巫毒10号，此时旧魅惑已到期，10与11实际死亡，好人胜利。

这三种路线分别验证“不消耗替死”“消耗替死但替身保活”“替身实际死亡”，不从目标提案推导画面死亡。相同真实文件供Web正向／逆向seek核实际存活、自然语言、关联席位与延期遗言。普通／连续窗口缺失迟到、原体撤权与付款后日志异常由独立失败反例覆盖，教学档不冒充所有异常测试；受限自然局与最新构建阶段门禁另行收口。
