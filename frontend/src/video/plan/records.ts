/**
 * 负责在一次编译中解释已校验历史事件。输入为归档事件及本局玩家白名单，输出共用的载荷、视觉语义和旧场景适配信息。
 * 缓存仅属于本次归档与名单；不按跨局 seq 缓存，不读取真实角色，不赋予视觉意图状态提交权。
 */
import type { ReplayEvent } from "@ai-werewolf-arena/replay-contract";
import { readReplayEvent, type ReadReplayEvent } from "../../replay/replay-event-reader";
import { visualIntentFromRecord } from "../visual-intent";
import type { VideoScene, VideoVisualIntent } from "../types";

export interface VideoEventInterpretation {
  readonly record: ReadReplayEvent | null;
  readonly visual: VideoVisualIntent;
  /** 旧场景/作者脚本仍使用的展示主体；与 visual 的真实行动主体分别保留。 */
  readonly actorId?: number;
  readonly targetIds: number[];
  readonly action?: VideoScene["action"];
}
export type VideoRecordReader = (event: ReplayEvent | undefined) => VideoEventInterpretation;

/** 只适配已知内建行动，不根据 family、台词或当前角色推断行动类型。 */
function sceneAction(
  event: ReplayEvent | undefined,
  visual: VideoVisualIntent,
): VideoScene["action"] {
  switch (event?.type) {
    case "wolf_kill_vote_cast":
      return { kind: "wolf-vote", status: "choice" };
    case "seer_checked":
    case "role_inspected":
      return { kind: "inspect", status: "recorded" };
    case "witch_potion_used":
      return { kind: visual.potion ?? "generic", status: "recorded" };
    case "guard_applied":
      return { kind: "guard", status: "choice" };
    case "voted_out":
      return { kind: "exile", status: "recorded" };
    default:
      return undefined;
  }
}

export function interpretVideoEvent(
  event: ReplayEvent | undefined,
  playerIds: readonly number[],
): VideoEventInterpretation {
  const record = event ? readReplayEvent(event, playerIds) : null;
  const visual = visualIntentFromRecord(event, record);
  const safe = record?.event;
  const p = safe?.payload;
  const actorId =
    typeof p?.actorId === "number"
      ? p.actorId
      : safe?.type === "hunter_shot" && typeof p?.hunterId === "number"
        ? p.hunterId
        : typeof p?.playerId === "number"
          ? p.playerId
          : undefined;
  return {
    record,
    visual,
    actorId,
    targetIds: typeof p?.targetId === "number" ? [p.targetId] : [],
    action: sceneAction(safe, visual),
  };
}

/** 缓存值脱离原载荷并冻结；不同语言或场景适配不能修改另一消费者的事实解释。 */
function freezeRecord<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.values(value).forEach(freezeRecord);
    Object.freeze(value);
  }
  return value;
}
export function createVideoRecordReader(playerIds: readonly number[]): VideoRecordReader {
  const knownPlayers = [...playerIds];
  const records = new WeakMap<ReplayEvent, VideoEventInterpretation>();
  const empty = freezeRecord(interpretVideoEvent(undefined, knownPlayers));
  return (event) => {
    if (!event) return empty;
    let interpretation = records.get(event);
    if (!interpretation) {
      interpretation = freezeRecord(interpretVideoEvent(event, knownPlayers));
      records.set(event, interpretation);
    }
    return interpretation;
  };
}
