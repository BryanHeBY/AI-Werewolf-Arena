/** 文件说明：警长机制事件的裁判与终端渲染。 */
import { ScriptJudgeLineHandlers, ScriptLiveRenderHandlers } from "../script/contracts";

export const SHERIFF_SCRIPT_JUDGE_HANDLERS: ScriptJudgeLineHandlers = {
  sheriff_nomination_summary: (event) => {
    const candidates = event.payload.candidates;
    return `现在开始竞选警长，上警玩家：${candidates.join("、")}号`;
  },
  sheriff_withdraw_summary: (event) => {
    const withdrawn = event.payload.withdrawn;
    return withdrawn.length === 0 ? "退水玩家：无" : `退水玩家：${withdrawn.join("、")}号`;
  },
  sheriff_candidates_finalized: (event) => {
    const candidates = event.payload.candidates;
    return `目前警上名单：${candidates.join("、")}号，请开始投票`;
  },
  sheriff_vote_summary: (event) => {
    const lineup = event.payload.votes.map((item) => {
      return item.abstain || item.targetId === null
        ? `${item.actorId}号->弃票`
        : `${item.actorId}号->${item.targetId}号`;
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

export const SHERIFF_SCRIPT_LIVE_HANDLERS: ScriptLiveRenderHandlers = {
  sheriff_candidate_declared: () => [],
  sheriff_nomination_summary: (event) => [
    {
      kind: "god",
      text: `[live][上帝][上警] 现在开始竞选警长，上警玩家：${event.payload.candidates.join("、")}号`,
    },
  ],
  sheriff_withdraw_summary: (event) => {
    const withdrawn = event.payload.withdrawn;
    return [{
      kind: "god",
      text: withdrawn.length === 0
        ? "[live][上帝][上警] 退水玩家：无"
        : `[live][上帝][上警] 退水玩家：${withdrawn.join("、")}号`,
    }];
  },
  sheriff_candidates_finalized: (event) => {
    const candidates = event.payload.candidates;
    return [{
      kind: "god",
      text: `[live][上帝] 目前警上名单：${candidates.join("、")}号，请开始投票`,
    }];
  },
  sheriff_vote_cast: (event) => {
    const { actorId, abstain, targetId } = event.payload;
    return [{
      kind: "action",
      text: abstain || targetId === null
        ? `[live][行动][警长投票] ${actorId}号弃票`
        : `[live][行动][警长投票] ${actorId}号投给${targetId}号`,
    }];
  },
  sheriff_vote_summary: (event) => {
    const lineup = event.payload.votes.map((item) => {
      return item.abstain || item.targetId === null
        ? `${item.actorId}号->弃票`
        : `${item.actorId}号->${item.targetId}号`;
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
