import { bundle } from "@remotion/bundler";
import { openBrowser, renderMedia, renderStill, selectComposition } from "@remotion/renderer";
import { parseArgs } from "node:util";
import { mkdtemp, mkdir, readFile, rm, lstat, link } from "node:fs/promises";
import path from "node:path";
import { isLocale } from "@ai-werewolf-arena/game-catalog";
import { resolveReplayInput } from "./replay-dev";
import { parseOfflineReplayJson } from "../src/replay/offline-replay";
import { createReplayRenderInput, FRAMES_PER_EVENT } from "../src/replay/replay-frame";
import { DEFAULT_REPLAY_TIME_ZONE } from "../src/replay/replay-display";

const defaultRendering = { bundle, openBrowser, selectComposition, renderStill, renderMedia };
export async function renderReplay(args: string[], rendering = defaultRendering) {
  const { values } = parseArgs({ args: args[0] === "--" ? args.slice(1) : args, options: {
    input: { type: "string" }, output: { type: "string" }, locale: { type: "string" },
    "time-zone": { type: "string" }, frame: { type: "string" }, browser: { type: "string" },
  }, strict: true, allowPositionals: false });
  if (!values.input || !values.output) throw new Error("replay_render_input_output_required");
  const source = resolveReplayInput(values.input);
  const output = path.resolve(values.output);
  if (path.resolve(source) === output) throw new Error("replay_render_source_overwrite");
  // Refuse existing outputs, including symlinks/hard links, before bundling or opening a browser.
  try { await lstat(output); throw new Error("replay_render_output_exists"); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  const replay = parseOfflineReplayJson(await readFile(source, "utf8"));
  const locale = values.locale ?? replay.meta.locale ?? "zh-CN";
  if (!isLocale(locale)) throw new Error("replay_display_locale_invalid");
  const inputProps = { ...createReplayRenderInput(replay, { locale, timeZone: values["time-zone"] ?? DEFAULT_REPLAY_TIME_ZONE }) };
  const still = values.frame !== undefined;
  const frame = still ? Number(values.frame) : undefined;
  if (still && (!/^\d+$/.test(values.frame!) || !Number.isSafeInteger(frame))) throw new Error("replay_frame_invalid");
  if (path.extname(output) !== (still ? ".png" : ".mp4")) throw new Error("replay_render_output_extension_invalid");
  if (frame !== undefined && frame >= Math.max(inputProps.replay.events.length * FRAMES_PER_EVENT, 1)) throw new Error("replay_frame_out_of_range");
  await mkdir(path.dirname(output), { recursive: true });
  // Keep the artifact on the target file system so link() publishes it atomically and exclusively.
  const temporary = await mkdtemp(path.join(path.dirname(output), ".awa-replay-render-"));
  const artifact = path.join(temporary, still ? "artifact.png" : "artifact.mp4");
  let browser: Awaited<ReturnType<typeof openBrowser>> | undefined;
  const errors: unknown[] = [];
  try {
    const serveUrl = await rendering.bundle({ entryPoint: path.resolve(import.meta.dir, "../src/replay/remotion-entry.tsx"), outDir: path.join(temporary, "bundle") });
    browser = await rendering.openBrowser("chrome", { browserExecutable: values.browser, logLevel: "error" });
    const common = { serveUrl, inputProps, puppeteerInstance: browser, logLevel: "error" as const };
    const composition = await rendering.selectComposition({ ...common, id: "Replay" });
    if (frame !== undefined && frame >= composition.durationInFrames) throw new Error("replay_frame_out_of_range");
    if (still) await rendering.renderStill({ ...common, composition, frame, output: artifact, imageFormat: "png", overwrite: false });
    else await rendering.renderMedia({ ...common, composition, codec: "h264", outputLocation: artifact, concurrency: 2, overwrite: false });
    try { await link(artifact, output); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EEXIST") throw new Error("replay_render_output_exists");
      throw error;
    }
  } catch (error) { errors.push(error); }
  finally {
    if (browser) { try { await browser.close({ silent: true }); } catch (error) { errors.push(error); } }
    try { await rm(temporary, { recursive: true, force: true }); } catch (error) { errors.push(error); }
  }
  if (errors.length === 1) throw errors[0];
  if (errors.length > 1) throw new AggregateError(errors, "replay_render_and_cleanup_failed");

}
if (import.meta.main) {
  try { await renderReplay(process.argv.slice(2)); }
  catch (error) { console.error(error instanceof Error && /^replay_[a-z_]+$/.test(error.message) ? error.message : "replay_render_failed"); process.exitCode = 1; }
}
