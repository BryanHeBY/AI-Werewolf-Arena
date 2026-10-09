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

/** Only local IDs and local loader messages may cross this CLI output boundary. */
export function replayCommandFailure(error: unknown, locale: Locale) {
  let candidate: unknown;
  try {
    candidate =
      error && typeof error === "object"
        ? Object.getOwnPropertyDescriptor(error, "message")?.value
        : undefined;
  } catch {
    /* foreign object */
  }
  const code =
    typeof candidate === "string" && codes.includes(candidate as (typeof codes)[number])
      ? candidate
      : "replay_command_failed";
  const message = loaderMessage(error, locale) ?? text(locale, "cli.offline_failed", { code });
  return { code, message };
}
