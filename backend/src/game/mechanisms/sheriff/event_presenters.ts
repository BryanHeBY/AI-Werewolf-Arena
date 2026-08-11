/** 文件说明：警长机制事件的裁判与终端渲染。 */
import { ScriptJudgeLineHandler, ScriptLiveRenderHandler } from "../script/contracts";

export const SHERIFF_SCRIPT_JUDGE_HANDLERS: Record<string, ScriptJudgeLineHandler> = {
  sheriff_nomination_summary: (event) => {
    const candidates = Array.isArray(event.payload.candidates) ? event.payload.candidates : [];
    return `现在开始竞选警长，上警玩家：${candidates.join("、")}号`;
  },
  sheriff_withdraw_summary: (event) => {
    const withdrawn = Array.isArray(event.payload.withdrawn) ? event.payload.withdrawn : [];
    return withdrawn.length === 0 ? "退水玩家：无" : `退水玩家：${withdrawn.join("、")}号`;
  },
  sheriff_candidates_finalized: (event) => {
    const candidates = Array.isArray(event.payload.candidates) ? event.payload.candidates : [];
    return `目前警上名单：${candidates.join("、")}号，请开始投票`;
  },
  sheriff_vote_summary: (event) => {
    const votes = Array.isArray(event.payload.votes) ? event.payload.votes : [];
    const lineup = votes.map((item) => {
      const vote = item as Record<string, unknown>;
      return vote.abstain === true || vote.targetId == null
        ? `${vote.actorId}号->弃票`
        : `${vote.actorId}号->${vote.targetId}号`;
    }).join("，");
    const winnerId = event.payload.winnerId;
    return winnerId == null
      ? `警长投票票型：${lineup}。无人当选警长`
      : `警长投票票型：${lineup}。${winnerId}号玩家当选警长`;
  },
  sheriff_elected: () => null,
  sheriff_badge_transferred: (event) => `警徽移交：${event.payload.fromId}号 -> ${event.payload.toId}号`,
  sheriff_badge_destroyed: (event) => `警徽被撕毁（原持有者${event.payload.targetId}号）`,
  sheriff_direction_chosen: (event) => {
    const direction = event.payload.direction === "counter_clockwise" ? "逆时针（警右）" : "顺时针（警左）";
    return `${event.payload.sheriffId}号警长选择发言顺序：${direction}`;
  },
};

export const SHERIFF_SCRIPT_LIVE_HANDLERS: Record<string, ScriptLiveRenderHandler> = {
  sheriff_candidate_declared: () => [],
  sheriff_nomination_summary: (event) => [
    {
      kind: "god",
      text: `[live][上帝][上警] 现在开始竞选警长，上警玩家：${Array.isArray(event.payload.candidates) ? event.payload.candidates.join("、") : ""}号`,
    },
  ],
  sheriff_withdraw_summary: (event) => {
    const withdrawn = Array.isArray(event.payload.withdrawn) ? event.payload.withdrawn : [];
    return [{
      kind: "god",
      text: withdrawn.length === 0
        ? "[live][上帝][上警] 退水玩家：无"
        : `[live][上帝][上警] 退水玩家：${withdrawn.join("、")}号`,
    }];
  },
  sheriff_candidates_finalized: (event) => {
    const candidates = Array.isArray(event.payload.candidates) ? event.payload.candidates : [];
    return [{
      kind: "god",
      text: `[live][上帝] 目前警上名单：${candidates.join("、")}号，请开始投票`,
    }];
  },
  sheriff_vote_cast: (event) => {
    const actorId = Number(event.payload.actorId);
    const abstain = event.payload.abstain === true;
    const targetId = event.payload.targetId == null ? null : Number(event.payload.targetId);
    return [{
      kind: "action",
      text: abstain || targetId === null
        ? `[live][行动][警长投票] ${actorId}号弃票`
        : `[live][行动][警长投票] ${actorId}号投给${targetId}号`,
    }];
  },
  sheriff_vote_summary: (event) => {
    const votes = Array.isArray(event.payload.votes) ? event.payload.votes : [];
    const lineup = votes.map((item) => {
      const vote = item as Record<string, unknown>;
      return vote.abstain === true || vote.targetId == null
        ? `${vote.actorId}号->弃票`
        : `${vote.actorId}号->${vote.targetId}号`;
    }).join("，");
    const winnerId = event.payload.winnerId;
    return [{
      kind: "god",
      text: winnerId == null
        ? `[live][上帝][警长投票] 警长投票票型：${lineup}。无人当选警长`
        : `[live][上帝][警长投票] 警长投票票型：${lineup}。${winnerId}号当选警长`,
    }];
  },
  sheriff_elected: () => [],
  sheriff_direction_chosen: (event) => {
    const direction = event.payload.direction === "counter_clockwise" ? "逆时针（警右）" : "顺时针（警左）";
    return [{ kind: "god", text: `[live][上帝] ${event.payload.sheriffId}号警长选择发言顺序：${direction}` }];
  },
};
