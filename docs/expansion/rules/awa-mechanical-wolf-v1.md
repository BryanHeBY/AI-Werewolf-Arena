# AWA Mechanical Wolf 1.0.0 规则卡

awa_classic 1.0.0，ID `mechanical_wolf`，机械狼／Mechanical Wolf；核验2026-10-09。选赛事机械狼技能版本并明确下述AWA细则，不与经典版同目标穿解药双刀或觉醒隐狼混用。

## mechanical_wolf

- 真Wolf、Wolf胜利归属、原生max1；无原生自爆、不与其它狼相认/聊天/共享刀口，学到具体狼身份也不授狼聊历史。当前公开支持board只含Wolf/Psychic/Witch/Hunter/Guard/Villager/Mechanical；其他牌先拒配置，不在预检用隐藏角色筛目标或揭“不可学习”错误。
- 每局一次 `mimic_role {target_id:number}`，580（女巫后、通灵实际查验前）可选另一实际活玩家，不self/dead/null。首夜或后夜可学，也可不调用工具等待；有效模仿立即知该目标的真实role，保存事实并得相应机械技能，从下一夜开始生效（包含枪）。不复制目标的库存/history/受损状态；每种机械技能有本卡独立初态。不改本人真实role/camp/获胜归属。
- 模仿前具体role标签Mechanical Wolf；模仿后显示已学习role（即使技能尚未生效、目标后来变身份或死去也不回写）；阵营查验仍Wolf，熊/决斗等真阵营规则不变。仅role伪装，不穿透其它版本伪装或借普通能力clone规则。
- 第一夜只有学习，无原生刀/技能。第二夜起250阶段私下选择本夜 `mechanical_mode {mode:kill|skill}`，无工具跳过默认为skill且不攻击；每夜只选择一次，同夜不切模式。学习是独立控制机会，任何mode均可晚学；kill/skill排他仅约束已学机械主动效果。学习机会与模式分别拥有一次关闭标识；晚学当夜仍不使用新技能。
- kill夜仅拥有基础狼刀与符合资格的额外刀；skill夜只拥有已生效的机械主动技能，绝不同夜使用毒/守/验与基础刀。死亡枪为被动，生效后不受mode排他。无技能/耗尽仍可skill空过。
- 只有自己活着、实际成为唯一活真Wolf才获得基础刀事实；只由装配/DeathResolution整批真实提交更新，查询/预计死亡不更新。自身与末其它Wolf同提案死不假继承；不同提案先获得再死保前缀。Day接刀不立即加行动。最早可刀Night2，首次继承后的可刀夜为max(2,事实日次+1)，日期固定，不因晚学/跳过/skill/其它狼复活而重置。
- 基础刀沿既有kill_vote（可弃票/自刀）、原生命计票与Guard/Heal/Dream；女巫只获得基础刀口，额外机械刀不是公开提示。

## 六类学习结果／五种技能

| 学到 | 独立机械效果与资源 |
| --- | --- |
| Villager | 只获身份，无主动技能，仍为真Wolf及正常继承刀 |
| Psychic | skill夜650可用mechanical_inspect查另一活玩家的规则role，允许跨夜repeat、不self；可无工具skip，每夜一次，history独立、尊重明确role伪装 |
| Witch | skill夜650用mechanical_poison，一瓶Poison，无解药/自救参数/女巫刀口；可不用，非法/撤权不耗，合法一毒后不可补瓶 |
| Guard | skill夜650用mechanical_guard，可守自己/另一活人或明确空守。盾免基础狼刀/额外机械刀，每个原始Poison源（包括机械毒）各反一次至原施毒者；反射仍Poison，反射毒绕过该施毒者的机械盾且不再反射，Dream仍可保护被反毒者。若施毒者本来就是被守目标，也按同一规则不形成自循环。机械盾不造成同守同救抵消；若同时普通Guard+Heal，则仅普通防护抵消，机械盾独立仍可挡刀。连续两个日次选同ID则本夜机械盾无效，天亮机械狼独立MechanicalGuardFailure判离；中间kill/skip/空守打断连续，复活同ID不避限制。失败仍消费本夜选择，不在preflight提前拒重复。 |
| Hunter | next-night起一枪，复用World死后许可与原生命。沿Hunter明确源策略：基础/机械刀、放逐、枪/白爆可枪；Poison/梦/魅惑/Duel/能力自罚等含禁止原因无枪，复合源任一禁止即禁。资源私有，原role仍Mechanical，不伪造Hunter身份或原生state。 |
| Wolf | 首个固定可刀夜的kill模式可额外mechanical_attack一次（可不同目标/同目标/null弃刀），独立资源，不覆盖基础刀口。只穿普通Guard；Heal、Dream和机械盾仍能挡，不能称穿一切。该夜skill/skip/无目标/未学到Wolf或未使用均过期，后夜无追加；晚学不得追补已过窗口。 |

## 范围、隐私、所有权

模仿/模式/资源与每类机械能力由唯一typed owner保存，动态合法工具由实际状态/时点生成，不普通grant来复制原角色技能。共享原生命范围用于actor/target/state/phase的await/gateway/提交复验；已消费资源与记录前缀保留，迟到或旧生命不能产生新效果。目标合法集合只看公开alive/self规则，不看底牌；Role标签只在支付模仿后得知。

毒药提交必须保存原施毒者/目标生命来源，不能从合并PoisonMark或事件历史猜毒手。机械盾、反毒、自罚和破盾刀形成typed本夜effects，NightPipeline统一交Damage算实际deaths/sources，阶段不直接alive=false或judge。反毒不伤施毒者新生命；保护目标免原始毒，但反射目标旧生命失效则不伪造新杀。普通已提交毒不因原caster死亡撤消，反射最多一次；多毒逐源结算再合死亡，不丢施毒者。

所有初批/追加死亡、遗言、全部警徽、角色钩子完整后PM最终judge。枪目标request原生命/版本直到实际额外死亡提交仍复验，不用target_id独自授权复活新生命。原技能枪/连守判离均有明确原因。

私有模仿/模式/机械能力报告只本人；目标无通知，狼队不获历史；反毒因果中的casterId及reflectTargetId仅God；玩家state/history/DTO/玩家事件一律裁掉这些源身份字段，反毒反馈不向模型泄露毒手ID。上帝事件可保因果，玩家投影明确脱离/裁剪；公开仅既有真实死亡/枪/结果。references/Map/clock不落state/DTO/Tape，source/lock/RNG严格兼容保持。

`roles.mechanical_wolf`仅{}，未知任意skill/mode/穿透/相认配置拒绝；公共parse与directbootstrap都验证支持角色集合。六人/十二人与独立完整场景按实际freeze范围配置，不先登记觉醒或任意17牌组合。

## 来源与明确AWA选择

[赛事角色页](https://melbournemasters.org/setups/roles/机械狼)与[机械狼通灵师板](https://melbournemasters.org/setups/ji-xie-lang-tong-ling-shi)支持不自爆、第二夜击杀/技能区分、反毒/连守判离、单毒/枪/首次接刀夜破盾额外刀。其原文没有明确模式是奇偶或自主选择、反射去向/递归/多源与穿Heal规则；本卡显式选择私下每夜二选一、一反射、只破普通Guard。

[经典版自身攻略（2026-03-04）](https://www.langrensha.net/strategy/meachanical_wolf.html)明确任意夜一次学习、独立狼与夜间技能次夜起；其同目标双刀穿Guard/Heal与本版不同，不混。经典版[2024流程](https://langrensha.net/news/20240905-3.html)写学习后当夜技能，与后稿不同；本卡选next-night，所有机械技能含枪同一生效边界。角色label来自[组织者通灵页](https://melbournemasters.org/setups/roles/通灵师)及[经典版通灵说明](https://www.langrensha.net/strategy/spirit.html)，不是阵营伪装证明。

mode选择/skip、580/650、模仿真role、所有技能次夜、唯一真Wolf/固定首可刀夜、枪源策略、保护/反射/多源/自罚、生命与取消、白名单/资源/受众都是AWA明确细则，不能声称所有同名机械一致。

## 验收要求

配置集合/count/错参数；晚学/学前后label/次夜生效/真实身份；六结果／五技能（包括民无技能）、mode排他/skip/机会关闭（外部普通gift技能由自身冻结规则，不冒认机械原生模式规则）；真死亡继承/同批不假接/首窗口过期、双刀同/异目标/Guard/Heal/女巫可见/原生命；毒源多施放者/反射零递归/反射原caster生命/机械盾/连守/skip/kill打断；枪资格/毒/梦/魅惑/徽/最后judge与target新生命撤销；查询只读、actor-only、不狼聊历史/不泄露毒手、所有新提示/拒绝/终端/记录/前端两语；6/12与八类字面真实SDK/ACP/混合两语完整局+全部Tape，20seed每板及技能/跳过/继承正分支，browser/实际PNG/三路审查，P7结束全支持release。

白名单外Dream/Charm/White/Duel等保护与枪资格当前只做受控伤害／死亡策略专项，不宣称这些联合board已开放；未来学习映射/支持矩阵扩展后另做合法完整局。
