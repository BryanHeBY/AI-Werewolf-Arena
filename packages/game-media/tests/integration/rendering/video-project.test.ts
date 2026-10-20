/**
 * 集成测试负责核对真实项目准备、相对素材和片段导出接线。输入为独立字面脚本和本次临时文件，预期为明确帧区间与原始字节。
 * 浏览器由注入适配器代表；真实 TSX/MP4 另由渲染验收覆盖，本层不调用模型或 TTS、不改历史 fixture。
 */
import { expect, test } from "bun:test";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {
  prepareVideo,
  materializeVideo,
  loadVideoProject,
  compileLoadedVideo,
} from "../../../../../apps/video/scripts/prepare-video";
import {
  renderVideoArtifact,
  type VideoRendering,
} from "../../../../../apps/video/scripts/render-video-artifact";
import { getVideoSourceIdentity } from "../../../src/video/plan";
import { replayCommandFailure } from "@ai-werewolf-arena/game-media/cli-error";

const fixture = path.resolve(
  import.meta.dir,
  "../../fixtures/six-player-mvp/sample/locale-unrecorded/god.replay.json",
);
const example = path.resolve(
  import.meta.dir,
  "../../../../../apps/video/examples/video/custom-layers/project.tsx",
);

test("loading and compiling remain usable without materializing an unrelated missing media file", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "awa-plan-only-"));
  try {
    const replay = JSON.parse(await readFile(fixture, "utf8"));
    const project = path.join(directory, "project.json");
    await writeFile(
      project,
      JSON.stringify({
        input: fixture,
        script: {
          source: getVideoSourceIdentity(replay),
          media: [{ id: "unused", kind: "image", src: "missing.png" }],
        },
      }),
    );
    const loaded = await loadVideoProject({ project });
    const compiled = compileLoadedVideo(loaded);
    expect(compiled.plan.media[0]!.src).toBe("missing.png");
    expect(compiled.assets).toEqual([]);
    expect((await prepareVideo({ project, assets: false })).plan.source).toEqual(
      compiled.plan.source,
    );
    await expect(prepareVideo({ project })).rejects.toThrow("ENOENT");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("script diagnostics expose finite codes and numeric anchors without opaque error prose", () => {
  expect(replayCommandFailure(new Error("video_source_mismatch"), "en").code).toBe(
    "video_source_mismatch",
  );
  expect(replayCommandFailure(new Error("video_anchor_mismatch:152"), "en")).toMatchObject({
    code: "video_anchor_mismatch",
    eventSeq: 152,
  });
  expect(replayCommandFailure(new Error("video_audio_duration_invalid"), "en").code).toBe(
    "video_audio_duration_invalid",
  );
  expect(replayCommandFailure(new Error("video_private_canary_invalid"), "en").code).toBe(
    "replay_command_failed",
  );
  expect(
    replayCommandFailure(new Error("video_anchor_mismatch:PRIVATE_CANARY"), "en").message,
  ).not.toContain("PRIVATE_CANARY");
});

test("typed project keeps custom functions in the module and exposes a JSON-only timeline", async () => {
  const prepared = await prepareVideo({ project: example });
  expect(prepared.layerNames).toEqual(["DecisionBadge"]);
  expect(prepared.plan.durationFrames).toBe(300);
  expect(prepared.plan.shots.map((shot) => [shot.id, shot.from])).toEqual([
    ["event:1", 0],
    ["event:2", 120],
    ["hold:decision-review", 210],
  ]);
  expect(JSON.parse(JSON.stringify(prepared.plan))).toEqual(prepared.plan);
  expect(prepared.plan.shots[2]!.layers.find((layer) => layer.kind === "custom")).toMatchObject({
    component: "DecisionBadge",
  });
});

test("valid React memo and forwardRef components are accepted as custom layers", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "awa-video-react-layers-"));
  try {
    const project = path.join(directory, "project.ts");
    const react = path.resolve(import.meta.dir, "../../../node_modules/react/index.js");
    await writeFile(
      project,
      `import {memo,forwardRef} from ${JSON.stringify(react)}; export default {input:${JSON.stringify(fixture)}}; export const layers={Memo:memo(()=>null),Ref:forwardRef(()=>null)};`,
    );
    const prepared = await prepareVideo({ project });
    expect(prepared.layerNames).toEqual(["Memo", "Ref"]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("project assets resolve from its own directory and copy by content without changing source", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "awa-project-assets-"));
  try {
    const replayText = await readFile(fixture, "utf8");
    await writeFile(path.join(directory, "replay.json"), replayText);
    await mkdir(path.join(directory, "clips"));
    const audio = new Uint8Array([82, 73, 70, 70, 0, 1, 2, 3]);
    await writeFile(path.join(directory, "clips/voice.wav"), audio);
    const project = path.join(directory, "project.json");
    await writeFile(
      project,
      JSON.stringify({
        input: "./replay.json",
        script: {
          source: getVideoSourceIdentity(JSON.parse(replayText)),
          media: [{ id: "voice", kind: "audio", src: "./clips/voice.wav", durationFrames: 90 }],
          audio: [{ id: "narrator", assetId: "voice", from: 0, track: "voice", speaker: "god" }],
        },
      }),
    );
    const prepared = await prepareVideo({ project });
    expect(prepared.plan.media[0]!.src).toMatch(/^assets\/[a-f0-9]{64}\.wav$/);
    const target = path.join(directory, "prepared");
    await mkdir(target);
    await materializeVideo(prepared, target);
    expect(new Uint8Array(await readFile(path.join(target, prepared.plan.media[0]!.src)))).toEqual(
      audio,
    );
    expect(await readFile(path.join(directory, "replay.json"), "utf8")).toBe(replayText);
    const invalid = JSON.parse(await readFile(project, "utf8"));
    invalid.script.source.fingerprint = "wrong";
    await writeFile(project, JSON.stringify(invalid));
    await expect(prepareVideo({ project })).rejects.toThrow();
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("partial export forwards an inclusive source-frame range and closes its own browser", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "awa-video-partial-"));
  try {
    const prepared = await prepareVideo({ project: example });
    let closed = 0,
      range: unknown,
      concurrency: unknown,
      timeout: unknown;
    const browser = {
      close: async () => {
        closed++;
      },
    } as unknown as Awaited<ReturnType<VideoRendering["openBrowser"]>>;
    const rendering: VideoRendering = {
      bundle: async () => "test-bundle",
      openBrowser: async () => browser,
      selectComposition: async () => ({
        id: "Replay",
        durationInFrames: 300,
        width: 1280,
        height: 720,
        fps: 30,
        defaultProps: {},
        props: {},
        defaultCodec: null,
        defaultOutName: null,
        defaultVideoImageFormat: null,
        defaultPixelFormat: null,
        defaultProResProfile: null,
        defaultSampleRate: null,
      }),
      renderStill: async () => {
        throw new Error("unexpected still");
      },
      renderMedia: async (options) => {
        range = options.frameRange;
        concurrency = options.concurrency;
        timeout = options.timeoutInMilliseconds;
        await writeFile(options.outputLocation!, "complete partial");
        return { buffer: null, slowestFrames: [], contentType: "video/mp4" };
      },
    };
    const output = path.join(directory, "partial.mp4");
    await renderVideoArtifact(
      prepared,
      { output, fromFrame: 18, toFrame: 47, concurrency: 3, timeoutMs: 120000 },
      rendering,
    );
    expect(range).toEqual([18, 47]);
    expect(concurrency).toBe(3);
    expect(timeout).toBe(120000);
    expect(closed).toBe(1);
    expect(await readFile(output, "utf8")).toBe("complete partial");
    await expect(renderVideoArtifact(prepared, { output }, rendering)).rejects.toThrow(
      "replay_render_output_exists",
    );
    await expect(
      renderVideoArtifact(
        prepared,
        { output: path.join(directory, "bad.mp4"), fromFrame: 40, toFrame: 20 },
        rendering,
      ),
    ).rejects.toThrow("replay_frame_out_of_range");
    await expect(
      renderVideoArtifact(
        prepared,
        { output: path.join(directory, "bad-timeout.mp4"), timeoutMs: 0.5 },
        rendering,
      ),
    ).rejects.toThrow("video_render_timeout_invalid");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
