/** 文件说明：警长机制相关事件在不同输出通道中的渲染实现。 */
import { AgentEventLineHandler } from "../broadcast/contracts";
import { ScriptJudgeLineHandler, ScriptLiveRenderHandler } from "../script/contracts";
import { RealtimeEventHandler } from "../session/contracts";
import { RealtimeGameEvent } from "../../infra/transport/broadcaster";

/** 警长事件 -> 玩家广播行映射。 */
export const SHERIFF_AGENT_EVENT_LINE_HANDLERS: Record<string, AgentEventLineHandler> = {
  sheriff_candidate_declared: (event) => {
    const p = event.payload as Record<string, any>;
    return `[系统][公开][上警] ${p.actorId}号${p.run === true ? "上警" : "退水"}`;
  },
  sheriff_candidates_finalized: (event) => {
    const p = event.payload as Record<string, any>;
    const candidates = Array.isArray(p.candidates) ? p.candidates : [];
    return `[系统][公开][上警] 候选名单：${candidates.join("、")}号`;
  },
  sheriff_vote_cast: (event) => {
    const p = event.payload as Record<string, any>;
    if (p.abstain === true || p.targetId === null || p.targetId === undefined) {
      return `[系统][公开][警长投票] ${p.actorId}号 -> 弃票`;
    }
    return `[系统][公开][警长投票] ${p.actorId}号 -> ${p.targetId}号`;
  },
  sheriff_elected: (event) => {
    const p = event.payload as Record<string, any>;
    return `[系统][公开] 警长当选：${p.winnerId}号`;
  },
};

/** 警长事件 -> 上帝判词渲染映射。 */
export const SHERIFF_SCRIPT_JUDGE_HANDLERS: Record<string, ScriptJudgeLineHandler> = {
  sheriff_elected: (event) => {
    const p = event.payload as Record<string, any>;
    return `警长当选：${p.winnerId}号`;
  },
};

/** 警长事件 -> 终端 live 渲染映射。 */
export const SHERIFF_SCRIPT_LIVE_HANDLERS: Record<string, ScriptLiveRenderHandler> = {
  sheriff_candidate_declared: (event) => [
    {
      kind: "action",
      text: `[live][行动][上警] ${event.payload.actorId}号${event.payload.run === true ? "上警" : "退水"}`,
    },
  ],
  sheriff_candidates_finalized: (event) => {
    const candidates = Array.isArray(event.payload.candidates)
      ? event.payload.candidates
      : [];
    return [
      {
        kind: "god",
        text: `[live][上帝] 上警名单：${candidates.join("、")}号`,
      },
    ];
  },
  sheriff_vote_cast: (event) => {
    if (event.payload.abstain === true || event.payload.targetId === null) {
      return [
        {
          kind: "action",
          text: `[live][行动][警长投票] ${event.payload.actorId}号弃票`,
        },
      ];
    }
    return [
      {
        kind: "action",
        text: `[live][行动][警长投票] ${event.payload.actorId}号投给${event.payload.targetId}号`,
      },
    ];
  },
};

function publicEvent(
  type: string,
  data: Record<string, unknown>,
  timestamp: number,
): RealtimeGameEvent {
  return {
    type,
    timestamp,
    data,
    visibility: { scope: "public" },
  };
}

/** 警长事件 -> 实时推送事件映射。 */
export const SHERIFF_REALTIME_EVENT_HANDLERS: Record<string, RealtimeEventHandler> = {
  sheriff_candidate_declared: (event) => [
    publicEvent(
      "sheriff_candidate_declared",
      {
        actorId: Number(event.payload.actorId),
        run: Boolean(event.payload.run),
      },
      event.timestamp,
    ),
  ],
  sheriff_candidates_finalized: (event) => [
    publicEvent(
      "sheriff_candidates_finalized",
      {
        candidates: Array.isArray(event.payload.candidates)
          ? event.payload.candidates.map((id) => Number(id))
          : [],
      },
      event.timestamp,
    ),
  ],
  sheriff_vote_cast: (event) => [
    publicEvent(
      "sheriff_vote_cast",
      {
        actorId: Number(event.payload.actorId),
        targetId:
          event.payload.targetId === null || event.payload.targetId === undefined
            ? null
            : Number(event.payload.targetId),
        abstain: Boolean(event.payload.abstain),
      },
      event.timestamp,
    ),
  ],
  sheriff_elected: (event) => [
    publicEvent(
      "sheriff_elected",
      {
        winnerId: Number(event.payload.winnerId),
        candidates: Array.isArray(event.payload.candidates)
          ? event.payload.candidates.map((id) => Number(id))
          : [],
        tally:
          event.payload.tally && typeof event.payload.tally === "object"
            ? event.payload.tally
            : {},
      },
      event.timestamp,
    ),
  ],
};
