/**
 * 负责将默认复盘与单局差异脚本编译为纯数据时间线。输入为原归档、脚本和显示选项，输出镜头、事实视图及媒体轨道。
 * 锚点校验和时间展开在渲染前完成；跳剪仅删镜头，事实视图始终复用完整原事件前缀投影，不执行对局规则。
 */
import {
  readReplayArchive,
  type ReplayDocument,
  type RecordingEnvelope,
  type ReplayFact,
} from "@ai-werewolf-arena/replay-contract";
import { supportsGamePresentation } from "@ai-werewolf-arena/game-presentation";
import { buildReplayEventView } from "../replay/replay-event-view";
import { buildPresentationReplay } from "../replay/replay-presentation";
import { createReplayCursorIndex } from "../replay/replay-projection";
import { presentationPlayers, resolvePlayerPresentations } from "../presentation";
import { resolveTheme } from "../themes";
import {
  DEFAULT_REPLAY_TIME_ZONE,
  validateReplayDisplay,
  type ReplayDisplayOptions,
} from "../replay/replay-display";
import { eventLabel } from "../replay/event-labels";
import {
  paginateVideoCaption,
  videoCaptionBudget,
  estimateVideoReadFrames,
  scheduleVideoCaptionPages,
} from "./captions";
import { getVideoSourceIdentity } from "./source";
import { compileScene, eventScene, factScene, semanticEventGroups } from "./semantic-scenes";
import type {
  AudioCue,
  CameraKeyframe,
  CameraTarget,
  CompiledSpeechCue,
  EventAnchor,
  JsonObject,
  LayerPoint,
  MediaAsset,
  PlannedAudioCue,
  PlannedVideoLayer,
  ShotOptions,
  SpeakerId,
  SpeechCue,
  VideoEventView,
  VideoLayer,
  VideoPlan,
  VideoScript,
  VideoShot,
} from "./types";

export function defineVideoScript(script: VideoScript): VideoScript {
  return script;
}
function fail(reason: string): never {
  throw new Error(`video_${reason}`);
}
function integer(value: number, name: string, min = 0): number {
  if (!Number.isSafeInteger(value) || value < min) fail(`${name}_invalid`);
  return value;
}
function finite(value: number, name: string, min = -Infinity, max = Infinity): number {
  if (!Number.isFinite(value) || value < min || value > max) fail(`${name}_invalid`);
  return value;
}
function nonempty(value: string, name: string): string {
  if (typeof value !== "string" || !value.trim()) fail(`${name}_invalid`);
  return value;
}
function json(value: unknown): void {
  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number" && Number.isFinite(value)) return;
  if (Array.isArray(value)) {
    value.forEach(json);
    return;
  }
  if (
    typeof value === "object" &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)
  ) {
    Object.values(value).forEach(json);
    return;
  }
  fail("custom_props_not_json");
}
function target(target: CameraTarget, playerIds: number[]): void {
  if (target === "table") return;
  if (
    !target ||
    !Array.isArray(target.playerIds) ||
    !target.playerIds.length ||
    new Set(target.playerIds).size !== target.playerIds.length
  )
    fail("camera_target_invalid");
  for (const id of target.playerIds) if (!playerIds.includes(id)) fail(`player_missing:${id}`);
}
function point(value: LayerPoint, playerIds: number[]): void {
  if (!value || typeof value !== "object") fail("layer_point_invalid");
  if ("playerId" in value) target({ playerIds: [value.playerId] }, playerIds);
  else {
    finite(value.x, "point_x");
    finite(value.y, "point_y");
  }
}
function speaker(value: SpeakerId, playerIds: number[]): void {
  if (value === "god") return;
  const id =
    typeof value === "string" && /^player:[1-9]\d*$/.test(value) ? Number(value.slice(7)) : NaN;
  if (!playerIds.includes(id)) fail("speaker_invalid");
}
function compileCamera(
  camera: CameraKeyframe[] | undefined,
  duration: number,
  playerIds: number[],
): CameraKeyframe[] {
  const keys = camera ?? [{ frame: 0, target: "table" }];
  if (!keys.length) fail("camera_empty");
  let previous = -1;
  for (const key of keys) {
    integer(key.frame, "camera_frame");
    if (key.frame >= duration || key.frame <= previous) fail("camera_frame_order_invalid");
    target(key.target, playerIds);
    if (key.zoom !== undefined) finite(key.zoom, "camera_zoom", 0.1, 12);
    if (key.easing !== undefined && !["linear", "smooth", "hold"].includes(key.easing))
      fail("camera_easing_invalid");
    previous = key.frame;
  }
  if (keys[0].frame !== 0) fail("camera_start_missing");
  return structuredClone(keys);
}
function compileLayers(
  layers: VideoLayer[] | undefined,
  duration: number,
  playerIds: number[],
): PlannedVideoLayer[] {
  const ids = new Set<string>();
  return (layers ?? [])
    .map((layer) => {
      nonempty(layer.id, "layer_id");
      if (ids.has(layer.id)) fail("layer_id_duplicate");
      ids.add(layer.id);
      const from = integer(layer.from ?? 0, "layer_from");
      const durationFrames = integer(layer.durationFrames ?? duration - from, "layer_duration", 1);
      if (from + durationFrames > duration) fail("layer_out_of_shot");
      const space =
        layer.space ??
        (["arrow", "highlight", "spotlight", "shake"].includes(layer.kind) ? "world" : "screen");
      if (!["world", "screen"].includes(space)) fail("layer_space_invalid");
      const zIndex = integer(layer.zIndex ?? 0, "layer_z_index");
      switch (layer.kind) {
        case "text":
          if (typeof layer.text !== "string") fail("layer_text_invalid");
          if (layer.x !== undefined) finite(layer.x, "text_x");
          if (layer.y !== undefined) finite(layer.y, "text_y");
          if (layer.width !== undefined) finite(layer.width, "text_width", 1);
          if (layer.fontSize !== undefined) finite(layer.fontSize, "text_font_size", 1);
          break;
        case "arrow":
          point(layer.fromTarget, playerIds);
          point(layer.toTarget, playerIds);
          if (layer.strokeWidth !== undefined) finite(layer.strokeWidth, "arrow_width", 1, 32);
          break;
        case "highlight":
        case "spotlight":
          target({ playerIds: layer.playerIds }, playerIds);
          if (layer.opacity !== undefined) finite(layer.opacity, "layer_opacity", 0, 1);
          break;
        case "flash":
          if (layer.opacity !== undefined) finite(layer.opacity, "layer_opacity", 0, 1);
          break;
        case "shake":
          if (space !== "world") fail("shake_requires_world_space");
          if (layer.intensity !== undefined) finite(layer.intensity, "shake_intensity", 0, 100);
          if (layer.frequency !== undefined) finite(layer.frequency, "shake_frequency", 0.01, 60);
          break;
        case "custom":
          nonempty(layer.component, "custom_component");
          json(layer.props ?? {});
          break;
        default:
          fail("layer_kind_unknown");
      }
      return { ...structuredClone(layer), from, durationFrames, space, zIndex };
    })
    .sort((a, b) => a.zIndex - b.zIndex);
}
function compileMedia(media: MediaAsset[]): MediaAsset[] {
  const ids = new Set<string>();
  return media.map((asset) => {
    nonempty(asset.id, "media_id");
    nonempty(asset.src, "media_src");
    if (ids.has(asset.id)) fail("media_id_duplicate");
    ids.add(asset.id);
    if (!["audio", "image", "video"].includes(asset.kind)) fail("media_kind_invalid");
    if (asset.durationFrames !== undefined) integer(asset.durationFrames, "media_duration", 1);
    if (asset.width !== undefined) integer(asset.width, "media_width", 1);
    if (asset.height !== undefined) integer(asset.height, "media_height", 1);
    return structuredClone(asset);
  });
}
function compileAudio(
  cues: AudioCue[],
  media: MediaAsset[],
  duration: number,
  playerIds: number[],
): PlannedAudioCue[] {
  const ids = new Set<string>();
  return cues.map((cue) => {
    nonempty(cue.id, "audio_id");
    if (ids.has(cue.id)) fail("audio_id_duplicate");
    ids.add(cue.id);
    const asset = media.find((item) => item.id === cue.assetId);
    if (!asset || asset.kind !== "audio") fail("audio_asset_missing");
    const from = integer(cue.from, "audio_from");
    const offsetFrames = integer(cue.offsetFrames ?? 0, "audio_offset");
    const available =
      asset.durationFrames === undefined ? undefined : asset.durationFrames - offsetFrames;
    const durationFrames = integer(
      cue.durationFrames ?? (available === undefined ? NaN : Math.min(available, duration - from)),
      "audio_duration",
      1,
    );
    if (from + durationFrames > duration || (available !== undefined && durationFrames > available))
      fail("audio_out_of_range");
    const volume = finite(cue.volume ?? 1, "audio_volume", 0, 4);
    const fadeInFrames = integer(cue.fadeInFrames ?? 0, "audio_fade_in");
    const fadeOutFrames = integer(cue.fadeOutFrames ?? 0, "audio_fade_out");
    if (fadeInFrames > durationFrames || fadeOutFrames > durationFrames) fail("audio_fade_invalid");
    if (!["voice", "music", "sfx"].includes(cue.track)) fail("audio_track_invalid");
    if (cue.speaker !== undefined) speaker(cue.speaker, playerIds);
    return {
      ...structuredClone(cue),
      from,
      offsetFrames,
      durationFrames,
      volume,
      fadeInFrames,
      fadeOutFrames,
    };
  });
}

export function compileVideoPlan(
  input: ReplayDocument | RecordingEnvelope<ReplayDocument>,
  script?: VideoScript,
  display?: ReplayDisplayOptions,
): VideoPlan {
  const archive = readReplayArchive(input);
  if (archive.identities && !supportsGamePresentation(archive.identities.presentation))
    fail("unsupported_presentation");
  const replay = archive.replay;
  const source = getVideoSourceIdentity(replay);
  if (
    script &&
    (script.source?.sessionId !== source.sessionId ||
      script.source?.fingerprint !== source.fingerprint)
  )
    fail("source_mismatch");
  const options = display ?? {
    locale: replay.meta.locale ?? "zh-CN",
    timeZone: DEFAULT_REPLAY_TIME_ZONE,
  };
  validateReplayDisplay(options);
  const fps = integer(script?.fps ?? 30, "fps", 1);
  // 旧单局脚本的坐标和world图层保持原布局；新项目默认采用广播名册与中央舞台。
  const layout = script?.layout ?? (script ? "legacy-ellipse-v1" : "broadcast-v1");
  if (!["legacy-ellipse-v1", "broadcast-v1"].includes(layout)) fail("layout_invalid");
  const width = integer(script?.width ?? (layout === "broadcast-v1" ? 1920 : 1280), "width", 320);
  const height = integer(script?.height ?? (layout === "broadcast-v1" ? 1080 : 720), "height", 240);
  const defaultDuration = integer(
    script?.defaultEventFrames ?? Math.round(fps * 3),
    "default_event_duration",
    1,
  );
  const pageDuration = integer(
    script?.captionPageFrames ?? Math.round(fps * 3),
    "caption_page_duration",
    1,
  );
  const seed = integer(script?.seed ?? 0, "seed");
  const media = compileMedia(script?.media ?? []);
  const playerIds = replay.players.map((item) => item.player_id);
  const playersPresentation = resolvePlayerPresentations(replay.players, script?.presentation);
  const names = presentationPlayers(playersPresentation);
  const theme = resolveTheme(script?.theme);
  for (const player of playersPresentation) {
    const avatar = player.avatar;
    if (
      avatar.kind === "asset" &&
      !media.some((asset) => asset.id === avatar.assetId && asset.kind === "image")
    )
      fail("avatar_asset_missing");
  }
  const presentation = buildPresentationReplay(replay);
  const visible = new Set(presentation.events.map((event) => event.seq));
  // 让事实投影始终使用完整原序列；过滤只决定默认镜头，不删除状态历史。
  const renderInput = {
    ...options,
    systemPlayers: names,
    replay: { ...presentation, events: replay.events },
  };
  const snapshots = createReplayCursorIndex(replay);
  const facts = replay.facts ?? [];
  const factCounts = Array.from({ length: replay.events.length + 1 }, () => 0);
  for (const fact of facts) factCounts[fact.afterSeq] = fact.seq;
  for (let seq = 1; seq < factCounts.length; seq++)
    factCounts[seq] = Math.max(factCounts[seq]!, factCounts[seq - 1]!);
  const views = new Map<string, VideoEventView>();
  const viewAt = (index: number, throughFactSeq = factCounts[index + 1] ?? 0): VideoEventView => {
    const key = `${index}:${throughFactSeq}`;
    if (!views.has(key)) {
      const latestFact = facts[throughFactSeq - 1];
      const snapshot =
        latestFact?.afterSeq === index + 1
          ? snapshots.facts[throughFactSeq - 1]!
          : index < 0
            ? snapshots.initial
            : snapshots.events[index]!;
      views.set(key, buildReplayEventView(renderInput, index, snapshot));
    }
    return views.get(key)!;
  };
  const eventIndexes = new Map(replay.events.map((event, index) => [event.seq, index]));
  const anchorIndex = (anchor: EventAnchor): number => {
    const index = eventIndexes.get(anchor?.seq);
    if (index === undefined || replay.events[index].type !== anchor.type)
      fail(`anchor_mismatch:${anchor?.seq}`);
    return index;
  };
  const edits = new Map<number, NonNullable<VideoScript["edits"]>[number]>();
  for (const edit of script?.edits ?? []) {
    const index = anchorIndex(edit.anchor);
    if (edits.has(index)) fail("edit_anchor_duplicate");
    edits.set(index, edit);
  }
  const factEdits = new Map<number, NonNullable<VideoScript["factEdits"]>[number]>();
  for (const edit of script?.factEdits ?? []) {
    if (!Number.isSafeInteger(edit.anchor?.seq)) fail(`fact_anchor_mismatch:${edit.anchor?.seq}`);
    const fact = facts[edit.anchor?.seq - 1];
    if (!fact || fact.kind !== edit.anchor.kind) fail(`fact_anchor_mismatch:${edit.anchor?.seq}`);
    if (factEdits.has(fact.seq)) fail("fact_edit_anchor_duplicate");
    factEdits.set(fact.seq, edit);
  }
  const holds = new Map<number, NonNullable<VideoScript["holds"]>>();
  const holdIds = new Set<string>();
  for (const hold of script?.holds ?? []) {
    nonempty(hold.id, "hold_id");
    if (holdIds.has(hold.id)) fail("hold_id_duplicate");
    holdIds.add(hold.id);
    const index = anchorIndex(hold.after);
    if (hold.stateAt) anchorIndex(hold.stateAt);
    holds.set(index, [...(holds.get(index) ?? []), hold]);
  }
  const shots: VideoShot[] = [];
  const shotAudio: AudioCue[] = [];
  let cursor = 0;
  function append(
    index: number,
    id: string,
    kind: VideoShot["kind"],
    edit: ShotOptions = {},
    sourceIndexes = [index],
    committedFacts: ReplayFact[] = [],
  ) {
    const committedFact = committedFacts[0];
    const event = replay.events[index];
    const endIndex = committedFact || kind === "hold" ? index : Math.max(index, ...sourceIndexes);
    const throughSeq = endIndex + 1;
    const throughFactSeq =
      committedFacts.at(-1)?.seq ??
      (kind === "hold" ? factCounts[throughSeq]! : factCounts[Math.max(0, throughSeq - 1)]!);
    const view = viewAt(endIndex, throughFactSeq);
    const primaryView = endIndex === index ? view : viewAt(index, factCounts[Math.max(0, index)]!);
    const sourceEvents = sourceIndexes
      .map((item) => replay.events[item])
      .filter((item) => item !== undefined);
    const base = committedFact
      ? factScene(committedFact, options.locale, names)
      : eventScene(
          event,
          sourceEvents,
          primaryView.label,
          primaryView.stage,
          playerIds,
          options.locale,
        );
    if (committedFacts.length > 1) {
      base.body = committedFacts
        .map((fact) => factScene(fact, options.locale, names).body)
        .join("\n");
      base.targetIds = committedFacts.flatMap((fact) =>
        fact.kind === "life_committed" ? [fact.playerId] : [],
      );
    }
    if (edit.caption !== undefined && typeof edit.caption !== "string") fail("caption_invalid");
    if (edit.caption !== undefined && edit.scene?.body === undefined) {
      base.body = edit.caption;
    }
    // 作者正文优先级显式保持一致；旧布局仅在没有覆盖时保留带事件前缀的标签。
    const body =
      edit.scene?.body ??
      edit.caption ??
      (layout === "broadcast-v1" || committedFact ? base.body : view.label);
    // 显式时长/分页及hold保原作者切片；新广播自动模板才采用新的真实字号预算。
    const budget = videoCaptionBudget(
      edit.durationFrames !== undefined || script?.captionPageFrames !== undefined
        ? "legacy-ellipse-v1"
        : layout,
      theme.options.largeText === true,
    );
    const paginate = (value: string) =>
      paginateVideoCaption(
        value,
        budget.columns,
        budget.maxLines,
        layout === "broadcast-v1" &&
          edit.durationFrames === undefined &&
          script?.captionPageFrames === undefined,
      );
    const captionPages = paginate(body);
    let captionOffset = 0;
    const captionPageOffsets = captionPages.map((page) => {
      const offset = captionOffset;
      captionOffset += page.length;
      return offset;
    });
    const otherLocale = options.locale === "en" ? "zh-CN" : "en";
    const otherScene = committedFact
      ? factScene(committedFact, otherLocale, names)
      : eventScene(
          event,
          sourceEvents,
          event ? eventLabel(event, otherLocale, playerIds, names) : view.label,
          view.stage,
          playerIds,
          otherLocale,
        );
    if (committedFacts.length > 1)
      otherScene.body = committedFacts
        .map((fact) => factScene(fact, otherLocale, names).body)
        .join("\n");
    const otherLabel =
      edit.scene?.body ??
      edit.caption ??
      (layout === "broadcast-v1" || committedFact
        ? otherScene.body
        : event
          ? eventLabel(event, otherLocale, playerIds, names)
          : view.label);
    const otherPages = paginate(otherLabel);
    const pageCount = Math.max(captionPages.length, otherPages.length);
    const automaticSpeaker = edit.scene?.speaker ?? base.speaker;
    const automaticSpeech: SpeechCue[] =
      automaticSpeaker &&
      (layout === "broadcast-v1" ||
        event?.type === "day_speech" ||
        edit.scene?.speaker !== undefined)
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
    const automaticReading =
      layout === "broadcast-v1" &&
      script?.captionPageFrames === undefined &&
      edit.durationFrames === undefined;
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
    );
    const hasResolution = endIndex > index && replay.events[endIndex]!.type === "voted_out";
    const resolutionReadFrames = hasResolution
      ? Math.max(
          ...([options.locale, otherLocale] as const).map((locale) =>
            estimateVideoReadFrames(
              eventLabel(replay.events[endIndex]!, locale, playerIds, names),
              fps,
            ),
          ),
        )
      : 0;
    const finalKind = edit.scene?.kind ?? base.kind;
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
      (layout === "broadcast-v1" &&
        (kind === "hold" || (!event && !committedFact)) &&
        edit.scene?.cues === undefined)
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
        text: eventLabel(replay.events[endIndex]!, options.locale, playerIds, names),
        targetId: Number(replay.events[endIndex]!.payload.target),
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
    if (base.visual) {
      scene.visual = structuredClone(base.visual);
      scene.visual.source = {
        eventSeqs: committedFact ? [] : sourceEvents.map((item) => item.seq),
        factSeqs: committedFacts.map((fact) => fact.seq),
      };
      if (committedFacts.length > 1 && scene.visual.life) {
        scene.visual.effectiveTargetIds = [...base.targetIds];
        scene.visual.effectiveTargetKnown = true;
        scene.visual.life = {
          ...scene.visual.life,
          playerIds: [...base.targetIds],
          committed: true,
          causes: Object.fromEntries(
            committedFacts
              .filter((fact) => fact.kind === "life_committed")
              .map((fact) => [fact.playerId, [...fact.causes]]),
          ),
        };
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
    const compiledSpeech: CompiledSpeechCue[] = speech.map((cue, cueIndex) => {
      speaker(cue.speaker, playerIds);
      if (typeof cue.text !== "string") fail("speech_text_invalid");
      const from = integer(cue.from ?? 0, "speech_from");
      const asset =
        cue.assetId === undefined
          ? undefined
          : media.find((item) => item.id === cue.assetId && item.kind === "audio");
      if (cue.assetId !== undefined && !asset) fail("speech_asset_missing");
      const duration = integer(
        cue.durationFrames ?? asset?.durationFrames ?? durationFrames - from,
        "speech_duration",
        1,
      );
      if (from + duration > durationFrames) fail("speech_out_of_shot");
      if (asset)
        shotAudio.push({
          id: `speech:${id}:${cueIndex}`,
          assetId: asset.id,
          from: cursor + from,
          durationFrames: duration,
          track: "voice",
          speaker: cue.speaker,
        });
      return { ...structuredClone(cue), from, durationFrames: duration };
    });
    const beforeIndex = committedFact ? index : Math.max(-1, Math.min(...sourceIndexes) - 1);
    const beforeFactSeq = committedFact
      ? committedFact.seq - 1
      : factCounts[Math.max(0, beforeIndex + 1)]!;
    const after = { frame: 0, throughSeq, throughFactSeq, view };
    // 旧脚本保持即时状态；广播动作在命中帧才提交完整前缀，不按动画猜伤害或逐张伪造死亡。
    const delayed =
      layout === "broadcast-v1" &&
      kind !== "hold" &&
      (index >= 0 || committedFact) &&
      base.kind !== "speech" &&
      scene.cues.impact > 0;
    const stateCues = delayed
      ? [
          {
            frame: 0,
            throughSeq: Math.max(0, beforeIndex + 1),
            throughFactSeq: beforeFactSeq,
            view: viewAt(beforeIndex, beforeFactSeq),
          },
          ...(endIndex > index
            ? [
                {
                  frame: scene.cues.impact,
                  throughSeq: index + 1,
                  throughFactSeq: factCounts[index]!,
                  view: primaryView,
                },
                { ...after, frame: scene.resolution?.revealFrame ?? scene.cues.settled },
              ]
            : [{ ...after, frame: scene.cues.impact }]),
        ]
      : [after];
    shots.push({
      id,
      kind,
      from: cursor,
      durationFrames,
      eventIndex: index,
      eventSeq: committedFact ? null : (event?.seq ?? null),
      view,
      captionPages,
      captionPageOffsets,
      ...(captionPageRanges ? { captionPageRanges } : {}),
      camera: compileCamera(edit.camera, durationFrames, playerIds),
      layers: compileLayers(edit.layers, durationFrames, playerIds),
      speech: compiledSpeech,
      sourceSeqs: committedFact ? [] : sourceEvents.map((item) => item.seq),
      sourceFacts: committedFacts.map((fact) => fact.seq),
      scene,
      stateCues,
    });
    cursor += durationFrames;
    integer(cursor, "timeline_duration", 1);
  }
  const factsAfter = new Map<number, ReplayFact[]>();
  for (const fact of facts)
    factsAfter.set(fact.afterSeq, [...(factsAfter.get(fact.afterSeq) ?? []), fact]);
  // 内部锚点一旦有导演修改、停留或事实提交，就切开自动聚合；原脚本无需重写整局。
  const barriers = new Set([
    ...edits.keys(),
    ...holds.keys(),
    ...facts.map((fact) => fact.afterSeq - 1),
  ]);
  const { groups, consumed } =
    layout === "broadcast-v1"
      ? semanticEventGroups(
          replay.events,
          playerIds,
          barriers,
          new Set([...edits.keys(), ...holds.keys()]),
        )
      : {
          groups: new Map<number, { indexes: number[]; primary: number }>(),
          consumed: new Set<number>(),
        };
  function appendFacts(afterSeq: number) {
    const pending = factsAfter.get(afterSeq) ?? [];
    for (let index = 0; index < pending.length; index++) {
      const fact = pending[index]!;
      const batch = [fact];
      // 只有同一前缀且owner明确标为同wave的死亡同时揭晓；afterSeq相同本身不是同波证据。
      // 旧档缺waveId或跨原事件前缀时保守逐条陈述提交，不宣称各条属于不同真实死亡波。
      while (
        layout === "broadcast-v1" &&
        fact.kind === "life_committed" &&
        fact.waveId !== undefined &&
        pending[index + 1]?.kind === "life_committed" &&
        (pending[index + 1] as Extract<ReplayFact, { kind: "life_committed" }>).waveId ===
          fact.waveId &&
        pending[index + 1]?.day === fact.day &&
        !factEdits.has(fact.seq) &&
        !factEdits.has(pending[index + 1]!.seq)
      )
        batch.push(pending[++index]!);
      const edit = factEdits.get(fact.seq);
      if (!edit?.skip) append(afterSeq - 1, `fact:${fact.seq}`, "event", edit, [], batch);
    }
  }
  appendFacts(0);
  for (let index = 0; index < replay.events.length; index++) {
    const event = replay.events[index];
    const group = groups.get(index);
    const primaryIndex = group?.primary ?? index;
    const primary = replay.events[primaryIndex]!;
    const edit = edits.get(primaryIndex);
    const incompleteVote =
      layout === "broadcast-v1" && ["vote_cast", "sheriff_vote_cast"].includes(primary.type);
    if (!consumed.has(index) && !edit?.skip && (visible.has(primary.seq) || edit || incompleteVote))
      append(primaryIndex, `event:${primary.seq}`, "event", edit, group?.indexes ?? [index]);
    appendFacts(event.seq);
    for (const hold of holds.get(index) ?? [])
      append(hold.stateAt ? anchorIndex(hold.stateAt) : index, `hold:${hold.id}`, "hold", hold);
  }
  if (!replay.events.length && !facts.length) append(-1, "empty", "event");
  if (!shots.length) fail("timeline_empty");
  const audio = compileAudio([...(script?.audio ?? []), ...shotAudio], media, cursor, playerIds);
  const eventFrames: VideoPlan["eventFrames"] = {};
  for (const shot of shots)
    for (const seq of shot.sourceSeqs) {
      const reveal = shot.stateCues.find((cue) => cue.throughSeq >= seq)!.frame;
      eventFrames[String(seq)] ??= [];
      eventFrames[String(seq)]!.push({
        shotId: shot.id,
        frame: shot.from + (shot.kind === "hold" ? 0 : reveal),
        mode: shot.kind === "hold" ? "revisit" : seq === shot.eventSeq ? "primary" : "absorbed",
      });
    }
  return {
    version: 1,
    source,
    display: { ...options },
    fps,
    width,
    height,
    seed,
    durationFrames: cursor,
    shots,
    media,
    audio,
    layout,
    theme,
    playersPresentation,
    eventFrames,
  };
}

/** 自定义参数辅助类型，供视频项目导出纯 JSON 数据时使用。 */
export type VideoCustomProps = JsonObject;
