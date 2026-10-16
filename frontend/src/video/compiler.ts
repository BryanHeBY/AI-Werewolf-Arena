/**
 * 负责将默认复盘与单局差异脚本编译为纯数据时间线。输入为原归档、脚本和显示选项，输出镜头、事实视图及媒体轨道。
 * 锚点校验和时间展开在渲染前完成；跳剪仅删镜头，事实视图始终复用完整原事件前缀投影，不执行对局规则。
 */
import {
  readReplayArchive,
  type ReplayDocument,
  type RecordingEnvelope,
} from "@ai-werewolf-arena/replay-contract";
import { supportsGamePresentation } from "@ai-werewolf-arena/game-presentation";
import { buildReplayFrame, FRAMES_PER_EVENT } from "../replay/replay-frame";
import { buildPresentationReplay } from "../replay/replay-presentation";
import { createReplaySnapshotIndex } from "../replay/replay-projection";
import {
  DEFAULT_REPLAY_TIME_ZONE,
  validateReplayDisplay,
  type ReplayDisplayOptions,
} from "../replay/replay-display";
import { eventLabel } from "../replay/event-labels";
import { paginateVideoCaption } from "./captions";
import { getVideoSourceIdentity } from "./source";
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
  const width = integer(script?.width ?? 1280, "width", 320);
  const height = integer(script?.height ?? 720, "height", 240);
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
  const names = replay.players.map((item) => ({ id: item.player_id, name: item.name }));
  const presentation = buildPresentationReplay(replay);
  const visible = new Set(presentation.events.map((event) => event.seq));
  // 让事实投影始终使用完整原序列；过滤只决定默认镜头，不删除状态历史。
  const renderInput = { ...options, replay: { ...presentation, events: replay.events } };
  const snapshots = createReplaySnapshotIndex(replay);
  const views = new Map<number, VideoEventView>();
  const viewAt = (index: number): VideoEventView => {
    if (!views.has(index))
      views.set(
        index,
        buildReplayFrame(renderInput, Math.max(0, index) * FRAMES_PER_EVENT, snapshots[index]),
      );
    return views.get(index)!;
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
  function append(index: number, id: string, kind: VideoShot["kind"], edit: ShotOptions = {}) {
    const view = viewAt(index);
    if (edit.caption !== undefined && typeof edit.caption !== "string") fail("caption_invalid");
    const captionPages = paginateVideoCaption(edit.caption ?? view.label);
    const otherLabel =
      edit.caption ??
      (index < 0
        ? view.label
        : eventLabel(
            replay.events[index],
            options.locale === "en" ? "zh-CN" : "en",
            playerIds,
            names,
          ));
    const pageCount = Math.max(captionPages.length, paginateVideoCaption(otherLabel).length);
    const event = replay.events[index];
    const automaticSpeech: SpeechCue[] =
      event?.type === "day_speech" &&
      typeof event.payload.text === "string" &&
      playerIds.includes(Number(event.payload.actorId))
        ? [{ speaker: `player:${event.payload.actorId}` as SpeakerId, text: event.payload.text }]
        : [];
    const speech = edit.speech ?? (kind === "event" ? automaticSpeech : []);
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
    const durationFrames = integer(
      edit.durationFrames ?? Math.max(defaultDuration, pageCount * pageDuration, mediaDuration),
      "shot_duration",
      1,
    );
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
    shots.push({
      id,
      kind,
      from: cursor,
      durationFrames,
      eventIndex: index,
      eventSeq: view.eventSeq,
      view,
      captionPages,
      camera: compileCamera(edit.camera, durationFrames, playerIds),
      layers: compileLayers(edit.layers, durationFrames, playerIds),
      speech: compiledSpeech,
    });
    cursor += durationFrames;
    integer(cursor, "timeline_duration", 1);
  }
  for (let index = 0; index < replay.events.length; index++) {
    const event = replay.events[index];
    const edit = edits.get(index);
    if (!edit?.skip && (visible.has(event.seq) || edit))
      append(index, `event:${event.seq}`, "event", edit);
    for (const hold of holds.get(index) ?? [])
      append(hold.stateAt ? anchorIndex(hold.stateAt) : index, `hold:${hold.id}`, "hold", hold);
  }
  if (!replay.events.length) append(-1, "empty", "event");
  if (!shots.length) fail("timeline_empty");
  const audio = compileAudio([...(script?.audio ?? []), ...shotAudio], media, cursor, playerIds);
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
  };
}

/** 自定义参数辅助类型，供视频项目导出纯 JSON 数据时使用。 */
export type VideoCustomProps = JsonObject;
