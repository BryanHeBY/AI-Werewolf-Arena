/**
 * 负责单镜头统一时间安排。输入为双语正文、显式导演时钟和已准备音频，输出场景节点、字幕页、结果揭晓和语音区间。
 * 自动阅读同时容纳两语预算；作者时钟优先，无法表达的节点仍报原错误；状态切换只消费本次计算的 reveal。
 */
import {
  paginateVideoCaption,
  videoCaptionBudget,
  estimateVideoReadFrames,
  scheduleVideoCaptionPages,
  scheduleVideoReading,
  readVideoSpeechReadingOptions,
} from "../captions";
import { compileScene } from "../semantic-scenes";
import type {
  MediaAsset,
  ShotOptions,
  SpeechCue,
  VideoLayoutId,
  VideoShot,
  VideoSpeechReadingOptions,
} from "../types";
import type { VideoShotContent } from "./shot-content";
import { fail, integer } from "./validation";

export interface VideoShotTimingOptions {
  fps: number;
  layout: VideoLayoutId;
  kind: VideoShot["kind"];
  eventType?: string;
  hasRecord: boolean;
  defaultDuration: number;
  pageDuration: number;
  explicitPageClock: boolean;
  largeText: boolean;
  media: MediaAsset[];
  playerIds: number[];
  speechReading?: VideoSpeechReadingOptions;
}
export function scheduleVideoShot(
  content: VideoShotContent,
  edit: ShotOptions,
  options: VideoShotTimingOptions,
) {
  const {
    fps,
    layout,
    kind,
    eventType,
    hasRecord,
    defaultDuration,
    pageDuration,
    explicitPageClock,
    largeText,
    media,
    playerIds,
  } = options;
  const { base, body, otherBody, resolution } = content;
  // 全文流只属于新广播自动时钟；显式作者时长/分页和hold继续原连续切片契约。
  const automaticReading =
    layout === "broadcast-v1" &&
    !explicitPageClock &&
    edit.durationFrames === undefined &&
    kind !== "hold";
  // 显式时长/分页及hold保原作者切片；新广播自动模板才采用新的真实字号预算。
  const budget = videoCaptionBudget(
    edit.durationFrames !== undefined || explicitPageClock ? "legacy-ellipse-v1" : layout,
    largeText,
  );
  const paginate = (value: string) =>
    paginateVideoCaption(
      value,
      budget.columns,
      budget.maxLines,
      layout === "broadcast-v1" && edit.durationFrames === undefined && !explicitPageClock,
    );
  const captionPages = automaticReading ? [body] : paginate(body);
  let captionOffset = 0;
  const captionPageOffsets = captionPages.map((page) => {
    const offset = captionOffset;
    captionOffset += page.length;
    return offset;
  });
  const otherPages = automaticReading ? [otherBody] : paginate(otherBody);
  const pageCount = Math.max(captionPages.length, otherPages.length);
  const automaticSpeaker = edit.scene?.speaker ?? base.speaker;
  const automaticSpeech: SpeechCue[] =
    automaticSpeaker &&
    (layout === "broadcast-v1" || eventType === "day_speech" || edit.scene?.speaker !== undefined)
      ? [{ speaker: automaticSpeaker, text: edit.scene?.body ?? edit.caption ?? base.body }]
      : [];
  let speech = edit.speech ?? (kind === "event" ? automaticSpeech : []);
  const mediaDuration = Math.max(
    0,
    ...speech.map(
      (cue) =>
        (cue.from ?? 0) +
        (cue.durationFrames ??
          media.find((asset) => asset.id === cue.assetId)?.durationFrames ??
          0),
    ),
  );
  // 纯记录没有发动/命中动画，默认立即可读；作者任一显式时钟仍完全优先，未知事件不套此快速预设。
  const compactNotice =
    automaticReading &&
    base.kind === "fallback" &&
    base.visual?.process === "notice" &&
    base.visual.fallbackReason === "recorded_notice_without_inferred_effect" &&
    edit.scene?.cues === undefined;
  const readFrames = captionPages.map((page) => estimateVideoReadFrames(page, fps));
  const otherReadFrames = otherPages.map((page) => estimateVideoReadFrames(page, fps));
  const readingDuration = Math.max(
    readFrames.reduce((a, b) => a + b, 0),
    otherReadFrames.reduce((a, b) => a + b, 0),
    content.structuredReadText ? estimateVideoReadFrames(content.structuredReadText, fps) : 0,
    content.otherStructuredReadText
      ? estimateVideoReadFrames(content.otherStructuredReadText, fps)
      : 0,
  );
  const hasResolution = resolution !== undefined;
  const resolutionReadFrames = resolution
    ? Math.max(
        estimateVideoReadFrames(resolution.text, fps),
        estimateVideoReadFrames(resolution.otherText, fps),
      )
    : 0;
  const finalKind = edit.scene?.kind ?? base.kind;
  const authoredSpeechReading = readVideoSpeechReadingOptions(edit.speechReading);
  // 全局策略略过票型、结果及旧时钟；逐段显式写在不适用节点则拒绝，避免接受后不生效。
  if (authoredSpeechReading && (!automaticReading || finalKind !== "speech"))
    fail("speech_reading_unavailable");
  const speechReading =
    automaticReading && finalKind === "speech"
      ? (authoredSpeechReading ?? options.speechReading ?? { motion: "line" as const })
      : undefined;
  const readingSettled =
    finalKind === "speech" || compactNotice
      ? 0
      : Math.max(Math.round((fps * 40) / 30), ...Object.values(edit.scene?.cues ?? {}));
  const durationFrames = integer(
    edit.durationFrames ??
      Math.max(
        defaultDuration,
        pageCount * pageDuration,
        mediaDuration +
          (automaticReading && speech.some((cue) => cue.assetId) ? Math.round(fps * 0.4) : 0),
        automaticReading ? readingSettled + readingDuration + resolutionReadFrames : 0,
      ),
    "shot_duration",
    1,
  );
  const scene = compileScene(base, edit.scene, edit.emphasis, fps, durationFrames, playerIds);
  if (edit.caption !== undefined || edit.scene?.body !== undefined) scene.bodySource = "script";
  if (
    compactNotice ||
    (layout === "broadcast-v1" && (kind === "hold" || !hasRecord) && edit.scene?.cues === undefined)
  )
    scene.cues = { establish: 0, travel: 0, impact: 0, settled: 0 };
  if (layout === "broadcast-v1" && scene.kind !== "speech") {
    if (pageCount > durationFrames) fail("caption_duration_too_short");
    const latestImpact = durationFrames - pageCount;
    if (scene.cues.impact > latestImpact) {
      // 自动节拍为每页保留至少一帧；显式节拍冲突必须报告，不能悄悄吞掉第一页。
      if (
        edit.scene?.cues?.impact !== undefined ||
        (edit.scene?.cues?.travel ?? 0) > latestImpact ||
        (edit.scene?.cues?.establish ?? 0) > latestImpact
      )
        fail("caption_reveal_conflict");
      scene.cues.impact = latestImpact;
      scene.cues.travel = Math.min(scene.cues.travel, latestImpact);
      scene.cues.establish = Math.min(scene.cues.establish, scene.cues.travel);
    }
    if (!edit.speech && kind === "event" && speech.length)
      speech = [
        {
          speaker: speech[0]!.speaker,
          text: scene.body,
          from: scene.cues.impact,
          durationFrames: durationFrames - scene.cues.impact,
        },
      ];
  }
  if (hasResolution) {
    scene.resolution = {
      text: resolution!.text,
      targetId: resolution!.targetId,
      ...(resolution!.ballot ? { ballot: resolution!.ballot } : {}),
      // 结果是第二条原始记录；自动播报先读完票型，再揭晓结果并给它独立停留。
      revealFrame:
        automaticReading && edit.scene?.cues?.settled === undefined
          ? readingSettled + readingDuration
          : scene.cues.settled,
    };
    if (!edit.speech && speech.length && kind === "event") {
      const resolution = scene.resolution;
      const voice = speech[0]!.speaker;
      speech =
        resolution.revealFrame > scene.cues.impact
          ? [
              {
                speaker: voice,
                text: scene.body,
                from: scene.cues.impact,
                durationFrames: resolution.revealFrame - scene.cues.impact,
              },
              {
                speaker: voice,
                text: resolution.text,
                from: resolution.revealFrame,
                durationFrames: durationFrames - resolution.revealFrame,
              },
            ]
          : [
              {
                speaker: voice,
                text: `${scene.body}\n${resolution.text}`,
                from: scene.cues.impact,
                durationFrames: durationFrames - scene.cues.impact,
              },
            ];
    }
  }
  const captionPageRanges = automaticReading
    ? scheduleVideoCaptionPages(
        finalKind === "speech" ? 0 : scene.cues.impact,
        finalKind === "speech" ? 0 : scene.cues.settled,
        durationFrames,
        readFrames,
      )
    : undefined;
  const readingEnd = scene.resolution?.revealFrame ?? durationFrames;
  const readingFrom = finalKind === "speech" ? 0 : scene.cues.impact;
  const reading = automaticReading
    ? scheduleVideoReading(
        readingFrom,
        readingEnd,
        finalKind === "speech" ? 0 : scene.cues.settled,
        fps,
        speechReading,
      )
    : undefined;
  if (automaticReading && scene.resolution)
    scene.resolution.reading = scheduleVideoReading(
      scene.resolution.revealFrame,
      durationFrames,
      scene.resolution.revealFrame,
      fps,
    );
  return {
    reading,
    scene,
    durationFrames,
    captionPages,
    captionPageOffsets,
    captionPageRanges,
    speech,
    reveal: {
      impact: scene.cues.impact,
      result: scene.resolution?.revealFrame ?? scene.cues.settled,
    },
  };
}
export type VideoShotTiming = ReturnType<typeof scheduleVideoShot>;
