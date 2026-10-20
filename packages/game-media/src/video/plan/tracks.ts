/**
 * 负责纯数据镜头、图层和已准备媒体轨道的编译与范围校验。输入为脚本轨道及镜头时长，输出脱离来源的有序轨道。
 * 不调用 TTS、不解析角色意图；显式音轨的媒体边界与原错误顺序保持一致。
 */
import { fail, integer, finite, nonempty, json } from "./validation";
import { isVideoSpeaker } from "../speakers";
import { validateSpeechAlignment } from "../../speech-timing";
import type {
  CompiledSpeechCue,
  SpeechCue,
  AudioCue,
  CameraKeyframe,
  CameraTarget,
  LayerPoint,
  MediaAsset,
  PlannedAudioCue,
  PlannedVideoLayer,
  SpeakerId,
  VideoLayer,
  VideoTimeConstraint,
} from "../types";

function validateClock(clock?: VideoTimeConstraint): void {
  if (clock === undefined) return;
  if (
    !clock ||
    typeof clock !== "object" ||
    Array.isArray(clock) ||
    Object.keys(clock).some((key) => !["anchor", "position", "duration"].includes(key)) ||
    (clock.anchor !== undefined &&
      !["start", "impact", "result", "end"].includes(clock.anchor) &&
      !/^speech:[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(clock.anchor)) ||
    (clock.position !== undefined && !["fixed", "stretch"].includes(clock.position)) ||
    (clock.duration !== undefined && !["fixed", "stretch"].includes(clock.duration))
  )
    fail("visual_clock_invalid");
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
export function validateSpeaker(value: SpeakerId, playerIds: number[]): void {
  if (!isVideoSpeaker(value, playerIds)) fail("speaker_invalid");
}
export function compileCamera(
  camera: CameraKeyframe[] | undefined,
  duration: number,
  playerIds: number[],
): CameraKeyframe[] {
  const keys = camera ?? [{ frame: 0, target: "table" }];
  if (!keys.length) fail("camera_empty");
  let previous = -1;
  for (const key of keys) {
    validateClock(key.clock);
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
export function compileLayers(
  layers: VideoLayer[] | undefined,
  duration: number,
  playerIds: number[],
): PlannedVideoLayer[] {
  const ids = new Set<string>();
  return (layers ?? [])
    .map((layer) => {
      validateClock(layer.clock);
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
export function compileMedia(media: MediaAsset[]): MediaAsset[] {
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
export function compileAudio(
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
    if (cue.speaker !== undefined) validateSpeaker(cue.speaker, playerIds);
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

/** 调度先确定语音区间；这里只校验说话者/素材并把局部音轨平移到总时间线。 */
export function compileSpeechTrack(
  cues: SpeechCue[],
  options: {
    id: string;
    shotFrom: number;
    durationFrames: number;
    fps: number;
    media: MediaAsset[];
    playerIds: number[];
  },
) {
  const { id, shotFrom, durationFrames, media, playerIds } = options;
  const audio: AudioCue[] = [];
  const speech: CompiledSpeechCue[] = cues.map((cue, cueIndex) => {
    validateSpeaker(cue.speaker, playerIds);
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
    if (cue.alignment) validateSpeechAlignment(cue.alignment, (duration * 1000) / options.fps);
    if (asset)
      audio.push({
        id: `speech:${id}:${cueIndex}`,
        assetId: asset.id,
        from: shotFrom + from,
        durationFrames: duration,
        track: "voice",
        speaker: cue.speaker,
      });
    return { ...structuredClone(cue), from, durationFrames: duration };
  });
  return { speech, audio };
}
