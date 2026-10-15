/**
 * 负责禁言长老规则、工具、阶段与事实的两语文案；输入为稳定消息key及占位值，输出固定模板。
 * 词典不读取World、原生命或表达权限；动作/译文原文只作为参数保留，展示不认证其含义。
 */
import type { MessageDefinition } from "../definition";
export const definition = {
  owner: "features/silence-elder",
  parameters: {
    "role.silence_elder.brief": [],
    "role.silence_elder.state": ["choice"],
    "silence.choice": ["day", "target", "translator"],
    "silence.round.day": [],
    "silence.round.pk": [],
    "action.silence.hint": [],
    "action.silence.directive": [],
    "action.gesture.hint": [],
    "action.gesture.directive": [],
    "action.translate_silence.hint": [],
    "action.translate_silence.directive": [],
    "request.summary.silence_elder": [],
    "request.summary.silence_gesture": [],
    "request.summary.silence_translation": [],
    "stage.silence_elder": [],
    "stage.silence_gesture": [],
    "stage.silence_translation": [],
    "prompt.config.silence_elder": [],
    "prompt.stage.silence_candidates": ["ids"],
    "prompt.stage.silence_gesture": ["round", "target"],
    "prompt.stage.silence_translation": ["description", "round", "target"],
    "event.silence_chosen": ["actor", "day", "target", "translator"],
    "event.silence_announced": ["day", "target", "translator"],
    "event.silence_gesture": ["actor", "description", "round"],
    "event.silence_translated": ["actor", "round", "target", "text"],
    "event.silence_translation_declined": ["actor", "round", "target"],
    "event.silence_expired": ["day", "target"],
    "replay.stage.silence_chosen": [],
    "replay.stage.silence_announced": [],
    "replay.stage.silence_gesture": [],
    "replay.stage.silence_translated": [],
    "replay.stage.silence_translation_declined": [],
    "replay.stage.silence_expired": [],
    "bot.silence.gesture": [],
    "bot.silence.translation": [],
  },
} as const satisfies MessageDefinition;
export const zhCN = {
  "role.silence_elder.brief":
    "禁言长老：每夜必须选择一名存活玩家，可选本人、可连续重选；另可指定一名不同于目标的存活翻译，或不指定。目标次日放逐讨论及PK只能用动作表达，翻译可另行解读。警上竞选、遗言、狼聊、技能与投票不受限制；效果不顺延。",
  "role.silence_elder.state":
    "最近已提交的夜间选择：{choice}。历史是本人知识，不代表当前夜窗或目标生命仍有效。",
  "silence.choice": "第{day}夜，禁言{target}号，翻译：{translator}",
  "silence.round.day": "放逐讨论",
  "silence.round.pk": "放逐PK",
  "action.silence.hint":
    "target_id必须是本轮告知的存活候选；translator_id必须显式填写，可为另一存活候选或null，不能等于target_id。",
  "action.silence.directive":
    "提交本夜唯一一次禁言选择，目标必选，翻译可明确不指定；只调用silence，不推断他人真实身份。",
  "action.gesture.hint":
    "description填写非空的手势、表情或身体动作描述，最长8192字符；不要写普通口头发言。",
  "action.gesture.directive":
    "本次发言受到禁言限制，只能调用gesture描述动作，不能用speak绕过；可以有符合人设的动作，但引擎不认证动作含义。",
  "action.translate_silence.hint":
    "text填写非空译文（最长8192字符）或显式null表示不译。译文是你本人对已公开动作的解读，不是引擎确认事实。",
  "action.translate_silence.directive":
    "本次是独立翻译窗口，只调用translate_silence发表自己的解读或明确不译；不能读取或编造目标私有信息，也不替代你自己的正常发言。",
  "request.summary.silence_elder": "选择本夜禁言对象与可选翻译",
  "request.summary.silence_gesture": "用动作完成本次受限发言",
  "request.summary.silence_translation": "解读公开动作或明确不译",
  "stage.silence_elder": "长老禁言选择",
  "stage.silence_gesture": "禁言动作表达",
  "stage.silence_translation": "动作翻译",
  "prompt.config.silence_elder":
    "禁言长老采用AWA文字动作与翻译政策：每夜必选一名活人，可自选、可连选；翻译可选但不能是目标。只限制次日放逐讨论及PK的口头发言，不影响警上、遗言、夜聊、技能或票权，日终到期。译文由翻译本人负责，不是引擎事实。",
  "prompt.stage.silence_candidates":
    "本轮禁言目标与可选翻译候选：{ids}。目标必选；翻译可为另一候选或null。",
  "prompt.stage.silence_gesture":
    "本次{round}轮到{target}号，以动作描述完成表达；动作会公开，普通speak不在本次合法工具中。",
  "prompt.stage.silence_translation":
    "请翻译{target}号在{round}的已公开动作：{description}。只依据公开动作与本人可见信息解读；可用text=null明确不译。",
  "event.silence_chosen": "{actor}号长老第{day}夜选择禁言{target}号，翻译：{translator}。",
  "event.silence_announced":
    "第{day}天，{target}号在放逐讨论及PK中仅能用动作表达；翻译：{translator}。",
  "event.silence_gesture": "{actor}号的{round}动作：{description}",
  "event.silence_translated": "{actor}号对{target}号{round}动作的译文（个人解读）：{text}",
  "event.silence_translation_declined": "{actor}号明确不翻译{target}号的{round}动作。",
  "event.silence_expired": "第{day}天{target}号的禁言效果到期。",
  "replay.stage.silence_chosen": "长老秘密选择",
  "replay.stage.silence_announced": "禁言公告",
  "replay.stage.silence_gesture": "动作表达",
  "replay.stage.silence_translated": "个人译文",
  "replay.stage.silence_translation_declined": "明确不译",
  "replay.stage.silence_expired": "禁言到期",
  "bot.silence.gesture":
    "先抬手示意大家慢一点，再指向自己的眼睛，随后摊开双手，请大家重新看清已有信息。",
  "bot.silence.translation":
    "我把这个动作理解为请大家重新审视当前判断；这只是我的解读，不是对方的口头发言或引擎事实。",
} as const;
export const en = {
  "role.silence_elder.brief":
    "Silencing Elder: choose one living player every night. You may choose yourself or repeat a target. Optionally appoint a different living translator. The target uses gestures during the next day's exile discussion and PK; the translator may interpret separately. Campaign speeches, last words, pack chat, abilities and votes are unaffected. The effect does not carry over.",
  "role.silence_elder.state":
    "Latest committed night choice: {choice}. This history is your knowledge, not proof that a night window or the target's original life is still valid.",
  "silence.choice": "Night {day}: silence player {target}; translator: {translator}",
  "silence.round.day": "exile discussion",
  "silence.round.pk": "exile PK",
  "action.silence.hint":
    "target_id must be one of this turn's disclosed living candidates. translator_id is required: use another living candidate or null; it must differ from target_id.",
  "action.silence.directive":
    "Submit this night's single silence choice. A target is required; explicitly choose a translator or none. Use silence only and do not infer undisclosed identities.",
  "action.gesture.hint":
    "description must be a nonempty description of gestures, facial expressions or body movements, at most 8192 characters. Do not write an ordinary spoken speech.",
  "action.gesture.directive":
    "This speaking position is silenced. Use gesture to describe actions; do not bypass it with speak. Gestures may reflect your personality, but the engine does not certify their meaning.",
  "action.translate_silence.hint":
    "text must be a nonempty interpretation of at most 8192 characters, or explicit null to decline. It is your interpretation of the public gesture, not an engine-confirmed fact.",
  "action.translate_silence.directive":
    "This is a separate translation window. Use translate_silence to give your interpretation or explicitly decline. Do not claim access to the target's private information. This does not replace your own normal speaking position.",
  "request.summary.silence_elder": "Choose tonight's silenced player and optional translator",
  "request.summary.silence_gesture": "Express this silenced speaking position using gestures",
  "request.summary.silence_translation": "Interpret the public gesture or explicitly decline",
  "stage.silence_elder": "Elder silence choice",
  "stage.silence_gesture": "Silenced gesture",
  "stage.silence_translation": "Gesture interpretation",
  "prompt.config.silence_elder":
    "The Silencing Elder uses the AWA text-gesture and translation policy: a living target is required every night, including self or repeat targets. A different living translator is optional. Only the next day's exile discussion and PK speech are restricted; campaigns, last words, night chat, abilities and voting rights are unaffected. The effect expires that day. Interpretations belong to the translator and are not engine facts.",
  "prompt.stage.silence_candidates":
    "Disclosed silence target and optional translator candidates: {ids}. Choose a target; the translator may be another candidate or null.",
  "prompt.stage.silence_gesture":
    "Player {target}'s {round} position must use a gesture description. The gesture will be public; ordinary speak is not a legal tool for this position.",
  "prompt.stage.silence_translation":
    "Interpret player {target}'s public gesture during {round}: {description}. Use only this public gesture and your own visible information. You may explicitly decline with text=null.",
  "event.silence_chosen":
    "Elder {actor}, night {day}: silence player {target}; translator: {translator}.",
  "event.silence_announced":
    "Day {day}: player {target} must use gestures during exile discussion and PK; translator: {translator}.",
  "event.silence_gesture": "Player {actor}'s {round} gesture: {description}",
  "event.silence_translated":
    "Player {actor}'s interpretation of player {target}'s {round} gesture (personal interpretation): {text}",
  "event.silence_translation_declined":
    "Player {actor} explicitly declines to interpret player {target}'s {round} gesture.",
  "event.silence_expired": "Player {target}'s silence effect expires on day {day}.",
  "replay.stage.silence_chosen": "Elder secret choice",
  "replay.stage.silence_announced": "Silence announcement",
  "replay.stage.silence_gesture": "Gesture",
  "replay.stage.silence_translated": "Personal interpretation",
  "replay.stage.silence_translation_declined": "Translation declined",
  "replay.stage.silence_expired": "Silence expired",
  "bot.silence.gesture":
    "Raise a hand to ask everyone to slow down, point to my eyes, then open both palms to ask the table to examine the available information again.",
  "bot.silence.translation":
    "I interpret the gesture as asking everyone to reconsider their current judgment. This is only my reading, not the player's spoken words or an engine fact.",
} satisfies Record<keyof typeof definition.parameters, string>;
export const messages = { definition, zhCN, en };
