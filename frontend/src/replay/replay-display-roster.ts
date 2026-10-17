/**
 * 负责进行中God归档的只读展示名册补全。输入为已读取原档，输出明确初始记录的名册与来源诊断。
 * 只在顶层名册为空时读取首条开局信息；不猜身份、不改档案或源指纹，后续身份变更仍由唯一事实投影处理。
 */
import type { ReplayDocument } from "@ai-werewolf-arena/replay-contract";
import { isRoleId } from "@ai-werewolf-arena/game-contract";
export function replayDisplayRoster(replay: ReplayDocument) {
  if (replay.players.length) return { players: replay.players, source: "archive" as const };
  const initial = replay.events[0];
  const rows =
    initial?.type === "god_private_game_info" && replay.perspective === "god"
      ? initial.payload.players
      : undefined;
  if (!Array.isArray(rows) || rows.length === 0) return { players: [], source: "missing" as const };
  const ids = new Set<number>();
  const seats = new Set<number>();
  const players: ReplayDocument["players"] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object" || Array.isArray(row))
      return { players: [], source: "missing" as const };
    const { id, role, camp, seat, name, model } = row;
    if (
      !Number.isSafeInteger(id) ||
      id < 1 ||
      ids.has(id) ||
      !isRoleId(role) ||
      !["good", "wolf", "third_party"].includes(camp) ||
      (seat !== undefined && (!Number.isSafeInteger(seat) || seat < 1 || seats.has(seat))) ||
      (name !== undefined && typeof name !== "string") ||
      (model !== undefined && typeof model !== "string")
    )
      return { players: [], source: "missing" as const };
    ids.add(id);
    if (seat !== undefined) seats.add(seat);
    players.push({
      player_id: id,
      role,
      camp,
      ...(seat === undefined ? {} : { seat }),
      ...(name === undefined ? {} : { name }),
      ...(model === undefined ? {} : { model }),
    });
  }
  return { players, source: "recorded_initialization" as const };
}
