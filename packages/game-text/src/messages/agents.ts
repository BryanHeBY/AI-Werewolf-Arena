/**
 * 负责 Agent 的行动提示、候选说明、重试／fallback 文案及 SDK／ACP 提交指引。
 * 输入为已有消息 ID 与中性占位参数声明；输出为 agents 家族的两语模板供提示政策／观察器使用。
 * 文字可以说明回合约束，但不拥有 turn、会话或提交权限；实际限制由请求／工具所有者执行，
 * 玩家姓名与原文作为参数由共享格式化器保留，不在此翻译或生成游戏事实。
 */
import type { MessageDefinition } from "./definition";

// parameters 定义本家族拥有的 key 及排序后的唯一参数名；空数组是明确无插值，不是遗漏声明。
export const definition = {
  owner: "agents",
  parameters: {
    "prompt.system.players": ["players"],
    "prompt.known_public_facts": ["facts"],
    "prompt.status.animal": ["state"],
    "prompt.config.body_nonconsecutive": [],
    "prompt.config.body_repeat": [],
    "prompt.status.raven": ["state"],
    "prompt.stage.wolf_kill_candidates": ["candidates"],
    "prompt.stage.mist": ["candidates"],
    "prompt.status.lover": ["partner"],
    "error.turn_invalid_action_limit": [],
    "error.action_turn_failed": [],
    "prompt.stage.wolf_targets": ["targets"],
    "prompt.config.knight_windows": ["windows"],
    "request.summary.knight_duel": [],
    "prompt.status.day": ["day"],
    "error.tool_mismatch": [],
    "request.summary.exile_pk": [],
    "prompt.config.sheriff_pk": [],
    "prompt.config.sheriff_direct": [],
    "prompt.config.exile_pk": [],
    "prompt.config.exile_direct": [],
    "turn.minimum": ["count"],
    "turn.maximum": ["count"],
    "turn.required_tools": ["tools"],
    "turn.system": ["max", "min"],
    "turn.user": ["max", "min", "required"],
    "turn.required_suffix": ["tools"],
    "prompt.system.identity": ["actor", "role"],
    "prompt.system.goal": [],
    "prompt.system.language": [],
    "prompt.system.name": ["name"],
    "prompt.system.teammates": ["teammates"],
    "prompt.system.ids": ["max"],
    "prompt.system.boundaries": [],
    "prompt.system.personality": ["personality"],
    "prompt.system.custom_instructions": ["instructions"],
    "prompt.system.inspection": [],
    "prompt.system.events": [],
    "prompt.system.facts": [],
    "prompt.system.speaking_style": [],
    "prompt.system.tools": [],
    "prompt.system.confidential": [],
    "prompt.system.reports": [],
    "prompt.user.speech": [],
    "prompt.user.speech_public": [],
    "prompt.user.speech_wolves": [],
    "prompt.user.speech_partner": [],
    "prompt.user.speech_brew": [],
    "prompt.user.no_speech": [],
    "prompt.user.required": [],
    "prompt.user.optional": [],
    "prompt.user.turn": ["actor", "context", "phase", "speech", "stage"],
    "prompt.user.rules": ["rules", "status"],
    "prompt.user.actions": ["constraint", "effective", "tools"],
    "prompt.user.arguments": ["hints", "submission", "targets", "usage"],
    "prompt.user.submit": [],
    "prompt.board.title": [],
    "prompt.board.size": ["count"],
    "prompt.board.lineup": ["lineup"],
    "prompt.board.skills": ["skills"],
    "prompt.retry.first": ["attempt", "max"],
    "prompt.retry.second": ["attempt", "max"],
    "prompt.retry.last": ["attempt", "max"],
    "prompt.retry.optional": ["attempt", "max"],
    "prompt.sdk.submit": ["turn"],
    "prompt.acp.submit": ["turn"],
    "prompt.acp.events": ["events"],
    "prompt.acp.turn": ["turn"],
    "prompt.stage.default": [],
    "prompt.status.private": ["state"],
    "prompt.status.wolf_teammates": ["teammates"],
    "prompt.status.idiot": [],
    "prompt.stage.sheriff_timing": [],
    "prompt.stage.sheriff_nomination": [],
    "prompt.stage.sheriff_withdraw": [],
    "prompt.stage.sheriff_vote": [],
    "prompt.stage.sheriff_vote_pk_first": [],
    "prompt.stage.sheriff_vote_pk_second": [],
    "prompt.stage.blast_only": ["tool"],
    "prompt.stage.wolf_target": ["target"],
    "prompt.stage.no_wolf_target": [],
    "prompt.stage.unknown_wolf_target": [],
    "prompt.targets.none": [],
    "prompt.targets.self": ["ids"],
    "prompt.targets.others": ["ids"],
    "prompt.config.title": [],
    "prompt.config.win": ["rules"],
    "prompt.config.sheriff": ["rules"],
    "prompt.config.sheriff_enabled": ["weight"],
    "prompt.config.night_before_sheriff": [],
    "prompt.config.sheriff_timing": [],
    "prompt.config.blast": ["rules"],
    "prompt.config.blast_enabled": ["windows"],
    "prompt.config.self_heal": ["rules"],
    "prompt.config.self_heal_always": [],
    "prompt.config.self_heal_first": [],
    "prompt.config.self_heal_disabled": [],
    "prompt.config.disclosure_open": [],
    "prompt.config.last_words_2017": [],
    "prompt.config.disclosure": [],
    "prompt.config.last_words": [],
    "prompt.config.ties": ["exile", "sheriff", "wolf"],
    "prompt.config.sheriff_tie": ["tie"],
    "tool.unknown_error": ["code"],
    "error.turn_not_open_or_session_invalid": [],
    "tool.turn_id_mismatch_context": ["tool", "turn"],
    "error.tool_not_allowed_in_this_turn": [],
    "error.invalid_tool_arguments": [],
    "error.turn_constraints_max_actions_exceeded": [],
    "error.turn_constraints_not_satisfied": [],
    "error.turn_id_mismatch": [],
    "request.summary.night_action": [],
    "request.summary.day_speech": [],
    "request.summary.exile_vote": [],
    "request.summary.death_shot": [],
    "request.summary.last_words": [],
    "request.summary.sheriff_nomination": [],
    "request.summary.sheriff_campaign": [],
    "request.summary.sheriff_withdraw": [],
    "request.summary.sheriff_vote": [],
    "request.summary.sheriff_direction": [],
    "request.summary.self_destruct_pre_vote": [],
    "request.summary.self_destruct": [],
    "request.retry.exile_vote": [],
    "request.retry.wolf_vote": [],
    "fallback.speech": ["actor"],
    "fallback.last_words": ["actor"],
    "fallback.wolf_chat": [],
    "request.summary.badge_choice": [],
    "prompt.config.badge_next": [],
    "prompt.config.badge_choice": [],
  },
} as const satisfies MessageDefinition;

export const zhCN = {
  "prompt.known_public_facts":
    "截至当前上帝已公布的局面：{facts}。这是已收到的公开公告摘要，不包含你的私有知识或玩家声明；roleReveals记录公告当时的身份，lastAnnouncedBadge记录最后公布的警徽归属。",
  "prompt.system.players":
    "公开玩家名册：{players}。编号与昵称对应，允许用昵称交流；工具行动必须使用玩家 ID。",
  "prompt.status.animal": "你的已公布动物角色知情：{state}。尚未公布的后台效果不是玩家知识。",
  "prompt.config.body_nonconsecutive":
    "秘密之身不能连续两夜主动指定同一人；明确null打断连续，自动自护不改主动目标。",
  "prompt.config.body_repeat": "秘密之身允许连续主动保护同一人（AWA重复保护变体）。",
  "prompt.status.raven": "你的封印、额外刀资源与已知队友快照：{state}",
  "prompt.stage.wolf_kill_candidates":
    "本夜普通狼刀合法候选：{candidates}。这些是候选，并不表示已被刀或死亡。只能在候选中投刀，或明确弃刀；有雾时全员明确弃刀将由引擎抽签。",
  "prompt.stage.mist":
    "未明之雾可选存活号码：{candidates}。选三个不同号码（可含自己和狼人），或明确 null 保留。",
  "prompt.status.lover":
    "你的伴侣是{partner}号，仅互认编号，不知底牌或阵营。殉情禁死亡技能，保留原生能力。",
  "error.turn_invalid_action_limit": "三次非法行动提交已关闭本回合。",
  "error.action_turn_failed": "行动回合失败，不能记作合法等待。",
  "prompt.stage.wolf_targets": "今晚实际狼刀目标：{targets}。解药至多救一人。",
  "prompt.config.knight_windows":
    "骑士窗口：{windows}。发言间隙包含最后一位发言后；同时启用间隙和发言后窗口时，最后间隙→发言后依次是两个独立窗口。天亮/间隙自爆先于对应决斗；发言后决斗先于进入Voting及其自爆窗口。骑士纯决斗失误先有本人遗言，再继续正常白天。",
  "request.summary.knight_duel": "可选择决斗或不行动，不消耗机会等待后续窗口。",
  "prompt.status.day": "当前日次：第{day}天。",
  "error.tool_mismatch": "非法操作，工具不匹配",
  "request.summary.exile_pk": "平票玩家进行一次PK发言，随后由其他合格玩家重投。",
  "prompt.config.sheriff_pk":
    "AWA警长策略：首轮只有未上警者投票，唯一候选直接当选；平票一次PK，PK者不投，第二次平票或全弃票无徽。",
  "prompt.config.sheriff_direct":
    "AWA警长策略：最终候选人之外的合格玩家投票，平票按本局直接决议策略。",
  "prompt.config.exile_pk":
    "AWA放逐策略：最高正票平票时一次PK；PK者不参与重投，仅投仍合格PK目标，再平票或全弃票不放逐。",
  "prompt.config.exile_direct": "AWA放逐策略：直接按本局平票策略决议。",
  "turn.minimum": "本轮至少需要完成{count}次有效行动。",
  "turn.maximum": "本轮最多允许{count}次有效行动。",
  "turn.required_tools": "结束前必须至少执行以下工具之一：{tools}",
  "turn.system": "本轮行动约束：至少{min}次、至多{max}次有效行动。",
  "turn.user": "本轮结束前需满足：最少{min}次、最多{max}次有效行动{required}。",
  "turn.required_suffix": " 且需命中工具：{tools}",
  "prompt.system.identity":
    "你正在参加一局狼人杀，座位编号是{actor}号。现在告知你的真实身份是{role}。如果随后发生身份或能力变化，以最新行动提示告知你的当前身份、阵营、可用能力和剩余次数为准；旧身份介绍只作历史，不代表仍能使用旧技能。收到“[行动提示]”后再进行本轮行动。",
  "prompt.system.goal":
    "争取达成本局规则赋予你的个人胜利目标。通常你随所属阵营获胜；若混血、孤独少女、情侣或其他特殊关系改变了个人胜利归属，则遵循本局对应规则，不把真实阵营等同于胜利归属，也不把对秘密归属的猜测当作已知事实。基于自己可见的信息自主判断、博弈、试探和调整策略，不要为了迎合多数而放弃独立判断。",
  "prompt.system.language": "你必须使用中文进行思考和表达。",
  "prompt.system.name": "你的昵称是{name}。可以用编号或昵称交流；提交行动始终使用玩家 ID。",
  "prompt.system.teammates":
    "本会话建立时，规则告知你的队友（不含你自己）的编号：{teammates}。后续授权名单以每轮行动提示为准。“无”仅表示没有额外公开给你的队友身份，不表示你的阵营中只有你一人。",
  "prompt.system.ids":
    "你只能引用本局存在的玩家编号，编号范围是1到{max}，严禁虚构不存在的玩家编号。",
  "prompt.system.boundaries":
    "阶段规则、可用工具与回合约束是不可违反的行动边界；在边界内由你自主决定策略和表达。",
  "prompt.system.personality": "你的性格与发言风格要求：{personality}",
  "prompt.system.custom_instructions": "你的自定义指令：{instructions}",
  "prompt.system.inspection":
    "预言家只查验本板规则规定的阵营标签：普通规则下，金水可能是任意好人角色（如女巫、猎人、守卫），并不等同于平民身份；特殊角色的伪装标签按本板规则解释，查验不会改变真实身份或阵营。事件中存在 result 时，以 result.kind 对应的完整结果为准：camp 为阵营标签，role 为身份标签，combined 为两者。isWerewolf 是旧兼容字段，false 不等于好人，不能覆盖 third_party 或具体身份结果。",
  "prompt.system.events":
    '你可见的对局事实会以 {"event":[seq,type,payload]} JSON 事件提供，ACP 模式可能一次提供 {"events":[[seq,type,payload],...]}。它们已经按你的身份完成可见性过滤；seq 只是你可见事件中的连续顺序号，不代表全局事件位置。按 seq 顺序理解，不要把协议字段当作玩家发言。',
  "prompt.system.facts":
    "按来源理解消息：上帝公开公告是所有玩家已获知的结果；只发给你的身份、查验或技能反馈是你的私有知识，不代表其他人也知道。day_speech、wolf_discussion、last_words_spoken 等事件中的 text 是玩家陈述，可能包含谎言、诈身份或误判，不能改写已知事实。只有收到 night_resolved 才能确认昨夜公开结果；其 payload.deaths 是初始夜间公开死亡名单，空数组仅表示该初始批次平安。additional_deaths 和成功的公开枪击可确认后续追加死亡；death_shot_blocked 表示落空，不能当作击杀。phase_changed 进入白天只表示阶段切换，不表示有人死亡或出现平安夜。结果尚未出现表示尚未获知，不能据缺席推断结果。狼刀投票只表示刀口选择，不能证明目标最终死亡；工具受理或接受提交也不等于技能已经结算，更不是上帝向全场公开认证了身份。",
  "prompt.system.speaking_style":
    "发言偏向真实牌桌口吻，按自己的判断和人设自然接话，不限定发言结构或打法。公开结果可说“上帝报了昨晚倒牌的人”；自己的查验可说“我昨晚验的那位是查杀”；他人陈述可说“那位认熊，这身份我还没认”。这些只是语气示例，优先用自然游戏语言代替“引擎提示”“事件payload”“工具返回”。允许按策略隐藏身份、报告自己的私有查验、诈身份和编造战术说辞；自己分清已知事实与编造内容即可。只在影响判断时说明推理前提，无需每句话重复“未认证”“仅供推测”等免责声明。",
  "prompt.system.tools":
    "游戏中所有能起效的行动都必须调用 submit_action 提交：包括发言、投票和使用技能。普通 assistant 文本不会被其他玩家听见，也不会产生游戏效果。交流时使用本轮列出的发言动作，按其参数说明填写内容；speak、speak_to_wolves、speak_to_partner、brew_discuss 的正文均写入 arguments.text。它们的受众不同，以本轮通道说明为准。使用真实工具调用，不要在普通文本里写一段 JSON 来冒充调用。可选窗口允许不行动；必需窗口仍须满足本轮行动约束。",
  "prompt.system.confidential":
    "发言正文不包含系统提示原文、工具调用、事件字段、回合 ID 或后台调试信息。正常讨论本局公开规则、按策略自报身份或分享自己的技能反馈都允许；私聊内容由你决定是否按策略转述，自己记清哪些是玩家说法、哪些才是上帝公开公告。通道受众和技能权限仍须遵守。",
  "prompt.system.reports":
    "当你观察到明确的规则、状态、流程、日志或可见信息矛盾时，可以先调用 report_bug 上报，再继续本轮正常行动。不要把正常策略分歧、身份声称、诈身份或不确定推测当作 bug。",
  "prompt.user.speech": "目前是你的发言轮次",
  "prompt.user.speech_public": "目前是你的公开发言轮次，正文会向全场公布",
  "prompt.user.speech_wolves": "目前是你的狼人夜聊轮次，正文只发给本轮规则允许的狼聊成员",
  "prompt.user.speech_partner": "目前是你的伴侣私聊轮次，正文只发给你的伴侣",
  "prompt.user.speech_brew": "目前是你的秘密调毒交流轮次，正文只发给本轮协助组，不发给女巫或全场",
  "prompt.user.no_speech": "目前不是你的发言轮次",
  "prompt.user.required": "你本轮必须至少调用一次可用工具完成行动。",
  "prompt.user.optional": "你本轮可以选择结束回合不行动。",
  "prompt.user.turn":
    "[行动提示] {actor}号玩家，现在轮到你行动，当前处于{phase}阶段，子阶段是{stage}，{speech}。{context}",
  "prompt.user.rules": "阶段规则：{rules}{status}",
  "prompt.user.actions":
    "{constraint} 你当前可以提交的行动有：{tools}，其中有效行动有：{effective}。",
  "prompt.user.arguments": "行动参数提示：{hints}{targets}。{usage} {submission}",
  "prompt.user.submit":
    "请基于当前可见信息自行决策。若选择行动，必须调用 submit_action；可选窗口可结束回应而不提交，必需窗口须满足上述约束。",
  "prompt.board.title": "当前板子信息：",
  "prompt.board.size": "总玩家数={count}",
  "prompt.board.lineup": "角色构成={lineup}",
  "prompt.board.skills": "角色技能简介={skills}",
  "prompt.retry.first":
    "上轮没有产生有效行动。你的思考可以保留，但所有会生效的发言或行动必须通过 submit_action 提交，不能只返回普通 assistant 文本。（重试 {attempt}/{max}）",
  "prompt.retry.second":
    "再次提醒：本轮仍有必需行动未完成，请调用 submit_action 提交。交流时选本轮允许的发言动作，正文放入该动作规定的文本参数；普通 assistant 文本不会生效。（重试 {attempt}/{max}）",
  "prompt.retry.last":
    "最后提醒：本轮必需行动仍未完成；若仍没有有效 submit_action，将按本轮失败策略处理。请提交所需行动，普通 assistant 文本不能代替行动。（重试 {attempt}/{max}）",
  "prompt.retry.optional":
    "本次行动提交未通过校验，不能当作合法等待。若仍要行动，请根据工具反馈修正后用 submit_action 提交；本轮是可选窗口，不想行动可结束回应而不再提交。此前非法提交仍会计入失败判定，结束回应不会清除错误或自动确认待确认的自爆。（重试 {attempt}/{max}）",
  "prompt.sdk.submit":
    "若选择行动，通过 submit_action 提交，turn_id 必须为 {turn}，action 必须是本轮列出的有效行动名，arguments 填该行动的参数。可选窗口可不提交，必需窗口须满足本轮约束。自爆提案只进入待确认，必须阅读警示并按返回要求再次明确确认才生效。可先调用 report_bug 上报明确矛盾，其 turn_id 同样必须为 {turn}；无需调用 get_game_schema。",
  "prompt.acp.submit":
    "若选择行动，调用 MCP 服务 werewolf-game 的 submit_action，不要直接调用上面列出的动作名。turn_id 必须为 {turn}，action 必须是本轮列出的动作名，arguments 填该动作的参数。可选窗口可不提交，必需窗口须满足本轮约束。自爆提案只进入待确认，必须阅读警示并按返回要求再次明确确认才生效。若发现明确矛盾，可先调用 report_bug，再继续正常决策。无需查询 get_game_schema；普通文本不会产生游戏效果。",
  "prompt.acp.events": "新增可见事件：{events}",
  "prompt.acp.turn": "当前回合 ID：{turn}",
  "prompt.stage.default": "请严格区分当前阶段职责，只执行本轮工具对应动作。",
  "prompt.status.private": "你的私有状态：{state}",
  "prompt.status.wolf_teammates":
    "本轮规则告知你的狼人队友编号（不含本人）：{teammates}。此前获知的身份属于历史信息，不因本轮名单改变而消失。",
  "prompt.status.idiot":
    "状态提醒：你已经翻牌为白痴并在先前的放逐中免死。仍可发言，但不可投票、再被放逐、竞选警长或持有警徽。",
  "prompt.stage.sheriff_timing":
    "首日警长流程发生在昨夜结果公开之前：此时尚未通过 night_resolved 公布死亡或平安夜，任何玩家仍能参与上警都不能证明其最终存活。不要根据狼人刀口、进入白天、结果尚未播报或其他玩家的说法，擅自断定昨夜结果。",
  "prompt.stage.sheriff_nomination":
    "这是上警报名阶段，不是退水阶段：run=true 表示报名上警，run=false 表示不上警；所有玩家的报名基于同一信息快照并行收集。",
  "prompt.stage.sheriff_withdraw":
    "这是警上发言结束后的退水阶段：run=true 表示继续竞选，run=false 表示退水；候选人的决定基于同一信息快照并行收集。",
  "prompt.stage.sheriff_vote":
    "这是警长直接决议投票：最终候选人之外的合格玩家可投票，包括已退水者。只能投给当前最终候选人或弃票；所有票基于同一信息快照并行收集。",
  "prompt.stage.sheriff_vote_pk_first":
    "这是警长首轮投票：只有最初没有上警的合格玩家可投票，退水者也不参与。本轮只能投给最终候选人或弃票；所有票基于同一信息快照并行收集。",
  "prompt.stage.sheriff_vote_pk_second":
    "这是警长PK重投：只有本轮PK候选人之外的合格玩家可投票。只能投给当前仍合格的PK候选人或弃票；再次平票或全弃票不产生警长。所有票基于同一信息快照并行收集。",
  "prompt.stage.blast_only":
    "这是公开自爆窗口，只有 {tool} 会改变对局；发言、投票和其他行动都不允许。若不自爆，直接结束本次回应，不提交行动。report_bug 只报告问题。",
  "prompt.stage.wolf_target": "当前已知本夜刀口是{target}号。",
  "prompt.stage.no_wolf_target": "当前已知本夜刀口为空（可能空刀或平票）。",
  "prompt.stage.unknown_wolf_target": "当前未获得明确刀口信息。",
  "prompt.targets.none": "可行动ID：无",
  "prompt.targets.self": "可行动ID（含你自己）：{ids}",
  "prompt.targets.others": "可行动ID（存活且不含你自己）：{ids}",
  "prompt.config.title": "本局规则配置：",
  "prompt.config.win": "胜利条件：{rules}",
  "prompt.config.sheriff": "警长机制：{rules}",
  "prompt.config.sheriff_enabled":
    "启用（包含上警、竞选发言、退水和按本局政策进行的投票；警长决定发言方向；警长票权={weight}）。无人上警、所有候选退水，或需要投票时没有有效警长票，均不产生警长；退水候选不会自动恢复。采用PK政策且只剩唯一候选时直接当选，无需投票。",
  "prompt.config.night_before_sheriff":
    "本板先完成夜间死亡结算，再开始白天与首日警长选举；已出局玩家不参加选举。",
  "prompt.config.sheriff_timing":
    "首日特殊时序：夜间行动结束后先进行上警报名、警上发言、退水和警下投票；警长投票结束后，才由 night_resolved 公布昨夜死亡或平安夜，再处理首夜遗言、警长定序和常规白天发言。昨夜实际死亡的玩家在公开结算前仍会参与上警流程。",
  "prompt.config.blast": "自爆机制：{rules}",
  "prompt.config.blast_enabled": "启用（窗口：{windows}）",
  "prompt.config.self_heal": "女巫自救：{rules}",
  "prompt.config.self_heal_always": "一直允许",
  "prompt.config.self_heal_first": "仅首夜允许",
  "prompt.config.self_heal_disabled": "不允许",
  "prompt.config.disclosure_open":
    "公开裁定（网易2017明牌条款）：真正结算死亡后，player_role_revealed向全体确认该玩家当前身份牌；不公开阵营、胜利归属、复制/赠予能力、资源或私有历史。夜间待死不提前翻牌，发言自报身份不属于引擎认证。",
  "prompt.config.last_words_2017":
    "遗言规则（网易2017条款）：全部白天/投票死亡，包括自爆和追加死亡波次，以及全部首夜死亡均有遗言；后续夜死无遗言。夜源枪击/牵连仍算夜死，白痴翻牌免死无遗言；本参数不更改开枪资格或判胜时点。",
  "prompt.config.disclosure":
    "公开裁定：普通夜间死亡和放逐出局均不公开底牌；仅以 idiot_revealed 等引擎事件明确公开的身份，以及个人收到的私有身份/查验事件为事实。玩家在发言或遗言中自报身份不属于引擎认证。",
  "prompt.config.last_words":
    "遗言规则：首夜死亡者、真正被放逐出局者、白天纯决斗失误的骑士获得遗言；后续夜死、自爆、白痴翻牌免死、死亡枪（猎人/狼王）、决斗成功目标与白狼王带走的目标均无遗言。同一玩家兼有首夜待死和白狼王带人来源时无遗言；同波其它纯首夜死亡照常授予。",
  "prompt.config.ties": "平票处理：放逐={exile}，狼刀={wolf}{sheriff}",
  "prompt.config.sheriff_tie": "，警长投票={tie}",
  "tool.unknown_error": "工具调用失败：{code}",
  "error.turn_not_open_or_session_invalid":
    "本回合未开放或会话不匹配；请仅使用当前会话最新行动提示中的turn_id。",
  "tool.turn_id_mismatch_context": "当前回合仍开放。请将 turn_id 改为 {turn}，重新调用 {tool}。",
  "error.tool_not_allowed_in_this_turn":
    "该行动不在本回合允许列表中；请使用最新行动提示列出的行动。",
  "error.invalid_tool_arguments": "行动参数无效；请根据当前行动参数提示修正后重新提交。",
  "error.turn_constraints_max_actions_exceeded": "本回合已经接受有效行动，不再接受额外行动。",
  "error.turn_constraints_not_satisfied":
    "尚未满足本回合行动约束；请查看details并提交符合要求的行动。",
  "error.turn_id_mismatch":
    "所提供的turn_id不匹配；本回合仍开放，请使用最新行动提示中的turn_id重新提交。",
  "request.summary.night_action": "夜间行动阶段需完成一次有效动作。",
  "request.summary.day_speech": "白天发言阶段必须完成一次发言动作。",
  "request.summary.exile_vote": "放逐投票阶段必须完成一次投票动作（可弃票）。",
  "request.summary.death_shot": "死亡开枪阶段必须完成一次开枪动作。",
  "request.summary.last_words": "遗言阶段必须完成一次发言动作。",
  "request.summary.sheriff_nomination": "上警声明阶段必须明确是否报名上警。",
  "request.summary.sheriff_campaign": "警上竞选发言阶段必须完成一次发言。",
  "request.summary.sheriff_withdraw": "退水阶段必须明确是否继续竞选。",
  "request.summary.sheriff_vote": "警长投票阶段必须完成一次投票（可弃票）。",
  "request.summary.sheriff_direction": "警长定序阶段必须选择发言方向。",
  "request.summary.self_destruct_pre_vote": "放逐前自爆窗口可选择执行自爆，也可结束回合。",
  "request.summary.self_destruct": "自爆窗口可选择执行自爆，也可直接结束回合。",
  "request.retry.exile_vote": "你的投票动作无效，请通过 submit_action 提交修正后的 vote 行动。",
  "request.retry.wolf_vote": "你的狼刀动作无效，请通过 submit_action 提交修正后的 kill_vote 行动。",
  "fallback.speech": "我是{actor}号，先听后位发言再判断。",
  "fallback.last_words": "遗言：我是{actor}号，以上是我最后的信息，供大家参考。",
  "fallback.wolf_chat": "今晚优先刀信息位。",
  "request.summary.badge_choice": "选择名单内继任者，或用null撕毁警徽。",
  "prompt.config.badge_next":
    "警徽：出局后按存活座位顺序自动移交；白痴翻牌直接撕毁。不提供原警长自行选择移交目标的行动。",
  "prompt.config.badge_choice": "警徽：死亡持有者选择合格活人继任或撕毁；白痴翻牌直接撕毁。",
} as const satisfies Record<keyof typeof definition.parameters, string>;

export const en = {
  "prompt.known_public_facts":
    "The situation announced by the moderator so far: {facts}. This summarizes public announcements you have received, not your private knowledge or player claims. roleReveals records roles at the time of announcement; lastAnnouncedBadge records the last announced badge holder.",
  "prompt.system.players":
    "Public player roster: {players}. Nicknames may be used in conversation; actions must use player IDs.",
  "prompt.status.animal":
    "Your published animal-role knowledge: {state}. Unpublished backend effects are not player knowledge.",
  "prompt.config.body_nonconsecutive":
    "Secret Body cannot actively choose the same target on consecutive nights. Explicit null breaks the sequence; automatic self-protection does not change the active target.",
  "prompt.config.body_repeat":
    "Secret Body may actively protect the same player on consecutive nights (AWA repeat variant).",
  "prompt.status.raven": "Your seal, extra knife charge and known teammate snapshot: {state}",
  "prompt.stage.wolf_kill_candidates":
    "Legal ordinary pack knife candidates tonight: {candidates}. These are candidates, not confirmed attacks or deaths. Vote within this list or explicitly pass; with Mist, all explicit passes cause an engine draw.",
  "prompt.stage.mist":
    "Living Mist candidates: {candidates}. Choose three distinct IDs, which may include yourself or wolves, or explicit null to keep the charge.",
  "prompt.status.lover":
    "Your partner is player {partner}; recognition grants no role or faction information. Heartbreak suppresses death abilities; original abilities remain.",
  "error.turn_invalid_action_limit": "Three invalid action submissions have closed this turn.",
  "error.action_turn_failed": "The action turn failed and cannot count as a legal wait.",
  "prompt.stage.wolf_targets":
    "Actual wolf attack targets tonight: {targets}. Healing can rescue at most one player.",
  "prompt.config.knight_windows":
    "Knight windows: {windows}. Between-speech windows include the final speaker; when both between- and after-speech windows are enabled, the final gap and then the after-speech slot are two separate windows. Public blasts at daybreak/between speeches precede the corresponding duel; the after-speech duel precedes entering Voting and its self-destruct window. A pure Knight duel failure grants that Knight last words before normal daytime continues.",
  "request.summary.knight_duel":
    "Choose a duel or skip without spending the opportunity until a later window.",
  "prompt.status.day": "Current game day: {day}.",
  "error.tool_mismatch": "Invalid action: tool mismatch",
  "request.summary.exile_pk":
    "Tied players give one PK speech each; other eligible players then vote again.",
  "prompt.config.sheriff_pk":
    "AWA sheriff policy: only non-nominees vote first; a sole candidate wins directly. One PK on a tie; PK candidates cannot vote. Another tie or all abstentions leaves no badge.",
  "prompt.config.sheriff_direct":
    "AWA sheriff policy: eligible players outside the final candidate list vote; configured direct tie resolution applies.",
  "prompt.config.exile_pk":
    "AWA exile policy: one PK after a positive top-vote tie; PK candidates cannot revote, only remaining eligible PK candidates may be targeted. Another tie or all abstentions means no exile.",
  "prompt.config.exile_direct": "AWA exile policy: configured direct tie resolution applies.",
  "turn.minimum": "This turn requires at least {count} valid actions.",
  "turn.maximum": "This turn allows at most {count} valid actions.",
  "turn.required_tools": "Before ending, perform at least one of these tools: {tools}",
  "turn.system": "Turn constraints: at least {min} and at most {max} valid actions.",
  "turn.user": "Before ending, provide at least {min} and at most {max} valid actions{required}.",
  "turn.required_suffix": "; at least one must use: {tools}",
  "prompt.system.identity":
    "You are taking part in a game of Werewolf, in seat {actor}. Your true role when this session begins is {role}. If your identity or abilities later change, follow the current identity, alignment, available abilities and remaining uses disclosed in the latest action prompt. An earlier role introduction is history and does not let you use an old ability. Wait for [Action prompt] before taking your turn.",
  "prompt.system.goal":
    "Aim to meet the personal victory conditions assigned by this game's rules. Usually you win with your alignment; if Hybrid, Lonely Girl, lovers or another special relationship changes your victory affiliation, follow that rule. True alignment and victory affiliation are not always the same. Treat a guess about hidden affiliation as a guess, not disclosed knowledge. Use information visible to you to judge, negotiate, probe and adjust your strategy. Keep your own judgment even when the majority disagrees.",
  "prompt.system.language": "Use English for your reasoning and expression.",
  "prompt.system.name":
    "Your nickname is {name}. Use numbers or nicknames in conversation; always submit actions using player IDs.",
  "prompt.system.teammates":
    "Teammates whose identities are revealed when this session is established, excluding yourself: {teammates}. Use each turn's action prompt for updated authorization. None means no additional teammate identity is revealed, not that you are the only member of your team.",
  "prompt.system.ids":
    "Only refer to player IDs that exist in this game, from 1 to {max}. Do not invent other IDs.",
  "prompt.system.boundaries":
    "Follow phase rules, allowed tools and turn constraints. Choose your strategy and expression within those boundaries.",
  "prompt.system.personality": "Your personality and speaking style: {personality}",
  "prompt.system.custom_instructions": "Your custom instructions: {instructions}",
  "prompt.system.inspection":
    "A Seer inspects the alignment label defined by this board: under ordinary rules, a good result can be any good role, such as Witch, Hunter or Guard, and does not prove Villager identity. Interpret disguised labels under the board's role rules; an inspection does not change real identity or alignment. When an event has result, use the complete result according to result.kind: camp is an alignment label, role is an identity label, and combined reveals both. isWerewolf is a legacy field; false does not mean Good and cannot override third_party or a specific identity result.",
  "prompt.system.events":
    'Visible game facts arrive as JSON {"event":[seq,type,payload]}; ACP may batch them as {"events":[[seq,type,payload],...]}. Visibility has already been filtered for your identity. seq is consecutive within your visible events and does not reveal the global event position. Read in seq order; protocol fields are not player speech.',
  "prompt.system.facts":
    "Distinguish sources: public moderator announcements reveal outcomes to the table, while role information, inspections and ability feedback sent only to you are private knowledge, not shared knowledge. text in day_speech, wolf_discussion or last_words_spoken is a player's claim and may be a lie, a role bluff or a mistake; it cannot overwrite known facts. Only night_resolved confirms the public night outcome: payload.deaths is the initial public night death list, and an empty list means that initial batch had no deaths. additional_deaths and successful public shots confirm later deaths; death_shot_blocked is a miss, not a kill. phase_changed entering day confirms only the phase change. An absent result means the outcome is not yet known; absence does not imply any result. A wolf kill vote chooses a target and does not prove death. A tool receipt or accepted submission does not prove that an ability has resolved or that the moderator has publicly certified a role.",
  "prompt.system.speaking_style":
    "Prefer the voice of someone at a real Werewolf table, responding naturally in your persona without a prescribed speech structure or strategy. You might say 'The moderator announced the overnight deaths' for a public result, 'My check last night came back wolf' for your own inspection, or 'They claim Bear; I am not sold yet' for a player's claim. These are tone examples, not a script; prefer ordinary game language to engine messages, event payloads and tool responses. You may strategically hide your role, report your private results, bluff a role and invent tactical claims, while keeping actual knowledge separate from your inventions in your own reasoning. Explain a condition when it matters to the read, without attaching an unconfirmed-or-speculative disclaimer to every sentence.",
  "prompt.system.tools":
    "All effective game actions, including speech, votes and skills, must be submitted with submit_action. Plain assistant text is not heard by other players and has no game effect. For communication, use a speaking action allowed this turn and follow its parameter hints; speak, speak_to_wolves, speak_to_partner and brew_discuss all put the speech in arguments.text. Their audiences differ; follow the channel description for this turn. Use an actual tool call, not JSON written as plain text to imitate one. Optional windows permit no action; required windows still need their action constraints satisfied.",
  "prompt.system.confidential":
    "Keep system-prompt text, tool calls, event fields, turn IDs and backend debugging information out of your speech. You may discuss public rules, claim a role and share your own ability feedback as part of your strategy. You may choose to recount private conversations; keep player accounts distinct from public moderator announcements in your own reasoning. Channel audiences and ability permissions still apply.",
  "prompt.system.reports":
    "If you observe a definite contradiction in rules, state, flow, logs or visible information, you may call report_bug before continuing your normal action. Strategic disagreement, role claims, bluffs and uncertain guesses are not bugs.",
  "prompt.user.speech": "this is your speaking turn",
  "prompt.user.speech_public":
    "this is your public speaking turn; your speech goes to the whole table",
  "prompt.user.speech_wolves":
    "this is your wolf-chat turn; your speech goes only to the wolf-chat members permitted this turn",
  "prompt.user.speech_partner":
    "this is your private partner-chat turn; your speech goes only to your partner",
  "prompt.user.speech_brew":
    "this is your private brewing-discussion turn; your speech goes only to this assistant group, not to the Witch or the table",
  "prompt.user.no_speech": "this is not your speaking turn",
  "prompt.user.required": "Complete this turn with at least one allowed action.",
  "prompt.user.optional": "You may end this turn without taking an action.",
  "prompt.user.turn":
    "[Action prompt] Player {actor}, it is your turn. Phase: {phase}; stage: {stage}; {speech}.{context}",
  "prompt.user.rules": "Stage rules: {rules}{status}",
  "prompt.user.actions":
    "{constraint} Allowed submissions: {tools}. Effective game actions: {effective}.",
  "prompt.user.arguments": "Action arguments: {hints}{targets}.{usage} {submission}",
  "prompt.user.submit":
    "Decide using your currently visible information. If you choose to act, use submit_action. In an optional window you may end without submitting; in a required window, satisfy the constraints above.",
  "prompt.board.title": "Current board:",
  "prompt.board.size": "Total players={count}",
  "prompt.board.lineup": "Role lineup={lineup}",
  "prompt.board.skills": "Role skill briefs={skills}",
  "prompt.retry.first":
    "The previous response produced no valid action. You may retain your reasoning, but effective speech and actions require submit_action; plain assistant text is insufficient. (Retry {attempt}/{max})",
  "prompt.retry.second":
    "Reminder: a required action is still missing this turn. Call submit_action. For communication, choose a speaking action allowed this turn and put the speech in its specified text parameter. Plain assistant text has no effect. (Retry {attempt}/{max})",
  "prompt.retry.last":
    "Final reminder: a required action is still missing. Without a valid submit_action, this turn will use its configured failure policy. Submit the required action; plain assistant text cannot replace it. (Retry {attempt}/{max})",
  "prompt.retry.optional":
    "The action submission failed validation and cannot count as a legal wait. If you still wish to act, correct it using the tool feedback and submit_action. This is an optional window, so you may end without another submission. Prior invalid submissions still count toward failure; ending does not clear errors or automatically confirm a pending self-destruction. (Retry {attempt}/{max})",
  "prompt.sdk.submit":
    "If you choose to act, use submit_action. turn_id must be {turn}, action must be an effective action name listed for this turn, and arguments must contain its parameters. Optional windows permit no submission; required windows must satisfy their constraints. A self-destruction proposal is pending only: read the warning and explicitly confirm again as instructed before it takes effect. You may first report a definite contradiction with report_bug using the same turn_id {turn}. You do not need get_game_schema.",
  "prompt.acp.submit":
    "If you choose to act, use the werewolf-game MCP service's submit_action; do not invoke the listed action names directly. turn_id must be {turn}; action must be a name listed for this turn, and arguments must contain its parameters. Optional windows permit no submission; required windows must satisfy their constraints. A self-destruction proposal is pending only: read the warning and explicitly confirm again as instructed before it takes effect. You may first call report_bug for a definite contradiction, then continue your decision. You do not need get_game_schema; plain text has no game effect.",
  "prompt.acp.events": "New visible events: {events}",
  "prompt.acp.turn": "Current turn ID: {turn}",
  "prompt.stage.default":
    "Follow this stage's responsibilities and perform only actions allowed this turn.",
  "prompt.status.private": "Your private state: {state}",
  "prompt.status.wolf_teammates":
    "Wolf teammate identities revealed for this turn, excluding yourself: {teammates}. Previously learned identities remain historical information even if this turn's list changes.",
  "prompt.status.idiot":
    "Status reminder: you revealed as Village Idiot and survived an earlier exile. You may still speak, but cannot vote, be exiled again, run for sheriff or hold the badge.",
  "prompt.stage.sheriff_timing":
    "The first-day sheriff election occurs before the night outcome is published. night_resolved has not yet announced deaths or no deaths. Participation in the election does not prove a player's survival. Do not infer the night outcome from the wolf target, entering day, an absent announcement or other players' claims.",
  "prompt.stage.sheriff_nomination":
    "This is nomination, not withdrawal: run=true enters the election; run=false declines nomination. All players' decisions are collected concurrently from the same information snapshot.",
  "prompt.stage.sheriff_withdraw":
    "This is withdrawal after campaign speeches: run=true continues the candidacy; run=false withdraws. Candidates' decisions are collected concurrently from the same information snapshot.",
  "prompt.stage.sheriff_vote":
    "This is the sheriff vote. Only final non-candidates vote, including withdrawn candidates. Vote for a current final candidate or abstain. All votes are collected concurrently from the same information snapshot.",
  "prompt.stage.sheriff_vote_pk_first":
    "This is the first sheriff vote. Only eligible players who did not nominate themselves may vote; withdrawn nominees cannot vote either. Vote for a final candidate or abstain. All votes use the same information snapshot.",
  "prompt.stage.sheriff_vote_pk_second":
    "This is the sheriff PK revote. Only eligible players outside the current PK candidate list may vote. Vote for a remaining eligible PK candidate or abstain; another tie or all abstentions leaves no sheriff. All votes use the same information snapshot.",
  "prompt.stage.blast_only":
    "This is a public self-destruction window. Only {tool} changes the game; speech, votes and other actions are forbidden. If you choose not to self-destruct, end this response without submitting an action. report_bug only reports problems.",
  "prompt.stage.wolf_target": "This night's wolf target revealed to you is player {target}.",
  "prompt.stage.no_wolf_target":
    "This night's wolf target revealed to you is empty, which may result from abstention or a tie.",
  "prompt.stage.unknown_wolf_target": "No definite wolf target has been revealed to you.",
  "prompt.targets.none": "Actionable IDs: None",
  "prompt.targets.self": "Actionable IDs (including yourself): {ids}",
  "prompt.targets.others": "Actionable IDs (alive, excluding yourself): {ids}",
  "prompt.config.title": "Rules for this game:",
  "prompt.config.win": "Win conditions: {rules}",
  "prompt.config.sheriff": "Sheriff mechanism: {rules}",
  "prompt.config.sheriff_enabled":
    "Enabled: nomination, campaign speeches, withdrawal and voting under this board's policy; the sheriff chooses speaking direction and has vote weight={weight}. If nobody runs, all candidates withdraw, or voting is required and no valid vote is cast, no sheriff is elected. Withdrawn candidates are never restored. Under the PK policy, a sole remaining candidate wins directly without a vote.",
  "prompt.config.night_before_sheriff":
    "This board resolves night deaths before daytime and the first sheriff election; eliminated players do not participate in the election.",
  "prompt.config.sheriff_timing":
    "First-day order: after night actions, collect nominations, campaign speeches, withdrawals and non-candidate votes. After the sheriff vote, night_resolved announces deaths or no deaths, followed by first-night last words, sheriff speaking direction and regular day speeches. Players who actually died overnight still participate in the election before the public night resolution.",
  "prompt.config.blast": "Self-destruction: {rules}",
  "prompt.config.blast_enabled": "Enabled (windows: {windows})",
  "prompt.config.self_heal": "Witch self-healing: {rules}",
  "prompt.config.self_heal_always": "Always allowed",
  "prompt.config.self_heal_first": "Allowed only on the first night",
  "prompt.config.self_heal_disabled": "Disallowed",
  "prompt.config.disclosure_open":
    "Disclosure (NetEase 2017 open-card clause): after an actual death is settled, player_role_revealed publicly confirms that player's current role card. It reveals no camp, victory affiliation, copied or gifted abilities, resources or private history. Pending night deaths are not revealed early. Speech claims are not engine confirmation.",
  "prompt.config.last_words_2017":
    "Last words (NetEase 2017 clause): every daytime or voting death, including self-destruction and subsequent death waves, and every first-night death receives last words. Later night deaths receive none. Night-origin shot or linked deaths remain night deaths; a surviving Village Idiot receives none. This policy does not change gun eligibility or victory timing.",
  "prompt.config.disclosure":
    "Disclosure: ordinary night deaths and exile do not reveal roles. Only identities explicitly revealed by engine events such as idiot_revealed, and private role or inspection events received by you, are confirmed facts. A role claim in speech or last words is not engine confirmation.",
  "prompt.config.last_words":
    "Last words: first-night deaths, actual exile deaths, and a Knight's pure daytime duel failure receive last words. Later night deaths, self-destruction, Village Idiot survival, death-shot targets, successful duel targets and White Wolf King blast targets receive none. One player with both pending first-night death and White Wolf King blast sources receives none; other purely first-night victims in the same batch receive last words normally.",
  "prompt.config.ties": "Tie handling: exile={exile}; wolf kill={wolf}{sheriff}",
  "prompt.config.sheriff_tie": "; sheriff vote={tie}",
  "tool.unknown_error": "Tool call failed: {code}",
  "error.turn_not_open_or_session_invalid":
    "This turn is closed or the session does not match. Use only the turn_id in this session's latest action prompt.",
  "tool.turn_id_mismatch_context":
    "The current turn is still open. Change turn_id to {turn} and call {tool} again.",
  "error.tool_not_allowed_in_this_turn":
    "This action is not allowed this turn. Use an action listed in the latest action prompt.",
  "error.invalid_tool_arguments":
    "Invalid action arguments. Correct them using the current action argument hints and submit again.",
  "error.turn_constraints_max_actions_exceeded":
    "A valid action has already been accepted this turn. No additional action is accepted.",
  "error.turn_constraints_not_satisfied":
    "The turn constraints are not satisfied. Read details and submit an action that meets them.",
  "error.turn_id_mismatch":
    "The supplied turn_id does not match. This turn is still open; submit again using the turn_id in the latest action prompt.",
  "request.summary.night_action": "Complete one valid action in the night action stage.",
  "request.summary.day_speech": "Complete one speech action in the day speech stage.",
  "request.summary.exile_vote": "Complete one exile vote action; you may abstain.",
  "request.summary.death_shot": "Complete one shot action in this death-triggered shooting stage.",
  "request.summary.last_words": "Complete one speech action for your last words.",
  "request.summary.sheriff_nomination": "State whether you enter the sheriff election.",
  "request.summary.sheriff_campaign": "Complete one campaign speech in the sheriff election.",
  "request.summary.sheriff_withdraw": "State whether you continue your candidacy or withdraw.",
  "request.summary.sheriff_vote": "Complete one sheriff vote; you may abstain.",
  "request.summary.sheriff_direction": "Choose a speaking direction in the sheriff ordering stage.",
  "request.summary.self_destruct_pre_vote":
    "In the pre-exile window, you may self-destruct or end the turn without acting.",
  "request.summary.self_destruct":
    "In this self-destruction window, you may self-destruct or end the turn without acting.",
  "request.retry.exile_vote": "Your vote action was invalid. Submit a corrected vote action.",
  "request.retry.wolf_vote":
    "Your wolf kill vote was invalid. Submit a corrected kill_vote action.",
  "fallback.speech":
    "I am player {actor}; I will listen to the remaining speakers before deciding.",
  "fallback.last_words":
    "Last words: I am player {actor}; use my final information as a reference.",
  "fallback.wolf_chat": "Prioritize an information role for tonight’s kill.",
  "request.summary.badge_choice": "Choose a listed successor, or use null to destroy the badge.",
  "prompt.config.badge_next":
    "Badge: transfer automatically by living seat order after death; revealed Village Idiots destroy it directly. The former sheriff has no action to choose a recipient.",
  "prompt.config.badge_choice":
    "Badge: the deceased holder chooses an eligible living successor or destroys it; revealed Idiots destroy it directly.",
} satisfies Record<keyof typeof definition.parameters, string>;

// 三份原数据一起交 catalog；satisfies 只作编译期 key 对齐，最终公开字典的冻结由 catalog 负责。
export const messages = { definition, zhCN, en };
