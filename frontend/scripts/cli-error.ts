/**
 * 负责将前端离线命令异常转为有限的双语诊断。输入为未知错误和显示语言，输出本地错误码与文案。
 * 仅接纳白名单字段与 HTTP 状态，不直接输出任意异常文字；描述符读取也可能触发外来 Proxy，失败时退回通用诊断。
 */
import { text, renderMessage, type Locale } from "@ai-werewolf-arena/game-text";
import { ReplayLoadError } from "../src/replay/offline-replay";

const codes = [
  "replay_dev_usage",
  "replay_render_input_output_required",
  "replay_render_source_overwrite",
  "replay_render_output_exists",
  "replay_frame_invalid",
  "replay_render_output_extension_invalid",
  "replay_frame_out_of_range",
  "replay_render_and_cleanup_failed",
  "replay_display_locale_invalid",
  "replay_display_time_zone_invalid",
  "video_project_invalid",
  "video_layers_invalid",
  "video_custom_layer_missing",
  "video_input_required",
  "video_media_invalid",
  "video_frame_range_invalid",
  "video_preview_port_invalid",
  "video_source_mismatch",
  "video_anchor_mismatch",
  "video_player_missing",
  "video_camera_empty",
  "video_camera_frame_order_invalid",
  "video_camera_start_missing",
  "video_camera_target_invalid",
  "video_camera_easing_invalid",
  "video_camera_zoom_invalid",
  "video_edit_anchor_duplicate",
  "video_hold_id_duplicate",
  "video_timeline_empty",
  "video_custom_props_not_json",
  "video_layer_id_duplicate",
  "video_layer_out_of_shot",
  "video_layer_space_invalid",
  "video_layer_kind_unknown",
  "video_layer_point_invalid",
  "video_layer_text_invalid",
  "video_shake_requires_world_space",
  "video_media_id_duplicate",
  "video_media_kind_invalid",
  "video_audio_id_duplicate",
  "video_audio_asset_missing",
  "video_audio_out_of_range",
  "video_audio_fade_invalid",
  "video_audio_track_invalid",
  "video_speaker_invalid",
  "video_speech_text_invalid",
  "video_speech_asset_missing",
  "video_speech_out_of_shot",
  "video_caption_invalid",
  "video_unsupported_presentation",
  "video_frame_invalid",
  "video_plan_empty",
] as const;
// 编译器的具名数值检查仅允许有限字段；不按任意 video_ 前缀放行外来异常正文。
const videoNumericFields = new Set([
  "fps",
  "width",
  "height",
  "seed",
  "default_event_duration",
  "caption_page_duration",
  "timeline_duration",
  "shot_duration",
  "camera_frame",
  "camera_zoom",
  "point_x",
  "point_y",
  "layer_from",
  "layer_duration",
  "layer_z_index",
  "text_x",
  "text_y",
  "text_width",
  "text_font_size",
  "arrow_width",
  "layer_opacity",
  "shake_intensity",
  "shake_frequency",
  "media_duration",
  "media_width",
  "media_height",
  "audio_from",
  "audio_duration",
  "audio_offset",
  "audio_volume",
  "audio_fade_in",
  "audio_fade_out",
  "speech_from",
  "speech_duration",
]);
const videoStringFields = new Set([
  "layer_id",
  "custom_component",
  "media_id",
  "media_src",
  "audio_id",
  "hold_id",
]);
function loaderMessage(error: unknown, locale: Locale): string | undefined {
  try {
    if (!(error instanceof ReplayLoadError)) return undefined;
    const ref = Object.getOwnPropertyDescriptor(error, "messageRef")?.value;
    if (!ref || typeof ref !== "object") return undefined;
    // 只读取自有数据描述符；不主动调用 messageRef 内的 getter，也不把相同文案当作可信诊断。
    const fields = Object.getOwnPropertyDescriptors(ref);
    if (
      Object.entries(fields).some(
        ([key, field]) => !["key", "parameters"].includes(key) || !("value" in field),
      )
    )
      return undefined;
    const key = fields.key?.value;
    if (
      ![
        "replay.invalid_file",
        "replay.missing_fields",
        "replay.unsupported_version",
        "replay.read_failed",
        "replay.http_failed",
      ].includes(key)
    )
      return undefined;
    const parameters = fields.parameters?.value;
    if (key === "replay.http_failed") {
      if (!parameters || typeof parameters !== "object") return undefined;
      const params = Object.getOwnPropertyDescriptors(parameters);
      const status = params.status?.value;
      if (
        Object.keys(params).length !== 1 ||
        typeof status !== "number" ||
        !Number.isInteger(status) ||
        status < 100 ||
        status > 599
      )
        return undefined;
      return renderMessage(locale, { key: "replay.http_failed", parameters: { status } });
    }
    if (
      parameters !== undefined &&
      (!parameters ||
        typeof parameters !== "object" ||
        Object.getOwnPropertyNames(parameters).length)
    )
      return undefined;
    return renderMessage(locale, { key });
  } catch {
    return undefined;
  }
}

/** 只有本地白名单错误码和已核对的加载文案可以进入 CLI 输出。 */
export function replayCommandFailure(error: unknown, locale: Locale) {
  let candidate: unknown;
  try {
    candidate =
      error && typeof error === "object"
        ? Object.getOwnPropertyDescriptor(error, "message")?.value
        : undefined;
  } catch {
    /* 外来对象的描述符查询失败，继续使用通用错误码。 */
  }
  let code = "replay_command_failed";
  let reference: { eventSeq?: number; playerId?: number } = {};
  if (typeof candidate === "string") {
    if (codes.includes(candidate as (typeof codes)[number])) code = candidate;
    const invalid = /^video_([a-z_]+)_invalid$/.exec(candidate);
    if (invalid && (videoNumericFields.has(invalid[1]!) || videoStringFields.has(invalid[1]!)))
      code = candidate;
    const anchor = /^(video_anchor_mismatch|video_player_missing):(\d+)$/.exec(candidate);
    if (anchor && Number.isSafeInteger(Number(anchor[2]))) {
      code = anchor[1]!;
      reference =
        code === "video_anchor_mismatch"
          ? { eventSeq: Number(anchor[2]) }
          : { playerId: Number(anchor[2]) };
    }
  }
  const message = loaderMessage(error, locale) ?? text(locale, "cli.offline_failed", { code });
  return { code, message, ...reference };
}
