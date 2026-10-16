/**
 * 负责本地视频项目、复盘与素材的准备。输入为显式文件路径及显示选项，输出纯数据计划和精确素材清单。
 * 相对路径归项目目录；自定义组件只登记模块与名称，不把函数放入渲染 props。本模块不生成语音或改写原归档。
 */
import { createHash } from "node:crypto";
import { readFile, stat, mkdir, copyFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import type { Locale } from "@ai-werewolf-arena/game-text";
import { compileVideoPlan, type VideoPlan, type VideoScript } from "../src/video";
import type { VideoProjectDefinition } from "../src/video-project";
import { parseOfflineReplayJson } from "../src/replay/offline-replay";
import { resolveReplayInput } from "./replay-dev";
import { THEME_IDS, resolveTheme } from "../src/themes";

export interface PrepareVideoOptions {
  input?: string;
  project?: string;
  locale?: Locale;
  timeZone?: string;
}
/** 准备结果拥有脱离的计划与素材来源；绝对路径只留在 Node 侧，不发送给预览页面。 */
export interface PreparedVideo {
  plan: VideoPlan;
  sourcePath: string;
  projectPath?: string;
  layerNames: string[];
  themeSlotNames?: string[];
  assets: Array<{ source: string; relativePath: string; bytes?: Uint8Array }>;
}

/** React 的 memo/forwardRef/lazy 是带标记的组件对象；注册校验不执行组件或恢复计划中的函数。 */
function isLayerComponent(value: unknown): boolean {
  if (typeof value === "function") return true;
  if (!value || typeof value !== "object") return false;
  const marker = (value as { $$typeof?: unknown }).$$typeof;
  return (
    marker === Symbol.for("react.memo") ||
    marker === Symbol.for("react.forward_ref") ||
    marker === Symbol.for("react.lazy")
  );
}

export async function prepareVideo(options: PrepareVideoOptions): Promise<PreparedVideo> {
  const projectPath = options.project ? path.resolve(options.project) : undefined;
  let definition: VideoProjectDefinition | undefined;
  let layerNames: string[] = [];
  let themeSlotNames: string[] = [];
  if (projectPath) {
    const module: Record<string, unknown> = projectPath.endsWith(".json")
      ? { default: JSON.parse(await readFile(projectPath, "utf8")) }
      : await import(pathToFileURL(projectPath).href);
    const value = module.default;
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new Error("video_project_invalid");
    definition = value as VideoProjectDefinition;
    if (typeof definition.input !== "string" || !definition.input.trim())
      throw new Error("video_project_invalid");
    if (module.layers !== undefined) {
      if (!module.layers || typeof module.layers !== "object" || Array.isArray(module.layers))
        throw new Error("video_layers_invalid");
      layerNames = Object.entries(module.layers).map(([name, component]) => {
        if (!isLayerComponent(component)) throw new Error("video_layers_invalid");
        return name;
      });
    }
    if (module.themeSlots !== undefined) {
      if (
        !module.themeSlots ||
        typeof module.themeSlots !== "object" ||
        Array.isArray(module.themeSlots)
      )
        throw new Error("video_theme_slots_invalid");
      const knownSlots = new Set(
        THEME_IDS.flatMap((id) => Object.values(resolveTheme(id).definition.slots)),
      );
      themeSlotNames = Object.entries(module.themeSlots).map(([name, component]) => {
        if (!knownSlots.has(name) || !isLayerComponent(component))
          throw new Error("video_theme_slots_invalid");
        return name;
      });
    }
  }
  const base = projectPath ? path.dirname(projectPath) : process.cwd();
  const input = options.input ? path.resolve(options.input) : definition?.input;
  if (!input) throw new Error("video_input_required");
  const sourcePath = resolveReplayInput(input, base);
  const replay = parseOfflineReplayJson(await readFile(sourcePath, "utf8"));
  const plan = compileVideoPlan(replay, definition?.script as VideoScript | undefined, {
    locale: options.locale ?? replay.meta.locale ?? "zh-CN",
    timeZone: options.timeZone ?? "UTC",
  });
  for (const shot of plan.shots)
    for (const layer of shot.layers)
      if (layer.kind === "custom" && !layerNames.includes(layer.component))
        throw new Error("video_custom_layer_missing");
  const assets: PreparedVideo["assets"] = [];
  const fonts = definition?.fonts;
  if (fonts !== undefined) {
    if (!Array.isArray(fonts)) throw new Error("video_fonts_invalid");
    const keys = new Set<string>();
    plan.fonts = fonts.map((font) => {
      if (
        !font ||
        typeof font !== "object" ||
        Object.keys(font).some((key) => !["family", "src", "weight"].includes(key)) ||
        typeof font.family !== "string" ||
        !font.family.trim() ||
        typeof font.src !== "string" ||
        !font.src.trim() ||
        /^(?:https?:|data:)/i.test(font.src) ||
        (font.weight !== undefined &&
          (typeof font.weight !== "string" ||
            !/^(?:normal|bold|[1-9]00(?: [1-9]00)?)$/.test(font.weight)))
      )
        throw new Error("video_fonts_invalid");
      const weight =
        font.weight === "normal" ? "400" : font.weight === "bold" ? "700" : font.weight;
      const range = weight?.split(" ").map(Number);
      if (range?.length === 2 && range[0]! > range[1]!) throw new Error("video_fonts_invalid");
      const key = `${font.family.trim().toLowerCase()}:${weight ?? "400"}`;
      if (keys.has(key)) throw new Error("video_font_duplicate");
      keys.add(key);
      return {
        family: font.family.trim(),
        src: font.src,
        ...(weight === undefined ? {} : { weight }),
      };
    });
  }
  // 先完整读取并摘要本地资产，输出只引用内容命名路径；原项目和源素材保持只读。
  for (const media of [...plan.media, ...(plan.fonts ?? [])]) {
    if (/^https?:\/\//i.test(media.src)) continue;
    const source = media.src.startsWith("file:")
      ? fileURLToPath(media.src)
      : path.resolve(base, media.src);
    if (!(await stat(source)).isFile()) throw new Error("video_media_invalid");
    const bytes = await readFile(source);
    const digest = createHash("sha256").update(bytes).digest("hex");
    const extension =
      path
        .extname(source)
        .toLowerCase()
        .replace(/[^.a-z0-9]/g, "") || ".bin";
    const relativePath = `assets/${digest}${extension}`;
    media.src = relativePath;
    if (!assets.some((asset) => asset.relativePath === relativePath))
      assets.push({ source, relativePath, bytes: new Uint8Array(bytes) });
  }
  return {
    plan,
    sourcePath,
    ...(projectPath ? { projectPath } : {}),
    layerNames,
    themeSlotNames,
    assets,
  };
}

/** 复制显式素材和 JSON 计划到调用方拥有的目录；失败传播，由上层负责整个临时目录的关闭。 */
export async function materializeVideo(prepared: PreparedVideo, directory: string): Promise<void> {
  for (const asset of prepared.assets) {
    const target = path.join(directory, asset.relativePath);
    await mkdir(path.dirname(target), { recursive: true });
    // 真正准备过的资源发布捕获字节，避免源文件后来变化却仍沿用旧摘要路径。
    if (asset.bytes) await writeFile(target, asset.bytes);
    else await copyFile(asset.source, target);
  }
  await writeFile(path.join(directory, "plan.json"), JSON.stringify(prepared.plan));
}
