/**
 * 负责累计已校验事件明确给出的夜聊范围和警上名单。输入来自唯一复盘投影的原事件前缀，输出独立的席位活动标记。
 * 不按阵营推夜聊资格、不读台词、不提前消费上警/退水的并发逐项记录；这些标记仅用于画面边框，不授予行动权限。
 */
import type { ReplayEvent } from "@ai-werewolf-arena/replay-contract";

export type ReplayRosterActivity =
  | { kind: "wolf-discussion"; status: "participant" | "speaker" }
  | { kind: "sheriff-election"; status: "candidate" | "withdrawn" };

const electionEvents = new Set([
  "sheriff_nomination_summary",
  "sheriff_candidate_declared",
  "sheriff_withdraw_summary",
  "sheriff_candidates_finalized",
  "sheriff_pk_started",
  "sheriff_vote_cast",
  "sheriff_vote_summary",
  "sheriff_elected",
]);

/** 调用者必须先经readReplayEvent校验名单与玩家引用；不在此重复解释JSON或维护另一套事实索引。 */
export function createReplayRosterActivity() {
  let day: number | undefined;
  let wolves = new Set<number>();
  let wolfSpeaker: number | undefined;
  let candidates: Set<number> | undefined;
  let withdrawn = new Set<number>();
  let awaitingPk = false;
  const clear = () => {
    wolves.clear();
    wolfSpeaker = undefined;
    candidates = undefined;
    withdrawn.clear();
    awaitingPk = false;
  };
  const atDay = (next: number) => {
    if (day !== undefined && day !== next) clear();
    day = next;
  };
  return {
    atDay,
    append(event: ReplayEvent) {
      atDay(event.day);
      const { type, payload: p } = event;
      if (type === "phase_changed" || event.phase === "game_over") {
        clear();
        return;
      }
      wolfSpeaker = undefined;
      // 个人结束夜聊仍保整组；刀票旧档沿用wolf_discussion stage，必须按type离开范围。
      if (event.phase !== "night") wolves.clear();
      else if (type === "wolf_tactical_order") wolves = new Set(p.order as number[]);
      else if (type === "wolf_discussion" || type === "wolf_discussion_ended")
        wolfSpeaker = p.actorId as number;
      else wolves.clear();

      if (event.phase !== "day") {
        candidates = undefined;
        withdrawn.clear();
        awaitingPk = false;
        return;
      }

      if (!electionEvents.has(type) && (type !== "day_speech" || awaitingPk)) {
        candidates = undefined;
        withdrawn.clear();
        awaitingPk = false;
      }
      // 退水虚线只在退水播报保留；之后仍用明确剩余名单标出警上范围。
      if (type !== "sheriff_withdraw_summary") withdrawn.clear();
      if (
        type === "sheriff_nomination_summary" ||
        type === "sheriff_candidates_finalized" ||
        type === "sheriff_pk_started"
      ) {
        candidates = new Set(p.candidates as number[]);
        awaitingPk = false;
      } else if (type === "sheriff_withdraw_summary") {
        withdrawn = new Set(p.withdrawn as number[]);
        for (const id of withdrawn) candidates?.delete(id);
      } else if (
        type === "sheriff_elected" ||
        (type === "sheriff_vote_summary" && typeof p.winnerId === "number")
      ) {
        candidates = undefined;
        awaitingPk = false;
      } else if (type === "sheriff_vote_summary" && p.winnerId === null) awaitingPk = true;
    },
    forPlayer(playerId: number): ReplayRosterActivity | undefined {
      // 缺order的旧档也明确记录了当前说话者；只标本人，不能借真实阵营补全队友名单。
      if (wolfSpeaker === playerId) return { kind: "wolf-discussion", status: "speaker" };
      if (wolves.has(playerId)) return { kind: "wolf-discussion", status: "participant" };
      if (withdrawn.has(playerId)) return { kind: "sheriff-election", status: "withdrawn" };
      if (candidates?.has(playerId)) return { kind: "sheriff-election", status: "candidate" };
      return undefined;
    },
  };
}
