/**
 * 负责独立重建寻香配对的历史可见事件。输入为归档、发表游标和观察者序号；
 * 输出为脱离原 payload 的历史 feed，序号只按该玩家可见项目累计。
 * 本族私有事实核本人和原 audience；vote_summary 去掉 tally，其它可见性保原逐类判断。
 * 不调用引擎 feed 或授予 live 披露，也不将归档受众当真实运行权限。
 * 本族读器只计算有限板子预期，不能修改关系、库存或历史来源。
 */
import { FRAGRANT_PAIR_EVENT_TYPES } from "@ai-werewolf-arena/game-contract/facts/fragrant-pair-seer";
import type { ReproductionRecord } from "../../../recording/reproduction";
/** 独立的有限板子可见性预期：只读归档前缀，不复用生产授权／投影器。 */
export function fragrantFeedAt(r: ReproductionRecord, cursor: number, actor: number): unknown[] {
  const publicTypes = new Set([
      "phase_changed",
      "day_speech",
      "night_resolved",
      "additional_deaths",
      "vote_summary",
      "voted_out",
      "game_over",
      "wolf_self_destruct",
      "last_words_granted",
      "last_words_spoken",
      "sheriff_nomination_summary",
      "sheriff_withdraw_summary",
      "sheriff_candidates_finalized",
      "sheriff_pk_started",
      "exile_pk_started",
      "sheriff_vote_summary",
      "sheriff_badge_transferred",
      "sheriff_badge_destroyed",
      "sheriff_direction_chosen",
    ]),
    packTypes = new Set([
      "wolf_tactical_order",
      "wolf_discussion",
      "wolf_discussion_ended",
      "wolf_kill_vote_cast",
    ]);
  const out: unknown[] = [];
  // 只处理已发表前缀；不可见事实不占该玩家的 seq，保原 clone／字段裁剪顺序。
  for (const e of r.events.slice(0, cursor)) {
    const p = e.payload;
    let payload: Record<string, unknown> | null = null,
      type = e.type;
    if ((FRAGRANT_PAIR_EVENT_TYPES as readonly string[]).includes(type)) {
      if (
        ["fragrant_pair_chosen", "fragrant_pair_inspected", "fragrant_night_notified"].includes(
          type,
        ) &&
        p.actorId === actor &&
        e.audience?.length === 1 &&
        e.audience[0] === actor
      )
        payload = structuredClone(p);
    } else if (type === "hunter_shot") {
      type = "player_shot";
      payload = { actorId: p.hunterId, targetId: p.targetId };
    } else if (packTypes.has(type)) {
      if (e.audience?.includes(actor)) payload = structuredClone(p);
    } else if (["witch_potion_used", "witch_potion_skipped", "guard_applied"].includes(type)) {
      if (p.actorId === actor) payload = structuredClone(p);
    } else if (publicTypes.has(type)) {
      if (type === "vote_summary") {
        const { tally: _tally, ...rest } = p;
        payload = structuredClone(rest);
      } else payload = structuredClone(p);
    }
    if (payload) out.push({ seq: out.length + 1, type, payload });
  }
  return out;
}
