# P5：白狼王接入与契约

规则、来源歧义与AWA确定选择见[冻结卡](../rules/awa-white-wolf-king-v1.md)。第九项真实角色，剩余55项继续对应阶段；不将本角色等同刺客白狼王或其它互认/带刀版本。

## 输入和资源

`self_destruct_with_target`要求reason、confirm=true和target_id；另一个当前存活ID（含队友）或null明确不带人。白狼王没有普通self_destruct或死亡shoot；按profile的当前资源/角色/阶段/窗口校验。接收accepted=true/applied=false不消费、不代表最后采纳；schema错、自己、死亡/不存在目标拒绝仍可在原窗口更正。

私有`white_wolf_king.canDetonate`与本人DTO `ownState.whiteWolfKing`；成功选中且提交时一次消费。普通狼队互认只IDs/关系，不泄露此机会或具体特殊狼牌。未选择/取消/过期/资源或生命变更不消费；公开事件只记录最终选择。

每轮中英提示使用实际允许工具名；白狼王不会同时被指示只能调用普通self_destruct。工具名/机器key不本地化，SDK/MCP外层共同协议仍统一，新增native schema是中性英文描述。共享遗言摘要包括死亡枪/白爆及首夜合并目标无遗言。

## 选择、提交与死亡所有权

SelfDestructWindow并发收集，捕获演员角色/生命/私有资源引用和目标生命，实际消费前重验，按最小仍合法稳定ID尝试。PhaseManager拥有pending-night知识；首日待刀/毒死白狼王不能吞死施放，提交前静默拒绝，不向玩家回传隐藏死因，不提前过滤模型的中性请求/目标列表。被拒者未消费，继续其它有效候选。

commitSelfDestructSelection只提交角色资源、公开事实及死亡提案；DeathResolution统一标整波死、初批遗言、警徽、角色技能、追加波次；PhaseManager最后判胜/推进夜。普通自爆事件保原字段；白爆独立`white_wolf_king_self_destruct {actorId,targetId,window}`，目标为WhiteWolfBlast，不伪装狼刀/Shot。

首日竞选前先合并待夜死与自爆双方，原因去重、阶段明确；相同目标只结一次，复合毒仍禁枪。纯夜死按基础首夜遗言；含WhiteWolfBlast的目标不因为合并夜死而获遗言。普通守护/解药不挡公开带人，猎人/狼王可对本原因追枪，整链前不封盘。

## 程序接口迁移

- `SelfDestructWindow.execute`返回`SelfDestructSelection|null`，替代旧`number|null`；tag区分ordinary/white_wolf_king、actorId与nullable targetId。
- Day/Voting commit callback现在接selection，Day另接window；可返回Promise<void|boolean>。false必须在无效应时返回，表示拒绝并尝试下一候选；void按成功兼容。抛错仍走原错误/收尾路径，不隐藏或回滚已提交前缀。
- 未传commit只返回意图，不自行杀人/消费；pipeline结果新增selfDestruct以保完整选择，既有summary的selfDestructBy仍是actorID。Voting removed包含实际两名提议ID，不代表低层已标死。
- 正常入口提供PhaseManager callback，所有资源和状态有唯一提交路径；纯低层调用者须按当前规则提交并交中央resolver，不依靠公开事件猜Actor是否已经dead。

公开/玩家schema2与Tape2保留；ToolName/DeathCause/Role/stage相关闭合枚举同步更新，严格source/lock/rules/RNG门槛不放宽。旧普通狼/Hunter/狼王字段保持，前端仅shared DTO/术语；原玩家文字、名字和历史记录不改写。

## 配置与验收范围

[六人板子](../../configs.example/boards/six_player_white_wolf_king.json)为AWA演示2狼（含白狼王）/预/猎/2民，屠边、自动选举、投票前窗口；[十二人板子](../../configs.example/boards/twelve_player_white_wolf_king.json)为白狼王替换普通狼一名、其余预女猎白配置及基础条件。对应games沿example既有Agent，未写认证或改用户configs；未声明swallowPoison等变体严格拒绝。

```sh
bun run --cwd backend run --configs-dir ../configs.example --game-config-name six_player_white_wolf_king
bun run --cwd backend run --configs-dir ../configs.example --game-config-name twelve_player_white_wolf_king
```

[人工判例](../../backend/tests/engine/rules/white_wolf_king.test.ts)含四窗口、pending caster刀/毒、null、guard不挡与pending target复合毒、资源/生命/ref/phase竞态、中英正确工具/遗言文本。实际完整场景为四窗口hunter链＋null延续＋pending caster刀/毒＋狼王→猎人链＋12人两日流程，共9case×SDK/ACP/混合×两语＝54实际本机完整局，每局严格Tape；角色资源/门槛采用字面预期，不借World生成模型决策。

原80＋本54＝134实际通路完整局，不是134外部模型局。另两板各16个显式active风格受限观察seed，真实技能分支/零修复与逐局重放，动作只用本人DTO与具名RNG；初版混合风格六人16seed没有实际白爆，未放宽分支断言，改为明确主动风格和可首日施放的有界概率策略，再保留实际分支门槛。

公开[前端夹具](../../frontend/tests/fixtures/six-player-white-wolf-king/white-wolf-king/en/god.replay.json)来自实际SDK完整局，中英单测/真实Chromium/Remotion帧核对双人同一事实死亡、追枪、null标签及终局时点。规则/实现/文档三路复查与最终门槛见[审查记录](reviews/p5-white-wolf-king.md)；P5骑士/守墓人、后续55项与P10外部模型质量仍待完成。
