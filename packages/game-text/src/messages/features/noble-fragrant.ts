/**
 * Owns the noble fragrant translations and their neutral key/placeholder definitions.
 * Inputs are existing contract MessageKeys and literal bilingual templates;
 * outputs are matching Chinese/English fragments and named parameter arrays.
 * Empty arrays explicitly mean no interpolation parameters. These definitions
 * never parse facts, execute rules, or validate user-supplied parameters; the
 * shared formatter retains that runtime boundary and preserves raw user text.
 */
import type { MessageDefinition } from "../definition";

export const definition = {
  owner: "features/noble-fragrant",
  parameters: {
    "ability.kind.pair_check": [],
    "stage.fragrant_bind": [],
    "prompt.stage.fragrant_pair_candidates": ["ids"],
    "rules.fragrant_pair_seer": [],
    "stage.pair_inspection": [],
    "event.fragrant_pair_chosen": ["actor", "day", "targets"],
    "event.fragrant_night_opened": ["day"],
    "replay.stage.fragrant_night_opened": [],
    "event.fragrant_wave_committed": ["actor", "day", "deaths"],
    "replay.stage.fragrant_wave_committed": [],
    "event.fragrant_pair_inspected": ["actor", "day", "first", "result", "second"],
    "event.fragrant_night_notified": ["actor", "day", "state"],
    "event.fragrant_binding_expired": ["actor", "created", "day", "first", "second"],
    "event.fragrant_link_triggered": ["actor", "added", "day", "first", "root", "second"],
    "fragrant.result.true": [],
    "fragrant.result.false": [],
    "fragrant.choice.pass": [],
    "fragrant.trigger.no_addition": [],
    "replay.stage.fragrant_pair_chosen": [],
    "replay.stage.fragrant_pair_inspected": [],
    "replay.stage.fragrant_night_notified": [],
    "replay.stage.fragrant_binding_expired": [],
    "replay.stage.fragrant_link_triggered": [],
    "prompt.status.fragrant": ["state"],
    "error.fragrant_pair_unavailable": [],
    "role.fragrant_phantom.brief": [],
    "role.awakened_seer.brief": [],
    "action.bind_fragrant_pair.hint": [],
    "action.bind_fragrant_pair.directive": [],
    "action.check_pair.hint": [],
    "action.check_pair.directive": [],
    "event.noble_body_night_opened": ["day"],
    "event.noble_body_knife_committed": ["day", "target"],
    "event.noble_body_native_damage_committed": ["day"],
    "replay.stage.noble_body_knife_committed": [],
    "replay.stage.noble_body_native_damage_committed": [],
    "event.noble_body_sources_committed": ["day", "state"],
    "event.noble_body_death_committed": ["actor", "causes", "day"],
    "replay.stage.noble_body_night_opened": [],
    "replay.stage.noble_body_sources_committed": [],
    "replay.stage.noble_body_death_committed": [],
    "role.night_noble.brief": [],
    "role.awakened_idiot.brief": [],
    "action.choose_servant.hint": [],
    "action.choose_servant.directive": [],
    "action.protect_secret_body.hint": [],
    "action.protect_secret_body.directive": [],
    "error.noble_body_unavailable": [],
    "stage.night_noble": [],
    "stage.secret_body": [],
    "stage.awakened_idiot_reveal_speech": [],
    "request.summary.secret_body_reveal": [],
    "prompt.status.noble": ["state"],
    "prompt.status.secret_body": ["state"],
    "prompt.config.noble_standard": [],
    "prompt.config.noble_restricted": [],
    "event.noble_servant_chosen": ["actor", "day", "target"],
    "event.secret_body_chosen": ["actor", "day", "target"],
    "event.noble_contract_closed": ["contract", "day", "status", "target"],
    "event.secret_body_blocked": ["actor", "cause", "day", "target"],
    "event.noble_night_notified": ["actor", "day", "state"],
    "event.secret_body_night_notified": ["actor", "day", "resource"],
    "event.secret_body_revealed": ["actor"],
    "event.secret_body_reveal_speech": ["actor", "text"],
    "replay.stage.noble_servant_chosen": [],
    "replay.stage.secret_body_chosen": [],
    "replay.stage.noble_contract_closed": [],
    "replay.stage.secret_body_blocked": [],
    "replay.stage.noble_night_notified": [],
    "replay.stage.secret_body_night_notified": [],
    "replay.stage.secret_body_revealed": [],
    "replay.stage.secret_body_reveal_speech": [],
  },
} as const satisfies MessageDefinition;

export const zhCN = {
  "ability.kind.pair_check": "双目标查验",
  "stage.fragrant_bind": "寻香绑定",
  "prompt.stage.fragrant_pair_candidates":
    "本次允许的原存活候选号码：{ids}；选择两个不同号码。只有绑定可以显式target_ids=null空过。",
  "rules.fragrant_pair_seer":
    "本局为AWA寻香识命十二人原生板：寻香魅影、三普狼、四村民、觉醒预言家、女巫、猎人、守卫，固定屠边且全狼出局优先。普狼互认且不认识魅影，魅影不狼聊、不自爆；首夜仅获知一名随机原始普狼，其余三狼真实夜初已全灭才接普通刀。魅影可每夜绑定两个不同存活号码或空过，覆盖当夜及白天，下一真实夜到期；空过不续旧对，真实死亡牵连整局只触发一次，施法者首次死亡不倒销已付关系。两端独立同波死亡不增加死因但消耗技能。牵连猎人不能枪，独立合格死因保留。首夜初始夜波牵连两端均有遗言；次夜夜死无遗言，放逐仅根目标有遗言，枪链无追加遗言。全波标死后，先所有遗言、再所有警徽、再枪链，全部结束才判胜；末狼和末神同时死亡时好人胜。觉醒预言家每夜必须选两个不同存活号码（可含自身、可重复往夜目标），只知其中是否至少一狼，结果不报数量或单体身份。夜序：实际开夜/到期/知识/刀权冻结、药重置、绑定、普狼聊、守卫、刀、女巫、双查、常规伤害；首日警长先于夜死公布。守卫连续真实夜不可同守、可自守空守；女巫禁自救、仅持解药见原刀口、一夜一药。所有新增行动及狼聊/刀严格失败不回退，合法空过必须明确提交。",
  "stage.pair_inspection": "双目标查验",
  "event.fragrant_pair_chosen": "{actor}号第{day}夜绑定选择：{targets}。",
  "event.fragrant_night_opened": "[God] 寻香板第{day}轮实际开夜。",
  "replay.stage.fragrant_night_opened": "实际开夜",
  "event.fragrant_wave_committed": "[God] {actor}号所在寻香板第{day}轮实际死亡波：{deaths}。",
  "replay.stage.fragrant_wave_committed": "实际死亡波提交",
  "event.fragrant_pair_inspected": "{actor}号第{day}夜查验{first}、{second}号：{result}。",
  "event.fragrant_night_notified": "{actor}号第{day}夜已知寻香状态：{state}。",
  "event.fragrant_binding_expired":
    "[God] {actor}号第{created}夜绑定的{first}、{second}号在第{day}夜到期。",
  "event.fragrant_link_triggered":
    "[God] {actor}号第{day}轮绑定{first}、{second}号已触发；根死亡{root}，追加{added}。",
  "fragrant.result.true": "至少一名真实狼人",
  "fragrant.result.false": "均非狼人",
  "fragrant.choice.pass": "本夜未建立绑定",
  "fragrant.trigger.no_addition": "两端已独立进入同波，不追加死亡或死因",
  "replay.stage.fragrant_pair_chosen": "寻香绑定选择",
  "replay.stage.fragrant_pair_inspected": "双目标结果",
  "replay.stage.fragrant_night_notified": "寻香夜初通知",
  "replay.stage.fragrant_binding_expired": "绑定到期",
  "replay.stage.fragrant_link_triggered": "实际牵连结算",
  "prompt.status.fragrant":
    "你的已授权寻香知识、绑定历史和刀权状态：{state}。只使用这些已知事实，不推断尚未公布的后台结算。",
  "error.fragrant_pair_unavailable": "当前请求、原角色能力、阶段、目标对或期限不允许该行动。",
  "role.fragrant_phantom.brief":
    "你是寻香魅影，属于狼人阵营并共享狼人胜利，但始终不参加普通狼聊，也不能自爆。首夜随机获知一个原始普通狼号码，该知识在其死亡后仍保留；不会因此知道其它狼。只有其它三个原始狼在真实夜初已全部死亡时，你本夜才有普通狼刀权，夜中死亡不补发刀。首夜起，尚未触发时每夜可绑定两名不同存活玩家（可含自己）或明确空过。绑定覆盖当夜和接下来白天，下一真实夜初到期；空过不延续旧对。选择不消耗次数，整局真实死亡牵连只触发一次：一端出局时，另一原生命若尚未进入同波则追加死亡；两端已独立同波死亡时不追加死因，但仍消费。已付关系可在原施法者首次死亡后触发。仅因牵连出局的猎人不能开枪；独立合格死因不被覆盖。关系知情只随真实已公布死亡更新，不能用待公布信息发言。",
  "role.awakened_seer.brief":
    "你是觉醒预言家，好人神职。首夜起每夜从存活候选中选择两个不同号码；允许含自己，也可跨夜重复目标或整对。至少两名候选时必须选择，不能空过、重复同号码或只交一个。唯一结果是这两人中是否至少有一个真实狼人（布尔值）；不返回狼人数量、哪个是狼、单体阵营或具体角色。仅你本人获知目标对和结果，目标和其它玩家不会收到。你可以结合自己的已知身份推理，但协议仍只有一个聚合结果。",
  "action.bind_fragrant_pair.hint":
    "绑定两个不同存活号码或明确空过：target_ids=[号码,号码] 或 null。",
  "action.bind_fragrant_pair.directive":
    "以 bind_fragrant_pair 提交两个不同合法号码，或 target_ids=null 明确空过；不要返回单体选择或延续旧绑定。",
  "action.check_pair.hint":
    "双目标查验：target_ids=[两个不同的存活号码]；允许包含自己，不允许空过。",
  "action.check_pair.directive":
    "以 check_pair 提交恰好两个不同合法号码；结果只有是否含狼的一个布尔值，不请求单体身份。",
  "event.noble_body_night_opened": "[God] 第{day}夜所有权已打开。",
  "event.noble_body_knife_committed": "[God] 第{day}夜狼刀标记已提交：{target}",
  "event.noble_body_native_damage_committed": "[God] 第{day}夜原生伤害已结算，刀药标记已清除。",
  "replay.stage.noble_body_knife_committed": "狼刀标记提交",
  "replay.stage.noble_body_native_damage_committed": "原生伤害结算提交",
  "event.noble_body_sources_committed": "[God] 第{day}夜有效来源已提交：{state}",
  "event.noble_body_death_committed": "[God] 第{day}夜／日{actor}号实际死亡：{causes}",
  "replay.stage.noble_body_night_opened": "夜间所有权提交",
  "replay.stage.noble_body_sources_committed": "有效夜伤提交",
  "replay.stage.noble_body_death_committed": "实际死亡提交",
  "role.night_noble.brief":
    "夜之贵族属于狼队，互知身份、参加狼聊与刀票。从第二夜起可选择其他活人作为夜仆或明确空过；有待到期夜仆时不能再选。夜仆在下一夜结算到期，猎魔命中夜仆只解除契约。契约终态于下一夜告知。自爆及刀口资格依本板公开政策。",
  "role.awakened_idiot.brief":
    "你有一份秘密之身。持有时每夜可选择存活玩家（含自己）或明确不指定；目标无有效夜伤时转护自己，只抵消一个有效来源。实际抵伤后身体耗尽，下一夜才统一告知是否耗身，不获知实际抵伤对象或来源。未耗身时免一次放逐，公开翻牌并发言，仍保留投票、竞选和警徽；下次可被放逐。连续目标限制依公开政策。",
  "action.choose_servant.hint": "选择其他活人作为夜仆，或明确使用null空过。",
  "action.choose_servant.directive": "用choose_servant提交一次选择。",
  "action.protect_secret_body.hint": "选择名单内活人保护（可选自己），或用null仅保留自护机会。",
  "action.protect_secret_body.directive": "用protect_secret_body提交一次保护选择。",
  "error.noble_body_unavailable": "当前请求、阶段或目标不允许该行动。",
  "stage.night_noble": "设置夜仆",
  "stage.secret_body": "秘密之身保护",
  "stage.awakened_idiot_reveal_speech": "活人翻牌发言",
  "request.summary.secret_body_reveal": "角色已公开且仍存活；请完成一次翻牌发言。",
  "prompt.status.noble": "你的已告知夜仆状态（隐藏终态延至下一夜）：{state}",
  "prompt.status.secret_body": "你的已告知身体状态（夜间耗身延至下一夜告知）：{state}",
  "prompt.config.noble_standard": "贵族可按普通狼人规则自爆、成为狼刀目标。",
  "prompt.config.noble_restricted": "贵族不能自爆，任何狼刀都不能选择贵族；狼聊、刀票和互认保留。",
  "event.noble_servant_chosen": "{actor}号第{day}夜选择夜仆：{target}。",
  "event.secret_body_chosen": "{actor}号第{day}夜主动保护选择：{target}。",
  "event.noble_contract_closed":
    "[God] 第{day}夜／日夜仆契约{contract}结束，目标{target}，终态{status}。",
  "event.secret_body_blocked": "[God] {actor}号第{day}夜消耗秘密之身，对{target}抵消来源{cause}。",
  "event.noble_night_notified": "{actor}号第{day}夜获知自己的夜仆状态：{state}",
  "event.secret_body_night_notified": "{actor}号第{day}夜获知身体状态：{resource}。",
  "event.secret_body_revealed":
    "{actor}号翻牌为觉醒愚者，消耗身体免除本次放逐；仍存活，投票与警徽资格保留。",
  "event.secret_body_reveal_speech": "[活人翻牌发言][{actor}] {text}",
  "replay.stage.noble_servant_chosen": "夜仆选择",
  "replay.stage.secret_body_chosen": "秘密之身选择",
  "replay.stage.noble_contract_closed": "夜仆契约终结",
  "replay.stage.secret_body_blocked": "秘密之身抵伤",
  "replay.stage.noble_night_notified": "夜仆状态通知",
  "replay.stage.secret_body_night_notified": "身体状态通知",
  "replay.stage.secret_body_revealed": "活人翻牌",
  "replay.stage.secret_body_reveal_speech": "翻牌发言",
} as const satisfies Record<keyof typeof definition.parameters, string>;

export const en = {
  "ability.kind.pair_check": "Pair inspection",
  "stage.fragrant_bind": "Fragrant binding",
  "prompt.stage.fragrant_pair_candidates":
    "Original living candidate IDs for this request: {ids}. Choose two distinct IDs. Only binding allows an explicit target_ids=null pass.",
  "rules.fragrant_pair_seer":
    "This is AWA's native twelve-player Fragrant Phantom / Awakened Seer board: one Phantom, three ordinary wolves, four Villagers, and the Awakened Seer, Witch, Hunter and Guard. Slaughter-side victory checks all wolves eliminated first. Ordinary wolves know each other, never the Phantom. The Phantom never chats with wolves or self-destructs, learns only one random original ordinary wolf on night one, and gets an ordinary knife only if all three were already dead at the actual night opening. Each night it may bind two distinct living IDs or explicitly pass. The relation lasts through night and day, expires at the next actual opening, and is never extended by a pass. Actual linkage triggers once; the caster's first death does not revoke a paid relation. Two independent deaths in the same wave consume it without a false added cause. Link-only Hunters cannot shoot; independent qualified causes remain. Both linked endpoints in the first night's initial wave receive last words. Later night deaths receive none; exile grants only the root's words; gun chains grant no additional words. Mark the whole wave, then all words, all badges, all guns and later waves before one victory check. If the last wolf and last god die together, good wins. The Awakened Seer must choose two distinct living IDs each night, allowing self and earlier targets; the sole result is a contains-wolf boolean, never a count or individual identity. Night order: actual opening/expiry/knowledge/knife freeze, potion reset, binding, ordinary wolf chat, Guard, knife, Witch, pair check and normal damage. First-day Sheriff election precedes the death announcement. Guard cannot repeat a target on consecutive actual nights, may self-guard or pass. Witch cannot self-heal, sees the original knife only while holding heal, and uses at most one bottle per night. New actions and wolf chat/knife fail strictly without fallback; a legal pass must be explicitly submitted.",
  "stage.pair_inspection": "Pair inspection",
  "event.fragrant_pair_chosen": "Player {actor}, night {day} binding choice: {targets}.",
  "event.fragrant_night_opened": "[God] The Fragrant board actually opened night {day}.",
  "replay.stage.fragrant_night_opened": "Actual night opening",
  "event.fragrant_wave_committed":
    "[God] Player {actor}'s fragrance board, cycle {day} actual death wave: {deaths}.",
  "replay.stage.fragrant_wave_committed": "Actual death wave commit",
  "event.fragrant_pair_inspected":
    "Player {actor} checked {first} and {second} on night {day}: {result}.",
  "event.fragrant_night_notified":
    "Player {actor}, night {day} authorized fragrance state: {state}.",
  "event.fragrant_binding_expired":
    "[God] Player {actor}'s night {created} binding of {first} and {second} expired at night {day}.",
  "event.fragrant_link_triggered":
    "[God] Player {actor}'s cycle {day} binding of {first} and {second} triggered; root {root}, added {added}.",
  "fragrant.result.true": "at least one true wolf",
  "fragrant.result.false": "neither is a wolf",
  "fragrant.choice.pass": "no binding established tonight",
  "fragrant.trigger.no_addition":
    "both already independent deaths in the wave; no added death or cause",
  "replay.stage.fragrant_pair_chosen": "Fragrant binding choice",
  "replay.stage.fragrant_pair_inspected": "Pair inspection result",
  "replay.stage.fragrant_night_notified": "Fragrance night notice",
  "replay.stage.fragrant_binding_expired": "Binding expiry",
  "replay.stage.fragrant_link_triggered": "Actual death linkage",
  "prompt.status.fragrant":
    "Your authorized fragrance knowledge, binding history and knife permission: {state}. Use these known facts only; do not assume unpublished backend settlement.",
  "error.fragrant_pair_unavailable":
    "The current request, original native ability, phase, target pair or deadline does not permit this action.",
  "role.fragrant_phantom.brief":
    "You are the Fragrant Phantom, on the wolf side and sharing its victory. You never join ordinary wolf chat or self-destruct. On the first night you learn one randomly selected original ordinary wolf; this historical knowledge remains after their death and reveals no other wolves. You gain an ordinary knife vote only if all three other original wolves were already dead at the actual night opening; deaths during the night never grant another knife. From night one, before the skill triggers, choose two distinct living players, including yourself if desired, or explicitly pass. A paid binding lasts through that night and the following day, expiring at the next actual night opening. Passing never extends the old pair. Choosing does not spend the skill; actual death linkage triggers once per game. If one endpoint actually dies, add the other original life only if it is not already an independent death in that wave. Both independent deaths still consume the trigger without adding a false cause. A paid relation survives its original caster's first death. A Hunter killed only by this link cannot shoot; an independent qualified cause remains intact. Your knowledge updates only from actual published deaths; never speak using pending private settlement.",
  "role.awakened_seer.brief":
    "You are the Awakened Seer, a good-side god. From night one, choose two distinct living candidate IDs each night. Self-targeting and repeated targets or pairs on later nights are allowed. With at least two candidates you must choose both: no pass, duplicate ID or single target. The only result is a boolean saying whether at least one member is truly on the wolf side. It reveals no count, individual wolf, individual alignment or exact role. Only you learn the pair and result; neither target nor any other player is notified. You may reason using your own known identity, but the protocol still returns one aggregate boolean.",
  "action.bind_fragrant_pair.hint":
    "Bind two distinct living IDs, or explicitly pass: target_ids=[ID,ID] or null.",
  "action.bind_fragrant_pair.directive":
    "Use bind_fragrant_pair with two distinct legal IDs, or target_ids=null to explicitly pass. Do not submit one target or extend an old binding.",
  "action.check_pair.hint":
    "Pair inspection: target_ids=[two distinct living IDs]. Self-targeting is allowed; passing is not.",
  "action.check_pair.directive":
    "Use check_pair with exactly two distinct legal IDs. The result is one contains-wolf boolean; do not request individual identities.",
  "event.noble_body_night_opened": "[God] Night {day} ownership opened.",
  "event.noble_body_knife_committed": "[God] Night {day} wolf knife mark committed: {target}",
  "event.noble_body_native_damage_committed":
    "[God] Night {day} native damage resolved; knife and potion marks cleared.",
  "replay.stage.noble_body_knife_committed": "Wolf knife mark commit",
  "replay.stage.noble_body_native_damage_committed": "Native damage resolution commit",
  "event.noble_body_sources_committed": "[God] Night {day} effective sources committed: {state}",
  "event.noble_body_death_committed":
    "[God] Player {actor} actually died on day/night {day}: {causes}",
  "replay.stage.noble_body_night_opened": "Night ownership commit",
  "replay.stage.noble_body_sources_committed": "Effective night damage commit",
  "replay.stage.noble_body_death_committed": "Actual death commit",
  "role.night_noble.brief":
    "You belong to the wolf pack: mutual recognition, chat and knife voting remain. From night two, choose another living player as a servant or explicitly pass. A pending servant occupies the slot until the following night settlement. A Demon Hunter hunting the servant only clears the contract. Terminal contract status is announced to you next night. Blast and knife-target eligibility follow the public board policy.",
  "role.awakened_idiot.brief":
    "You have one Secret Body. While intact, each night choose a living player (including yourself), or explicitly leave the target unspecified. If that target has no effective harm, protection falls back to yourself; it cancels exactly one effective source. An actual block spends the body; only whether it was spent is announced next night, never the actual target or cause. An intact body cancels one exile, reveals your role and grants a reveal speech. You remain alive with voting, candidacy and badge rights; a later exile can kill you. Repeated targets follow the public policy.",
  "action.choose_servant.hint":
    "Choose another living player as servant, or explicitly pass with null.",
  "action.choose_servant.directive": "Submit one choice with choose_servant.",
  "action.protect_secret_body.hint":
    "Choose a listed living target (self allowed), or null for self fallback only.",
  "action.protect_secret_body.directive": "Submit one protection choice with protect_secret_body.",
  "error.noble_body_unavailable": "This request, phase or target does not permit the action.",
  "stage.night_noble": "Choose a servant",
  "stage.secret_body": "Secret Body protection",
  "stage.awakened_idiot_reveal_speech": "Living role reveal speech",
  "request.summary.secret_body_reveal":
    "Your role is public and you remain alive. Complete one reveal speech.",
  "prompt.status.noble":
    "Your last announced servant state (hidden terminal changes arrive next night): {state}",
  "prompt.status.secret_body":
    "Your last announced body state (night consumption is announced next night): {state}",
  "prompt.config.noble_standard":
    "The Noble can blast and can be a pack knife target under ordinary wolf rules.",
  "prompt.config.noble_restricted":
    "The Noble cannot blast or be any wolf knife target; chat, knife votes and pack recognition remain.",
  "event.noble_servant_chosen": "Player {actor} chose a servant on night {day}: {target}.",
  "event.secret_body_chosen": "Player {actor} chose a protection target on night {day}: {target}.",
  "event.noble_contract_closed":
    "[God] Servant contract {contract} closed on day/night {day}, target {target}, status {status}.",
  "event.secret_body_blocked":
    "[God] Player {actor} spent Secret Body on night {day}, blocking {cause} against {target}.",
  "event.noble_night_notified": "Player {actor} received servant state on night {day}: {state}",
  "event.secret_body_night_notified":
    "Player {actor} received body state on night {day}: {resource}.",
  "event.secret_body_revealed":
    "Player {actor} revealed as the Awakened Village Idiot and spent the body to cancel this exile. They remain alive with voting and badge rights.",
  "event.secret_body_reveal_speech": "[Living reveal speech][{actor}] {text}",
  "replay.stage.noble_servant_chosen": "Servant choice",
  "replay.stage.secret_body_chosen": "Secret Body choice",
  "replay.stage.noble_contract_closed": "Servant contract closed",
  "replay.stage.secret_body_blocked": "Secret Body block",
  "replay.stage.noble_night_notified": "Servant notification",
  "replay.stage.secret_body_night_notified": "Body notification",
  "replay.stage.secret_body_revealed": "Living role reveal",
  "replay.stage.secret_body_reveal_speech": "Reveal speech",
} satisfies Record<keyof typeof definition.parameters, string>;

export const messages = { definition, zhCN, en };
