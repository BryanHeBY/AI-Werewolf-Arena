# 鬼魂新娘：Melbourne 来源的有限 AWA 三方规则

唯一 `awa_melbourne_ghost_bride_v1`，来自2026-10-09实际读取的[Melbourne Masters 标准板](https://melbournemasters.org/setups/gui-hun-xin-niang)与[角色卡](https://melbournemasters.org/setups/roles/%E9%AC%BC%E9%AD%82%E6%96%B0%E5%A8%98)。来源明确12人构成、三方须清其余两方、首夜选新郎/情侣殉情及每夜沟通、Bride查验Good、情侣共选证婚人、Witness仅知两号且不见夜聊、单身Wolf清完后情侣刀/再清情侣后Witness刀、单爆吞徽。角色卡提醒以本局版型为准；本版本不冒大众唯一规则或完整赛事复刻。

来源没有裁定下面共同选择协议、原Wolf婚礼成员权限、固定成员Goal、夜初刀捕获、复合殉情枪权、全灭和细夜序。以下全部为明确AWA工程补全，不开放任意变体。

## 唯一有限板子与目标

精确12牌：3普通Wolf、4Villager、Seer/Witch/Hunter/Guard/Bride各1；标准N，拒绝其它扩展/额外牌池/event pack。独立 `three_factions_elimination`，拒绝City/Side/ReachHalf或组合优先。Good神民共同胜利方；Bride初始ThirdParty，提交Groom后两人Third，Witness仅双同意完整提交后Third。原Role/Camp、姓名、Agent、生命、徽、原生库存不换，Bride自身Camp Third；Groom/Witness独立Victory只Third，移除原Good/Wolf目标。

全roster初始化绑定原主体、生命版本、Role/privateState/Camp/Victory原组件和原派别；完整group冻结3成员，其他人按原Good/Wolf归属，每人恰属一方。判胜及获胜名单按此不可变assignment，不按当前Role.camp猜。一个派别至少一活人且另外两派全死才获胜，获胜名单含本方死者；全灭draw。原组件/授权归属漂移失败关闭，不退回City/Cupid。所有牵连、原生死亡枪追加波次、遗言/徽处理完后PM唯一判胜，不在末Wolf/情侣刚死时提前封盘。

## 首夜双阶段关系与授权

先Bride min1/max1 mandatory/error/noFallback `choose_bridegroom {target_id:整数}`，必须另一原活人。同步冻结独立pair `{policy,groupId,brideId,groomId,day:1}`、关闭原选择机会、赋二人Third Goal。双方私有互认伙伴号（Groom知道Bride为新娘），不自动交换原其它角色/库存。

随后Bride、Groom顺序各提交一次 `speak_to_partner`（总2条，可空text显式不发言；缺回复/非法失败）；再Bride mandatory提名 `choose_wedding_witness {target_id:整数}`，必须非情侣原活人。第一份提名仅向Groom给 `proposedWitnessId`，Groom同generation mandatory提交同号；不一致/缺失/非法明确失败，不代选、不猜minID。第二票后二人及目标原life/版本、Role/privateState/Camp/Victory、第一份原票授权全部终验，无await同步创建新的冻结group `{...pair,witnessId}`与Witness Goal。不得给原pair对象追加Witness字段。

原factory opaque request绑定World/config/actor/tool/day/phase/setup generation、pending窗口与原组件，不靠模型stage或复制metadata授权；deadline克隆仅沿明确继承。提交前与await/gateway后重验，死亡后复活/同号新主体/跨World/旧窗口/重复票均拒绝。聊天用已提交pair授权，提交和投递前重验发送/接收原life版本与Role/privateState、owner、World/day/phase；任一失效不写新message，首夜不依赖尚无的group。

God setup精确 `{policy,status,actorId,groomId,witnessId,witnessVotes}`，未提交id为null，votes是0/1/2个精确 `{actorId,targetId}`；status为pending/active/paired/complete/failed/cancelled，active不写成功checkpoint。Bride状态精确 `{policy,remaining:0|1,groomId:整数|null}`。pending无pair/票、Bride1/null；paired有原pair、Bride0/原Groom、二人Third、无Witness；complete同号两票/完整三人group。closed保留真实前缀：无pair、pair+0票、pair+1票、pair+2份不一致票均可失败，但不得有完整group。婚礼setup未完成时失败的外层RecordedCheckpoint.complete=false与status failed/cancelled配对，不给setup schema额外complete字段。失败finally关闭全部窗口和传输回合，保原失败；不能重新setup/投票/自爆/判胜/下一日推进，半pair不能当ready。不读取外来getter或把替换state写成成功。

## 夜序、秘密与唯一刀

首夜：Night→Bride选Groom→两条顺序情侣聊天→Bride提名/Groom同意Witness→complete→capture唯一knife owner→Guard→普通Wolf或独立继承刀→Witch→Seer→完整源闭包→逐波标死/固定遗言/徽/死亡枪与新增波→night_resolved完整死亡ID（含终局）→全链PM判胜；未终局才天亮/首日Sheriff/Day/Voting。后夜：Night入口capture一次owner→两活情侣顺序各一条chat→Guard→唯一knife→Witch→Seer→同样死亡链、公共完整死亡发布与收尾。Hunter夜晚确认仅本人原库存状态提示，不增加空动作。来源夜末上警仪式改成AWA夜伤后活人竞选，明确流程改编。

单身Wolf严格为group外原普通Wolf。原Wolf Groom/Witness离开普通互认/夜聊/刀/自爆；保原身份查验与历史记忆，退出产生的推断允许。自爆在request、validator和commit三处拒绝，不能只改wolf_team。情侣/Witness不加入普通wolfKnifeHolders，不用wolfTeamEvent广播继承票，只复用伤害处理。native神职原技能库存保持，第三方Goal不剥除技能。

刀owner每夜capture一次：活单身Wolf>0→普通包；否则两原情侣都活→情侣；否则两情侣都死且Witness原活→Witness；其它无刀。首次capture必须complete后，门槛变化到下一夜，不因不同波次再补刀。情侣资格依两生命同时有效，晚失一方不能降格另一人单刀；撤权只能撤刀，不能当夜换owner。所有刀在末伤害提交重验owner、group和目标原life，死亡复活/替换撤销。

knife请求mandatory min1/max1/error/noFallback；显式弃刀 `{target_id:null,abstain:true}`，选人 `{target_id:整数,abstain:false}`，交叉组合/缺回复拒绝。情侣各一票，两弃→无刀，一弃一选→选者目标，同选→一次该目标，不同选→minID；目标排除二情侣。Witness排除自己。普通Wolf沿原一票协议/minID，继承组不共享普通票fact。继承刀使用WolfKill夜伤，Guard/Witch及AWA双保失败照固定参数；不绕保护。

## 死亡与查验

Bride Seer查验固定Good，其它婚礼成员按原角色truth，原Wolf仍Wolf；不拿独立Goal当查验Camp。Witness没有殉情，情侣唯一关系owner独立于Cupid。

仅真实独立死亡根向另一方派生Lovers，派生不回灌根。单根Groom Hunter WolfKill→Groom仅WolfKill可枪，Bride Lovers；Bride WolfKill→Groom Lovers禁枪。双方同波各有独立外因→两方保原原因且各加Lovers，Hunter禁枪。Poison抑制优先；选定native `awa_knife_or_exile_v1`要求所有源均刀/放逐，Shot+WolfKill禁枪，不能仅含刀就合格。抑制和来源先全波归并/关系闭包，再开放枪窗口，枪提交仍重验原life/库存/源；新增波继续closure。单根毒/枪/放逐/自爆/刀均连另一人，所有重复边和源有限去重，不提前裁赢家。

## 固定 normalized 配置

除唯一Bride policy外，不开放本preset任意参数变体，schema/resolve/Tape同拒。

| 项目       | 唯一值                                                                                     |
| ---------- | ------------------------------------------------------------------------------------------ |
| 目标/牌数  | three_factions_elimination；exact12deck                                                    |
| Seer       | awa_alive_v1 / awa_required_when_legal_v1                                                  |
| Guard      | netease_consecutive_nights_v1；原显式弃守与目标协议                                        |
| Witch      | selfHeal disabled / awa_with_heal_v1 / awa_one_native_v1                                   |
| Hunter     | 原生awa_knife_or_exile_v1；本owner额外Lovers抑制                                           |
| Sheriff    | enabled；awa_final_candidates_v1；awa_next_seat_v1；1.5；min_seat；无initialSheriffSeat    |
| Voting/tie | awa_direct_v1；exileVote min_id；Wolf/继承刀 min_id                                        |
| 信息/遗言  | awa_hidden_v1；awa_initial_wave_v1                                                         |
| hooks      | onPreElection=true、onPreVote=true、onDaybreak=false、onPerSpeechGap=false                 |
| 自爆       | 仅on_pre_election/on_pre_vote；group原Wolf不可自爆；单爆销全场徽并取消未完首次竞选，不转徽 |

## DTO、录制与严格消费

God见完整pair/group/双票/每夜owner/伤害来源/Goal。情侣本人见原身份库存、伙伴号、自身Third目标、完整已提交Witness号、合法chat；Groom见首票提名，Bride在complete见一致结果，不开放Groom原raw decision。Witness见自身原身份/库存/Third目标、情侣两号和本人是否继承刀，不见聊天/原两票/双方原角色库存。普通Wolf只有有效普通队友/普通包，无婚礼fact；历史授权内容保留。逐knownWolfTeammates、native projectLover、工具、target候选、DTO/提示/Observed/private录制与sharedframe核验，不只过滤新事件。不向unknown补原角色。

独立strict typed full/lean fact与setup owner，不夹Cupid/Hybrid/Lonely或基础旧档。中途未finalized仅上次CP events可落后decisions，不能消费为完整Tape；成功须双份同代同号原决定、一次完整group、各夜唯一owner/single knife、原roster/Goal/库存、完整CP矩阵；婚礼setup未完成的失败partial保真实pair/票前缀、无group、native决定0；setup已complete后原生技能失败则保完整group、setup complete、真实原生决定及实际已消费库存，只有外层CP complete=false，不能伪装为未完成婚礼。同步改fact/state/Goal、foreign request/life、伪complete/重复票/无capture继承刀、跨preset/无owner混挂均拒绝。

## 人工预期与实施门槛

三方各独胜/清一方仍继续/全灭draw；Groom与Witness同为原Wolf、神职×神职原库存实际扣付；双同意、分歧、缺一票、第一票后目标/票者/阶段晚撤权和半pair失败partialTape；三刀owner有刀/弃刀/保护、晚撤权不降级/不补刀、末singleWolf白天死次夜继承；两条chat及Witness0可见；全部独立根/双根/复合源/枪链与吞徽；opaque/deadline/跨World/getter0；God/两情侣/Witness/普通Wolf四scope双语真实档、strict private读档、Studio/sharedframe及坏档。

实施贯通schema→原生实例→窗口/阶段→权限/晚撤权→伤害/完整胜利→DTO/受限bot/双语→God/本人record→strict Tape→前端。实际SDK HTTP/ACP子进程MCP/mixed双语整局逐Tape、严格失败partialTape、受限Observed、1000World分别产生证据；三组源码复核与所有离线门禁闭合后才登记implemented。规则及实际通路已贯通，技术门禁与三组只读复核见[完整功能验收](../reviews/p9-ghost-bride.md)。当前目录23verified/8implemented/33planned；P9a五角色已技术交付，P9其余/P10及用户总体最终验收继续。
