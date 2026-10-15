/**
 * 负责觉醒守卫与骑士有限白天窗口的中英模板。输入稳定消息键与惰性参数，输出规则及真实事实说明。
 * 文案不授予保护／决斗，不凭提案改Alive；用户昵称和原话保持原文，私有选择与公开亮牌分开。
 */
import type { MessageDefinition } from "../definition";
export const definition = {
  owner: "features/awakened-day-roles",
  parameters: {
    "event.awakened_self_destruct_declared": ["actor", "day", "window"],
    "event.awakened_self_destruct_resolved": ["actor", "day", "deaths", "window"],
    "event.awakened_duel_resolved": ["actor", "day", "deaths", "target"],
    "replay.stage.awakened_self_destruct_declared": [],
    "replay.stage.awakened_self_destruct_resolved": [],
    "replay.stage.awakened_duel_resolved": [],
    "replay.stage.awakened_guard_cycle_started": [],
    "replay.stage.awakened_protection_chosen": [],
    "replay.stage.awakened_protection_block_detail": [],
    "replay.stage.awakened_protection_expired": [],
    "role.awakened_guard.brief": [],
    "role.awakened_guard.state": ["history"],
    "awakened_guard.history.open": ["day"],
    "awakened_guard.history.protected": ["day", "target"],
    "awakened_guard.history.passed": ["day"],
    "awakened_guard.history.unused": ["day"],
    "action.awakened_protect.hint": [],
    "action.awakened_protect.directive": [],
    "stage.awakened_protection_night": [],
    "stage.awakened_protection_day": [],
    "request.summary.awakened_protect": [],
    "prompt.stage.awakened_protect": ["last", "targets"],
    "prompt.config.awakened_guard": [],
    "event.awakened_guard_cycle_started": ["actor", "day"],
    "event.awakened_protect_chosen": ["actor", "day", "target"],
    "event.awakened_protect_wait": ["actor", "day"],
    "event.awakened_protect_pass": ["actor", "day"],
    "event.awakened_protect_unused": ["actor", "day"],
    "event.awakened_protection_revealed": ["actor", "target"],
    "event.awakened_protection_blocked": ["day", "target"],
    "event.awakened_protection_detail": ["actor", "causes", "day", "phase", "root", "target"],
    "event.awakened_protection_expired": ["actor", "day"],
    "replay.stage.awakened_guard_private": [],
    "replay.stage.awakened_protection_revealed": [],
    "replay.stage.awakened_protection_blocked": [],
    "replay.stage.awakened_guard_god": [],
    "role.awakened_knight.brief": [],
    "role.awakened_knight.state": ["targets"],
    "action.awakened_duel.hint": [],
    "action.awakened_duel.directive": [],
    "stage.awakened_duel": [],
    "stage.awakened_duel_continue": [],
    "request.summary.awakened_duel": [],
    "request.summary.awakened_duel_continue": [],
    "prompt.stage.awakened_duel": ["continuing", "targets"],
    "prompt.config.awakened_knight": [],
    "event.awakened_duel_wolf": ["actor", "day", "target"],
    "event.awakened_duel_good": ["actor", "day", "target"],
    "event.awakened_duel_ended": ["actor", "day"],
    "event.awakened_duel_no_targets": ["actor", "day"],
    "event.awakened_duel_actor_lost": ["actor", "day"],
    "event.awakened_duel_miss": ["actor", "day"],
    "replay.stage.awakened_duel_committed": [],
    "replay.stage.awakened_duel_chain_ended": [],
    "death.awakened_duel": [],
  },
} as const satisfies MessageDefinition;
export const zhCN = {
  "event.awakened_self_destruct_declared":
    "第{day}天，{actor}号声明自爆（{window}）；是否实际死亡另行结算。",
  "event.awakened_self_destruct_resolved":
    "第{day}天，{actor}号自爆（{window}）已结算，实际死亡：{deaths}。",
  "event.awakened_duel_resolved":
    "第{day}天，{actor}号对{target}号的决斗已结算，实际死亡：{deaths}。",
  "replay.stage.awakened_self_destruct_declared": "自爆声明",
  "replay.stage.awakened_self_destruct_resolved": "自爆实际结算",
  "replay.stage.awakened_duel_resolved": "决斗实际结算",
  "replay.stage.awakened_guard_cycle_started": "守卫周期开始（本人私有）",
  "replay.stage.awakened_protection_chosen": "守卫周期选择（本人私有）",
  "replay.stage.awakened_protection_block_detail": "全天保护原因（上帝私有）",
  "replay.stage.awakened_protection_expired": "全天保护到期（上帝私有）",
  "role.awakened_guard.brief":
    "觉醒守卫属于好人神职。每个实际夜晚及随后白天共用一次全天保护，可保护自己，不能与上一实际周期保护同一座位；完整空过一周期可断开连守。夜晚或白天有限安全边界可选择保护、等待或整周期放弃。保护挡住本周期所有致死，包括毒、放逐、决斗和替死，但仅绑定原目标生命。夜选择保密；白天实际发动公开身份及目标。",
  "role.awakened_guard.state": "本人的逐周期选择：{history}。",
  "awakened_guard.history.open": "第{day}周期尚未使用",
  "awakened_guard.history.protected": "第{day}周期保护{target}号",
  "awakened_guard.history.passed": "第{day}周期明确放弃",
  "awakened_guard.history.unused": "第{day}周期结束未使用",
  "action.awakened_protect.hint":
    "mode=protect时target_id必须是可选座位；mode=wait或pass时必须为null。wait只等待下一个安全边界，pass放弃本周期剩余机会。",
  "action.awakened_protect.directive":
    "只用awakened_protect明确选择protect、wait或pass；无答复和超时不是等待。",
  "stage.awakened_protection_night": "觉醒守卫夜间选择",
  "stage.awakened_protection_day": "觉醒守卫白天安全窗口",
  "request.summary.awakened_protect": "选择本周期保护、继续等待或整周期放弃",
  "prompt.stage.awakened_protect":
    "本次可保护：{targets}。是否已确定无后继机会：{last}；wait仅保留至下一个实际安全边界，若没有后继则日终自动结束未使用，不保证还有下一次。",
  "prompt.config.awakened_guard":
    "本板使用AWA觉醒守卫实际夜+随后白天周期政策，一周期最多保护一次；已付盾到实际日终，不能连守同一座位。每个安全边界固定先守卫后觉醒骑士，不能看到决斗后回到同一窗口补盾。",
  "event.awakened_guard_cycle_started": "第{day}周期，{actor}号觉醒守卫的本周期机会开启。",
  "event.awakened_protect_chosen":
    "第{day}周期，{actor}号选择保护{target}号；保护绑定本周期原生命。",
  "event.awakened_protect_wait": "第{day}周期，{actor}号选择等待下一个安全窗口。",
  "event.awakened_protect_pass": "第{day}周期，{actor}号明确放弃本周期剩余保护机会。",
  "event.awakened_protect_unused": "第{day}周期，{actor}号在最后窗口未发动保护，本周期关闭。",
  "event.awakened_protection_revealed": "{actor}号翻牌为觉醒守卫，本周期保护{target}号。",
  "event.awakened_protection_blocked": "第{day}天，{target}号的本次致死被全天保护阻挡。",
  "event.awakened_protection_detail":
    "第{day}天，{actor}号的全天保护阻挡{target}号本次致死，死因：{causes}；执行阶段：{phase}，死亡根：{root}。",
  "event.awakened_protection_expired": "第{day}周期结束，{actor}号本周期保护到期。",
  "replay.stage.awakened_guard_private": "觉醒守卫选择（本人私有）",
  "replay.stage.awakened_protection_revealed": "觉醒守卫亮牌保护",
  "replay.stage.awakened_protection_blocked": "全天保护阻挡",
  "replay.stage.awakened_guard_god": "全天保护（上帝私有）",
  "role.awakened_knight.brief":
    "觉醒骑士属于好人神职，可在普通放逐发言、PK和开票前的有限安全边界决斗另一活人。目标是狼则可在完整死亡连锁后继续决斗或结束入夜；目标是好人则双方各自接受致死，完成连锁后恢复未完成的原发言。同一座位整局只能尝试一次，盾或替死不返还资格。当前链实际死者的遗言推迟到链正常结束后依死亡顺序发表；失败不会自动结束链。",
  "role.awakened_knight.state": "整局已尝试座位：{targets}。",
  "action.awakened_duel.hint":
    "target_id为可选活人或null。普通窗口的null只表示本次不发动；连续窗口的null表示结束成功链并入夜。同一座位整局只能尝试一次。",
  "action.awakened_duel.directive":
    "只用awakened_duel提交目标或明确null；missing、非法或超时不会自动视为结束。",
  "stage.awakened_duel": "觉醒骑士决斗机会",
  "stage.awakened_duel_continue": "觉醒骑士连续决斗决定",
  "request.summary.awakened_duel": "选择决斗目标或明确本次不发动",
  "request.summary.awakened_duel_continue": "继续决斗或明确结束成功链并入夜",
  "prompt.stage.awakened_duel":
    "可选目标：{targets}。是否连续决斗窗口：{continuing}。候选名单不提供真实阵营。",
  "prompt.config.awakened_knight":
    "本板觉醒骑士每个座位整局只能决斗一次。真实Wolf分支可连续，Good分支结束链恢复原发言；盾和狼美人替死按真实致死统一结算。每次决斗完整连锁后先给未用守卫机会，再继续决斗。遗言延后到正常链尾，最终判胜仍在完整链后。",
  "event.awakened_duel_wolf":
    "第{day}天，{actor}号觉醒骑士决斗{target}号，确认狼分支；实际死亡另行结算。",
  "event.awakened_duel_good":
    "第{day}天，{actor}号觉醒骑士决斗{target}号，确认好人分支；双方分别接受致死判定。",
  "event.awakened_duel_ended": "第{day}天，{actor}号结束本次成功决斗链；遗言后入夜。",
  "event.awakened_duel_no_targets": "第{day}天，{actor}号已无合法新决斗目标；本链遗言后入夜。",
  "event.awakened_duel_actor_lost": "第{day}天，{actor}号已失去继续决斗资格；既有连锁遗言后入夜。",
  "event.awakened_duel_miss": "第{day}天，{actor}号误中好人，本次链结束；遗言后继续原发言。",
  "replay.stage.awakened_duel_committed": "觉醒骑士决斗",
  "replay.stage.awakened_duel_chain_ended": "觉醒骑士链结束",
  "death.awakened_duel": "觉醒决斗",
};
export const en = {
  "event.awakened_self_destruct_declared":
    "Day {day}: Player {actor} declares self-destruction at {window}; actual death resolves separately.",
  "event.awakened_self_destruct_resolved":
    "Day {day}: Player {actor}’s self-destruction at {window} resolved; actual deaths: {deaths}.",
  "event.awakened_duel_resolved":
    "Day {day}: Player {actor}’s duel against Player {target} resolved; actual deaths: {deaths}.",
  "replay.stage.awakened_self_destruct_declared": "Self-destruction declaration",
  "replay.stage.awakened_self_destruct_resolved": "Actual self-destruction resolution",
  "replay.stage.awakened_duel_resolved": "Actual duel resolution",
  "replay.stage.awakened_guard_cycle_started": "Guard cycle start (owner only)",
  "replay.stage.awakened_protection_chosen": "Guard cycle choice (owner only)",
  "replay.stage.awakened_protection_block_detail": "Protection causes (God only)",
  "replay.stage.awakened_protection_expired": "Protection expiry (God only)",
  "role.awakened_guard.brief":
    "The Awakened Guard is a good power role. Each real night and its following day share one protection. Self-protection is allowed; the same seat cannot be protected in adjacent real cycles. A fully unused cycle breaks the restriction. Protect at night or a finite daytime boundary, wait, or pass the whole cycle. Protection blocks all lethal proposals this cycle, including poison, exile, duels and replacement deaths, and binds the original target life. Night choices are private; daytime protection reveals your role and target.",
  "role.awakened_guard.state": "Your cycle choices: {history}.",
  "awakened_guard.history.open": "Cycle {day}: unused so far",
  "awakened_guard.history.protected": "Cycle {day}: protected Player {target}",
  "awakened_guard.history.passed": "Cycle {day}: explicitly passed",
  "awakened_guard.history.unused": "Cycle {day}: ended unused",
  "action.awakened_protect.hint":
    "With mode=protect, target_id must be an eligible seat. With wait or pass, it must be null. wait defers to the next safe boundary; pass closes the remaining cycle.",
  "action.awakened_protect.directive":
    "Use only awakened_protect to choose protect, wait or pass explicitly. Missing or timed out replies are not waits.",
  "stage.awakened_protection_night": "Awakened Guard night choice",
  "stage.awakened_protection_day": "Awakened Guard daytime boundary",
  "request.summary.awakened_protect": "Protect this cycle, wait, or pass the whole cycle",
  "prompt.stage.awakened_protect":
    "Eligible protection targets: {targets}. No later opportunity has been established: {last}. Waiting preserves the choice only until an actual later safe boundary; if none occurs, the real day ends the cycle unused. A later opportunity is not guaranteed.",
  "prompt.config.awakened_guard":
    "This board uses the AWA real-night-and-following-day protection cycle: at most one protection per cycle, lasting until the real day ends, with no same-seat protection in adjacent cycles. Each safe boundary runs Guard before Awakened Knight; a duel cannot reopen that same protection window.",
  "event.awakened_guard_cycle_started":
    "Cycle {day}: Player {actor} opens this cycle’s protection opportunity.",
  "event.awakened_protect_chosen":
    "Cycle {day}: Player {actor} protects Player {target}, bound to this cycle’s original life.",
  "event.awakened_protect_wait": "Cycle {day}: Player {actor} waits for the next safe boundary.",
  "event.awakened_protect_pass":
    "Cycle {day}: Player {actor} explicitly passes all remaining protection opportunities.",
  "event.awakened_protect_unused":
    "Cycle {day}: Player {actor} leaves protection unused at the final boundary; the cycle closes.",
  "event.awakened_protection_revealed":
    "Player {actor} reveals as the Awakened Guard and protects Player {target} this cycle.",
  "event.awakened_protection_blocked":
    "Day {day}: all-day protection blocks this lethal proposal against Player {target}.",
  "event.awakened_protection_detail":
    "Day {day}: Player {actor}’s all-day protection blocks this lethal proposal against Player {target}; causes: {causes}; execution: {phase}, death origin: {root}.",
  "event.awakened_protection_expired": "Cycle {day} ends; Player {actor}’s protection expires.",
  "replay.stage.awakened_guard_private": "Awakened Guard choice (owner only)",
  "replay.stage.awakened_protection_revealed": "Awakened Guard reveal",
  "replay.stage.awakened_protection_blocked": "All-day protection block",
  "replay.stage.awakened_guard_god": "All-day protection (God only)",
  "role.awakened_knight.brief":
    "The Awakened Knight is a good power role who may duel another living player at finite normal-discussion, PK and pre-ballot boundaries. A wolf target allows another duel after the complete death chain, or ending the day. A good target creates separate lethal proposals for you and the target, then resumes the unfinished discussion. Each seat can be attempted only once per game; protection and replacement never refund it. Actual deaths in the current chain receive last words in death order only after normal chain completion. Failures do not automatically end the chain.",
  "role.awakened_knight.state": "Seats already attempted this game: {targets}.",
  "action.awakened_duel.hint":
    "target_id is an eligible living player or null. At an ordinary boundary, null declines this opportunity. In a continuation, null ends the successful chain and the day. Each seat can be attempted once per game.",
  "action.awakened_duel.directive":
    "Use only awakened_duel with a target or explicit null. Missing, invalid or timed out replies do not count as ending.",
  "stage.awakened_duel": "Awakened Knight duel opportunity",
  "stage.awakened_duel_continue": "Awakened Knight continuation",
  "request.summary.awakened_duel": "Choose a duel target or explicitly decline this opportunity",
  "request.summary.awakened_duel_continue":
    "Duel again or explicitly end the successful chain and the day",
  "prompt.stage.awakened_duel":
    "Eligible targets: {targets}. Continuation window: {continuing}. Candidate lists do not reveal true camps.",
  "prompt.config.awakened_knight":
    "The Awakened Knight may attempt each seat once per game. True-wolf branches may continue; true-good branches end the chain and resume the original discussion. Protection and Beauty replacement apply to actual lethal proposals. After each complete duel death chain, an unused Guard acts before the next duel. Last words and the final victory checkpoint follow normal completion of the full chain.",
  "event.awakened_duel_wolf":
    "Day {day}: Awakened Knight {actor} duels Player {target}, confirming the wolf branch; actual deaths resolve separately.",
  "event.awakened_duel_good":
    "Day {day}: Awakened Knight {actor} duels Player {target}, confirming the good branch; each receives a separate lethal proposal.",
  "event.awakened_duel_ended":
    "Day {day}: Player {actor} ends the successful duel chain; night follows last words.",
  "event.awakened_duel_no_targets":
    "Day {day}: Player {actor} has no eligible new duel target; night follows this chain’s last words.",
  "event.awakened_duel_actor_lost":
    "Day {day}: Player {actor} can no longer continue dueling; night follows last words for the existing chain.",
  "event.awakened_duel_miss":
    "Day {day}: Player {actor} hit a good player; the chain ends and the original discussion resumes after last words.",
  "replay.stage.awakened_duel_committed": "Awakened Knight duel",
  "replay.stage.awakened_duel_chain_ended": "Awakened Knight chain end",
  "death.awakened_duel": "Awakened duel",
};
export const messages = { definition, zhCN, en };
