/**
 * 负责阵营归属、混血／隐狼、机械／觉醒技能及特殊查验身份配置的两语文案。
 * 输入为既有消息 ID、参数名与身份模板；输出为 identity 家族的状态／提示／复盘片段。
 * 这些字段描述引擎已提供的身份知识，不读取隐藏阵营、变更角色或授予继承技能，
 * 实际身份所有权与启用时点仍由领域机制持有，参数插值由共享格式化器执行。
 */
import type { MessageDefinition } from "../definition";

// parameters 定义本家族拥有的 key 及排序后的唯一参数名；空数组是明确无插值，不是遗漏声明。
export const definition = {
  owner: "features/identity",
  parameters: {
    "role.gargoyle.configured_identity": [],
    "role.psychic.configured_identity": [],
    "role.mirror_girl.configured_identity": [],
    "reason.cursed_fox_survived_faction_elimination": [],
    "replay.stage.hybrid_exemplar_chosen": [],
    "replay.stage.hybrid_affiliation_resolved": [],
    "role.hybrid.brief": [],
    "role.hybrid.state": [],
    "role.hybrid.status": ["state"],
    "action.choose_exemplar.hint": [],
    "stage.hybrid": [],
    "error.hybrid_unavailable": [],
    "error.hybrid_target": [],
    "console.hybrid.choice": ["actor", "day", "target"],
    "console.hybrid.affiliation": ["actor", "day", "faction", "target"],
    "role.mechanical_wolf.brief": [],
    "role.mechanical_wolf.state": [],
    "role.mechanical_wolf.status": ["first", "inherited", "learned", "mode", "ready", "resources"],
    "mechanical.mode.kill": [],
    "role.awakened_hidden_wolf.brief": [],
    "role.awakened_hidden_wolf.state": [],
    "role.awakened_hidden_wolf.status": [
      "activation",
      "first",
      "inherited",
      "learned",
      "ready",
      "resources",
    ],
    "stage.awakened_mimic": [],
    "stage.awakened_skill": [],
    "stage.awakened_attack": [],
    "stage.awakened_activation": [],
    "stage.awakened_inherited": [],
    "error.awakened_unavailable": [],
    "error.awakened_target": [],
    "error.awakened_guard_repeat": [],
    "action.awakened_mimic.hint": [],
    "action.awakened_poison.hint": [],
    "action.awakened_guard.hint": [],
    "action.awakened_attack.hint": [],
    "mechanical.mode.skill": [],
    "stage.mechanical_mode": [],
    "stage.mechanical_mimic": [],
    "stage.mechanical_skill": [],
    "stage.mechanical_attack": [],
    "error.mechanical_unavailable": [],
    "error.mechanical_target": [],
    "action.mimic_role.hint": [],
    "action.mechanical_mode.hint": [],
    "action.mechanical_inspect.hint": [],
    "action.mechanical_poison.hint": [],
    "action.mechanical_guard.hint": [],
    "action.mechanical_attack.hint": [],
    "console.mechanical.awakened": ["actor", "day", "first"],
    "console.mechanical.mode": ["actor", "day", "mode"],
    "console.mechanical.mimic": ["actor", "day", "ready", "role", "target"],
    "console.mechanical.mimic_skip": ["actor", "day"],
    "console.mechanical.skill_skip": ["actor", "day"],
    "console.mechanical.poison": ["actor", "day", "target"],
    "console.mechanical.guard": ["actor", "day", "failed", "target"],
    "console.mechanical.attack": ["actor", "day", "target"],
    "console.mechanical.reflection": ["actor", "caster", "day", "target"],
    "console.mechanical.shot": ["actor", "target"],
    "role.mirror_girl.brief": [],
    "role.mirror_girl.state": [],
    "stage.mirror_girl": [],
    "role.psychic.brief": [],
    "role.psychic.state": [],
    "ability.role_check.psychic_rules": [],
    "stage.psychic": [],
    "role.gargoyle.brief": [],
    "role.gargoyle.state": [],
    "role.gargoyle.status": ["active", "inherited"],
    "console.gargoyle.awakened": ["actor", "day"],
    "replay.stage.gargoyle_awakened": [],
    "role.hidden_wolf.brief": [],
    "role.hidden_wolf.state": [],
    "role.hidden_wolf.state_good_v1": [],
    "role.hidden_wolf.camp_good_v1": [],
    "role.hidden_wolf.camp_inheritance_v1": [],
    "role.hidden_wolf.status": ["active", "inherited"],
    "console.hidden_wolf.awakened": ["actor", "day"],
    "replay.stage.hidden_wolf_awakened": [],
    "role.cursed_fox.brief": [],
    "role.cursed_fox.state": [],
    "victory.goal.netease_cursed_fox_last_faction_v1": [],
    "replay.stage.awakened_attack_chosen": [],
    "replay.stage.awakened_guard_chosen": [],
    "replay.stage.awakened_mimic_skipped": [],
    "replay.stage.awakened_mimicked": [],
    "replay.stage.awakened_poison_used": [],
    "replay.stage.awakened_skill_skipped": [],
    "replay.stage.mechanical_attack_chosen": [],
    "replay.stage.mechanical_awakened": [],
    "replay.stage.mechanical_guard_chosen": [],
    "replay.stage.mechanical_mimic_skipped": [],
    "replay.stage.mechanical_mimicked": [],
    "replay.stage.mechanical_mode_selected": [],
    "replay.stage.mechanical_poison_reflected": [],
    "replay.stage.mechanical_poison_used": [],
    "replay.stage.mechanical_shot": [],
    "replay.stage.mechanical_skill_skipped": [],
  },
} as const satisfies MessageDefinition;

export const zhCN = {
  "role.gargoyle.configured_identity":
    "你是独立的真实狼人石像鬼，在前段具体角色查验阶段行动；无狼队互认、夜聊或原生自爆。其他真实狼人全部死亡后，刀权仍要求本夜原生查验机会合法完成。查验目标与行动按下述配置策略。",
  "role.psychic.configured_identity":
    "你是通灵师，真实好人神职，在后段查验阶段查具体规则角色，报告尊重明确伪装；无原生狼刀、死亡枪或保护。查验目标与行动按下述配置策略。",
  "role.mirror_girl.configured_identity":
    "你是魔镜少女，真实好人神职。原生具体角色查验在后段魔镜阶段执行，实例历史跨生命保留，报告尊重明确伪装；不授予狼队权限或刀权。查验目标与行动按下述配置策略。",
  "reason.cursed_fox_survived_faction_elimination": "普通阵营全灭时咒狐存活独胜",
  "replay.stage.hybrid_exemplar_chosen": "榜样选择",
  "replay.stage.hybrid_affiliation_resolved": "胜利归属",
  "role.hybrid.brief":
    "首夜选择榜样、胜利跟随其真实阵营但不知阵营；自身始终为Good民，阵营查验始终验好。",
  "role.hybrid.state":
    "你的真实底牌是混血儿，真实阵营是Good，始终计入民边。首夜110阶段必须一次choose_exemplar选择另一实际存活玩家作为榜样，不能选自己、死者或null，也不能等待或后夜补选。合法选择之后不可更改：胜利归属跟随提交时榜样的真实阵营，但你不知道其阵营或身份，需自行根据公开信息判断。自身与榜样死亡、复活或榜样后续身份变化均不改变已冻结归属，出局后仍可随该方获胜；无胜者则你也不获胜。你始终验好、具体身份为混血儿，不获得狼队友、互认、夜聊、刀权、自爆或榜样技能，对象也不会收到选择通知。真实狼人全死时按本板Good判胜，即使你支持狼也不延长对局；狼人屠民仍必须清除你。未完成选择前没有默认胜利归属；非法、过期或撤权不会替新状态提交。只保留自己的选择记录，不把推断说成引擎确认。",
  "role.hybrid.status": "你自己的榜样选择与机会：{state}。其真实阵营与底牌未知。",
  "action.choose_exemplar.hint":
    "choose_exemplar：首夜必选一次，整数target_id为另一实际存活玩家；不可self/dead/null，不允许skip或重选。只确认选择，不获得阵营或身份。",
  "stage.hybrid": "混血儿选择榜样",
  "error.hybrid_unavailable": "混血儿选择仅首夜获授权且未选择、原胜利归属为空时可用。",
  "error.hybrid_target": "请选择另一实际存活玩家，不能自选、null或虚构编号。",
  "console.hybrid.choice":
    "【混血儿私有选择】{actor}号第{day}夜选择{target}号为榜样，阵营与身份未知。",
  "console.hybrid.affiliation":
    "【上帝胜利归属】{actor}号第{day}夜选择{target}号，冻结胜利归属：{faction}。",
  "role.mechanical_wolf.brief": "独立狼；一次学习、次夜生效；每夜选择刀或技能，唯一活狼时接刀。",
  "role.mechanical_wolf.state":
    "你的真实底牌是机械狼，属于狼人阵营。你不与其它狼互认或夜聊，也不能自爆。你的原生机械能力首夜只有学习；580阶段（女巫后、通灵查验前）可在任意夜一次mimic_role学另一活人的真实角色，立即知身份并保存独立资源，所有原生机械技能（含枪）次夜起，不改变真实角色或阵营。模仿后具体角色查验显示学到的角色，阵营仍为狼。第二夜起mechanical_mode选择kill或skill，跳过默认skill，同夜不可切换；学习机会独立于模式。kill模式只有成为唯一活狼并已到固定首次刀夜才能kill_vote。skill模式650使用已学机械技能：学通灵可mechanical_inspect重复验另一活人；学女巫一瓶mechanical_poison，没有解药或刀口；学守卫mechanical_guard可自守或null空守，盾挡刀且每条原始毒各返回原施毒者一次；反射绕过施毒者机械盾、不递归，梦仍能挡反射毒。普通Guard与Heal同守同救时，对基础及额外刀的两普通防护均抵消，机械盾独立保留。连续两夜同ID守护无效并天亮自己判离，skip/kill/null打断。学猎人次夜一枪被动不受模式限制：刀/放逐/枪/白爆可枪，毒/梦/魅惑/决斗/自罚或含任一禁止复合源不能枪。学狼仅固定首个可刀夜的kill模式有一次mechanical_attack（可null），只穿普通守卫，解药/梦/机械盾可挡；错过、未学或skill均过期，不晚补。学平民无技能。成功死亡枪公开机械枪类型、机械狼身份和实际目标，不公开学习对象ID或其它库存。合法行动/等待关本夜机会，非法或撤权不能消费新owner资源；已经实际消费及记录的前缀保留，旧作用域不能产生新效果；报告仅本人，绝不向队伍共享私有来源。外部获赠的普通G02能力按本轮绑定实例规则独立行动，原生机械模式不限制它们。",
  "role.mechanical_wolf.status":
    "已学角色：{learned}；生效夜：{ready}；曾接刀：{inherited}；固定首次刀夜：{first}；本夜模式：{mode}；独立库存：{resources}。",
  "mechanical.mode.kill": "击杀",
  "role.awakened_hidden_wolf.brief":
    "独立狼：一局一次模仿，实际夜末激活，唯一活狼后接刀，复制资源独立。",
  "role.awakened_hidden_wolf.state":
    "你的真底牌是觉醒隐狼，阵营与胜利始终为狼人。不相认、无小狼夜聊/群刀/自爆。任意一夜580阶段在女巫后、魔镜少女前用awakened_mimic模仿另一活人，一局一次，立即知真角色并伪装具体角色查验标签；不改变真角色/阵营/胜利。无工具等待不耗机会。实际夜末900才激活：猎人枪该点armed，主动技能从实际激活下一夜开始；中断则保留学习但等待后续真实激活。学平民无技能；学魔镜少女获得独立mirror规则inspect_role实例，空历史，同实例整局禁重复目标、可跳过，按绑定ability_id；学女巫一瓶awakened_poison，无解药/刀口；学守卫awakened_guard，可自己/另一活人/null，挡刀毒、不反毒，相邻实际夜同非空稳定ID非法且不关回合，null或无工具wait断连续；学猎人独立一枪，普通刀/放逐/枪允许，毒/梦/魅惑/决斗/能力自罚及任一禁止复合源禁枪，公开成功枪与原生猎人同中立player_shot。唯一活真Wolf由真实装配/死亡结算接刀，固定首个可刀夜不早于Night2；基础kill_vote与已激活主动技能独立。学普通狼有一次awakened_attack，激活次夜且当前有刀权才行动；非空活人ID才耗，null/wait不耗可留后夜，普通保护可挡、不破守卫、不覆盖女巫基础刀口。没有机械mode、反毒、连守自罚或首刀夜过期。库存不补，不继承目标库存/历史/人格。报告仅本人，已付前缀保留；迟到/换owner不得花新body资源。",
  "role.awakened_hidden_wolf.status":
    "已学角色：{learned}；实际激活夜：{activation}；主动起始夜：{ready}；已接刀：{inherited}；固定首刀夜：{first}；独立资源：{resources}。",
  "stage.awakened_mimic": "觉醒隐狼模仿",
  "stage.awakened_skill": "觉醒隐狼技能",
  "stage.awakened_attack": "觉醒隐狼额外刀",
  "stage.awakened_activation": "觉醒隐狼夜末激活",
  "stage.awakened_inherited": "觉醒隐狼接刀",
  "error.awakened_unavailable": "本夜觉醒能力未授权、已关闭或没有资源。",
  "error.awakened_target": "请选择该行动允许的实际存活整数序号；模仿不能自己。",
  "error.awakened_guard_repeat": "相邻两夜不可非空守同一玩家序号；选另一目标或null。",
  "action.awakened_mimic.hint":
    "awakened_mimic：另一活人整数target_id，非自己/死人/null；一局一次任意夜，wait保机会。立即知身份，实际夜末激活，猎人枪当点，主动次夜。",
  "action.awakened_poison.hint":
    "awakened_poison：一瓶毒，活人整数target_id，可自己；无解药/刀口，wait不耗，不补瓶。",
  "action.awakened_guard.hint":
    "awakened_guard：活人整数target_id，可自己，或null。挡刀毒、不反毒；相邻实际夜同非空ID非法，null/wait断连续。",
  "action.awakened_attack.hint":
    "awakened_attack：有接刀权限的一次普通额外刀，非空活人整数target_id才耗，null/wait可留后夜；守救/梦/独立盾可挡，基础刀口独立。",
  "mechanical.mode.skill": "技能",
  "stage.mechanical_mode": "机械狼模式选择",
  "stage.mechanical_mimic": "机械狼学习",
  "stage.mechanical_skill": "机械狼技能",
  "stage.mechanical_attack": "机械狼额外刀",
  "error.mechanical_unavailable": "本夜机械行动未获授权、已关闭或没有可用资源。",
  "error.mechanical_target": "请选择本工具允许的实际存活目标；学习和查验不能选自己。",
  "action.mimic_role.hint":
    "mimic_role：target_id为另一存活整数玩家ID，不可self/dead/null；可不调用工具等待后夜。一次学习，全部技能次夜生效。",
  "action.mechanical_mode.hint":
    "mechanical_mode：mode仅kill或skill；第二夜起每夜一次，跳过默认skill。主动技能与刀排他，学习/已生效被动枪独立。",
  "action.mechanical_inspect.hint":
    "mechanical_inspect：skill模式选择另一存活整数target_id，可跨夜重复；可不调用工具skip，报告仅本人。",
  "action.mechanical_poison.hint":
    "mechanical_poison：skill模式仅一瓶毒，整数target_id可为自己或活人；无解药或刀口，可不调用工具skip，不补瓶。",
  "action.mechanical_guard.hint":
    "mechanical_guard：skill模式target_id为活人整数ID（含自己）或null空守；连夜同ID合法但盾失败、自己天亮判离。",
  "action.mechanical_attack.hint":
    "mechanical_attack：仅固定首个可刀夜kill模式，target_id活人整数或null弃刀；只穿普通Guard，不覆盖基础刀或女巫刀口。",
  "console.mechanical.awakened": "【机械狼】{actor}号于第{day}天接刀，固定首个可刀夜为{first}。",
  "console.mechanical.mode": "【机械狼】{actor}号第{day}夜选择{mode}。",
  "console.mechanical.mimic":
    "【机械狼】{actor}号第{day}夜学习{target}号的{role}，第{ready}夜生效。",
  "console.mechanical.mimic_skip": "【机械狼】{actor}号第{day}夜未学习。",
  "console.mechanical.skill_skip": "【机械狼】{actor}号第{day}夜未使用机械技能。",
  "console.mechanical.poison": "【机械毒】{actor}号第{day}夜对{target}号使用毒药。",
  "console.mechanical.guard":
    "【机械守护】{actor}号第{day}夜选择{target}，连续守护判离：{failed}。",
  "console.mechanical.attack": "【机械额外刀】{actor}号第{day}夜选择{target}。",
  "console.mechanical.reflection":
    "【机械反毒】第{day}夜，{actor}号保护{target}号，毒返回原施毒者{caster}号。",
  "console.mechanical.shot": "【机械狼开枪】{actor}号命中{target}号。",
  "role.mirror_girl.brief":
    "AWA默认：好人神职，每夜女巫后可查另一活人的具体角色；同实例整局不可重查已记录编号，可跳过关闭本夜而不花次数。",
  "role.mirror_girl.state":
    "你的角色是魔镜少女，好人神职，随好人获胜。原生魔镜查验在每夜女巫后600阶段，用inspect_role选择另一实际存活、未在本实例历史中查过的玩家，不能self/dead/null；等待刀毒结算但未实际标死者仍可行动或被查。同一能力实例跨整局不可重复稳定玩家ID，自己或目标复活、目标改身份/座位也不清历史。报告按本板明确role标签和伪装规则，只有你知道，不额外获得真实阵营、能力库存、狼队信息/夜聊/刀权；对象无通知，历史不因未来变化回写。可不调用工具跳过，或无目标时自动关闭本夜，uses不增加且旧报告不改；连续三次非法决策不是合法skip。查验不造成伤害或改身份。赠予/复制的魔镜实例有独立空历史，转移完整保留该实例的policy/记录/库存/闭夜；不同实例和玩家互不算重查。原ID/policy/来源/状态/生命撤换或迟到不消费新owner，gateway后重复历史仍须重验。取得另一个查验实例时按当前绑定policy行动，魔镜不能替石像鬼原生查后刀。",
  "stage.mirror_girl": "魔镜少女行动",
  "role.psychic.brief":
    "AWA默认：好人神职，女巫后可查另一存活玩家的具体规则角色，可跨夜重验；也可无工具跳过，关闭本夜机会但不耗次数。",
  "role.psychic.state":
    "你的底牌是【通灵师】，好人神职。你的原生通灵能力每夜女巫后可查其它实际存活玩家的具体规则角色，尊重明确伪装；可跨夜重复查同编号，不可自验或查死者。可以不调用工具跳过，关闭本实例本夜机会但uses不增；target_id:null不是合法目标。报告仅你可见，知道狼人身份不授予狼聊/刀权；旧报告不会被后来的伪装变化回写；获赠其它查验时，以本轮绑定实例规则为准。",
  "ability.role_check.psychic_rules":
    "本轮通灵查验能力：女巫后选另一存活玩家，可跨夜重复验同ID，不可self/dead/null目标。具体规则role尊重伪装，不改变你的真实身份/阵营。每实例每夜一次，可不调用工具跳过（关闭本夜，不增加uses）；报告仅你，目标无通知。非法/撤权无报告或消费新实例；转移保完整policy/history/资源及本夜关闭。",
  "stage.psychic": "通灵师行动",
  "role.gargoyle.brief":
    "AWA默认：独立狼，无相认/狼聊/自爆。每夜先查其它存活玩家具体角色，同实例不能self/重复；唯一活Wolf接刀后须结束本夜查验再刀，可自刀。",
  "role.gargoyle.state":
    "你的底牌是【石像鬼】，狼阵营但不与狼队相认、夜聊或共享刀口，不能原生自爆。你的原生石像鬼查验每夜上半夜先查其它存活未验玩家的具体规则角色（含伪装），原生同实例不能自验/重验。有效目标存在时须完成，无未验目标则流程自然结束不假消费。真正成为唯一活Wolf时接刀，仍须本夜原生查验流程结束且资格有效才可Night刀人/弃票/自刀；Day不立即出刀。预言家查你为Wolf，知道某狼身份不授予狼聊历史。",
  "role.gargoyle.status": "本人曾接刀：{inherited}；本夜查后刀资格：{active}。",
  "console.gargoyle.awakened": "{actor}号石像鬼在第{day}天获得刀权",
  "replay.stage.gargoyle_awakened": "石像鬼接刀",
  "role.hidden_wolf.brief":
    "狼阵营，单向知道其它狼ID，不夜聊、不自爆；实际成为唯一活狼时接刀。阵营查验遵循本局策略，具体角色查验和熊感知遵循接刀状态；骑士按真实阵营。",
  "role.hidden_wolf.state":
    "你的底牌是【隐狼】，狼阵营。你单向知道其它狼的授权ID，普通狼队不知道你；始终不参与或读取普通狼夜聊，不能原生自爆。开局唯一狼或真实死亡后成为唯一活狼时获得基础刀权，白天获得不立即出刀。未接刀查验好人/平民且不触发熊，曾接刀后查验狼/隐狼并可被熊感知，死后不恢复伪装；骑士看真实阵营。当前实际出刀还要求你存活、资格有效且唯一活狼。",
  "role.hidden_wolf.state_good_v1":
    "你的底牌是【隐狼】，狼阵营。单向知道其它狼的授权ID，狼队不知道你；无普通狼夜聊和原生自爆。开局或真实死亡后唯一活狼才接基础刀，白天接刀不立即攻击。阵营查验策略 netease_2020_good_v1：预言家式阵营查验始终显示好人，包括接刀后和死亡后。具体角色查验仍按AWA：接刀前平民、接刀后隐狼；熊感知仍跟随接刀。这些独立规则不是完整网易预设。骑士及胜负按真实阵营；当前出刀还要求本人存活、资格有效且唯一活狼。",
  "role.hidden_wolf.camp_good_v1":
    "隐狼阵营查验策略 netease_2020_good_v1：接刀前后始终为好人；具体角色查验和熊感知保留AWA接刀规则。",
  "role.hidden_wolf.camp_inheritance_v1":
    "隐狼阵营查验策略 awa_inheritance_v1：接刀前为好人，接刀后为狼人。",
  "role.hidden_wolf.status": "本人曾获得刀权：{inherited}；当前可出刀：{active}。",
  "console.hidden_wolf.awakened": "{actor}号隐狼在第{day}天获得刀权",
  "replay.stage.hidden_wolf_awakened": "隐狼接刀",
  "role.cursed_fox.brief":
    "第三方独立目标；免普通狼刀，预言家或幸运儿查验导致出局，任一普通阵营全灭时存活则独胜",
  "role.cursed_fox.state":
    "你的底牌是【咒狐】。你属于第三方，独立获胜：好人或狼人全灭时，你仍存活则只有你获胜。你免疫普通狼刀，但不免毒、枪、放逐或牵连。预言家及幸运儿查验使你出局，魔镜身份查验不会；当夜摄梦可保护查验死亡。你没有原生主动夜间技能，可获得奇迹商人赠技。",
  "victory.goal.netease_cursed_fox_last_faction_v1": "普通阵营全灭时存活",
  "replay.stage.awakened_attack_chosen": "觉醒隐狼额外刀选择",
  "replay.stage.awakened_guard_chosen": "觉醒隐狼守护选择",
  "replay.stage.awakened_mimic_skipped": "觉醒隐狼放弃模仿",
  "replay.stage.awakened_mimicked": "觉醒隐狼模仿结果",
  "replay.stage.awakened_poison_used": "觉醒隐狼用毒",
  "replay.stage.awakened_skill_skipped": "觉醒隐狼放弃技能",
  "replay.stage.mechanical_attack_chosen": "机械狼额外刀选择",
  "replay.stage.mechanical_awakened": "机械狼接刀",
  "replay.stage.mechanical_guard_chosen": "机械狼守护选择",
  "replay.stage.mechanical_mimic_skipped": "机械狼放弃学习",
  "replay.stage.mechanical_mimicked": "机械狼学习结果",
  "replay.stage.mechanical_mode_selected": "机械狼模式选择",
  "replay.stage.mechanical_poison_reflected": "机械盾毒药反射",
  "replay.stage.mechanical_poison_used": "机械狼用毒",
  "replay.stage.mechanical_shot": "机械狼开枪",
  "replay.stage.mechanical_skill_skipped": "机械狼放弃技能",
} as const satisfies Record<keyof typeof definition.parameters, string>;

export const en = {
  "role.gargoyle.configured_identity":
    "You are Gargoyle, a true Wolf acting independently in early role inspection. No pack recognition, chat or native self-destruct. When all other true Wolves are dead, knife access requires completion of your native inspection opportunity that night. Use the configured inspection policy below.",
  "role.psychic.configured_identity":
    "You are Spirit Seer, a true Good god. Your concrete role inspection acts in the late inspection stage; reports respect declared role disguises. No native knife, death gun or protection. Use the configured inspection policy below.",
  "role.mirror_girl.configured_identity":
    "You are Mirror Girl, a true Good god. Your native concrete role inspection acts in the late Mirror stage and preserves its instance history across lives; reports respect declared role disguises. It grants no pack access or knife. Use the configured inspection policy below.",
  "reason.cursed_fox_survived_faction_elimination":
    "Cursed Fox survives an ordinary faction elimination and wins alone",
  "replay.stage.hybrid_exemplar_chosen": "Exemplar choice",
  "replay.stage.hybrid_affiliation_resolved": "Victory affiliation",
  "role.hybrid.brief":
    "Choose an exemplar on night one; victory follows their true faction without revealing it. You always remain a true Good villager and camp inspections show Good.",
  "role.hybrid.state":
    "Your true role is Hybrid, your true faction is Good, and you always count on the villager side. In stage 110 on night one you must use choose_exemplar once to choose another actually living player. No self, dead target or null; no passing or later-night choice. After legal commitment you cannot change it: your victory follows the exemplar's true faction at that moment, but you do not learn their faction or role and must infer it from public evidence. Your death, the exemplar's death or revival, and later role changes never rewrite your frozen affiliation; you can win with that faction while dead. No winner means no personal win. Camp inspections always show Good and role inspections show Hybrid. You gain no wolf recognition, teammates, chat, knife, self-destruct or exemplar abilities; the target is not notified. When all true wolves die this board awards Good victory, even if you support wolves; wolves still need to eliminate you to slaughter the villager side. Before choosing you have no default victory affiliation. Invalid, late or revoked decisions never commit a new owner's state. Keep only your own choice; never present an inference as an engine-confirmed faction.",
  "role.hybrid.status":
    "Your own exemplar choice and remaining opportunity: {state}. Their true faction and role are unknown.",
  "action.choose_exemplar.hint":
    "choose_exemplar: mandatory once on night one. Integer target_id must be another actually living player; no self/dead/null, skip or reselect. Confirms only your choice, not faction or role.",
  "stage.hybrid": "Hybrid exemplar selection",
  "error.hybrid_unavailable":
    "Hybrid selection requires authorization on night one, an unused choice and the original empty victory affiliation.",
  "error.hybrid_target": "Choose another actually living player; no self, null or invented ID.",
  "console.hybrid.choice":
    "Hybrid private choice: player {actor} chose player {target} on night {day}; faction and role remain unknown.",
  "console.hybrid.affiliation":
    "God victory affiliation: player {actor} chose player {target} on night {day}; frozen affiliation: {faction}.",
  "role.mechanical_wolf.brief":
    "Independent wolf: learn once, effective next night; choose kill or skill each night, inherit the knife as the sole living wolf.",
  "role.mechanical_wolf.state":
    "Your true role is Mechanical Wolf and your faction remains Werewolves. You have no pack recognition, chat or self-destruct. On night one, learning is your only native mechanical action; you may learn once on any night. At stage 580 after Witch and before Spirit Seer, once in any night, mimic_role learns another living player's true role, immediately records that identity and creates independent resources; all native mechanical skills, including the gun, start next night. True identity/faction never changes. After learning, role inspections show the learned role, but camp inspections still show wolf. From night two, mechanical_mode selects kill or skill; passing defaults to skill and you cannot switch that night. Learning is a separate opportunity in either mode. In kill mode, kill_vote requires being the sole living true wolf and reaching the fixed first knife night. Skill mode acts at stage 650: Spirit Seer gives repeat mechanical_inspect on another living player; Witch gives one mechanical_poison, no antidote or knife information; Guard gives mechanical_guard on self/another living player or null. Its shield blocks knives and reflects each original toxin once to its original caster. Reflection bypasses that caster's mechanical shield and never recurses; Dream still blocks reflected poison. Simultaneous ordinary Guard and Heal cancel both ordinary protections for base and extra knives; the mechanical shield remains independent. Guarding the same ID on consecutive actual nights fails and kills you at dawn. Skip, kill or null breaks that chain. Hunter gives a passive one-shot gun next night independent of mode: knives/exile/shots/White Wolf blast allow it; poison/dream/charm/duel/self-penalty or any forbidden compound cause blocks it. Wolf gives one mechanical_attack (or null) only in kill mode on the fixed first knife night: it pierces ordinary Guard only; Heal/Dream/mechanical shields block it. Missing that night, learning late or choosing skill expires it. Villager gives no skill. A successful death shot publicly reveals the mechanical gun type, Mechanical Wolf identity and actual target, but not the learning target ID or other resources. Legal choices/passes close that night; invalid/revoked decisions cannot spend a new owner's inventory. Consumption and records already committed are preserved, while stale scopes produce no new effect. Reports are yours alone; never share private causal sources with the pack. External ordinary G02 abilities follow this turn's bound instance rules independently; native mechanical modes do not restrict them.",
  "role.mechanical_wolf.status":
    "Learned role: {learned}; effective night: {ready}; inherited knife: {inherited}; fixed first knife night: {first}; current mode: {mode}; independent resources: {resources}.",
  "mechanical.mode.kill": "Kill",
  "role.awakened_hidden_wolf.brief":
    "Independent wolf: mimic once, activate at actual night end, inherit the knife as sole living wolf; copied resources are independent.",
  "role.awakened_hidden_wolf.state":
    "Your true role is Awakened Hidden Wolf; faction and victory remain Werewolves. No mutual pack recognition, chat, collective knife or self-destruct. Once in any night, awakened_mimic at stage 580 after Witch and before Mirror Girl chooses another living player: immediately learn their true role and mask your role-inspection label, without changing true identity/faction/victory. Tool-free wait preserves the opportunity. Only actual night-end stage 900 activates learning: Hunter gun is armed then; active skills start the following actual night. Interruption preserves learning but requires later actual activation. Villager gives no skill. Mirror Girl gives an independent mirror-policy inspect_role instance with empty history, no repeated target for its lifetime, optional, bound by ability_id. Witch gives one awakened_poison, no antidote or knife information. Guard gives awakened_guard on self/another living ID or null: blocks knives/poison, no reflection; the same nonempty stable ID on adjacent actual nights is rejected without closing the turn, null or tool-free wait breaks the chain. Hunter gives one passive gun; ordinary knives/exile/shots allow it, poison/dream/charm/duel/self-penalty or any forbidden compound blocks it. Native and copied successful Hunter guns share neutral player_shot. Actual assembly/death resolution records inheritance only as the sole living true Wolf, with a fixed first knife night no earlier than Night2. Base kill_vote and activated skills are independent. Wolf gives one awakened_attack after activation and while you currently hold the knife: only a living nonempty ID spends it, null/wait preserves it for later nights. Normal protection blocks it, no Guard piercing or replacement of Witch base knife information. No mechanical mode, reflection, guard self-penalty or first-knife-night expiry. No resource refill or target inventory/history/personality copy. Reports are yours alone; paid prefixes survive, while late/replaced owners cannot spend a new body's resources.",
  "role.awakened_hidden_wolf.status":
    "Learned role: {learned}; actual activation night: {activation}; active skills from night: {ready}; inherited knife: {inherited}; fixed first knife night: {first}; independent resources: {resources}.",
  "stage.awakened_mimic": "Awakened Hidden Wolf learning",
  "stage.awakened_skill": "Awakened Hidden Wolf skill",
  "stage.awakened_attack": "Awakened Hidden Wolf extra knife",
  "stage.awakened_activation": "Awakened Hidden Wolf night-end activation",
  "stage.awakened_inherited": "Awakened Hidden Wolf knife inheritance",
  "error.awakened_unavailable":
    "This awakened action is not authorized, is closed, or has no resource this night.",
  "error.awakened_target":
    "Choose an actually living integer target permitted by this action; learning cannot target yourself.",
  "error.awakened_guard_repeat":
    "You cannot guard the same nonempty player ID on adjacent nights; choose another target or null.",
  "action.awakened_mimic.hint":
    "awakened_mimic: another living integer target_id, never self/dead/null; once in any night, tool-free wait preserves it. Immediate identity, actual night-end activation: Hunter gun then, active skills next night.",
  "action.awakened_poison.hint":
    "awakened_poison: one poison, living integer target_id including self, no antidote/knife information; tool-free wait spends nothing, never refilled.",
  "action.awakened_guard.hint":
    "awakened_guard: living integer target_id including self, or null. Block knives/poison without reflection; adjacent actual nights on the same nonempty ID are invalid, null/tool-free wait breaks the chain.",
  "action.awakened_attack.hint":
    "awakened_attack: one normal extra knife while holding the inherited knife; living integer target_id spends it, null/tool-free wait saves it for later. Guard/Heal/Dream/independent shields block it; base knife information stays separate.",
  "mechanical.mode.skill": "Skill",
  "stage.mechanical_mode": "Mechanical Wolf mode choice",
  "stage.mechanical_mimic": "Mechanical Wolf learning",
  "stage.mechanical_skill": "Mechanical Wolf skill",
  "stage.mechanical_attack": "Mechanical Wolf extra knife",
  "error.mechanical_unavailable":
    "This mechanical action is not authorized, is closed, or has no resource this night.",
  "error.mechanical_target":
    "Choose an actually living target allowed by this tool; learning and inspection cannot target yourself.",
  "action.mimic_role.hint":
    "mimic_role: target_id is another living integer player ID, never self/dead/null. You may pass without a tool and learn later. Once per game; all skills start next night.",
  "action.mechanical_mode.hint":
    "mechanical_mode: mode is kill or skill, once each night from night two. Passing defaults to skill. Active skills and knives are exclusive; learning and an armed passive gun are independent.",
  "action.mechanical_inspect.hint":
    "mechanical_inspect: in skill mode choose another living integer target_id; repeat IDs across nights are allowed. You may pass without a tool; only you receive the report.",
  "action.mechanical_poison.hint":
    "mechanical_poison: one poison in skill mode; integer target_id may be self or another living player. No antidote or knife information. You may pass without a tool; never refilled.",
  "action.mechanical_guard.hint":
    "mechanical_guard: in skill mode target_id is a living integer ID including self, or null for empty guard. Consecutive nights on the same ID are legal but the shield fails and you die at dawn.",
  "action.mechanical_attack.hint":
    "mechanical_attack: only in kill mode on the fixed first knife night; target_id is a living integer ID or null to pass. Pierce ordinary Guard only; never replace the base knife or Witch knife information.",
  "console.mechanical.awakened":
    "Mechanical Wolf player {actor} inherited on day {day}; fixed first knife night: {first}.",
  "console.mechanical.mode": "Mechanical Wolf player {actor} chose {mode} on night {day}.",
  "console.mechanical.mimic":
    "Mechanical Wolf player {actor} learned player {target}'s {role} on night {day}, effective night {ready}.",
  "console.mechanical.mimic_skip": "Mechanical Wolf player {actor} passed learning on night {day}.",
  "console.mechanical.skill_skip":
    "Mechanical Wolf player {actor} passed the mechanical skill on night {day}.",
  "console.mechanical.poison":
    "Mechanical poison: player {actor} poisoned player {target} on night {day}.",
  "console.mechanical.guard":
    "Mechanical guard: player {actor} chose {target} on night {day}; consecutive-guard penalty: {failed}.",
  "console.mechanical.attack":
    "Mechanical extra knife: player {actor} chose {target} on night {day}.",
  "console.mechanical.reflection":
    "Mechanical reflection: on night {day}, player {actor} shielded player {target}; poison returned to original caster {caster}.",
  "console.mechanical.shot": "Mechanical Wolf shot: player {actor} hit player {target}.",
  "role.mirror_girl.brief":
    "AWA default: Good god. After Witch, optionally inspect another living player's specific role. Never repeat an ID in this instance's whole-game history; passing closes the night without spending a use.",
  "role.mirror_girl.state":
    "Your role is Mirror Girl, a Good god helping Good win. Your native Mirror inspection acts at stage 600 after Witch each night: inspect_role chooses another actually living player absent from this instance's history. No self/dead/null targets; pending knife or poison deaths have not yet removed their actions. Never repeat a stable player ID for this instance across the game, even after your or the target's revival, role changes or seat changes. Only you receive the rule-defined role label, respecting explicit disguises. No extra true faction, inventories, wolf knowledge/chat/knife; the target is not notified and future changes do not rewrite old reports. You may pass without a tool; no targets also closes this night, without spending uses or changing previous reports. Three invalid decisions are not a legal pass. Inspection causes no damage or identity change. New Mirror gifts/copies have independent empty histories; transfers preserve complete policy/history/resources and the closed night. Other instances and players do not count as your repeat. A stale or revoked original ID/policy/source/state/life cannot spend a new owner's resource; unique history is rechecked after gateway. Follow this turn's bound policy for other granted inspections; Mirror never substitutes for native Gargoyle inspection-to-knife authority.",
  "stage.mirror_girl": "Mirror Girl action",
  "role.psychic.brief":
    "AWA default: Good god. After Witch, optionally inspect another living player's rule-defined role, including repeat IDs across nights; passing closes this night without spending a use.",
  "role.psychic.state":
    "Your role is Spirit Seer, a Good god. Your native Spirit Seer ability acts after Witch each night: inspect another actually living player's rule-defined role, respecting explicit disguises. Repeat IDs across nights are allowed; no self or dead targets. You may pass without calling a tool, closing this instance for the night without increasing uses; target_id:null is not a valid target. Only you receive the report. Learning a wolf role grants no pack chat or knife rights; later disguises never rewrite previous reports. For a granted inspection, follow this turn's bound instance rules.",
  "ability.role_check.psychic_rules":
    "Spirit Seer inspection ability for this turn: after Witch, choose another living player; repeat IDs across nights are allowed, but no self/dead/null targets. Respect rule-defined role disguises; your real identity/faction does not change. Once per instance per night; passing without a tool closes this night without increasing uses. Only you receive the report; the target is not notified. Invalid/revoked actions create no report or consumption on a new instance. Transfers preserve full policy/history/resources and the closed night.",
  "stage.psychic": "Spirit Seer action",
  "role.gargoyle.brief":
    "AWA default: Independent wolf without mutual recognition, pack chat or self-destruction. Inspect another living player's rule-defined role first each night; no self or repeated ID per instance. As the sole living wolf, finish native inspection before inherited knife, including self-knife.",
  "role.gargoyle.state":
    "Your role is Gargoyle, aligned with wolves but without pack recognition, chat or shared knife targets; no native self-destruction. Your native Gargoyle ability first inspects another living uninspected player each night for their rule-defined role, including disguises. Your native instance forbids self/repeat. Complete inspection when eligible targets exist; with none, finish the phase without invented consumption. Inherit the knife when actually the sole living wolf; finish this night's native inspection with valid eligibility before a Night knife, pass or self-knife. No immediate daytime attack. Seer sees you as Wolf; learning a wolf role does not grant pack history.",
  "role.gargoyle.status":
    "Personally inherited the knife: {inherited}; knife eligibility after this night's inspection: {active}.",
  "console.gargoyle.awakened": "Gargoyle {actor} inherits the knife on day {day}",
  "replay.stage.gargoyle_awakened": "Gargoyle inheritance",
  "role.hidden_wolf.brief":
    "Wolf faction; knows other wolf IDs one way, without pack chat or self-destruction. Inherits the knife when actually the sole living wolf. Camp inspection follows the configured policy; role labels and Bear follow inheritance. Knight uses true faction.",
  "role.hidden_wolf.state":
    "Your role is Hidden Wolf, aligned with wolves. You know authorized IDs of other wolves one way; the ordinary pack does not know you. Never join or read ordinary pack chat, and cannot natively self-destruct. Inherit the basic knife at opening if the sole wolf, or after actual deaths leave you the sole living wolf; daytime inheritance gives no immediate attack. Before inheritance inspection shows Good/Villager and Bear does not sense you; once inherited inspection shows Wolf/Hidden Wolf and Bear can sense you, without restoring disguise on death. Knight uses true faction. A current knife action also requires you alive, eligible and the sole living wolf.",
  "role.hidden_wolf.state_good_v1":
    "Your role is Hidden Wolf, aligned with wolves. You know authorized IDs of other wolves one way; the pack does not know you. No ordinary pack chat or native self-destruct. Inherit the basic knife only as the sole living wolf at opening or after actual deaths; daytime inheritance grants no immediate attack. Camp-inspection policy netease_2020_good_v1: Seer-style camp inspections always report Good, including after inheritance and death. AWA role inspection remains Villager before inheritance and Hidden Wolf afterward; Bear detection follows inheritance. These latter rules are independent and are not a complete NetEase preset. Knight and victory use true faction. A current knife action also requires you alive, eligible and the sole living wolf.",
  "role.hidden_wolf.camp_good_v1":
    "Hidden Wolf camp-inspection policy netease_2020_good_v1: always Good, including after knife inheritance. Role inspection and Bear retain AWA inheritance behavior.",
  "role.hidden_wolf.camp_inheritance_v1":
    "Hidden Wolf camp-inspection policy awa_inheritance_v1: Good before knife inheritance and Wolf afterward.",
  "role.hidden_wolf.status":
    "Personally inherited the knife: {inherited}; currently able to attack: {active}.",
  "console.hidden_wolf.awakened": "Hidden Wolf {actor} inherits the knife on day {day}",
  "replay.stage.hidden_wolf_awakened": "Hidden Wolf inheritance",
  "role.cursed_fox.brief":
    "Independent third-party goal; immune to the ordinary wolf knife, eliminated by Seer or Lucky inspection, and wins alone if alive when either ordinary faction is eliminated",
  "role.cursed_fox.state":
    "Your role is Cursed Fox. You belong to a third party with an independent goal: if either Good or Wolf is entirely eliminated and you remain alive, only you win. You resist the ordinary wolf knife, but not poison, shots, exile or linked deaths. Seer and Lucky camp inspection eliminate you; Mirror role inspection does not. Dream protection can prevent inspection death that night. You have no native active night ability and can receive a Miracle Merchant gift.",
  "victory.goal.netease_cursed_fox_last_faction_v1": "Survive an ordinary faction elimination",
  "replay.stage.awakened_attack_chosen": "Awakened wolf extra attack choice",
  "replay.stage.awakened_guard_chosen": "Awakened wolf guard choice",
  "replay.stage.awakened_mimic_skipped": "Awakened wolf skips learning",
  "replay.stage.awakened_mimicked": "Awakened wolf learning result",
  "replay.stage.awakened_poison_used": "Awakened wolf poison",
  "replay.stage.awakened_skill_skipped": "Awakened wolf skips a skill",
  "replay.stage.mechanical_attack_chosen": "Mechanical wolf extra attack choice",
  "replay.stage.mechanical_awakened": "Mechanical wolf inherits the knife",
  "replay.stage.mechanical_guard_chosen": "Mechanical wolf guard choice",
  "replay.stage.mechanical_mimic_skipped": "Mechanical wolf skips learning",
  "replay.stage.mechanical_mimicked": "Mechanical wolf learning result",
  "replay.stage.mechanical_mode_selected": "Mechanical wolf mode choice",
  "replay.stage.mechanical_poison_reflected": "Mechanical shield poison reflection",
  "replay.stage.mechanical_poison_used": "Mechanical wolf poison",
  "replay.stage.mechanical_shot": "Mechanical wolf shot",
  "replay.stage.mechanical_skill_skipped": "Mechanical wolf skips a skill",
} satisfies Record<keyof typeof definition.parameters, string>;

// 三份原数据一起交 catalog；satisfies 只作编译期 key 对齐，最终公开字典的冻结由 catalog 负责。
export const messages = { definition, zhCN, en };
