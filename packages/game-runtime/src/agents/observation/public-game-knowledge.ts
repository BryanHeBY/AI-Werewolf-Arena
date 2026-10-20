/**
 * 负责从玩家已经收到的公开结果提取稳定局面；输入为可见事件，输出为出局集合与公告摘要。
 * 不读取 World 或尚未公布的真实生命、身份。
 * 出局、翻牌与警徽是知识摘要；不把玩家发言、狼刀选择、私有查验或工具回执升格为公开事实。
 * 观察投影与 LLM 窗口共用死亡事实解释；各会话仍独立拥有游标与累计知识。
 */
import type { PlayerVisibleEvent } from "@ai-werewolf-arena/game-contract";

/** 仅按已发表结果推导出局；保留观察投影原有的事件顺序和字段读取语义。 */
export function announcedDeathIds(events: readonly PlayerVisibleEvent[]): Set<number> {
  const dead = new Set<number>();
  for (const event of events) {
    if (
      (event.type === "night_resolved" ||
        event.type === "additional_deaths" ||
        event.type === "awakened_duel_resolved" ||
        event.type === "awakened_self_destruct_resolved") &&
      Array.isArray(event.payload.deaths)
    ) {
      for (const id of event.payload.deaths) if (typeof id === "number") dead.add(id);
    }
    const target =
      event.type === "voted_out"
        ? event.payload.target
        : event.type === "wolf_self_destruct"
          ? event.payload.wolfId
          : event.type === "player_shot" ||
              event.type === "hunter_shot" ||
              event.type === "wolf_king_shot" ||
              event.type === "mechanical_shot"
            ? event.payload.targetId
            : undefined;
    if (typeof target === "number") dead.add(target);
    if (event.type === "white_wolf_king_self_destruct") {
      if (typeof event.payload.actorId === "number") dead.add(event.payload.actorId);
      if (typeof event.payload.targetId === "number") dead.add(event.payload.targetId);
    }
    if (event.type === "knight_duel") {
      const victim =
        event.payload.result === "wolf"
          ? event.payload.targetId
          : event.payload.result === "not_wolf"
            ? event.payload.actorId
            : undefined;
      if (typeof victim === "number") dead.add(victim);
    }
  }
  return dead;
}

/** 翻牌是当时已公开的身份，不能据此声称之后的秘密换牌也已公开。 */
export interface PublicGameKnowledge {
  announcedDeadIds: number[];
  roleReveals: Array<{ playerId: number; role: string; seq: number }>;
  /** undefined 表示尚未获知；null 只表示上帝明确宣布警徽被销毁。 */
  lastAnnouncedBadge?: number | null;
}

/** 只有明确公开底牌的专用事实才补角色；普通枪击、自爆或决斗不据技能外观猜底牌。 */
const explicitRoleAnnouncements: Readonly<Record<string, { field: string; role: string }>> = {
  idiot_revealed: { field: "targetId", role: "idiot" },
  animal_cat_revealed: { field: "actorId", role: "white_cat" },
  animal_puffer_revealed: { field: "actorId", role: "pufferfish" },
  debater_revealed: { field: "actorId", role: "debater" },
  // 机械枪按本局规则同时公开机械狼身份；中立 player_shot 不公开技能来源。
  mechanical_shot: { field: "actorId", role: "mechanical_wolf" },
};

/** 仅累计有限的公开局面，不保存第二份发言历史，也不重读已被游标消费的事件。 */
export function appendPublicGameKnowledge(
  previous: PublicGameKnowledge | undefined,
  events: readonly PlayerVisibleEvent[],
): PublicGameKnowledge {
  const dead = new Set(previous?.announcedDeadIds);
  for (const id of announcedDeathIds(events)) dead.add(id);
  const reveals = new Map(previous?.roleReveals.map((reveal) => [reveal.playerId, reveal]));
  let badge = previous?.lastAnnouncedBadge;
  for (const event of events) {
    const payload = event.payload;
    const announcement = Object.hasOwn(explicitRoleAnnouncements, event.type)
      ? explicitRoleAnnouncements[event.type]
      : undefined;
    if (
      event.type === "player_role_revealed" &&
      typeof payload.playerId === "number" &&
      typeof payload.role === "string"
    ) {
      reveals.set(payload.playerId, {
        playerId: payload.playerId,
        role: payload.role,
        seq: event.seq,
      });
    } else if (announcement && typeof payload[announcement.field] === "number") {
      const playerId = payload[announcement.field] as number;
      reveals.set(playerId, {
        playerId,
        role: announcement.role,
        seq: event.seq,
      });
    } else if (event.type === "sheriff_elected" && typeof payload.winnerId === "number") {
      badge = payload.winnerId;
    } else if (event.type === "sheriff_badge_transferred" && typeof payload.toId === "number") {
      badge = payload.toId;
    } else if (event.type === "sheriff_badge_destroyed") {
      badge = null;
    }
  }
  return {
    announcedDeadIds: [...dead].sort((a, b) => a - b),
    roleReveals: [...reveals.values()].sort((a, b) => a.playerId - b.playerId),
    ...(badge !== undefined ? { lastAnnouncedBadge: badge } : {}),
  };
}
