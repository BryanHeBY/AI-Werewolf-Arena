import type { ReplayDocument, ReplayEvent } from "@ai-werewolf-arena/replay-contract";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function parseOfflineReplayJson(raw: string): ReplayDocument {
  const value: unknown = JSON.parse(raw);
  if (!isRecord(value) || typeof value.sessionId !== "string" || !Array.isArray(value.events)) {
    throw new Error("这不是 AI Werewolf Arena 导出的 .replay.json 文件。");
  }
  if (!isRecord(value.meta) || !isRecord(value.result) || !Array.isArray(value.phaseWindows)) {
    throw new Error("复盘文件缺少 meta、result 或 phaseWindows 字段。");
  }
  return value as unknown as ReplayDocument;
}

export async function readOfflineReplay(file: File): Promise<ReplayDocument> {
  return parseOfflineReplayJson(await file.text());
}

export function eventLabel(event: ReplayEvent): string {
  const payload = event.payload;
  switch (event.type) {
    case "god_private_game_info":
      return `角色分布：${formatRoleLineup(payload.players)}`;
    case "phase_changed":
      return phaseChangeLabel(payload, event.day, event.phase);
    case "wolf_tactical_order":
      return `狼人开始夜聊，顺序：${numberList(payload.order, " → ")}`;
    case "wolf_discussion":
      return `${numberValue(payload.actorId)}号夜聊：${stringValue(payload.text)}`;
    case "wolf_discussion_ended":
      return `${numberValue(payload.actorId)}号结束夜聊：${stringValue(payload.reason)}`;
    case "wolf_kill_vote_cast":
      return payload.abstain === true
        ? `${numberValue(payload.actorId)}号弃刀`
        : `${numberValue(payload.actorId)}号投刀${numberValue(payload.targetId)}号`;
    case "guard_applied":
      return payload.abstain === true || payload.targetId === null
        ? `${numberValue(payload.actorId)}号守卫选择空守`
        : `${numberValue(payload.actorId)}号守护${numberValue(payload.targetId)}号`;
    case "seer_checked":
      return `${numberValue(payload.actorId)}号查验${numberValue(payload.targetId)}号：${payload.isWerewolf === true ? "狼人" : "好人"}`;
    case "witch_potion_used":
      return `${numberValue(payload.actorId)}号对${numberValue(payload.targetId)}号使用${potionName(payload.potionType)}`;
    case "witch_potion_skipped":
      return `${numberValue(payload.actorId)}号女巫未使用药剂`;
    case "sheriff_nomination_summary":
      return `上警玩家：${numberList(payload.candidates)}号`;
    case "sheriff_withdraw_summary":
      return `退水玩家：${numberList(payload.withdrawn) || "无"}`;
    case "sheriff_candidates_finalized":
      return `警上候选：${numberList(payload.candidates)}号`;
    case "sheriff_vote_cast":
      return voteLabel(payload, "警长票");
    case "sheriff_vote_summary":
      return `警长票型：${voteLineup(payload.votes)}；${payload.winnerId == null ? "无人当选" : `${numberValue(payload.winnerId)}号当选警长`}`;
    case "sheriff_elected":
      return `${numberValue(payload.winnerId)}号当选警长`;
    case "sheriff_direction_chosen":
      return `${numberValue(payload.sheriffId)}号选择${payload.direction === "counter_clockwise" ? "逆时针（警右）" : "顺时针（警左）"}发言`;
    case "sheriff_badge_transferred":
      return `警徽移交：${numberValue(payload.fromId)}号 → ${numberValue(payload.toId)}号`;
    case "sheriff_badge_destroyed":
      return `警徽被撕毁（原持有者${numberValue(payload.targetId)}号）`;
    case "day_speech":
      return `${numberValue(payload.actorId)}号发言：${stringValue(payload.text)}`;
    case "night_resolved": {
      const deaths = numberList(payload.deaths);
      return deaths ? `昨夜死亡：${deaths}号` : "昨夜是平安夜";
    }
    case "vote_cast":
      return voteLabel(payload, "放逐票");
    case "vote_summary":
      return `放逐票型：${voteLineup(payload.votes)}`;
    case "voted_out":
      return `${numberValue(payload.target)}号被放逐出局`;
    case "idiot_revealed":
      return `${numberValue(payload.targetId)}号翻牌为白痴，免于放逐并失去投票权`;
    case "wolf_self_destruct":
      return `${numberValue(payload.wolfId)}号狼人自爆`;
    case "hunter_shot":
      return `${numberValue(payload.hunterId)}号猎人开枪带走${numberValue(payload.targetId)}号`;
    case "hunter_silent_due_to_poison":
      return `${numberValue(payload.hunterId)}号猎人因中毒无法开枪`;
    case "last_words_granted":
      return `${numberValue(payload.playerId)}号获得遗言`;
    case "last_words_spoken":
      return `${numberValue(payload.playerId)}号遗言：${stringValue(payload.text)}`;
    case "game_over":
      return `对局结束：${stringValue(payload.winner) || "未知阵营"}获胜（${stringValue(payload.reason) || "未注明原因"}）`;
    default:
      return typeof payload.text === "string" ? payload.text : event.type;
  }
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function numberValue(value: unknown): string {
  return typeof value === "number" && Number.isFinite(value) ? String(value) : "?";
}

function numberList(value: unknown, separator = "、"): string {
  return Array.isArray(value)
    ? value.filter((item): item is number => typeof item === "number").join(separator)
    : "";
}

function voteLabel(payload: Record<string, unknown>, label: string): string {
  const actor = numberValue(payload.actorId);
  if (payload.abstain === true || payload.targetId == null) return `${actor}号${label}弃票`;
  const weight = typeof payload.weight === "number" && payload.weight !== 1
    ? `（权重${payload.weight}）`
    : "";
  return `${actor}号${label}投给${numberValue(payload.targetId)}号${weight}`;
}

function voteLineup(value: unknown): string {
  if (!Array.isArray(value)) return "无";
  return value.map((item) => {
    if (!item || typeof item !== "object") return "?";
    const vote = item as Record<string, unknown>;
    const actor = numberValue(vote.actorId);
    if (vote.abstain === true || vote.targetId == null) return `${actor}号→弃票`;
    const weight = typeof vote.weight === "number" && vote.weight !== 1
      ? `(w=${vote.weight})`
      : "";
    return `${actor}号→${numberValue(vote.targetId)}号${weight}`;
  }).join("，");
}

function potionName(value: unknown): string {
  if (value === "heal") return "解药";
  if (value === "poison") return "毒药";
  return "药剂";
}

function phaseChangeLabel(payload: Record<string, unknown>, day: number, fallback: string): string {
  const phase = stringValue(payload.phase) || fallback;
  if (phase === "night") return `第${day}天夜晚，天黑请闭眼`;
  if (phase === "day") return `第${day}天白天，天亮了`;
  if (phase === "voting") return "进入放逐投票阶段";
  if (phase === "game_over") return "对局结束";
  return `进入${phase}`;
}

function formatRoleLineup(value: unknown): string {
  if (!Array.isArray(value)) return "未知";
  return value.map((item) => {
    if (!item || typeof item !== "object") return "?";
    const player = item as Record<string, unknown>;
    return `${numberValue(player.seat ?? player.id)}号=${stringValue(player.role) || "unknown"}`;
  }).join("，");
}
