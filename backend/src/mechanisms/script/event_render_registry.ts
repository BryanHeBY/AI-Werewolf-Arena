/** 文件说明：事件 -> 脚本回放文本/终端文本渲染注册表。 */
import { GameEvent } from "../../domain/model";
import {
  ScriptChatLineHandler,
  ScriptJudgeLineHandler,
  ScriptLiveRender,
  ScriptLiveRenderHandler,
  ScriptReplayStageHandler,
} from "./contracts";
import { GUARD_SCRIPT_LIVE_HANDLERS } from "../roles/guard/event_presenters";
import { SEER_SCRIPT_LIVE_HANDLERS } from "../roles/seer/event_presenters";
import { WITCH_SCRIPT_LIVE_HANDLERS } from "../roles/witch/event_presenters";
import {
  WOLF_SCRIPT_CHAT_HANDLERS,
  WOLF_SCRIPT_LIVE_HANDLERS,
} from "../roles/wolf/event_presenters";
import {
  SHERIFF_SCRIPT_JUDGE_HANDLERS,
  SHERIFF_SCRIPT_LIVE_HANDLERS,
} from "../sheriff/event_presenters";

const CHAT_HANDLERS: Record<string, ScriptChatLineHandler> = {
  day_speech: (event) => `[白天][${event.payload.actorId}] ${event.payload.text}`,
  ...WOLF_SCRIPT_CHAT_HANDLERS,
};

const JUDGE_HANDLERS: Record<string, ScriptJudgeLineHandler> = {
  phase_changed: (event) => {
    const p = event.payload;
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
    return null;
  },
  night_resolved: (event) => {
    const p = event.payload;
    const deaths = Array.isArray(p.deaths) ? p.deaths : [];
    if (deaths.length === 0) {
      return `昨夜是平安夜`;
    }
    return `昨夜死亡：${deaths.join("、")}号`;
  },
  voted_out: (event) => `${event.payload.target}号被放逐出局`,
  wolf_self_destruct: (event) => `${event.payload.wolfId}号狼人自爆，流程被中断`,
  game_over: (event) => `胜利阵营：${event.payload.winner}，原因：${event.payload.reason}`,
  ...SHERIFF_SCRIPT_JUDGE_HANDLERS,
};

const REPLAY_STAGE_HANDLERS: Record<string, ScriptReplayStageHandler> = {
  phase_changed: (event) => String(event.payload.phase ?? "phase_changed"),
  day_speech: () => "day_speech",
  vote_cast: () => "voting",
  voted_out: () => "voting",
  wolf_discussion: () => "wolf_discussion",
  wolf_discussion_ended: () => "wolf_discussion",
  wolf_kill_vote_cast: () => "wolf_discussion",
  guard_applied: () => "guard",
  seer_checked: () => "seer",
  witch_potion_used: () => "witch",
  witch_potion_skipped: () => "witch",
  sheriff_candidate_declared: () => "sheriff",
  sheriff_candidates_finalized: () => "sheriff",
  sheriff_vote_cast: () => "sheriff",
  sheriff_elected: () => "sheriff",
};

const LIVE_HANDLERS: Record<string, ScriptLiveRenderHandler> = {
  god_private_game_info: (event) => {
    const players = Array.isArray(event.payload.players) ? event.payload.players : [];
    const roleView = players.map((item: any) => `${item.seat ?? item.id}:${item.role}`).join(", ");
    return [{ kind: "god", text: `[live][上帝私有][开局] 角色分布 ${roleView}` }];
  },
  day_speech: (event) => [{ kind: "system", text: `[live][白天][${event.payload.actorId}] ${event.payload.text}` }],
  game_over: (event) => [
    {
      kind: "end",
      text: `[live][终局] winner=${event.payload.winner} reason=${event.payload.reason}`,
    },
  ],
  ...WOLF_SCRIPT_LIVE_HANDLERS,
  ...SEER_SCRIPT_LIVE_HANDLERS,
  ...GUARD_SCRIPT_LIVE_HANDLERS,
  ...WITCH_SCRIPT_LIVE_HANDLERS,
  ...SHERIFF_SCRIPT_LIVE_HANDLERS,
};

/** 脚本渲染注册表。 */
export class ScriptEventRenderRegistry {
  toChatLine(event: GameEvent): string | null {
    const handler = CHAT_HANDLERS[event.type];
    return handler ? handler(event) : null;
  }

  toJudgeLine(event: GameEvent): string | null {
    const handler = JUDGE_HANDLERS[event.type];
    return handler ? handler(event) : null;
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
    const handler = REPLAY_STAGE_HANDLERS[event.type];
    if (handler) {
      return handler(event) ?? event.type;
    }
    return event.type;
  }

  toLiveRender(event: GameEvent, printPrivateEvents: boolean): ScriptLiveRender[] {
    const handler = LIVE_HANDLERS[event.type];
    if (handler) {
      const rendered = handler(event, printPrivateEvents);
      if (rendered) {
        return rendered;
      }
    }
    const judge = this.toJudgeLine(event);
    if (judge) {
      return [{ kind: "god", text: `[live][上帝] ${judge}` }];
    }
    return [];
  }
}

let defaultRegistry: ScriptEventRenderRegistry | null = null;

/** 获取默认脚本渲染注册表实例。 */
export function getDefaultScriptEventRenderRegistry(): ScriptEventRenderRegistry {
  if (!defaultRegistry) {
    defaultRegistry = new ScriptEventRenderRegistry();
  }
  return defaultRegistry;
}
