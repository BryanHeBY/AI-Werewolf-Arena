import { GameEvent } from "../../domain/model";

export type ScriptLiveKind =
  | "chat"
  | "action"
  | "private"
  | "god"
  | "system"
  | "end";

export interface ScriptLiveRender {
  kind: ScriptLiveKind;
  text: string;
}

export class ScriptEventRenderRegistry {
  toChatLine(event: GameEvent): string | null {
    if (event.type === "wolf_discussion") {
      return `[夜聊][${event.payload.actorId}] ${event.payload.text}`;
    }
    if (event.type === "wolf_discussion_ended") {
      return `[夜聊][结束][${event.payload.actorId}] ${event.payload.reason}`;
    }
    if (event.type === "day_speech") {
      return `[白天][${event.payload.actorId}] ${event.payload.text}`;
    }
    return null;
  }

  toJudgeLine(event: GameEvent): string | null {
    const p = event.payload;
    if (event.type === "phase_changed") {
      if (p.phase === "night") {
        return `天黑请闭眼（第${p.day}天夜晚）`;
      }
      if (p.phase === "day") {
        return `天亮了（第${p.day}天白天）`;
      }
      if (p.phase === "voting") {
        return `现在进入放逐投票阶段`;
      }
      if (p.phase === "game_over") {
        return `对局结束`;
      }
    }

    if (event.type === "night_resolved") {
      const deaths = Array.isArray(p.deaths) ? p.deaths : [];
      if (deaths.length === 0) {
        return `昨夜是平安夜`;
      }
      return `昨夜死亡：${deaths.join("、")}号`;
    }
    if (event.type === "voted_out") {
      return `${p.target}号被放逐出局`;
    }
    if (event.type === "wolf_self_destruct") {
      return `${p.wolfId}号狼人自爆，流程被中断`;
    }
    if (event.type === "game_over") {
      return `胜利阵营：${p.winner}，原因：${p.reason}`;
    }
    return null;
  }

  toReplayRenderText(event: GameEvent): string | undefined {
    const judge = this.toJudgeLine(event);
    if (judge) {
      return `[上帝] ${judge}`;
    }
    const chat = this.toChatLine(event);
    return chat ?? undefined;
  }

  toReplayStage(event: GameEvent): string {
    if (event.type === "phase_changed") {
      return String(event.payload.phase ?? "phase_changed");
    }
    if (event.type === "day_speech") {
      return "day_speech";
    }
    if (event.type === "vote_cast" || event.type === "voted_out") {
      return "voting";
    }
    if (
      event.type === "wolf_discussion" ||
      event.type === "wolf_discussion_ended" ||
      event.type === "wolf_kill_vote_cast"
    ) {
      return "wolf_discussion";
    }
    if (event.type === "guard_applied") {
      return "guard";
    }
    if (event.type === "seer_checked") {
      return "seer";
    }
    if (event.type === "witch_potion_used") {
      return "witch";
    }
    return event.type;
  }

  toLiveRender(event: GameEvent, printPrivateEvents: boolean): ScriptLiveRender[] {
    if (event.type === "god_private_game_info") {
      const players = Array.isArray(event.payload.players) ? event.payload.players : [];
      const roleView = players.map((item: any) => `${item.seat ?? item.id}:${item.role}`).join(", ");
      return [{ kind: "god", text: `[live][上帝私有][开局] 角色分布 ${roleView}` }];
    }
    if (event.type === "wolf_discussion") {
      return [{ kind: "chat", text: `[live][夜聊][${event.payload.actorId}] ${event.payload.text}` }];
    }
    if (event.type === "wolf_discussion_ended") {
      return [{ kind: "chat", text: `[live][夜聊][结束][${event.payload.actorId}] ${event.payload.reason}` }];
    }
    if (event.type === "day_speech") {
      return [{ kind: "system", text: `[live][白天][${event.payload.actorId}] ${event.payload.text}` }];
    }
    if (event.type === "guard_applied") {
      return [{ kind: "action", text: `[live][行动][守卫] ${event.payload.actorId}号守护${event.payload.targetId}号` }];
    }
    if (event.type === "seer_checked" && printPrivateEvents) {
      return [{
        kind: "private",
        text: `[live][私有][查验] ${event.payload.actorId}号查验${event.payload.targetId}号 => ${event.payload.isWerewolf ? "狼人" : "好人"}`,
      }];
    }
    if (event.type === "wolf_kill_vote_cast") {
      if (event.payload.abstain === true) {
        return [{ kind: "chat", text: `[live][行动][狼刀票] ${event.payload.actorId}号弃刀` }];
      }
      return [{ kind: "chat", text: `[live][行动][狼刀票] ${event.payload.actorId}号投刀${event.payload.targetId}号` }];
    }
    if (event.type === "witch_potion_used") {
      return [{
        kind: "private",
        text: `[live][行动][女巫] ${event.payload.actorId}号对${event.payload.targetId}号使用${event.payload.potionType}`,
      }];
    }
    if (event.type === "game_over") {
      return [{
        kind: "end",
        text: `[live][终局] winner=${event.payload.winner} reason=${event.payload.reason}`,
      }];
    }
    const judge = this.toJudgeLine(event);
    if (judge) {
      return [{ kind: "god", text: `[live][上帝] ${judge}` }];
    }
    return [];
  }
}

let defaultRegistry: ScriptEventRenderRegistry | null = null;

export function getDefaultScriptEventRenderRegistry(): ScriptEventRenderRegistry {
  if (!defaultRegistry) {
    defaultRegistry = new ScriptEventRenderRegistry();
  }
  return defaultRegistry;
}
