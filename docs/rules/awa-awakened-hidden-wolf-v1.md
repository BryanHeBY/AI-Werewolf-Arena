# AWA Awakened Hidden Wolf 1.0.0 规则卡

<a id="awakened_hidden_wolf"></a>

规则集 `awa_classic` 1.0.0；ID `awakened_hidden_wolf`，觉醒隐狼／Awakened Hidden Wolf；核验2026-10-09。完整角色与原十二人镜隐迷踪联合板已验收，登记verified，见[支持边界](../contracts/mechanism-support-boundaries.md)。不以已有隐狼/机械狼/魔镜少女的单角色交付代替本角色门槛。

## 已核第一方来源

[网易镜隐迷踪发布稿](https://langrensha.com/news/official/20231113/26904_1119726.html)页署 **2023-10-26**，不是URL中的11月13日。原12人板为三普通Wolf、觉醒隐狼、Mirror/Witch/Hunter/Guard、四Villager；模仿立即知道目标身份，技能在模仿当夜结束后获得。

[官方完整讲解BV1z84y1R7Du](https://www.bilibili.com/video/BV1z84y1R7Du/)的屏幕规则/演示：54–56秒学普通Wolf在加入狼队时得一次额外袭击；69–75秒学Witch只一毒、无解药；94秒学Guard可挡毒、不可连续两夜守同人；119秒不自爆、不知其他狼/其他狼不知它、不参与夜聊群刀，其余三狼出局后可袭击；126秒模仿当夜Mirror已看到被模仿身份、技能第二天可用。依据为官方账号视频与实际帧，未取得字幕接口，两插画没有完整规则。

[2026-07-10 官方赛事规则](https://langrensha.com/20260710/31012_1307230.html)说明复制守护保护对象不被刀或毒出局。[2025-10-10 官方选手采访](https://langrensha.com/20251010/31012_1263939.html)有小狼误刀觉醒隐狼的赛例，与不相认一致。赛事行为积分不纳入本版引擎。

以下来源未充分规定的学习夜次/跳过、自选/实际alive、独立资源初态、精确阶段、首次可刀时点、基础刀与复制技能并用、保护冲突、枪的精确夜末生效和受众均为 **AWA明确选择**。不引入未经证明的反毒、额外刀破盾、连守自罚或机械kill/skill模式；一次额外袭击也不套机械首刀夜过期规则。

## awakened_hidden_wolf

1. 真Wolf、Wolf胜利，原生最多1；正常公共发言/投票/警长。无原生自爆、不相认/夜聊/群刀；其它狼也不知道它。知道模仿对象是Wolf不授历史或队友权限。
2. 初始有限白名单为AwakenedHiddenWolf/Wolf/MirrorGirl/Witch/Hunter/Guard/Villager；最多一Aw，其它角色/额外牌/变身份来源联合板暂拒，parse与direct bootstrap同验。原镜隐迷踪12人组合须随本角色交付；6人是明确AWA缩编，不冒原官方人数。
3. 一局一次 `awakened_mimic {target_id:integer}`，580（Witch后、Mirror实际查验前）选择另一实际活人，不self/dead/null。首夜或后夜均可学习；无工具等待只关本夜，不花一局机会。没有其它活候选时不请求，按合法wait闭夜不耗机会。三次非法仍有目标则明确失败，不当合法wait；候选只按公开alive/self，不用隐藏role筛选。
4. 提交点冻结目标真实role并立即知道该身份；不复制其真实camp、胜利/人格/Agent、已有库存/受损/历史/幸运儿或其它附加能力。只映射白名单内六类目标。自己真实role/camp/胜利不变，目标后来死/变身不回写学习。
5. 学习后具体role查验显示学到的role（同夜580后即如此），未学显示AwakenedHiddenWolf；本AWA低层camp查验仍真Wolf。普通Seer等不因这条低层定义开放联合板，真实camp也不变好人。Mirror尊重本role伪装，不把它当真camp或复制资源报告。
6. **当夜结束后的激活**：所有夜间角色行动结束的900激活点、统一夜间伤害计算之前，提交本次学习的ready事实。Mirror/Poison/Guard等主动效果从**实际完成激活的日次+1**起；复制Hunter枪在该夜末即armed，之后同夜初批刀死/白天出局可按枪源策略使用。这不是机械狼“所有技能统一次夜”。若流程在900前中断，不能假装已经激活；已学习前缀保留，下一完整夜的末点可补完成激活；不能只用mimicDay+1使未ready效果提前行动。
7. 学习与刀权独立，不需要mechanical_mode。本版拥有刀权后可在同夜使用基础刀及已生效的复制主动技能；学习不改变本夜已关闭的技能/刀窗口，晚学不立即补行动。
8. 唯一活真Wolf才继承基础刀，装配/DeathResolution在整批真实死亡后更新，不由只读查询/预计刀死更新。自己与末其它Wolf同批死不假继承；先继承再死保前缀。最早Night2，固定第一可刀夜为max(2,继承事实日次+1)；其它Wolf复活期间无刀，之后恢复不重置接刀事实或补资源。
9. 基础刀沿 `kill_vote`，可空刀/自刀，目标原life计票，普通Guard/Heal/Dream按既有规则。仅本人知道接刀与固定首夜，不补狼队历史/聊天。

## 六学习结果／独立资源

| 学到       | 本AWA复制效果                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Villager   | 只得身份，无技能；仍Wolf、可正常继承基础刀                                                                                                                                                                                                                                                                                                                                                                                    |
| MirrorGirl | 实际激活后下一夜起独立mirror policy role_check，empty history/null lastTarget/lastDay/lastUsedDay、uses0、无总次数上限；每实例整局禁重查，optional/无目标闭夜沿已交付Mirror规则；不继承对象旧验人，不改变自己的真role/camp。由Aw原生学习机制安装新实例，来源是Aw原生能力，不要求目标当前还持native或转出的能力实例；目标缺库存不影响学习。元数据只引用能力ID，history/resources不在学习state再复制一份；实例转出/撤销后不补发 |
| Witch      | 下一夜起 `awakened_poison` 一瓶毒、无解药/刀口/目标原瓶状态；可self/另一活人，可不调用工具等待。合法毒才耗唯一瓶，关闭本夜，原caster/target life typed毒源保留；无补瓶                                                                                                                                                                                                                                                        |
| Guard      | 下一夜起 `awakened_guard {target_id:integer                                                                                                                                                                                                                                                                                                                                                                                   | null}`，可守self/另一活人或空守；挡普通基础/额外Wolf刀与Poison，不反射毒。相邻两个实际日次不可非空守同一稳定ID，preflight拒绝、非法不消费/不关夜；skip/空守打断连续，不连守判死。投射独立目标原life保护，实际actor/owner撤换不得保护新body              |
| Hunter     | 夜末激活后的一枪、库存独立，不受刀或主动技能模式限制。沿本AWA枪源：基础/额外刀、放逐/枪允许；Poison/梦/魅惑/决斗/能力自罚等或任一禁止复合源不允许。初夜刀死时是否枪由900是否实际完成与死后许可决定，不读“次夜”猜枪。原猎人已用枪/死/失能不削新复制库存；passing shoot:null合法耗枪，非法/撤权不花新owner枪                                                                                                                    |
| Wolf       | 下一夜起、已接刀且当前唯一活真Wolf时，有一局一次额外 `awakened_attack {target_id:integer                                                                                                                                                                                                                                                                                                                                      | null}`，可与基础刀同/异目标；普通Guard/Heal/Dream/复制盾均可挡，**不破盾**。无工具等待/明确null空刀只关闭本夜，不花一次库存，可以留到后夜；只有合法非空袭击才耗，未ready/无刀权不请求，暂失刀权不补库存。独立基础刀口不被额外刀覆盖，女巫不获额外刀目标 |

## 伤害、权限与状态所有权

10. 复制守护是独立刀/毒防护，不用机械盾反毒逻辑。本版明确普通Guard+Heal抵消仍按原规则；有效复制盾独立保留，即使普通两保护抵消仍能挡刀/毒，额外刀同样不穿它。挡原始Poison不返瓶/不致反射者死亡；与机械盾同目标时**Aw复制盾先吸收原始毒，不触发该源机械反射**。对其它未吸收原始毒形成的机械反射，若原施者body有Aw复制盾，也吸收该反射Poison，不递归。多毒逐源保留、原caster死不撤已付毒；target新life不受旧毒/盾。受控双盾/多毒/保护施毒者分别有字面判例，不因专项开放机械联合板。不挡枪/白爆/梦/魅惑/商人反噬等其它伤害。
11. 原生复制守/毒/枪/额外刀有唯一typed owner与每夜关闭/库存；Mirror数据只在role_check实例。角色学习/资源对象不放World/Map/组件ref/clock，运行作用域另存原actor/target life、role/camp/privateState/source/实例ID。
12. await、gateway、效果提交/资源消费最终复验；迟到/复活/换状态/撤权/变phase不报告或花新owner库存。已支付学习/库存/报告前缀保留；已付守护/额外刀提案复验原owner/learning/skill/phase与目标原life，不用已经关闭的本夜资格或耗空库存误撤合法前缀。守护提交后施者的**第一次真实死亡**不撤防护；原body被替换或复活、角色/private owner/learning/skill撤换仍撤未结算旧提案，不保护新body。已提交毒不因caster死撤销。完整NightPipeline同World/day提交后重入明确拒绝，不清已付保护或资源。技能阶段只提交typed效果，Damage计算真实死因，DeathResolution完成遗言/徽/钩子/追加波次后PM最后judge。
13. 学习/ready/技能选择/报告/资源只本人，目标无通知，小狼不获这些事实。God保存因果；玩家状态/DTO与事件按已知字段白名单，不泄目标库存/毒手/其它未授权信息。本人可看其自选对象与学到身份，不把独立库存当来自原目标的历史。
14. 成功枪的**玩家公开协议**统一为中立 `player_shot {actorId,targetId}`：原生Hunter与复制Hunter同type/字段、公开事件的玩家档stage均为death_shot，不能从原hunter_shot类型或记录stage辨别来源。God内部可保原生hunter_shot与复制枪因果及真实底牌；自己的请求stage可按已知角色不同，不授其它玩家。只确认实际枪击与目标，不额外发布trueRole、camp、学习对象或库存；God复盘已明示全底牌，不声称该视角隐藏来源。枪许可/目标从request原life到实际追加死亡提交均复验，不用裸ID杀复活新body。额外刀致死单独 `awakened_hidden_knife`原因，沿普通刀遗言/枪许可策略，不借机械破盾死因。
15. 所有新Role/阶段/tool/错误/资源/反馈/日志/审计/复盘/前端/视频中英齐备；机器字段、原话/昵称/人格不翻译。`roles.awakened_hidden_wolf`只接受{}，不开放任意学习范围/模式/保护参数拼规则。

## 完整启用要求

- 六结果／五种技能（民无技能）、任意夜学习/待到夜末/同夜Mirror role伪装、独立库存/历史、原生Hunter夜末当日枪vs主动次夜、学前后camp不变；活/死/本人与目标、非法/skip/资源耗尽及不补。
- trueWolf唯一继承/同批皆死/复活暂失/固定首个可刀时点，额外刀once/留后夜/真正消费/不补，不相认/无聊群刀/不自爆；刀+技能同夜、额外刀同异目标/普通保护、女巫仅基本刀口，无机械mode/破盾/反毒/自罚/首刀夜过期混入。
- 复制Guard poison防护+repeat拒绝/skip打断、普通Guard/Heal冲突和Poison多源/旧life；复制Poison原source与库存，Hunter许可/forbidden compound/初夜刀毒/徽/追加死亡之后最后judge。
- actor/target/资源/source/policy/phase与原life最终复验、已付prefix/World重入；typed所有权与观察字段、God/actor/小狼/target受众，对象库存/报告不复制。
- 六/原十二配置、字面SDK/ACP/MCP/混合两语完整局＋strict Tape、每板至少20受限seed与每技能/继承/跳过正覆盖；Mirror原联合板必须真实运转，旧Magic/Mechanical/Hidden等受影响边界回归。
