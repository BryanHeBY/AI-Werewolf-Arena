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
] as const;
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
  const code =
    typeof candidate === "string" && codes.includes(candidate as (typeof codes)[number])
      ? candidate
      : "replay_command_failed";
  const message = loaderMessage(error, locale) ?? text(locale, "cli.offline_failed", { code });
  return { code, message };
}
