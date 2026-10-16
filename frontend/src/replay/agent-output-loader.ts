/**
 * 负责读取操作者显式选择的玩家私有档案。输入为 JSON 原文或 canonical 玩家视图，输出为校验后的视图或逐轮 Agent 输出。
 * 通过公共 reader 验证，保留玩家局部顺序；不访问网络、不发现其它文件、不修改游戏回放或扩大视角。
 */
import {
  readReplayPlayerView,
  agentOutputFromDeltaMessages,
  type CanonicalReplayPlayerView,
} from "@ai-werewolf-arena/replay-contract";
import { ReplayLoadError } from "./offline-replay";

export function parsePlayerAgentArchive(raw: string): CanonicalReplayPlayerView {
  try {
    return readReplayPlayerView(JSON.parse(raw));
  } catch {
    throw new ReplayLoadError({ key: "replay.agent_invalid" });
  }
}

/** 原玩家局部顺序是唯一排序来源，不用 God 的事件数量补齐私有时间线。 */
export function playerAgentOutputTurns(view: CanonicalReplayPlayerView) {
  return view.timeline.flatMap((entry) =>
    entry.kind === "turn"
      ? [
          {
            seq: entry.seq,
            day: entry.day,
            phase: entry.phase,
            requestId: entry.request_id,
            outputs: agentOutputFromDeltaMessages(entry.delta_messages),
          },
        ]
      : [],
  );
}
