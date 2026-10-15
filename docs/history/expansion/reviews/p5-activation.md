# P5 第一批角色阶段验收

## 目标核对与支持范围

roadmap P5要求狼王、白狼王、骑士、守墓人逐项规则卡、双语、判例/交互/完整对局/复盘，以及基础判胜/警徽/遗言回归。前三项分别在 `2dd0e0d`、`549e503`、`fa19e58`完成；本次守墓人交付关闭该阶段，不能据此结束P6–P10或53计划角色。

| 角色   | 明确版本与接口                                                                                                                    | 完整场景证据                                                          | 公开6/12板子                      |
| ------ | --------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | --------------------------------- |
| 狼王   | [规则卡](../../rules/awa-wolf-king-v1.md)、[契约](../wolf-king.md)；独立死亡枪/受限死因、普通狼权限                                  | [审查](p5-wolf-king.md)，30双语actual SDK/ACP/混合局+Tape，24受限seed | six/twelve_player_wolf_king       |
| 白狼王 | [规则卡](../../rules/awa-white-wolf-king-v1.md)、[契约](../white-wolf-king.md)；四自爆窗口、null带人、无吞待夜死、独立WhiteWolfBlast | [审查](p5-white-wolf-king.md)，54actual局+Tape、32active受限seed      | six/twelve_player_white_wolf_king |
| 骑士   | [规则卡](../../rules/awa-knight-v1.md)、[契约](../knight.md)；三离散窗/一次机会、真实camp、Duel/DuelFailure、末神/末狼与徽章         | [审查](p5-knight.md)，48actual局+Tape、40active受限seed               | six/twelve_player_knight          |
| 守墓人 | [规则卡](../../rules/awa-gravekeeper-v1.md)、[契约](../gravekeeper.md)；前日实际exile冻结标签、后夜被动反馈/actor-only、无主动tool   | [审查](p5-gravekeeper.md)，48actual局+Tape、40active受限seed          | six/twelve_player_gravekeeper     |

基础7项保持[P4范围](p4-activation.md)。四角色版本不是所有同名平台统一规范：Knight/White的分歧与组织者/官方站资料各自记在卡。Awakened Knight等不复用普通角色；石像鬼未注册，守墓人当前12人是普通狼改编示例，不冒充来源的石像鬼板子。

共享目录保留64项，当前**11 verified／53 planned**；执行许可仍由真实profile与严格配置决定。此表是已验场景和板子范围，不表示11项任意组合或所有22机制均已交付；发布级支持组合矩阵/强制门槛按P10继续，不放宽未知角色/参数拒绝。

## 跨角色与公共机制

- 普通狼/特殊狼互认只授权ID与关系，私有枪/自爆机会/守墓结果不透传；字段与事件受众由统一接收/投影约束。
- 死亡唯一经DeathResolution：整波先dead→初批授权遗言→所有徽章→钩子→追加波次；PhaseManager最后judge/推进，终局不追加普通行动。
- WolfKing→Hunter枪链、White爆→非毒Hunter/King链、Knight命中King/White禁死亡技能均有人工和actual整局证据。White目标同时Poison＋WhiteWolfBlast禁枪由真实PhaseManager人工专项验证；54局actual White矩阵中的待毒/刀是施放者静默拒绝场景，不能拿来替代目标复合毒的wire证据。
- Gravekeeper只反馈真实放逐主目标，不把Idiot免死、普通/White自爆、Knight决斗、King/Hunter追加死当exile。正常和无放逐/旧结果场景分别完整执行。
- 本批审查修正Night阶段取消：day/phase/gameOver/revision由manager提供，含同phase与往返jump失效；所有原生stage前后/await后/gateway后、被动消费前再验，取消无假伤害/后续反馈/phase覆盖。原错及已提交前缀保留，未引入通用清理/投票框架。
- camp/role/combined型信息各自约束，Knight看真实camp，Gravekeeper看冻结camp标签；shared严格reader防错误历史变成具体牌。旧schema2/Tape2保留，source/lock/rules/RNG门槛不放宽。
- 两语协议/状态/拒绝/终端/复盘/工作台/纯frame一致；名字/原发言不翻译。模型收到的提示使用真实wire正例，private档/CP不冒充模型输入。

## 完整门槛及审查

基础50＋P5四项30＋54＋48＋48＝**230实际本机双语完整局**，真实SDK HTTP/ACP进程/注入MCP以及混合角色全部走生产runner，全部严格Tape。模型响应为本人字面计划，不读取World/其它玩家牌，不宣称外部Codex/Claude质量评测。随机策略只本人冻结DTO＋具名RNG；已支持两个基础板子与各角色受限seed在最终release共同回归。

三路逐角色交叉审查各有发现→修正→复查记录；守墓人的两项Medium（取消续写/坏历史具体牌）已关闭。前端新真实十二人God档反馈帧、纯投影/未知值/不改生命与actual浏览器核验；发现英文字幕遮挡底部role后修正席位留白，actual bbox门槛证明不重叠，重生成两语PNG目视。未改MP4编码管道，保留P3/G04实际视频证据，不声称本阶段逐新角色重编码。

最终release **820／60313／107文件、0失败及smoke/type/deps/boundaries/i18n通过**，frontend83／711/type/build，actual Chromium20（含实际卡片/字幕不重叠）及两语真实PNG已通过，终态见[守墓人最终记录](p5-gravekeeper.md)。P5标完成。P6从摄梦人、狼美人、熊、隐狼、石像鬼的冻结依赖继续；P7/P8/P9/P10与T6/长局/发布矩阵不因当前绿而删减。
