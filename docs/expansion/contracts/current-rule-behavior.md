# 八类当前规则与最终验收依据

2026-10-09，按实际 consumer 描述；“没有来源变体”表示保持指定行为，不写笼统 deferred。下列外部链接只支持其明示条款，AWA 扩展工程部分独立标注。角色策略更新见 [摄梦/狼美人契约](historical-night-role-policies.md)。路径以 backend/src 为根。

## 1. 通用信息与受众

普通夜死通过 night_resolved 给死亡 ID，不公开底牌/死因/梦或魅惑来源。mechanisms.disclosure.deathRevealPolicy 已支持 awa_hidden_v1（默认）/netease_2017_open_v1：只有实际提交死亡才产生 player_role_revealed，只给 ID 和当时底牌，每生命一次；白痴放逐免死走专属事实。mechanisms.lastWords.policy 已支持 awa_initial_wave_v1（默认）/netease_2017_day_and_first_night_v1，控制遗言而非枪权。

阵营/具体身份查验只发授权私有受众，按角色伪装解析；预言家历史不成为全队历史。历史狼队事件按记录 audience 授权，而不是用今日身份反推过去受众。ownState 使用独立 DTO 白名单，不复制 privateState；PresentationReplay 独立白名单不承载玩家私有状态。梦游者/魅惑目标无直接通知或特殊状态字段；合法公开落空结果仍可用于推断。坏回放事实原子拒绝，不从字段名称猜角色。

丘比特选择只在God保留来源策略/原阵营/关系组；情侣各自仅收到对方ID，Cupid自己的DTO只保留已选两人ID，不泄漏底牌或最终分组；历史私有通知按原actor授权，复活/换生命撤销当前关系DTO。已有配置：丘比特具名胜利策略、明牌/遗言策略；hidden_wolf.campInspection；seer target/action；gargoyle/psychic/mirror_girl inspectionPolicy；witch knifeVisibility。没有“全部公开/共享全部历史/穿透所有伪装”开关：官方条款仅证明特定身份与受众，未证明全局扩权。源码：engine/agent_visible_event_feed.ts、roles/player_state.ts、roles/inspection.ts、replay reader；证据：agent_visibility/player_observation/replay_event_reader/public_death_policies 与本批独立DTO回归。

## 2. 保护与伤害

Guard+Heal 同时存在则两者抵消，只影响普通保护，不取消独立梦/机械盾/觉醒盾。普通 Guard/Heal 不挡毒/返回毒。机械盾反射原毒一次，返回毒不递归反射；觉醒盾吸收原毒/返回毒。目标生命/来源 scope 失效不提交对应效果。

| 原因                      | Guard          | Heal                       | AWA梦默认 | 网易具名梦                                | 机械盾                 | 觉醒盾 |
| ------------------------- | -------------- | -------------------------- | --------- | ----------------------------------------- | ---------------------- | ------ |
| 普通刀                    | 挡，双保护抵消 | 同左                       | 挡        | 挡                                        | 挡                     | 挡     |
| 毒/合法返回毒             | 不挡           | 不挡                       | 挡        | 挡                                        | 原毒反射，返回不再反射 | 吸收   |
| 机械额外刀                | 穿透           | 有效Heal挡，Guard+Heal抵消 | 挡        | 挡                                        | 挡                     | 挡     |
| 觉醒额外刀                | 两者恰有一个挡 | 同左                       | 挡        | 挡                                        | 挡                     | 挡     |
| 机械守护失败              | 不挡           | 不挡                       | 不挡      | 挡（扩展工程补全、未开放机械+梦公开板子） | 不挡                   | 不挡   |
| 奇迹反噬                  | 不挡           | 不挡                       | 挡        | 挡                                        | 不挡                   | 不挡   |
| 黑市反噬                  | 不挡           | 不挡                       | 不挡      | 挡（扩展工程补全）                        | 不挡                   | 不挡   |
| 连梦/施梦者夜死牵连 Dream | 不挡           | 不挡                       | 不挡      | 不挡                                      | 不挡                   | 不挡   |

Night 来源枪/Charm 由 DeathResolution/DreamNightFrame 单独判断梦保护；Guard/Heal 不挡魅惑。Day 来源不借旧梦。已配置 Guard repeatPolicy、Witch 自救/药品策略、Dream protectionPolicy；没有任意每死因 bool 或优先级编辑器。[官方奇迹商人公告](https://www.taptap.cn/moment/19875502311345790)支持赠守同守同救，但没有覆盖上述全部扩展原因；保持每个明确版本，防止组合成无来源玩法。源码：core/domain/systems/damage_resolution_system.ts、core/domain/night_effects.ts、engine/death_resolution.ts；证据：mechanical_damage/awakened_damage/dreamer/night_abilities 与本批矩阵。

## 3. 夜序与动态能力

按 priority 升序，同 priority 按 stage id 排序并去重。当前阶段：80丘比特（仅首夜）；100女巫重置；110混血；125奇迹赠予；130黑市交易；140黑市受赠；150摄梦；180通灵；200狼聊；250机械/觉醒模式；300守卫；400刀票；450魅惑；500女巫；580机械/觉醒学习；600预言家/石像鬼/魔镜；650机械/觉醒技能；660特殊刀；700幸运儿；900觉醒激活/赠枪激活。相同优先级仍以实际注册 id 次序，未在板子里的阶段不凭表出现。

NightStageRegistry 预先纳入角色 possibleNightAbilities/possibleDeathAbilities 与世界已有实例，因此前置赠予产生能力后可进后置阶段；每实例实际 startsOnDay/expiresAfterDay/activation/scope 再限制。已配置：角色组合、具体行动策略与骑士 Day enabledWindows；**没有夜序 preset 或数字优先级用户字段**。公告支持奇迹前置赠予/后置幸运儿，机械参考页只给其自身板型，不能据此重排混血/商人/梦/觉醒混合板。保持稳定 AWA 顺序，避免未知跨板语义。源码：mechanisms/stages/night/night_stage_registry.ts 与各角色 night_stages.ts；证据：night_abilities、merchant_game_execution、mechanical/awakened execution + strict Tape。

## 4. 死亡链与胜利先后

丘比特关系先按本次外部死亡种子闭合，殉情方在任何死亡技能请求前取得Lovers抑制死因；夜间已付费梦关系继续迭代，日间不沿旧梦。守/救/梦不挡殉情；狼美人全部来源版本都不因殉情发动魅惑。这是新增情侣规则的有限跨角色工程补全。DeathResolution 再标死并处理初批遗言、警徽与死后技能，所有追加波次/梦/魅惑/枪及警徽完成后 PhaseManager 判胜；不在见到末神或末狼时跳过链。默认 winConditions 缺省为屠城；SlaughterCity/SlaughterSide/WolfReachHalf 各条目先检查 wolves=0，因此普通双方全灭为 Good，不产生通用平局。板子 rules.winConditions 是有序数组，先命中的有效决策生效。WolfReachHalf 还要求 good>0 且 wolves>=good，是 AWA 工程条件。

末狼狼美人只有真实放逐、有效魅惑实际消灭最后一神/民时，exile_settled 的 slaughter_side 条目可覆盖普通清狼；[City,Side] 与 [Side,City] 可因此不同。胜者成员按胜利归属，不按当前持有技能或是否活着改写。

丘比特首批仅屠城：完整链之后先检查两名原生命情侣均存活且关系组外皆死的独胜，再检查普通屠城。网易2017丘比特始终跟随情侣，Lui-même独立丘比特仍随好人；狼数量只计真实Wolf，网易跟随Wolf/第三方的原丘比特不阻挡狼屠城。其它独立目标组合仍拒绝，详见[来源策略卡](../rules/sourced-cupid-v1.md)。已配置有序胜利条件、死亡枪deathActionPolicy、遗言/警徽策略、有限死因策略；没有任意抢先判胜/平局 preset。2017基础条款支持屠边/清狼，未给出所有扩展同时灭绝与复合链裁定，保留 AWA 具体结果。源码：engine/death_resolution.ts、engine/phase_manager.ts、win_conditions/default_specs.ts、wolf_beauty/relation.ts；证据：victory_outcomes/death_chain/wolf_beauty/第一夜临界局。

## 5. 复制资源与期限

机械学习新模板：村民空能力、查验空历史、毒1、守护空目标、枪独立canShoot/armed、狼人独立额外刀；原角色库存不克隆也不消耗。readyOnNight=学习day+1；进入实际相应夜才武装枪。额外刀仅首个获准接刀夜窗口，选skill模式或窗口过去会 expired；晚学狼人且首刀窗口已过也不能补刀。

觉醒学习用自己的六类模板；夜末实际激活记 activationNight，activeFromNight=activationNight+1，主动技能随后实际夜可用；枪激活时武装。觉醒额外刀是一次库存，空刀仅关闭本夜机会、不消费库存，未沿机械的首刀过期窗口。复制不按 holder 的原生枪/查验参数重写模板。

已配置：板子角色/原生具体role查验与枪策略，不是学习库存/期限参数；机械/觉醒角色参数仍{}。[机械参考页](https://werewolves.games/ji-xie-lang/)支持一次学习/通常次夜使用，未明确库存快照、全部模板和两角色期限；故保留当前版本而不开放“克隆剩余库存/任意生效夜”。源码：mechanical_wolf/state.ts、awakened_hidden_wolf/state.ts；证据：state/inheritance/runtime/scope/configured_role_policies。

## 6. grant/copy/transfer 与枪来源

grant 输入显式 statePolicy/状态模板，建立独立资源，copy 源身份必须真实存在且kind一致；不允许复制 lucky/black_market 实例。transfer 先验接收者、创建成功才移除旧持有者，保 uses/lastUsedDay/起止夜/disabled 等元数据；保 Guard lastTarget、Dream lastTarget/lastDay/protectionPolicy、药的列举库存与本夜标记、role_check 完整history/state。Seer 低层 statePolicy 可改知识、Guard/Dream 非库存 history 并非通用全字段等同检查，不能把它写成所有转移全状态完全一致。Lucky 必须 state 完全一致；Black 只用白名单投影且完整检查 state/资源/来源和转移期间life/role/scope，不能刷新或向坏阵营泄漏。

赠枪由黑市创建一次独立枪；只在后续实际夜武装，转移保 original grantedNight/armedOnNight/remaining/disabled/deathExpired，目标存活且Good、没有现存/退休重复枪。copyDeathGun 明确不支持。机械/觉醒学猎人的枪是角色自己的模板，和黑市赠枪实例不同；它们不继承持有者 native deathActionPolicy。S7 狼美人只认实际原生hunter_shot，赠枪/转移枪不升级为原生猎人来源。

没有面向用户的通用grant/copy/transfer配置：它们是受机制授权的引擎 API。没有来源支持转移回满、任意source字段或“持有者原生规则接管”，保留严格来源与库存检查。源码：roles/ability_changes.ts、death_abilities.ts；证据：night_abilities/gift_gun/configured_role_policies 与本批 Dream transfer。

## 7. 奇迹商人

库存一次 check/poison/guard，合法赠予消费商人库存。可选无行动只关闭本夜、保库存以后再选；赠真Wolf阵营不授能力而反噬商人。成功独立 lucky 实例 maxUses=1、startsOnDay=当日，700阶段当夜可用，也可留以后；lucky 每夜只选一种动作，不能把原生女巫双药实验套到赠毒。活体目标/阵营/来源在提交点再验，受赠者死亡永久过期，复活或转移不刷新。

MerchantBacklash 初始夜死因，不受Guard/Heal/机械盾/觉醒盾阻止，AWA梦与网易具名梦均挡；绑定原生命/付费来源scope。公开/私有结果沿既有受众，不把真实阵营错误当预检泄密。角色参数仍{}，没有多库存/换货/无反噬配置。[2020官方公告](https://www.taptap.cn/moment/19875502311345790)明示一次、技能可保留、赠狼次日出局及阶段独立；未定义所有新增保护的反噬矩阵，保持 AWA 明确补全。源码：miracle_merchant/night_stage.ts、recipient_ability_stage.ts；证据：miracle_merchant/merchant_game_execution/simulation/Lucky Tape。

## 8. 黑市商人

库存一次 check/poison/gun；无行动关闭当夜保库存。合法赠予消费；赠真Wolf不授技能/受赠通知，反噬商人。check/poison 实例 startsOnDay=day+1，在140黑市专属阶段可用，不能被普通Seer/Witch阶段提前消费；赠枪只在后续实际夜900激活，不因日次跳转伪造激活。受赠者不知道来源，死亡永久过期，保留受赠后的获准知识；Black 转移与资源严格检查见第6项。

BlackMarketBacklash 不受普通保护和 AWA 默认梦阻止；网易具名梦挡是本批明确扩展工程规则。角色参数仍{}；本批没有改库存/同夜生效/来源通知规则，也没有新增黑市多次库存或自身免反噬preset。黑市并非奇迹别名，同名二手资料不足以替换已冻结 P7 版本；故保留具体 AWA 行为，而非用奇迹官方来源冒称黑市标准。源码：black_market_merchant/night_stage.ts、state.ts、death_abilities.ts；证据：black_market_merchant/black_market_game_execution/gift_gun 与双语黑市反噬 Tape。

八项状态均为当前实现已逐项复核；没有来源的额外玩法没有实现或宣称实现。新源码门禁记录在 [implementation-status.md](implementation-status.md)，用户最终验收仍待进行。

## P8杠精的有限当前行为补充

`roles.debater.policy=awa_melbourne_2026_speech_gap_v1`仅一项赛事来源AWA窗口适配，schema严格、默认具名，首批11角色。普通发言前可选、整局接受一次，不改夜序/保护/死因/复制转移/商人库存；真实Good神职仍按原AWA胜利计数。匿名表决按接受时全活人固定1票严格过半，与放逐和警长票重分离；临时禁票只原生命/该日常规和PK，徽移交保留配置。完整边界见[规则卡](../rules/awa-melbourne-debater-v1.md)与[验收](../reviews/p8-debater.md)，不能称完整赛事预设。首组事件尚未启用，原八类行为及已有配置保持各自来源语境。
