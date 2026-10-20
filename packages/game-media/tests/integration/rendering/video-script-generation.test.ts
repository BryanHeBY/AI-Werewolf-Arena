/** 完整流程导出测试负责验证可执行原稿和全文对照。输入为独立录像夹具，预期为原生计划逐字段相等及原文保留，不调用TTS。 */
import { expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {
  editableVideoScript,
  generateVideoScript,
} from "../../../../../apps/video/scripts/generate-video-script";
import { prepareVideo } from "../../../../../apps/video/scripts/prepare-video";
import { compileVideoPlan } from "../../../src/video/plan";
import { parseOfflineReplayJson } from "../../../src/replay/offline-replay";

test("a generated TS project reproduces the complete native plan and preserves existing authored files", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "awa-video-script-"));
  const input = path.resolve(
    import.meta.dir,
    "../../fixtures/six-player-mvp/sample/locale-unrecorded/god.replay.json",
  );
  const output = path.join(directory, "native.generated.ts");
  const report = path.join(directory, "flow.html");
  try {
    const original = await prepareVideo({ input });
    const generated = await generateVideoScript({ input, output, report });
    const reproduced = await prepareVideo({ project: output });
    expect(reproduced.plan).toEqual(original.plan);
    expect(generated.shots).toBe(original.plan.shots.length);
    const text = await readFile(output, "utf8");
    expect(text).toContain('"eventSeqs"');
    expect(text).toContain('"durationFrames"');
    const html = await readFile(report, "utf8");
    for (const shot of original.plan.shots) expect(html).toContain(shot.id);
    const authored = path.join(directory, "authored.ts");
    await writeFile(authored, "export default {};\n");
    await expect(generateVideoScript({ input, output: authored })).rejects.toThrow(
      "video_script_output_exists",
    );
    expect(await readFile(authored, "utf8")).toBe("export default {};\n");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("a complete editable copy retains native behavior and changes its own text without the original project", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "awa-editable-script-"));
  const input = path.resolve(
    import.meta.dir,
    "../../fixtures/six-player-mvp/sample/locale-unrecorded/god.replay.json",
  );
  try {
    const output = path.join(directory, "production.ts");
    const native = await prepareVideo({ input });
    await generateVideoScript({ input, output, editable: true });
    const copied = await prepareVideo({ project: output });
    expect(copied.plan).toEqual(native.plan);
    const text = await readFile(output, "utf8");
    expect(text).toContain('"shotEdits"');
    expect(text).not.toContain("native.generated");
    await expect(generateVideoScript({ input, output, editable: true })).rejects.toThrow(
      "video_script_output_exists",
    );
    const replay = parseOfflineReplayJson(await readFile(input, "utf8"));
    const script = editableVideoScript(native.plan, {
      source: native.plan.source,
      layout: "broadcast-v1",
    });
    Object.assign(script.shotEdits![0]!.scene!, {
      body: "修改副本正文。",
      bodySource: "script",
      bodyLayout: "text",
    });
    script.shotEdits![0]!.speech = [{ speaker: "god", text: "修改副本配音。" }];
    const changed = compileVideoPlan(replay, script);
    expect(changed.shots[0]!.scene.body).toBe("修改副本正文。");
    expect(changed.shots[0]!.scene.bodySource).toBe("script");
    expect(changed.shots[0]!.speech[0]!.text).toBe("修改副本配音。");
    expect(native.plan.shots[0]!.scene.body).not.toBe("修改副本正文。");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("a separate browser visuals module keeps Node authoring out of the generated render entry", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "awa-video-visuals-"));
  try {
    const input = path.resolve(
      import.meta.dir,
      "../../fixtures/six-player-mvp/sample/locale-unrecorded/god.replay.json",
    );
    await writeFile(
      path.join(directory, "visuals.ts"),
      "export const layers = {Card: function Card(){return null;}};\n",
    );
    const project = path.join(directory, "project.ts");
    await writeFile(
      project,
      `import { readFileSync } from "node:fs";\nreadFileSync(${JSON.stringify(input)},"utf8");\nexport default {input:${JSON.stringify(input)},visuals:"./visuals.ts"};\n`,
    );
    const prepared = await prepareVideo({ project });
    expect(prepared.layerNames).toEqual(["Card"]);
    expect(prepared.visualsPath).toBe(path.join(directory, "visuals.ts"));
    const { writeVideoEntry } =
      await import("../../../../../apps/video/scripts/render-video-artifact");
    const entry = await readFile(await writeVideoEntry(prepared, directory), "utf8");
    expect(entry).toContain(JSON.stringify(path.join(directory, "visuals.ts")));
    expect(entry).not.toContain(JSON.stringify(project));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
