/**
 * Owns the mist radiant translations and their neutral key/placeholder definitions.
 * Inputs are existing contract MessageKeys and literal bilingual templates;
 * outputs are matching Chinese/English fragments and named parameter arrays.
 * Empty arrays explicitly mean no interpolation parameters. These definitions
 * never parse facts, execute rules, or validate user-supplied parameters; the
 * shared formatter retains that runtime boundary and preserves raw user text.
 */
import type { MessageDefinition } from "../definition";

export const definition = {
  owner: "features/mist-radiant",
  parameters: {
    "prompt.status.eclipse": ["state"],
    "replay.stage.eclipse_swallowed": [],
    "replay.stage.eclipse_native_suppressed": [],
    "replay.stage.eclipse_native_restored": [],
    "replay.stage.eclipse_lease_closed": [],
    "replay.stage.radiant_shelter_chosen": [],
    "role.radiant_count.brief": [],
    "role.eclipse_maid.brief": [],
    "rules.radiant_eclipse": [],
    "action.cast_shelter.hint": [],
    "action.cast_shelter.directive": [],
    "action.swallow_skill.hint": [],
    "action.swallow_skill.directive": [],
    "stage.radiant_shelter": [],
    "stage.eclipse_swallow": [],
    "error.radiant_shelter_unavailable": [],
    "error.radiant_shelter_target": [],
    "error.eclipse_swallow_unavailable": [],
    "error.eclipse_swallow_target": [],
    "event.radiant_shelter_used": ["actor", "target"],
    "event.radiant_shelter_passed": ["actor"],
    "event.eclipse_swallowed": ["actor", "target"],
    "event.eclipse_swallow_passed": ["actor"],
    "event.eclipse_native_suppressed": [],
    "event.eclipse_native_restored": [],
    "event.eclipse_lease_committed": ["day"],
    "event.eclipse_lease_aborted": ["day"],
    "ability.kind.shelter": [],
    "death.radiant_backlash": [],
    "replay.stage.alchemist_mist_chosen": [],
    "replay.stage.alchemist_mist_skipped": [],
    "replay.stage.alchemist_snake_chosen": [],
    "replay.stage.raven_unsealed": [],
    "replay.stage.raven_knife_chosen": [],
    "replay.stage.raven_knife_skipped": [],
    "replay.stage.mist_knife_drawn": [],
    "prompt.config.mist_raven_timing": [],
    "event.alchemist_mist_chosen": ["actor", "day", "targets"],
    "event.alchemist_mist_skipped": ["actor", "day", "reason"],
    "event.alchemist_snake_chosen": ["actor", "day", "target"],
    "event.raven_unsealed": ["actor", "day", "teammates"],
    "event.raven_knife_chosen": ["actor", "day", "target"],
    "event.raven_knife_skipped": ["actor", "day", "reason"],
    "event.mist_knife_drawn": ["candidates", "day", "target"],
    "mist.reason.dead": [],
    "mist.reason.spent": [],
    "mist.reason.no_targets": [],
    "mist.reason.sealed": [],
    "prompt.status.alchemist": ["state"],
    "death.raven_claw_knife": [],
    "replay.stage.alchemist_mist": [],
    "replay.stage.alchemist_snake": [],
    "replay.stage.raven_knife": [],
    "prompt.stage.snake": ["candidates", "target"],
    "prompt.stage.raven_knife": ["candidates"],
    "request.summary.alchemist_snake": [],
    "stage.alchemist_mist": [],
    "stage.alchemist_snake": [],
    "stage.raven_knife": [],
    "role.alchemist.brief": [],
    "role.raven_claw_wolf.brief": [],
    "action.cast_mist.hint": [],
    "action.cast_mist.directive": [],
    "action.use_snake.hint": [],
    "action.use_snake.directive": [],
    "action.raven_knife.hint": [],
    "action.raven_knife.directive": [],
    "error.mist_unavailable": [],
    "error.mist_target": [],
    "error.snake_unavailable": [],
    "error.snake_target": [],
    "error.raven_knife_unavailable": [],
    "error.raven_knife_target": [],
  },
} as const satisfies MessageDefinition;

export const zhCN = {
  "prompt.status.eclipse": "你的吞噬记录：{state}",
  "replay.stage.eclipse_swallowed": "吞噬原生技能",
  "replay.stage.eclipse_native_suppressed": "原生技能封禁",
  "replay.stage.eclipse_native_restored": "原生技能恢复",
  "replay.stage.eclipse_lease_closed": "借用授权关闭",
  "replay.stage.radiant_shelter_chosen": "流光庇护",
  "role.radiant_count.brief":
    "你是流光伯爵，属于好人神职。从第二夜起，每夜可选择一名其他存活玩家给予流光庇护，也可明确放弃。庇护免疫该夜的狼刀、毒药及梦游伤害；不能自保，不能连续两夜庇护同一个人。若本夜被蚀日侍女吞噬，你没有原生庇护行动，天亮解除封禁；借用者的选择不会写回你的上一目标。被封禁的夜晚不算一次放弃。 借庇护继承原主上一目标及实际夜序，但不写回借用者的新选择；封禁期间未行动，隔过一夜恢复后可以再次选择原目标。",
  "role.eclipse_maid.brief":
    "你是蚀日侍女，属于狼人阵营，与你的狼队共同胜负。你单向知道其他狼人身份，但他们不知道你；你不参与狼聊，不能自爆，只有在真实夜初其余狼人已全部出局时才有狼刀。从第二夜起，每夜可吞噬一名存活好人，也可明确放弃，不能连续两夜吞噬同一个人。被吞者当夜失去原生能力，你获得其当前可借能力并可在相应阶段使用。借用库存独立、不写回原主，不复制历史查验或提示；借药继承当时库存且每夜最多一瓶、不能自救，空库存不发借药行动。借梦的梦游及死亡牵连以你为施法者；借庇护不能保护你自己。吞伯爵或该夜最终受庇护的目标会触发独立流光反噬，但吞噬和借得技能仍有效；摄梦保护可以阻挡反噬，连续梦或梦主死亡的伤害仍另行结算。天亮借用授权结束。 借庇护按继承的上一目标及实际夜序判断连续，使用后不改写伯爵的记录。 借梦继承原主上一梦游目标及实际夜序；梦游可以连续选择同一目标并造成连续梦伤，但不能梦你自己。",
  "rules.radiant_eclipse":
    "猎日逐光采用 AWA 十二人版本：流光伯爵与蚀日侍女从第二夜行动，庇护与吞噬各自不能连续两夜选相同目标。侍女先吞噬、原主暂失原生能力，再执行庇护、摄梦、狼聊、狼刀、用药及查验。借用从当前能力白名单快照产生独立库存，不复制私密历史、也不写回原主；借药最多一瓶、禁止自救，原主已耗药不刷新。借梦与牵连以侍女为施法者。庇护免疫狼刀、毒药和梦伤；吞伯爵或本夜受庇护者会反噬，摄梦可挡反噬但不挡连续梦或梦主死亡。临时封禁及借用授权在夜末关闭，已提交效果仍正常结算；失败中止不发布正常恢复、夜死或胜负。 庇护连续限制按本次能力保留或继承的上一目标与实际夜序判断；原主被封禁的夜晚无行动记录，借用选择不写回，不能按全局上一夜庇护目标排除。 借梦继承原主上一目标及实际夜序，允许连续梦并造成独立梦伤，不能梦侍女自己。空借药库存没有借药请求，原生女巫空药流程保留。侍女单向知道狼队、不狼聊、不自爆，只在真实夜初其余狼已全灭时有普通狼刀。",
  "action.cast_shelter.hint":
    "调用 cast_shelter，target_id 为一个其他存活玩家编号；不能连续夜重复本次庇护保留或继承的上一目标，明确放弃用 null。",
  "action.cast_shelter.directive": "请选择本夜流光庇护目标，或明确放弃。",
  "action.swallow_skill.hint":
    "调用 swallow_skill，target_id 为一个存活好人且非上一夜吞噬的玩家编号；明确放弃用 null。",
  "action.swallow_skill.directive": "请选择本夜吞噬目标，或明确放弃。",
  "stage.radiant_shelter": "流光庇护",
  "stage.eclipse_swallow": "吞噬技能",
  "error.radiant_shelter_unavailable": "当前无法进行流光庇护。",
  "error.radiant_shelter_target":
    "庇护目标必须是其他存活玩家，且不能连续夜重复本次庇护保留或继承的上一目标。",
  "error.eclipse_swallow_unavailable": "当前无法吞噬技能。",
  "error.eclipse_swallow_target": "吞噬目标必须是存活好人，且不能与上一夜相同。",
  "event.radiant_shelter_used": "{actor}庇护{target}。",
  "event.radiant_shelter_passed": "{actor}本夜未使用流光庇护。",
  "event.eclipse_swallowed": "{actor}吞噬{target}的原生技能。",
  "event.eclipse_swallow_passed": "{actor}本夜未吞噬技能。",
  "event.eclipse_native_suppressed": "你的原生技能本夜暂时失效；天亮恢复。",
  "event.eclipse_native_restored": "本夜临时封禁已解除。",
  "event.eclipse_lease_committed": "第{day}夜借用授权正常关闭。",
  "event.eclipse_lease_aborted": "第{day}夜借用授权因中止关闭。",
  "ability.kind.shelter": "流光庇护",
  "death.radiant_backlash": "流光反噬",
  "replay.stage.alchemist_mist_chosen": "雾选择",
  "replay.stage.alchemist_mist_skipped": "跳过雾请求",
  "replay.stage.alchemist_snake_chosen": "蛇救治选择",
  "replay.stage.raven_unsealed": "狼鸦解封",
  "replay.stage.raven_knife_chosen": "额外刀选择",
  "replay.stage.raven_knife_skipped": "跳过额外刀请求",
  "replay.stage.mist_knife_drawn": "雾内随机刀",
  "prompt.config.mist_raven_timing":
    "迷雾鸦影时序：每夜若夜初炼金存活且蛇未用，白天发言后私下决定蛇，然后公布并提交最终夜死；首日发言前先完成警长流程。只有条件不满足才按普通夜死顺序。若仍有待定夜而白天自爆，先提交自爆死亡与警徽，再决定蛇及待定夜死，之后判胜；已完成的救治窗口不会因放逐前自爆重开。此为条件规则，不公开当前药量。",
  "event.alchemist_mist_chosen": "第 {day} 夜，{actor} 号的未明之雾选择：{targets}。",
  "event.alchemist_mist_skipped": "第 {day} 夜，{actor} 号未请求雾：{reason}。",
  "event.alchemist_snake_chosen": "第 {day} 夜结算前，{actor} 号的法老之蛇选择：{target}。",
  "event.raven_unsealed": "第 {day} 夜，{actor} 号狼鸦解封；已知队友快照：{teammates}。",
  "event.raven_knife_chosen": "第 {day} 夜，{actor} 号的额外刀选择：{target}。",
  "event.raven_knife_skipped": "第 {day} 夜，{actor} 号未请求额外刀：{reason}。",
  "event.mist_knife_drawn":
    "第 {day} 夜，狼队全员明确弃刀；雾内候选 {candidates}，引擎抽取刀口：{target}。",
  "mist.reason.dead": "已死亡",
  "mist.reason.spent": "资源耗尽",
  "mist.reason.no_targets": "没有合法目标",
  "mist.reason.sealed": "尚未解封",
  "prompt.status.alchemist": "你的炼金资源与已提交历史：{state}",
  "death.raven_claw_knife": "狼鸦穿透额外刀",
  "replay.stage.alchemist_mist": "未明之雾",
  "replay.stage.alchemist_snake": "法老之蛇救治",
  "replay.stage.raven_knife": "狼鸦额外刀",
  "prompt.stage.snake":
    "本夜原普通刀口：{target}。可救目标：{candidates}；无合法目标也要明确 target_id:null。通常在发言后决定；自爆中断时在实际死亡及警徽处理后立即决定。",
  "prompt.stage.raven_knife":
    "狼鸦额外刀可选号码：{candidates}。不受雾圈限制，不能选自己，或明确 null 保留。",
  "request.summary.alchemist_snake": "决定本夜法老之蛇救治",
  "stage.alchemist_mist": "未明之雾",
  "stage.alchemist_snake": "法老之蛇救治",
  "stage.raven_knife": "狼鸦额外刀",
  "role.alchemist.brief":
    "你是炼金魔女，好人神职。未明之雾和法老之蛇各一次，可同夜使用。夜间先选三个不同存活号码圈住普通狼刀，可含自己和狼人；明确空过不消耗。还有蛇时，天亮后通常在发言结束时私下获知本夜原普通刀口并决定救治，仅首夜能自救；保护已挡刀仍可付药。蛇只去普通刀伤害，无法救狼鸦穿透刀或连续梦。仅本夜初你存活且蛇未用时，夜死才延迟到唯一救治后公布；否则按普通顺序。自爆中断时，自爆死亡及警徽先于救治，夜死和连锁完成后才判胜。",
  "role.raven_claw_wolf.brief":
    "你是狼鸦之爪，狼人阵营。狼队知道你，封印时你不知道队友且不能狼聊或普通投刀；永远不能自爆。只在真实夜初活狼少于三人时永久解封，知道当刻仍存活队友，之后保留已知死队友，不补发此前死狼或狼聊。解封后参与狼聊和普通投刀，并可保留或使用一次独立额外刀；目标必须是其他存活原生命，圈外也可，穿透本板梦保护和蛇救治，仍可引起摄梦死亡牵连。",
  "action.cast_mist.hint": "cast_mist：target_ids 为三个不同存活号码，或 null 明确弃用。",
  "action.cast_mist.directive":
    "本次仅提交一次 cast_mist，可包含自己或狼人；不能用缺失回复代替弃用。",
  "action.use_snake.hint": "use_snake：target_id 为本夜原普通刀口，或 null 明确弃药。",
  "action.use_snake.directive":
    "通常在白天发言结束后私下救治；自爆中断时，在自爆实际死亡和警徽处理后立即决定，只依据已经发生的信息。只救合法原刀口，或明确 null；没有合法对象也必须明确弃药。",
  "action.raven_knife.hint": "raven_knife：target_id 为其他存活号码，或 null 保留额外刀。",
  "action.raven_knife.directive": "额外刀不受雾圈限制，明确 null 保留次数；不能自刀。",
  "error.mist_unavailable": "当前不能使用未明之雾。",
  "error.mist_target": "请选择三个不同的合法存活号码，或明确弃用。",
  "error.snake_unavailable": "当前不在唯一法老之蛇救治窗口。",
  "error.snake_target": "只能救治允许的本夜原刀口，或明确弃药。",
  "error.raven_knife_unavailable": "当前不能使用狼鸦额外刀。",
  "error.raven_knife_target": "请选择其他合法存活号码，或明确保留。",
} as const satisfies Record<keyof typeof definition.parameters, string>;

export const en = {
  "prompt.status.eclipse": "Your swallowing record: {state}",
  "replay.stage.eclipse_swallowed": "Skill swallowed",
  "replay.stage.eclipse_native_suppressed": "Native skill suppressed",
  "replay.stage.eclipse_native_restored": "Native skill restored",
  "replay.stage.eclipse_lease_closed": "Borrowed authorization closed",
  "replay.stage.radiant_shelter_chosen": "Radiant shelter",
  "role.radiant_count.brief":
    "You are the Radiant Count, a good-side god. From night two, shelter one other living player or explicitly pass. Shelter blocks that night's ordinary wolf knife, poison and dream damage. You cannot shelter yourself or the same player on consecutive nights. If the Eclipse Maid swallows your skill, you have no native shelter action that night; suppression ends at dawn. Her borrowed choice does not change your previous target. A suppressed night is not a recorded pass. Borrowed shelter inherits the owner’s previous target and actual night number, without writing the borrower’s new choice back. After a suppressed night with no native action, you may choose your earlier target again.",
  "role.eclipse_maid.brief":
    "You are the Eclipse Maid, on the wolf side and sharing its victory. You know the other wolves, but they do not know you. You never join wolf chat or self-destruct. You gain the ordinary knife only when every other wolf was already dead at the actual start of the night. From night two, swallow one living good-side player or explicitly pass; you cannot swallow the same player on consecutive nights. The target loses their native skill for that night. You borrow its currently available state and act in its normal stage. Borrowed stocks are independent and never written back; old inspection results and prompt history are not copied. Borrowed potions use the current stock, at most one per night, with no self-heal; empty stock creates no borrowed potion turn. You are the caster and death-link owner of a borrowed dream, and borrowed shelter cannot protect yourself. Swallowing the Count or that night's sheltered player causes separate radiant backlash; swallowing and the borrowed skill still take effect. Dream protection can block backlash, while consecutive-dream and caster-death damage are resolved separately. Borrowed authorization ends at dawn. Borrowed shelter checks consecutive nights using the inherited previous target and actual night number; your use does not change the Count’s record. Borrowed dream inherits the owner’s previous dream target and actual night number. Repeating that target on consecutive nights is allowed and causes consecutive-dream damage; you cannot dream yourself.",
  "rules.radiant_eclipse":
    "This is AWA's twelve-player Radiant Eclipse version. The Count and Maid act from night two; shelter and swallowing each prohibit repeating their own target on consecutive nights. The Maid swallows first and temporarily suppresses the owner's native skill; shelter, dreams, wolf chat, the knife, potions and inspection follow. Borrowing snapshots only permitted current state, creates independent stock, copies no private history and writes nothing back. Borrowed potions allow one bottle, no self-heal and no refresh of spent stock. The Maid is the caster of a borrowed dream and its death link. Shelter blocks the knife, poison and dream damage. Swallowing the Count or a sheltered player causes backlash; dream protection blocks backlash, but consecutive dreams and caster-death links remain separate. Night-end closure removes temporary suppression and borrowed authorization without canceling submitted effects. An aborted night publishes no normal restoration, night deaths or victory. Shelter’s repeat restriction uses its retained or inherited previous target and actual night number. A suppressed native owner records no action, and borrowed choices are not written back; there is no global previous-night shelter target. Borrowed dream inherits the owner’s prior target and actual night number: consecutive targeting is allowed and causes its own dream damage, and the Maid cannot dream herself. Empty borrowed potion stock creates no borrowed turn; the native Witch keeps her existing empty-stock flow. The Maid knows the other wolves, but they do not know her identity. She never joins wolf chat or self-destructs, and gets the ordinary knife only when all other wolves were dead at the actual start of the night.",
  "action.cast_shelter.hint":
    "Call cast_shelter with target_id identifying another living player. Do not repeat this shelter skill’s retained or inherited target on consecutive actual nights; use null to explicitly pass.",
  "action.cast_shelter.directive": "Choose this night's shelter target or explicitly pass.",
  "action.swallow_skill.hint":
    "Call swallow_skill with target_id identifying a living good-side player who was not swallowed on the previous night; use null to explicitly pass.",
  "action.swallow_skill.directive": "Choose this night's swallow target or explicitly pass.",
  "stage.radiant_shelter": "Radiant shelter",
  "stage.eclipse_swallow": "Swallow skill",
  "error.radiant_shelter_unavailable": "Radiant shelter is unavailable now.",
  "error.radiant_shelter_target":
    "Shelter another living player without repeating this shelter skill’s retained or inherited target on consecutive actual nights.",
  "error.eclipse_swallow_unavailable": "Skill swallowing is unavailable now.",
  "error.eclipse_swallow_target":
    "Swallow a living good-side player, choosing a different target from the previous night.",
  "event.radiant_shelter_used": "{actor} shelters {target}.",
  "event.radiant_shelter_passed": "{actor} passes on shelter this night.",
  "event.eclipse_swallowed": "{actor} swallows {target}'s native skill.",
  "event.eclipse_swallow_passed": "{actor} passes on swallowing this night.",
  "event.eclipse_native_suppressed":
    "Your native skill is temporarily suppressed for this night; it returns at dawn.",
  "event.eclipse_native_restored": "This night's temporary suppression has ended.",
  "event.eclipse_lease_committed": "Borrowed authorization closed normally for night {day}.",
  "event.eclipse_lease_aborted": "Borrowed authorization closed after night {day} was aborted.",
  "ability.kind.shelter": "Radiant shelter",
  "death.radiant_backlash": "Radiant backlash",
  "replay.stage.alchemist_mist_chosen": "Mist choice",
  "replay.stage.alchemist_mist_skipped": "Skipped Mist request",
  "replay.stage.alchemist_snake_chosen": "Snake healing choice",
  "replay.stage.raven_unsealed": "Raven unsealed",
  "replay.stage.raven_knife_chosen": "Extra knife choice",
  "replay.stage.raven_knife_skipped": "Skipped extra knife request",
  "replay.stage.mist_knife_drawn": "Mist knife draw",
  "prompt.config.mist_raven_timing":
    "Mist/Raven timing: on every night when the Alchemist starts alive with Snake unspent, daytime speeches precede the private Snake decision and final night death announcement and commitment. On day one, sheriff election precedes those speeches. Use the ordinary night death order only when this condition is unmet. A daytime blast with a pending night first commits the blast death and badge, then Snake and pending night deaths, then victory. A completed healing window never reopens for a pre-vote blast. These are rule conditions, not disclosure of current charges.",
  "event.alchemist_mist_chosen": "Night {day}: player {actor} chose Mist targets: {targets}.",
  "event.alchemist_mist_skipped": "Night {day}: no Mist request for player {actor}: {reason}.",
  "event.alchemist_snake_chosen":
    "Before night {day} settlement: player {actor} chose Snake target: {target}.",
  "event.raven_unsealed":
    "Night {day}: Raven {actor} unsealed; known teammate snapshot: {teammates}.",
  "event.raven_knife_chosen": "Night {day}: player {actor} chose extra knife target: {target}.",
  "event.raven_knife_skipped": "Night {day}: no extra knife request for player {actor}: {reason}.",
  "event.mist_knife_drawn":
    "Night {day}: all pack voters explicitly passed. Mist candidates: {candidates}; engine-drawn target: {target}.",
  "mist.reason.dead": "dead",
  "mist.reason.spent": "charge spent",
  "mist.reason.no_targets": "no legal target",
  "mist.reason.sealed": "still sealed",
  "prompt.status.alchemist": "Your Alchemist charges and committed history: {state}",
  "death.raven_claw_knife": "Raven penetrating extra knife",
  "replay.stage.alchemist_mist": "Alchemist Mist",
  "replay.stage.alchemist_snake": "Snake healing",
  "replay.stage.raven_knife": "Raven extra knife",
  "prompt.stage.snake":
    "Original ordinary knife target: {target}. Legal healing target: {candidates}; an empty set still requires explicit target_id:null. Normally decide after speeches; a blast requires an immediate decision after actual death and badge handling.",
  "prompt.stage.raven_knife":
    "Extra knife candidates: {candidates}. Mist does not restrict this attack; self-targeting is forbidden; explicit null keeps it.",
  "request.summary.alchemist_snake": "Decide Snake healing for this pending night",
  "stage.alchemist_mist": "Alchemist Mist",
  "stage.alchemist_snake": "Snake healing",
  "stage.raven_knife": "Raven extra knife",
  "role.alchemist.brief":
    "You are the Alchemist, a good god. Mist and Snake each have one charge and can both be used for the same night. Before pack chat choose three distinct living players, including yourself or wolves, to restrict the ordinary pack knife; an explicit pass costs nothing. While Snake remains, normally after daytime speeches you privately learn the original pack target and may remove its ordinary knife damage. Self-healing is allowed only for night one; you may pay even if hidden protection already blocked the knife. Snake never removes Raven’s penetrating extra knife or consecutive dream damage. Night deaths are delayed only if you were alive at this night’s start with Snake unspent; otherwise use the ordinary order. A blast interrupts this schedule: its actual death and badge are committed first, then decide healing immediately using only information already available, settle full night deaths and judge victory.",
  "role.raven_claw_wolf.brief":
    "You are the Raven Claw Wolf. The pack recognizes you, but while sealed you know no teammates and cannot chat or cast the ordinary knife vote. You can never self-destruct. You permanently unseal only at a real night start with fewer than three living wolves, learning only teammates alive then; keep their identities if they later die without receiving earlier dead identities or old chat. Once unsealed join ordinary pack chat and voting. You also have one optional independent extra knife against another living original body, even outside Mist. It penetrates this board’s dream protection and Snake, but killing the Dreamer still causes the genuine dream link.",
  "action.cast_mist.hint":
    "cast_mist: target_ids is three distinct living player IDs, or null for an explicit pass.",
  "action.cast_mist.directive":
    "Submit cast_mist exactly once. Yourself and wolves are legal; a missing response is not a pass.",
  "action.use_snake.hint":
    "use_snake: target_id is this pending night’s original ordinary knife target, or null to pass.",
  "action.use_snake.directive":
    "Normally decide privately after daytime speeches. If a blast interrupts, decide immediately after its actual death and badge handling, using only information already available. Choose the legal original knife target or explicit null; no legal target still requires a pass.",
  "action.raven_knife.hint":
    "raven_knife: target_id is another living player, or null to keep the extra knife.",
  "action.raven_knife.directive":
    "The extra knife ignores Mist. Explicit null keeps the charge; self-targeting is forbidden.",
  "error.mist_unavailable": "Mist is unavailable for this turn.",
  "error.mist_target": "Choose exactly three distinct legal living IDs, or explicitly pass.",
  "error.snake_unavailable": "The unique Snake healing window is not open.",
  "error.snake_target": "Heal only the allowed original knife target, or explicitly pass.",
  "error.raven_knife_unavailable": "The Raven extra knife is unavailable.",
  "error.raven_knife_target": "Choose another legal living player, or explicitly keep the charge.",
} satisfies Record<keyof typeof definition.parameters, string>;

export const messages = { definition, zhCN, en };
