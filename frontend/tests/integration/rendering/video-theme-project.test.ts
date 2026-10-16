/**
 * 集成测试负责仅主题插槽项目、字体准备与预览／导出接线。输入为本次临时 TS 项目、合成字体字节与独立坏配置，预期取显式注册键、SHA256、源字节和有限错误码。
 * 实际调用准备器、生成入口、Vite 注册插件和预览生命周期；只替代预览子进程，不启动浏览器、下载字体或执行 TTS，不改历史夹具。
 */
import { expect, spyOn, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { materializeVideo, prepareVideo } from "../../../scripts/prepare-video";
import { previewVideo } from "../../../scripts/preview-video";
import { renderVideoArtifact, writeVideoEntry } from "../../../scripts/render-video-artifact";
import { videoPreviewPlugin } from "../../../scripts/video-preview-plugin";
import { getVideoSourceIdentity } from "../../../src/video/source";

const fixture = path.resolve(
  import.meta.dir,
  "../../fixtures/six-player-mvp/sample/locale-unrecorded/god.replay.json",
);
const fontBytes = new Uint8Array([119, 79, 70, 50, 0, 1, 2, 3, 255]);
const fontDigest = createHash("sha256").update(fontBytes).digest("hex");

async function project(
  directory: string,
  additions: Record<string, unknown> = {},
  slot = "gothic-v1/speech",
) {
  const replayText = await readFile(fixture, "utf8");
  await writeFile(path.join(directory, "replay.json"), replayText);
  const filename = path.join(directory, `project-${crypto.randomUUID()}.ts`);
  await writeFile(
    filename,
    `export default ${JSON.stringify({ input: "./replay.json", script: { source: getVideoSourceIdentity(JSON.parse(replayText)), layout: "broadcast-v1", theme: { id: "gothic-v1" } }, ...additions })};\nexport const themeSlots = {${JSON.stringify(slot)}: function SlotOnlyRenderer(){return null;}};\n`,
  );
  return filename;
}

test("a themeSlots-only module reaches preparation, generated export entry and Vite registry without layers", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "awa-video-theme-only-"));
  const previous = process.env.AWA_VIDEO_PROJECT_ENTRY;
  try {
    const filename = await project(directory);
    const prepared = await prepareVideo({ project: filename });
    expect(prepared.layerNames).toEqual([]);
    expect(prepared.themeSlotNames).toEqual(["gothic-v1/speech"]);
    expect(prepared.plan.layout).toBe("broadcast-v1");
    expect(JSON.parse(JSON.stringify(prepared.plan))).toEqual(prepared.plan);
    const entry = await readFile(await writeVideoEntry(prepared, directory), "utf8");
    expect(entry).toContain(`import * as authored from ${JSON.stringify(filename)}`);
    expect(entry).toContain("createVideoRoot(authored.layers, authored.themeSlots)");
    process.env.AWA_VIDEO_PROJECT_ENTRY = filename;
    const plugin = videoPreviewPlugin();
    const resolve = plugin.resolveId as (source: string, importer: string) => string | undefined;
    const load = plugin.load as (source: string) => string | undefined;
    const resolved = resolve("./video-layer-registry", "/workspace/src/video-preview.tsx");
    expect(resolved).toBe("\0awa-video-layers");
    expect(resolve("/src/video-layer-registry.ts", "/workspace/src/video-preview.tsx")).toBe(
      resolved,
    );
    const registry = load(resolved!);
    expect(registry).toContain(`import * as project from ${JSON.stringify(filename)}`);
    expect(registry).toContain("export const themeSlots = project.themeSlots ?? {}");
    expect(registry).toContain("export default project.layers ?? {}");
  } finally {
    if (previous === undefined) delete process.env.AWA_VIDEO_PROJECT_ENTRY;
    else process.env.AWA_VIDEO_PROJECT_ENTRY = previous;
    await rm(directory, { recursive: true, force: true });
  }
});

test("preview startup passes the same theme-only project and prepared assets to Vite and cleans its directory", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "awa-video-theme-preview-"));
  let preparedDirectory = "";
  let command: unknown;
  let captured: { project?: string; replay?: string; bytes?: Uint8Array; fonts?: unknown } = {};
  const before = [process.listenerCount("SIGINT"), process.listenerCount("SIGTERM")];
  const spawn = spyOn(Bun, "spawn");
  try {
    await writeFile(path.join(directory, "local.woff2"), fontBytes);
    const filename = await project(directory, {
      fonts: [{ family: "LocalFont", src: "./local.woff2", weight: "400" }],
    });
    spawn.mockImplementation(((
      _command: unknown,
      options: { env: Record<string, string | undefined> },
    ) => {
      command = _command;
      preparedDirectory = options.env.AWA_VIDEO_PLAN_DIR!;
      captured = {
        project: options.env.AWA_VIDEO_PROJECT_ENTRY,
        replay: options.env.AWA_REPLAY_INPUT,
      };
      return {
        kill() {},
        exited: (async () => {
          const plan = JSON.parse(
            await readFile(path.join(preparedDirectory, "plan.json"), "utf8"),
          );
          captured.fonts = plan.fonts;
          captured.bytes = new Uint8Array(
            await readFile(path.join(preparedDirectory, plan.fonts[0].src)),
          );
          return 0;
        })(),
      };
    }) as unknown as typeof Bun.spawn);
    expect(await previewVideo(["--project", filename, "--port", "4199"])).toBe(0);
    expect(command).toEqual([
      "bun",
      "--no-env-file",
      path.resolve(import.meta.dir, "../../../node_modules/vite/bin/vite.js"),
      "--host",
      "127.0.0.1",
      "--port",
      "4199",
      "--strictPort",
    ]);
    expect(captured.project).toBe(filename);
    expect(captured.replay).toBe(path.join(directory, "replay.json"));
    expect(captured.fonts).toEqual([
      { family: "LocalFont", src: `assets/${fontDigest}.woff2`, weight: "400" },
    ]);
    expect(captured.bytes).toEqual(fontBytes);
    await expect(stat(preparedDirectory)).rejects.toMatchObject({ code: "ENOENT" });
    expect([process.listenerCount("SIGINT"), process.listenerCount("SIGTERM")]).toEqual(before);
  } finally {
    spawn.mockRestore();
    await rm(directory, { recursive: true, force: true });
  }
});

test("prepared font bytes remain content-addressed after source changes and cannot be overwritten by export", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "awa-video-font-bytes-"));
  try {
    const font = path.join(directory, "local.woff2");
    await writeFile(font, fontBytes);
    const filename = await project(directory, {
      fonts: [{ family: "LocalFont", src: "./local.woff2", weight: "400 700" }],
    });
    const projectBefore = await readFile(filename, "utf8");
    const replayBefore = await readFile(path.join(directory, "replay.json"), "utf8");
    const prepared = await prepareVideo({ project: filename });
    expect(prepared.plan.fonts).toEqual([
      { family: "LocalFont", src: `assets/${fontDigest}.woff2`, weight: "400 700" },
    ]);
    expect(new Uint8Array(await readFile(font))).toEqual(fontBytes);
    // 内容寻址承诺针对准备时的字节；后续源编辑不能污染此前计划的同一摘要地址。
    const edited = new Uint8Array([9, 8, 7]);
    await writeFile(font, edited);
    const target = path.join(directory, "prepared");
    await mkdir(target);
    await materializeVideo(prepared, target);
    expect(new Uint8Array(await readFile(path.join(target, `assets/${fontDigest}.woff2`)))).toEqual(
      fontBytes,
    );
    expect(new Uint8Array(await readFile(font))).toEqual(edited);
    expect(await readFile(filename, "utf8")).toBe(projectBefore);
    expect(await readFile(path.join(directory, "replay.json"), "utf8")).toBe(replayBefore);
    await expect(renderVideoArtifact(prepared, { output: font, frame: 0 })).rejects.toThrow(
      "replay_render_source_overwrite",
    );
    expect(new Uint8Array(await readFile(font))).toEqual(edited);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("unknown slot registrations and duplicate, remote or invalid font definitions fail before preview", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "awa-video-theme-rejections-"));
  try {
    await expect(
      prepareVideo({ project: await project(directory, {}, "gothic-v1/future-slot") }),
    ).rejects.toThrow("video_theme_slots_invalid");
    const duplicate = [
      { family: "LocalFont", src: "./font.woff2" },
      { family: "LocalFont", src: "./other.woff2", weight: "normal" },
    ];
    await expect(
      prepareVideo({ project: await project(directory, { fonts: duplicate }) }),
    ).rejects.toThrow("video_font_duplicate");
    for (const fonts of [
      [{ family: "Remote", src: "https://example.invalid/font.woff2" }],
      [{ family: "Remote", src: "http://example.invalid/font.woff2" }],
      [{ family: "Inline", src: "data:font/woff2;base64,AA==" }],
      [{ family: "", src: "./font.woff2" }],
      [{ family: "Local", src: "./font.woff2", weight: "450" }],
      [{ family: "Local", src: "./font.woff2", extra: true }],
    ])
      await expect(prepareVideo({ project: await project(directory, { fonts }) })).rejects.toThrow(
        "video_fonts_invalid",
      );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
