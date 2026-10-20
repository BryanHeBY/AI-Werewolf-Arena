/**
 * 负责将已校验的公开播报载荷转成紧凑展示字段。输入仅为reader接受的record，输出纯JSON，不复制昵称、模型或私有接入字段。
 * 每个分支按正式事件契约取值；座次、角色、明确阵营、名单与警徽相互独立，不解析本地化长句或从角色推当前阵营。
 */
import type { ReadReplayEvent } from "../replay/replay-event-reader";

export type AnnouncementCamp = "good" | "wolf" | "third_party" | "unknown";
export type AnnouncementContent =
  | {
      kind: "lineup";
      players: Array<{ playerId: number; seat?: number; roleId: string; camp: AnnouncementCamp }>;
    }
  | {
      kind: "roster";
      purpose:
        "wolf-order" | "nomination" | "withdrawal" | "candidates" | "sheriff-pk" | "exile-pk";
      playerIds: number[];
      ordered: boolean;
    }
  | {
      kind: "badge";
      operation: "elected" | "transferred" | "destroyed";
      playerId: number;
      fromId?: number;
    }
  | { kind: "phase"; phase: string; day: number }
  | { kind: "last-words"; playerId: number }
  | { kind: "direction"; playerId: number; direction: string }
  | { kind: "ability"; playerId: number; abilityKind: string; operation: string }
  | {
      kind: "notice";
      purpose: "charm-link" | "poisoned-shot" | "idiot-reveal";
      playerId: number;
      targetId?: number;
    };

const camp = (value: unknown): AnnouncementCamp =>
  value === "good" || value === "wolf" || value === "third_party" ? value : "unknown";

/** 未覆盖或未通过reader的事件留给原公告，不以字段看起来相似为由扩张身份披露范围。 */
export function announcementContent(
  record: ReadReplayEvent | null | undefined,
): AnnouncementContent | null {
  if (!record) return null;
  const { type, payload: p } = record.event;
  switch (type) {
    case "god_private_game_info":
      return {
        kind: "lineup",
        players: (p.players as Array<Record<string, unknown>>).map((player) => ({
          playerId: Number(player.id ?? player.seat),
          ...(Number.isSafeInteger(player.seat) && Number(player.seat) > 0
            ? { seat: Number(player.seat) }
            : {}),
          roleId: String(player.role),
          camp: camp(player.camp),
        })),
      };
    case "wolf_tactical_order":
      return {
        kind: "roster",
        purpose: "wolf-order",
        playerIds: [...(p.order as number[])],
        ordered: true,
      };
    case "sheriff_nomination_summary":
    case "sheriff_candidates_finalized":
    case "sheriff_pk_started":
    case "exile_pk_started":
      return {
        kind: "roster",
        purpose:
          type === "sheriff_nomination_summary"
            ? "nomination"
            : type === "sheriff_candidates_finalized"
              ? "candidates"
              : type === "sheriff_pk_started"
                ? "sheriff-pk"
                : "exile-pk",
        playerIds: [...(p.candidates as number[])],
        ordered: false,
      };
    case "sheriff_withdraw_summary":
      return {
        kind: "roster",
        purpose: "withdrawal",
        playerIds: [...(p.withdrawn as number[])],
        ordered: false,
      };
    case "sheriff_elected":
      return { kind: "badge", operation: "elected", playerId: Number(p.winnerId) };
    case "sheriff_badge_transferred":
      return {
        kind: "badge",
        operation: "transferred",
        fromId: Number(p.fromId),
        playerId: Number(p.toId),
      };
    case "sheriff_badge_destroyed":
      return { kind: "badge", operation: "destroyed", playerId: Number(p.targetId) };
    case "phase_changed":
      return { kind: "phase", phase: String(p.phase ?? record.event.phase), day: record.event.day };
    case "last_words_granted":
      return { kind: "last-words", playerId: Number(p.playerId) };
    case "sheriff_direction_chosen":
      return { kind: "direction", playerId: Number(p.sheriffId), direction: String(p.direction) };
    case "ability_changed":
      return {
        kind: "ability",
        playerId: Number(p.actorId),
        abilityKind: String(p.kind),
        operation: String(p.operation),
      };
    case "charm_death":
      return {
        kind: "notice",
        purpose: "charm-link",
        playerId: Number(p.actorId),
        targetId: Number(p.targetId),
      };
    case "hunter_silent_due_to_poison":
      return { kind: "notice", purpose: "poisoned-shot", playerId: Number(p.hunterId) };
    case "idiot_revealed":
      return { kind: "notice", purpose: "idiot-reveal", playerId: Number(p.targetId) };
    default:
      return null;
  }
}
