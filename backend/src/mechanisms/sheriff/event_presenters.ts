/** 文件说明：警长机制相关事件在不同输出通道中的渲染实现。 */
import { AgentEventLineHandler } from "../broadcast/contracts";
import { ScriptJudgeLineHandler, ScriptLiveRenderHandler } from "../script/contracts";
import { RealtimeEventHandler } from "../session/contracts";
import { RealtimeGameEvent } from "../../infra/transport/broadcaster";

/** 警长事件 -> 玩家广播行映射。 */
export const SHERIFF_AGENT_EVENT_LINE_HANDLERS: Record<string, AgentEventLineHandler> = {
  sheriff_candidate_declared: () => {
    // 逐条上警/退水事件不直接广播，统一由汇总事件输出。
    return null;
  },
  sheriff_nomination_summary: (event) => {
    const p = event.payload as Record<string, any>;
    const candidates = Array.isArray(p.candidates) ? p.candidates : [];
    return `[系统][公开][上警] 现在开始竞选警长，上警玩家：${candidates.join("、")}号`;
  },
  sheriff_withdraw_summary: (event) => {
    const p = event.payload as Record<string, any>;
    const withdrawn = Array.isArray(p.withdrawn) ? p.withdrawn : [];
    if (withdrawn.length === 0) {
      return `[系统][公开][上警] 退水玩家：无`;
    }
    return `[系统][公开][上警] 退水玩家：${withdrawn.join("、")}号`;
  },
  sheriff_candidates_finalized: (event) => {
    const p = event.payload as Record<string, any>;
    const candidates = Array.isArray(p.candidates) ? p.candidates : [];
    return `[系统][公开] 目前警上名单：${candidates.join("、")}号，请开始投票`;
  },
  sheriff_vote_cast: () => null,
  sheriff_vote_summary: (event) => {
    const p = event.payload as Record<string, any>;
    const votes = Array.isArray(p.votes) ? p.votes : [];
    const lineup = votes
      .map((item: any) =>
        item.abstain === true || item.targetId === null || item.targetId === undefined
          ? `${item.actorId}号->弃票`
          : `${item.actorId}号->${item.targetId}号`,
      )
      .join("，");
    const winnerId = p.winnerId;
    if (winnerId === null || winnerId === undefined) {
      return `[系统][公开][警长投票] 警长投票票型：${lineup}。无人当选警长`;
    }
    return `[系统][公开][警长投票] 警长投票票型：${lineup}。${winnerId}号玩家当选警长`;
  },
  sheriff_elected: () => null,
  sheriff_badge_transferred: (event) => {
    const p = event.payload as Record<string, any>;
    return `[系统][公开] 警徽移交：${p.fromId}号 -> ${p.toId}号`;
  },
  sheriff_badge_destroyed: (event) => {
    const p = event.payload as Record<string, any>;
    return `[系统][公开] 警徽被撕毁（原持有者${p.targetId}号）`;
  },
  sheriff_direction_chosen: (event) => {
    const p = event.payload as Record<string, any>;
    const direction =
      p.direction === "counter_clockwise" ? "逆时针（警右）" : "顺时针（警左）";
    return `[系统][公开] ${p.sheriffId}号警长选择发言顺序：${direction}`;
  },
};

/** 警长事件 -> 上帝判词渲染映射。 */
export const SHERIFF_SCRIPT_JUDGE_HANDLERS: Record<string, ScriptJudgeLineHandler> = {
  sheriff_nomination_summary: (event) => {
    const p = event.payload as Record<string, any>;
    const candidates = Array.isArray(p.candidates) ? p.candidates : [];
    return `现在开始竞选警长，上警玩家：${candidates.join("、")}号`;
  },
  sheriff_withdraw_summary: (event) => {
    const p = event.payload as Record<string, any>;
    const withdrawn = Array.isArray(p.withdrawn) ? p.withdrawn : [];
    return withdrawn.length === 0 ? `退水玩家：无` : `退水玩家：${withdrawn.join("、")}号`;
  },
  sheriff_candidates_finalized: (event) => {
    const p = event.payload as Record<string, any>;
    const candidates = Array.isArray(p.candidates) ? p.candidates : [];
    return `目前警上名单：${candidates.join("、")}号，请开始投票`;
  },
  sheriff_vote_summary: (event) => {
    const p = event.payload as Record<string, any>;
    const votes = Array.isArray(p.votes) ? p.votes : [];
    const lineup = votes
      .map((item: any) =>
        item.abstain === true || item.targetId === null || item.targetId === undefined
          ? `${item.actorId}号->弃票`
          : `${item.actorId}号->${item.targetId}号`,
      )
      .join("，");
    const winnerId = p.winnerId;
    if (winnerId === null || winnerId === undefined) {
      return `警长投票票型：${lineup}。无人当选警长`;
    }
    return `警长投票票型：${lineup}。${winnerId}号玩家当选警长`;
  },
  sheriff_elected: () => null,
  sheriff_badge_transferred: (event) => {
    const p = event.payload as Record<string, any>;
    return `警徽移交：${p.fromId}号 -> ${p.toId}号`;
  },
  sheriff_badge_destroyed: (event) => {
    const p = event.payload as Record<string, any>;
    return `警徽被撕毁（原持有者${p.targetId}号）`;
  },
  sheriff_direction_chosen: (event) => {
    const p = event.payload as Record<string, any>;
    const direction =
      p.direction === "counter_clockwise" ? "逆时针（警右）" : "顺时针（警左）";
    return `${p.sheriffId}号警长选择发言顺序：${direction}`;
  },
};

/** 警长事件 -> 终端 live 渲染映射。 */
export const SHERIFF_SCRIPT_LIVE_HANDLERS: Record<string, ScriptLiveRenderHandler> = {
  sheriff_candidate_declared: () => [],
  sheriff_nomination_summary: (event) => [
    {
      kind: "action",
      text: `[live][行动][上警] 现在开始竞选警长，上警玩家：${Array.isArray(event.payload.candidates) ? event.payload.candidates.join("、") : ""}号`,
    },
  ],
  sheriff_withdraw_summary: (event) => {
    const withdrawn = Array.isArray(event.payload.withdrawn)
      ? event.payload.withdrawn
      : [];
    return [
      {
        kind: "action",
        text:
          withdrawn.length === 0
            ? `[live][行动][上警] 退水玩家：无`
            : `[live][行动][上警] 退水玩家：${withdrawn.join("、")}号`,
      },
    ];
  },
  sheriff_candidates_finalized: (event) => {
    const candidates = Array.isArray(event.payload.candidates)
      ? event.payload.candidates
      : [];
    return [
      {
        kind: "god",
        text: `[live][上帝] 目前警上名单：${candidates.join("、")}号，请开始投票`,
      },
    ];
  },
  sheriff_vote_cast: () => [],
  sheriff_vote_summary: (event) => {
    const votes = Array.isArray(event.payload.votes) ? event.payload.votes : [];
    const lineup = votes
      .map((item: any) =>
        item.abstain === true || item.targetId === null || item.targetId === undefined
          ? `${item.actorId}号->弃票`
          : `${item.actorId}号->${item.targetId}号`,
      )
      .join("，");
    const winnerId = event.payload.winnerId;
    return [
      {
        kind: "action",
        text:
          winnerId === null || winnerId === undefined
            ? `[live][行动][警长投票] 警长投票票型：${lineup}。无人当选警长`
            : `[live][行动][警长投票] 警长投票票型：${lineup}。${winnerId}号玩家当选警长`,
      },
    ];
  },
  sheriff_elected: () => [],
  sheriff_direction_chosen: (event) => {
    const direction =
      event.payload.direction === "counter_clockwise"
        ? "逆时针（警右）"
        : "顺时针（警左）";
    return [
      {
        kind: "god",
        text: `[live][上帝] ${event.payload.sheriffId}号警长选择发言顺序：${direction}`,
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
  sheriff_nomination_summary: (event) => [
    publicEvent(
      "sheriff_nomination_summary",
      {
        candidates: Array.isArray(event.payload.candidates)
          ? event.payload.candidates.map((id) => Number(id))
          : [],
      },
      event.timestamp,
    ),
  ],
  sheriff_withdraw_summary: (event) => [
    publicEvent(
      "sheriff_withdraw_summary",
      {
        withdrawn: Array.isArray(event.payload.withdrawn)
          ? event.payload.withdrawn.map((id) => Number(id))
          : [],
      },
      event.timestamp,
    ),
  ],
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
  sheriff_direction_chosen: (event) => [
    publicEvent(
      "sheriff_direction_chosen",
      {
        sheriffId: Number(event.payload.sheriffId),
        direction: String(event.payload.direction ?? "clockwise"),
      },
      event.timestamp,
    ),
  ],
  sheriff_vote_summary: (event) => [
    publicEvent(
      "sheriff_vote_summary",
      {
        votes: Array.isArray(event.payload.votes) ? event.payload.votes : [],
        winnerId:
          event.payload.winnerId === null || event.payload.winnerId === undefined
            ? null
            : Number(event.payload.winnerId),
      },
      event.timestamp,
    ),
  ],
};
