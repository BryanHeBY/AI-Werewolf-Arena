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
    "你是魔镜少女，好人神职。每夜后半段查验具体角色，查验记录在复活后仍保留，结果遵循本局的身份伪装规则；知道狼的身份也不获得狼聊或刀权。查验目标与行动按下述本局规则。",
  "reason.cursed_fox_survived_faction_elimination": "普通阵营全灭时咒狐存活独胜",
  "replay.stage.hybrid_exemplar_chosen": "榜样选择",
  "replay.stage.hybrid_affiliation_resolved": "胜利归属",
  "role.hybrid.brief":
    "首夜选择榜样，随其当时真实阵营获胜但不知道该阵营；自身始终计入好人民边，阵营查验始终验好。",
  "role.hybrid.state":
    "你的底牌是混血儿，真实阵营是好人，始终计入民边。首夜前段必须选择另一名存活玩家作为榜样；不能自选、选死者或空过，也不能留到后夜补选。选择成功后不可更改，你随榜样在选择当时的真实阵营获胜；上帝只告知你选了谁，不告知对方身份或阵营。你或榜样死亡、复活，以及榜样日后身份变化，都不改变这次胜利归属；你出局后仍可随该方获胜，本局无胜者则你也不获胜。阵营查验始终验你好人，角色查验为混血儿。你不因此知道狼队友，也不获得狼队互认、狼聊、刀权、自爆或榜样技能，榜样不会收到被选通知。真实狼人全部出局时按本板好人胜利处理，即使你支持狼也不能延长对局；狼队屠民仍须清除你。选择之前没有默认支持方，无效或过期行动不算完成选择。对于榜样阵营的猜测只是你的判断，不是上帝告知的结果。",
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
    "你的底牌是机械狼，属于狼人阵营，不与其他狼互认或夜聊，也不能自爆。整局可在任意一夜学习一次另一名存活玩家的真实角色，学习在女巫之后、通灵查验之前进行；立即得知对方身份并获得自己独立的一份技能次数，不继承对方已经消耗的资源。学到的机械技能包括枪都从次夜生效，不改变你的真实角色或阵营；此后具体角色查验显示学到的角色，阵营查验仍为狼。首夜只能学习；第二夜起每夜选择击杀或技能模式，不选默认技能，当夜不能切换，学习机会独立于模式。击杀模式下，只有成为唯一存活真狼且到达规定的首次刀夜，才有普通刀权。技能模式在学习阶段之后使用已学能力：学通灵可查另一活人的具体角色，跨夜可以重复；学女巫有一瓶毒，没有解药或刀口信息；学守卫可守自己、另一活人或空守，机械盾挡刀，并把每条原始毒各反给原施毒者一次。反毒无视施毒者的机械盾，不会再次反射，梦境保护仍能挡反毒。同一目标被普通守卫保护又被女巫救时，两份普通保护对基础刀和额外刀均抵消，机械盾独立保留。连续两夜机械守护同一编号，保护失败且你在天亮出局；跳过、击杀模式或空守会打断连续。学猎人次夜获得一枪，属于被动能力，不受模式限制：刀、放逐、枪击、白狼王自爆带走可开枪；毒、梦、魅惑、决斗、能力自罚不可开枪，多种死因包含任一禁枪原因也不能开枪。学普通狼额外获得一次穿普通守卫的刀，只能在固定首次刀夜且选择击杀模式时使用，可空刀；解药、梦境和机械盾仍能挡。错过该夜、来不及学到或当夜选技能模式，都不能以后补用。学平民没有技能。成功开枪会向全场公布机械枪、你的机械狼身份和实际目标，不公布学习对象或其他剩余次数。合法行动或等待结束当夜对应机会；无效或过期行动不生效，已经消耗的次数不会退回。技能反馈由上帝私下告知你，不会自动共享给狼队。另行获赠的普通能力按该能力的本轮说明独立行动，不受机械模式限制。",
  "role.mechanical_wolf.status":
    "已学角色：{learned}；生效夜：{ready}；曾接刀：{inherited}；固定首次刀夜：{first}；本夜模式：{mode}；独立库存：{resources}。",
  "mechanical.mode.kill": "击杀",
  "role.awakened_hidden_wolf.brief":
    "独立狼：一局一次模仿，实际夜末激活，唯一活狼后接刀，复制资源独立。",
  "role.awakened_hidden_wolf.state":
    "你的底牌是觉醒隐狼，阵营与胜利归属始终为狼人。不与普通狼互认，不参与普通狼夜聊或集体刀，也不能自爆。整局可在任意一夜、女巫之后魔镜少女之前模仿另一名存活玩家一次；立即知道对方真实角色，并让具体角色查验显示学到的角色，不改变你的真实身份、阵营或胜利归属。不行动可保留学习机会。学习在夜晚真正结束时激活：猎人枪在该时刻可用，主动技能从激活后的下一夜开始；若夜晚中断，保留学习，等待后续实际激活。学平民无技能；学魔镜少女获得一份单独记录的新查验能力，整局不可重复查同一玩家，可以跳过；学女巫获得一瓶毒，没有解药或刀口信息；学守卫可守自己、另一活人或空守，挡刀和毒但不反毒，相邻两夜不可守同一非空编号，选错可修正，不直接关闭回合，空守或不行动会打断连续。学猎人获得自己的一枪，普通刀、放逐、枪击致死可开枪；毒、梦、魅惑、决斗、能力自罚不可开枪，多种死因含任一禁枪原因也不能开枪。成功枪击的公开公告与普通猎人相同，不额外暴露学习来源。开局或真实死亡结算后成为唯一存活真狼才获得普通刀权，首次可刀夜不早于第二夜；普通刀和已激活的主动技能可以独立使用。学普通狼有一次额外刀，须在激活次夜起且当前有刀权时使用；选择活人目标才耗机会，空刀或不行动可留到后夜。普通保护均可挡它，不穿守卫，也不替代女巫看到的基础刀口。你没有机械狼的模式切换、反毒、连守自罚或首次刀夜过期规则。学习不补回已消耗次数，也不继承对方已有次数、历史或人格；自己的反馈只由上帝私下告知，不会自动共享。已经消耗的次数不会因迟到或身份变化退回，无效或过期行动不生效。",
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
    "AWA默认：好人神职，每夜女巫后可查另一活人的具体角色；每份查验能力各自记录，整局不可重查已记编号，可跳过当夜而不花次数。",
  "role.mirror_girl.state":
    "你是魔镜少女，好人神职，随好人获胜。每夜女巫之后可查另一名存活、尚未被这份魔镜能力查过的玩家；不能自验、查死者或提交空目标。夜间刀毒尚未正式结算出局的玩家仍可行动或被查。整局不能用同一份能力重复查同一编号；你或对方复活、对方改变身份或座位，都不清除记录。只得到本局角色查验规则允许的身份结果，遵循伪装规则，不额外得知真实阵营、技能剩余次数或狼队信息；上帝只私下告知你，对方不收到通知，日后变化也不改写旧报告。查到狼不赋予狼聊或刀权，查验本身不造成伤害或改变身份。可不行动跳过当夜，没有合法目标时也直接结束本夜查验，不消耗次数、不修改旧报告；三次非法提交仍按失败处理，不能当作合法跳过。另行获赠或复制的魔镜能力从空记录开始，几份能力分别记查验历史；能力被转移时原规则、历史、剩余次数和当夜是否已行动一并保留。无效或过期行动不生效。获得其他查验能力时按那份能力的本轮说明行动，魔镜查验不能代替石像鬼取得刀权所需的自身查验。",
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
    "You are Mirror Girl, a Good special role. Inspect specific roles late at night; your inspection history survives revival and results respect this board's role disguises. Knowing a wolf's role grants no pack chat or knife. Follow the inspection rules below.",
  "reason.cursed_fox_survived_faction_elimination":
    "Cursed Fox survives an ordinary faction elimination and wins alone",
  "replay.stage.hybrid_exemplar_chosen": "Exemplar choice",
  "replay.stage.hybrid_affiliation_resolved": "Victory affiliation",
  "role.hybrid.brief":
    "Choose an exemplar on night one; victory follows their true faction without revealing it. You always remain a true Good villager and camp inspections show Good.",
  "role.hybrid.state":
    "Your role is Hybrid. Your true alignment is Good and you always count on the villager side. Early on night one you must choose another living player as your exemplar; no self, dead target, pass or later-night selection. A successful choice cannot be changed: you win with the exemplar's true alignment at the time of selection. The moderator tells you only whom you selected, not their role or alignment. Your death or revival, theirs, and later role changes never alter that victory affiliation. You can win while dead; no game winner means no personal win. Alignment checks always show you as Good and role checks show Hybrid. You gain no wolf recognition, teammate identities, chat, knife, self-destruction or exemplar abilities, and your exemplar is not notified. When all true wolves die this board awards Good victory, even if you support wolves; wolves still need to eliminate you to slaughter the villager side. Before selection you have no default affiliation. Invalid or late actions do not count as a selection. A read on the exemplar's alignment remains your inference, not a moderator result.",
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
    "Your role is Mechanical Wolf and your alignment is Werewolves. You have no mutual pack recognition, pack chat or self-destruction. Once per game, on any night after Witch and before Spirit Seer, you may learn another living player's true role. You learn that role immediately and gain your own independent ability uses, rather than inheriting their remaining stock. All learned mechanical abilities, including the gun, begin next night. Your true role and alignment do not change; subsequent role checks show the learned role, while alignment checks still show wolf. On night one you can only learn. From night two, choose kill or skill mode each night; no choice defaults to skill and the mode cannot change that night. Learning remains a separate opportunity. In kill mode, the ordinary knife requires being the sole living true wolf and reaching your fixed first knife night. In skill mode, use learned abilities after the learning stage: Spirit Seer lets you inspect another living player's role, with repeats across nights; Witch gives one poison, no antidote or knife information; Guard lets you protect yourself, another living player, or nobody. The mechanical shield blocks knives and reflects each original toxin once to its original caster. Reflected poison bypasses that caster's mechanical shield, cannot reflect again, and is still blocked by Dream protection. Ordinary Guard and Witch healing on the same target cancel both ordinary protections against base and extra knives; the mechanical shield remains independent. Guarding the same ID on consecutive nights fails and eliminates you at dawn; passing, kill mode or empty protection breaks that sequence. Hunter gives one passive gun from next night regardless of mode: knives, exile, shots and White Wolf King blast allow it; poison, Dream, charm, duel or ability self-penalty forbid it, as does any compound death containing a forbidden cause. Learning an ordinary Wolf gives one extra knife, available only in kill mode on the fixed first knife night; you may pass. It pierces ordinary Guard but is blocked by antidote, Dream or mechanical shields. Missing that night, learning too late or choosing skill mode expires it permanently. Villager gives no skill. A successful shot publicly reveals the mechanical gun, your Mechanical Wolf role and the actual target, not the learning target or other remaining uses. A legal action or pass closes the corresponding nightly opportunity. Invalid or late actions have no effect, and uses already spent are not refunded. The moderator gives ability feedback privately to you; it is not automatically shared with the pack. Separately granted ordinary abilities follow their own turn rules and are not restricted by mechanical mode.",
  "role.mechanical_wolf.status":
    "Learned role: {learned}; effective night: {ready}; inherited knife: {inherited}; fixed first knife night: {first}; current mode: {mode}; independent resources: {resources}.",
  "mechanical.mode.kill": "Kill",
  "role.awakened_hidden_wolf.brief":
    "Independent wolf: mimic once, activate at actual night end, inherit the knife as sole living wolf; copied resources are independent.",
  "role.awakened_hidden_wolf.state":
    "Your role is Awakened Hidden Wolf; alignment and victory affiliation remain Werewolves. You have no mutual recognition with the ordinary pack, pack chat, collective knife or self-destruction. Once per game, on any night after Witch and before Mirror Girl, you may mimic another living player. You immediately learn their true role and make role inspections show the learned role without changing your true role, alignment or victory affiliation. Passing preserves the learning opportunity. Learning activates when the night actually ends: a Hunter gun becomes available then, while active abilities start the following night. An interrupted night preserves the learning until actual activation. Villager gives no skill. Mirror Girl gives a separate new inspection ability with its own empty history; never repeat a player with that ability, and passing is allowed. Witch gives one poison, no antidote or knife information. Guard lets you protect yourself, another living player, or nobody against knives and poison, without reflection. The same nonempty ID on adjacent nights is invalid but can be corrected without closing the turn; empty protection or no action breaks the sequence. Hunter gives your own one-shot gun: ordinary knives, exile and shots allow it; poison, Dream, charm, duel or ability self-penalty forbid it, as does any compound death with a forbidden cause. A successful shot uses the same public announcement as an ordinary Hunter and does not additionally reveal the learning source. You inherit the ordinary knife only as the sole living true wolf at setup or after actual death resolution; the first knife night cannot precede night two. The ordinary knife and activated active skills are independent. Learning an ordinary Wolf gives one extra knife, usable from the night after activation while you currently hold knife rights. Choosing a living target spends it; an empty knife or no action preserves it for later nights. Ordinary protection blocks it, it does not pierce Guard, and it does not replace the base knife information shown to Witch. There is no Mechanical Wolf mode, reflection, repeated-guard self-penalty or first-knife-night expiry. Learning never refills spent uses or copies the target's remaining uses, history or personality. Feedback is private to you and not automatically shared. Spent uses are not refunded by late responses or identity changes, and invalid or late actions have no effect.",
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
    "AWA default: a Good special role. After Witch, optionally inspect another living player's specific role. Each copy of the ability keeps its own whole-game record and cannot repeat an ID; passing closes that night without spending a use.",
  "role.mirror_girl.state":
    "You are Mirror Girl, a Good special role winning with Good. Each night after Witch, you may inspect another living player not previously checked with this copy of your Mirror ability. No self, dead or empty targets. Players awaiting unresolved night knife or poison deaths can still act and be inspected. Never repeat the same ID with that ability during the game: your or their revival, their role changes and seat changes do not erase the record. You receive only the role result allowed by this board's inspection and disguise rules, not additional true alignment, remaining ability uses or wolf-team knowledge. The moderator tells you privately; the target is not notified and later changes do not rewrite old reports. Knowing a wolf grants no pack chat or knife; inspection does no damage and changes no identity. You may take no action to pass, and having no legal targets also ends that night's inspection without spending a use or changing old reports. Three invalid submissions are still a failure, not a legal pass. Separately gifted or copied Mirror abilities start with their own empty histories; each keeps its own record. When an ability is transferred, its rules, history, remaining uses and whether it has acted that night all transfer together. Invalid or late actions have no effect. Use the current instructions for any other inspection ability you obtain; a Mirror check cannot replace the personal inspection Gargoyle needs before using its knife.",
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
