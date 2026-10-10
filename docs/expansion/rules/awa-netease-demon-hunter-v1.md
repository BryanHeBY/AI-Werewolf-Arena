# AWA 网易卡表来源猎魔人 v1（规则冻结）

来源为[网易官网公开卡表](https://langrensha.res.netease.com/pc/gw/20190509150909/js/kapaiData_02806e2.js)的 `num:23/type:2`；2026-10-10直接下载并Unicode解码读取。文件未标条目发布日期，URL数字不是出版日期。官网条款支持第二夜起逐夜可猎、真狼目标次日出局/好人目标导致猎魔人次日出局、女巫毒无效；未写每夜必须、一次总库存、全部特殊伤害免疫或所有扩展交互。

唯一 `awa_netease_demon_hunter_v1`，Role `demon_hunter`，真实Good/神边，普通Good胜利归属。首批仅两份精确牌组各配单独City或Side，共四板：6人=2Wolf+1Villager+1Seer+1Witch+1Demon；12人=3Wolf+4Villager+1Seer+1Witch+1Hunter+1Guard+1Demon。Demon必须且仅1；其余牌数精确匹配，不含Idiot。无排序限制但总数及各角色计数固定，不接受其它“基础七”数量变体。City/Side只能且仅一个；归并完整死亡链后既有Wolf=0优先Good，两方同时全灭也是Good；Side在仍有狼时神=0或民=0则Wolf，Demon计入神，不增加胜方活人门槛。其它P5–P9、活动、额外初始牌池、复制/赠予/转移与其它目标组合尚未支持，必须拒绝。是否扩大组合依后续独立验收。

## 明确AWA补全（不冒称官方）

第一夜不打开主动工具，女巫原生毒免从初始即有效。第二夜起原活人猎魔人在Witch/Seer后、统一夜伤结算前的priority650、stage demon_hunter回应一次。唯一allowedTool demon_hunt，min1/max1/required_any，requiresAction=true、error/noFallback。原factory请求opaque绑定World/config/actor/tool/day/Night/原组件及当夜窗口；仅获准交付链同scope clone，deadline只能缩短，普通复制或跨World请求拒绝。

`demon_hunt {target_id:int|null,abstain:boolean}`：选其他当前活人，或规范null/true显式弃猎；非null/false才狩猎，不能自猎/尸体/字符串/额外字段。每个实际夜一次，允许跨夜重复对象，没有整局一次库存。requiresAction只要求规范回应，不描述成官方强制每夜猎杀；错误/缺失为严格失败，零provider fallback/随机补动作。

选定目标按其原真实Camp判Wolf/Good，不按Seer查验标签或胜利目标。初批阵营只有原Good/Wolf；第三方/变阵营/同名觉醒组合不兼容。域提交持有原角色/原privateState/原scope、原配置、生命版本/目标身份与phase预算，原request/deadline克隆链授权；await前后及实际伤害标死前复验。

提交前非法、过期、重复或撤权：decision error，无accepted gateway op、无history、不补猎。同步合法域提交后才decision action及accepted op、追加一次history；合法弃猎也占当夜槽且入history，不产生伤害。提交后标死前撤权保留action/op/history真实前缀，只取消待结算伤害，God记精确取消，不删除历史、不重新打开槽、不补请求。该能力无可扣整局库存，不能用“不消费”掩盖已提交选择。

正常同夜狼刀尚未结算，不能让已提交合法猎杀凭较后stage消失；实际外来先死、重活或身份/组件更换撤权。命中狼新增 `demon_hunt` 夜死因，误猎则猎魔人新增 `demon_hunt_backlash`。跨Night→PM最后一次授权复验后，在任何Alive写入前统一冻结全部合法hunt、反噬、WolfKill和原生Witch来源集合，再逐波标死；同波原Witch待死不撤已提交合法毒，不能按标死遍历顺序撤毒免。猎魔人不直接写Alive、不先判胜或打断后续原夜技能。普通Guard/Heal只处理狼刀，不能挡两种新源；同夜自身狼刀与误猎保留两源。Dream、Charm、反射、吞噬、替死与特殊枪不在初批支持范围，不用泛化免伤推断。

Night内完成源归并、遗言、徽、枪及追加波→公共night_resolved完整死亡ID（含终局）→City/Side判胜→仅非终局转Day/首日竞选；该流程是AWA补全，不冒官方。死亡枪按原Hunter awa_knife_or_exile_v1全源允许表，demon_hunt_backlash禁枪；不是给Demon增枪。

本有限AWA板的原生Witch工具也采用error/noFallback，合法明确none仍可提交；provider失败不补弃药。这是交付完整性工程约束，不是网易角色条款，也不改既有其它AWA板的Witch默认。毒免只抑制拥有原生Witch实例与本次合法生命周期证明的原毒，女巫毒药仍实际消费。没有合法来源的通用Poison印记、非女巫复制/赠毒/反射及其它夜伤不自动受免；未支持来源组合配置拒绝。若来源撤权，不把其当有效毒再发免毒成功事实。免疫判定、原Witch来源与授权证明仅God；Witch仅见自己合法毒药使用，不获目标为Demon或毒免成功反馈；Demon也不自动获知遭毒、毒者或免毒。

## 原生实例、权限和录制

独立原生state精确 `{policy:"awa_netease_demon_hunter_v1",history:[{day:整数>=2,targetId:整数|null}]}`；实际夜严格递增、唯一day，null是弃猎，非null是原非本人目标；没有remaining/count/目标Camp字段。原Role/Camp/Victory/privateState引用保持，普通狼人未知身份。工具与提示不反馈夜中目标Camp；次日死亡按固定公开ID/翻牌规则披露。

God full选择事实 `{policy,actorId,day,targetId}`；本人lean `{policy,day,targetId}`，不含目标Camp。God取消事实引用原已提交非空choice、原day/owner与具名reason；不伪取消弃猎、首夜动作、无history的选择或跨板owner。其他人均无以上事实。God死亡源仅其scope；公共night_resolved只ID，不泄露hunt/反噬/毒免原因或Camp；最小private sharedFrame只本人身份及合法lean选择，不把God死亡源转给private/public。

CP保持6/12原roster、Role/Camp/Victory/native库存/history；失败安全快照独立刷新合法原Witch消费，getter/Proxy零执行，替换组件不得混入成功缓存。strict source/Tape因果同时验证原决定、accepted op、选择fact/history、取消及最终完整源，不以source/replay共用缓存互相证明。免疫成功仅God精确事实 `{policy,actorId,day,witchId}`；每份证明至多一次，必须与原native Witch毒药真实消费和原目标一致。God取消reason有限为 `authority_revoked`，不把未知异常当已验证取消。

## 固定normalized配置

Seer awa_alive_v1/awa_required_when_legal_v1；Witch selfHeal disabled/awa_with_heal_v1/awa_one_native_v1；12板Hunter awa_knife_or_exile_v1、Guard netease_consecutive_nights_v1；disclosure awa_hidden_v1、lastWords awa_initial_wave_v1；voting awa_direct_v1，两票tie min_id；Sheriff awa_final_candidates_v1/awa_next_seat_v1/1.5/min_seat，6板disabled（normalized省略sheriff/sheriffVote与不存在的Hunter/Guard参数）、12板enabled，无initialSheriffSeat；hooks只有onPreElection/onPreVote为true，selfDestruct只有这两窗口。缺省经normalize可等价，任何其它normalized值拒绝。唯一Demonpolicy不按其它角色策略重写来源。

schema→bootstrap/实例→请求/严格preflight→域提交/伤害→DTO/双语→God/本人录制→CP因果→actual strict Tape→四板全部贯通后才启用。复制/赠予/转移不因新角色登记开放。规则卡不能代替角色验收。

## 必要人工判例与门禁

第一夜无hunt仍挡合法native Witch毒；第二夜选狼/好人/弃猎；跨夜重复对象，禁自/尸体/额外参数/一次原请求；目标身份/配置/生命/原组件/phase/deadline撤权、getter/Proxy零副作用；actor同夜狼刀+猎狼双根、误猎+刀复合源；Guard/Heal不挡hunt/反噬，普通刀原矩阵；Witch毒实际消费但免毒，不吞其它源；完整遗言/徽/枪链后City/Side结果，两方全灭Good。

独立手写人工结果；四板分别实际双语SDK HTTP/ACP子进程MCP/mixed完整胜利与strictfailure partialTape；God/Demon/Witch/普通人四scope字段矩阵；失败CP真实已消费Witch库存与late取消；受限Observed逐Tape、1000World、前端sharedFrame/Chromium/PNG。前端坏档拒伪库存、泄漏Camp、无owner/首夜history/假取消。三组只读review与完整离线门禁。角色仍planned，目录23verified/8implemented/33planned；Ghost完整功能已在f5153b8交付，继续本角色实现。

## 选择预算与晚撤权的可执行Tape输入

request/deadline只约束provider交付与同步choice commit，提交成功即关闭该请求，不把请求deadline续作已付效果寿命。效果保留原World/config、Role/privateState/生命版本、目标原身份和Night窗口，至before_night_source_freeze再次复验；Night整体取消仍撤效。

取消事实精确 `{policy,actorId,day,targetId,reason:"authority_revoked",faultId:字符串|null}`，引用同夜已提交非空choice；faultId只审计，不控制伤害。default纯action Tape没有已执行故障输入、也不能从已有确定性游戏输入推导外部取消时，严格拒绝，不按God取消标签跳伤害，不宣称能重造未记录外来组件突变。

验收使用可选严格版本化 `faultPlan`，独立夹具开局前给定，同一不可变输入进入source录制与Replay。精确 `{version:"awa_fault_plan_v1",steps:[{id,at:{day,point:"before_night_source_freeze",afterDecision:{actorId,stage:"demon_hunter",turn:1}},mutation:{kind:"replace_alive_component",playerId,alive:true}}]}`；初版仅此具名操作，只允许提交后原actor/target等已有真实玩家，禁止脚本/回调/任意字段路径。输入属于明确离线验收故障边界，不是公开board参数，不是模型工具。

source/Replay同一engine边界都真正以World操作新建Alive组件，记录fault_applied独立op，每步仅执行一次；未知步骤、错边界/目标、重复/未消费均拒绝。引擎随后自行复验生成取消与CP，不直接修改proof结果。独立oracle要求原action/op/history保留、取消一次、猎杀伤害为零、原生消费保留；严格比较请求/事件/CP/ops及故障消费。删fault、改时点/玩家、删取消、伪取消、取消与猎杀伤害并存坏档均拒绝。该证据明确称fault-plan Tape，与默认纯action Tape分开；不能由取消fact反推或补造faultPlan。
