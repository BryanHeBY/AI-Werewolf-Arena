/**
 * 负责网页与成片共用的结构化展示内容，由展示层拥有字段排版契约。输入是已校验场景事实，输出纯JSON块。
 * 不解析正文意图、不查询真实角色或执行规则；原文、请求、报告、结果及资源保持独立，揭晓时钟仍由视频场景负责。
 */
import type { GameOutcome } from "@ai-werewolf-arena/game-contract";
import type { ReadReplayEvent } from "../replay/replay-event-reader";
import { announcementContent, type AnnouncementContent } from "./announcement-content";
import type {
  PotionInventoryState,
  VideoBallot,
  VideoScene,
  VideoVisualIntent,
  VideoVisualReport,
} from "../video/types";

export type SceneContentBlock =
  | { kind: "announcement"; announcement: AnnouncementContent }
  | { kind: "life"; playerIds: number[]; causes: Record<string, string[]> }
  | {
      kind: "dialogue";
      actorId: number;
      text: string;
      textSource: "event" | "script";
      dialogue: NonNullable<VideoVisualIntent["dialogue"]>;
    }
  | {
      kind: "action";
      process: VideoVisualIntent["process"];
      actorId?: number;
      requestedTargetIds: number[];
      effectiveTargetIds: number[];
      effectiveTargetKnown: boolean;
      recipientIds: number[];
    }
  | {
      kind: "report";
      report: VideoVisualReport;
      actorId?: number;
      targetIds: number[];
      recipientIds: number[];
    }
  | { kind: "ballot"; ballot: VideoBallot }
  | { kind: "inventory"; state: PotionInventoryState }
  | {
      kind: "outcome";
      outcome?: GameOutcome;
      winner?: string | null;
      reason?: string;
      winningPlayerIds: number[];
    }
  | { kind: "record"; text: string; reason: string };
export interface SceneContent {
  version: 1;
  blocks: SceneContentBlock[];
}

/** 兼容字段只在此适配一次；消费者按block.kind选模板，不能从字符串补结果。 */
export function sceneContent(scene: VideoScene, record?: ReadReplayEvent | null): SceneContent {
  const blocks: SceneContentBlock[] = [];
  const visual = scene.visual;
  const announcement = scene.bodySource === "event" ? announcementContent(record) : null;
  if (announcement) blocks.push({ kind: "announcement", announcement });
  // 只有权威生命提交携带出局对象；一般技能报告、请求目标和未确认夜报不能制造此块。
  if (visual?.life?.committed)
    blocks.push({
      kind: "life",
      playerIds: [...visual.life.playerIds],
      causes: structuredClone(visual.life.causes ?? {}),
    });
  if (visual?.dialogue && visual.actorId !== undefined)
    blocks.push({
      kind: "dialogue",
      actorId: visual.actorId,
      text: scene.body,
      textSource: scene.bodySource,
      dialogue: structuredClone(visual.dialogue),
    });
  if (scene.ballot) blocks.push({ kind: "ballot", ballot: structuredClone(scene.ballot) });
  if (visual?.report)
    blocks.push({
      kind: "report",
      report: structuredClone(visual.report),
      ...(visual.actorId === undefined ? {} : { actorId: visual.actorId }),
      targetIds: [...visual.requestedTargetIds],
      recipientIds: [...visual.recipientIds],
    });
  if (visual?.victory) blocks.push({ kind: "outcome", ...structuredClone(visual.victory) });
  if (scene.inventory)
    blocks.push({ kind: "inventory", state: structuredClone(scene.inventory.after) });
  if (
    visual &&
    !visual.dialogue &&
    !visual.victory &&
    !visual.report &&
    !scene.ballot &&
    !scene.stock &&
    !visual.life &&
    visual.process !== "notice" &&
    !visual.fallbackReason
  )
    blocks.push({
      kind: "action",
      process: visual.process,
      ...(visual.actorId === undefined ? {} : { actorId: visual.actorId }),
      requestedTargetIds: [...visual.requestedTargetIds],
      effectiveTargetIds: [...visual.effectiveTargetIds],
      effectiveTargetKnown: visual.effectiveTargetKnown === true,
      recipientIds: [...visual.recipientIds],
    });
  if (!blocks.length)
    blocks.push({
      kind: "record",
      text: scene.body,
      reason: visual?.fallbackReason ?? "recorded_context",
    });
  return { version: 1, blocks };
}

/** 主归属只取结构化判胜；旧档仅明确合法阵营winner可选相应徽记；null既可能个人也可能关系胜利，不能补无胜者或成员。 */
export function outcomeEmblem(
  outcome: GameOutcome | undefined,
  legacyWinner?: string | null,
): "good" | "wolf" | "third-party" | "individual" | "relationship" | "no-winner" | "unknown" {
  if (!outcome)
    return legacyWinner === "good" || legacyWinner === "wolf"
      ? legacyWinner
      : legacyWinner === "third_party"
        ? "third-party"
        : "unknown";
  if (outcome.kind === "no_winner") return "no-winner";
  if (outcome.primary.kind === "faction")
    return outcome.primary.faction === "third_party" ? "third-party" : outcome.primary.faction;
  return outcome.primary.kind;
}
