import { COMPONENT } from "../domain/components/names";
import { RoleComponent } from "../domain/components/role";
import { EntityId, GameEvent, Role } from "../domain/model";
import { World } from "../domain/world";

/**
 * 构建“单个玩家可见”的广播消息流（聊天格式行）。
 * 规则：
 * - 公开事件：全体可见；
 * - 狼队事件：仅狼人可见；
 * - 私有行动：仅行动发起者可见；
 * - 放逐阶段不逐票公开，只公开最终放逐结果。
 */
export function buildAgentBroadcastFeed(
  world: World,
  events: GameEvent[],
  actorId: EntityId,
  limit: number = 80,
): string[] {
  const actorRole = world.getComponent<RoleComponent>(actorId, COMPONENT.Role)?.role;
  const isWolf = actorRole === Role.Wolf;
  const lines: string[] = [];

  for (const event of events) {
    const line = mapEventToBroadcastLine(event, actorId, isWolf);
    if (line) {
      lines.push(line);
    }
  }

  return lines.slice(-limit);
}

function mapEventToBroadcastLine(
  event: GameEvent,
  actorId: EntityId,
  isWolf: boolean,
): string | null {
  const p = event.payload as Record<string, any>;
  switch (event.type) {
    case "phase_changed":
      if (p.phase === "day") {
        return `[系统][公开] 天亮了（第${p.day}天白天）`;
      }
      if (p.phase === "voting") {
        return `[系统][公开] 现在进入放逐投票阶段`;
      }
      if (p.phase === "night") {
        return `[系统][公开] 天黑请闭眼（第${p.day}天夜晚）`;
      }
      if (p.phase === "game_over") {
        return `[系统][公开] 对局结束`;
      }
      return null;
    case "day_speech":
      return `[发言][公开][${p.actorId}] ${p.text}`;
    case "night_resolved":
      if (Array.isArray(p.deaths) && p.deaths.length > 0) {
        return `[系统][公开] 昨夜死亡：${p.deaths.join("、")}号`;
      }
      return `[系统][公开] 昨夜平安夜`;
    case "voted_out":
      return `[系统][公开] 放逐结果：${p.target}号出局`;
    case "wolf_self_destruct":
      return `[系统][公开] ${p.wolfId}号狼人自爆`;
    case "game_over":
      return `[系统][公开] 胜利阵营：${p.winner}，原因：${p.reason}`;
    case "wolf_discussion":
      return isWolf ? `[夜聊][狼队][${p.actorId}] ${p.text}` : null;
    case "wolf_tactical_order":
      return isWolf ? `[狼队][顺序] ${Array.isArray(p.order) ? p.order.join("->") : ""}` : null;
    case "wolf_kill_vote_cast":
      // 狼刀投票信息按串行过程保留在狼队内部可见。
      return isWolf ? `[狼刀票][狼队] ${p.actorId}号 -> ${p.targetId}号` : null;
    case "seer_checked":
      if (Number(p.actorId) !== actorId) {
        return null;
      }
      return `[私有][查验] 你查验${p.targetId}号 => ${p.isWerewolf ? "狼人" : "好人"}`;
    case "guard_applied":
      if (Number(p.actorId) !== actorId) {
        return null;
      }
      return `[私有][守卫] 你守护了${p.targetId}号`;
    case "witch_potion_used":
      if (Number(p.actorId) !== actorId) {
        return null;
      }
      return `[私有][女巫] 你对${p.targetId}号使用了${p.potionType}`;
    default:
      return null;
  }
}
