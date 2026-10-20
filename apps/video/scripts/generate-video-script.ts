/**
 * 负责导出前端原生完整流程稿。输入为录像或项目路径，输出可执行TS项目和逐镜头HTML对照。
 * 稿件保留编译器的全文、来源与估时时钟；人工修改放在独立覆盖文件，不回写归档或调用TTS。
 */
import { fileURLToPath } from "node:url";
import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { prepareVideo, type PrepareVideoOptions } from "./prepare-video";
import type { VideoProjectDefinition } from "@ai-werewolf-arena/game-media/video-project";
import type { SpeechCue, VideoPlan, VideoScript } from "@ai-werewolf-arena/game-media/video/plan";
import { pathToFileURL } from "node:url";

export interface GeneratedVideoFlowShot {
  id: string;
  eventSeqs: number[];
  factSeqs: number[];
  from: number;
  durationFrames: number;
  title: string;
  text: string;
  speech: SpeechCue[];
}
const marker = "/** 负责保存自动生成的前端完整流程稿。";
/** 展开完整镜头正文与配音供直接编辑；原始事件和事实仍由编译器投影。 */
export function editableVideoScript(plan: VideoPlan, script: VideoScript): VideoScript {
  const previous = new Map((script.shotEdits ?? []).map((edit) => [edit.id, edit]));
  return {
    ...structuredClone(script),
    shotEdits: plan.shots
      .filter((shot) => shot.kind !== "hold")
      .map((shot) => ({
        ...structuredClone(previous.get(shot.id) ?? {}),
        id: shot.id,
        scene: {
          ...structuredClone(previous.get(shot.id)?.scene ?? {}),
          title: shot.scene.title,
          body: shot.scene.body,
          bodySource: shot.scene.bodySource,
          bodyLayout: shot.scene.bodyLayout ?? "structured",
        },
        speech: structuredClone(shot.speech),
        camera: structuredClone(shot.camera),
        layers: structuredClone(shot.layers),
      })),
  };
}
const escape = (value: unknown) =>
  String(value).replace(
    /[&<>"']/g,
    (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!,
  );
export async function generateVideoScript(
  options: PrepareVideoOptions & { output: string; report?: string; editable?: boolean },
) {
  const prepared = await prepareVideo({ ...options, assets: false });
  const { plan } = prepared;
  const output = path.resolve(options.output);
  if (output === prepared.sourcePath || output === prepared.projectPath)
    throw new Error("video_script_source_overwrite");
  try {
    if (!(await readFile(output, "utf8")).startsWith(marker))
      throw new Error("video_script_output_exists");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const flow: GeneratedVideoFlowShot[] = plan.shots.map((shot) => ({
    id: shot.id,
    eventSeqs: shot.sourceSeqs,
    factSeqs: shot.sourceFacts,
    from: shot.from,
    durationFrames: shot.durationFrames,
    title: shot.scene.title,
    text: [shot.scene.body, shot.scene.notes?.title, shot.scene.notes?.body]
      .filter(Boolean)
      .join("\n\n"),
    speech: shot.speech,
  }));
  let definition: VideoProjectDefinition;
  if (prepared.projectPath) {
    definition = prepared.projectPath.endsWith(".json")
      ? JSON.parse(await readFile(prepared.projectPath, "utf8"))
      : (await import(pathToFileURL(prepared.projectPath).href)).default;
    if ((prepared.layerNames.length || prepared.themeSlotNames?.length) && !prepared.visualsPath)
      throw new Error("video_script_generate_from_replay_required");
  } else {
    definition = {
      input: "",
      script: {
        source: plan.source,
        layout: plan.layout,
        theme: { id: plan.theme.id },
        fps: plan.fps,
        width: plan.width,
        height: plan.height,
        pacing: "narration",
      },
    };
  }
  const relative = (file: string) => {
    const value = path.relative(path.dirname(output), file).split(path.sep).join("/");
    return value.startsWith(".") ? value : `./${value}`;
  };
  const originalScript: VideoScript = { ...definition.script!, source: plan.source };
  const script = options.editable
    ? editableVideoScript(plan, originalScript)
    : structuredClone(originalScript);
  const projectBase = prepared.projectPath ? path.dirname(prepared.projectPath) : process.cwd();
  for (const media of script.media ?? [])
    if (!/^(?:https?:|file:)/i.test(media.src))
      media.src = relative(path.resolve(projectBase, media.src));
  const fonts = definition.fonts?.map((font) => ({
    ...font,
    src: relative(path.resolve(projectBase, font.src)),
  }));
  const source = `${options.editable ? "/** 负责保存可编辑的完整制作稿。 输入为锁定录像，输出逐镜头编排；直接修改对应镜头，自动导出不覆盖此文件。 */" : `${marker} 输入为锁定录像，输出原生编排与全文镜头索引；保留原稿作为对照。 */`}\nimport { defineVideoProject } from ${JSON.stringify(relative(fileURLToPath(import.meta.resolve("@ai-werewolf-arena/game-media/video-project"))))};\n${options.editable ? "" : `import type { GeneratedVideoFlowShot } from ${JSON.stringify(relative(path.resolve(import.meta.dir, "generate-video-script")))};\n\nexport const flow: GeneratedVideoFlowShot[] = ${JSON.stringify(flow, null, 2)};\n`}\nexport default defineVideoProject(${JSON.stringify(
    {
      input: relative(prepared.sourcePath),
      script,
      ...(prepared.visualsPath ? { visuals: relative(prepared.visualsPath) } : {}),
      ...(fonts ? { fonts } : {}),
    },
    null,
    2,
  )});\n`;
  await mkdir(path.dirname(output), { recursive: true });
  const temporary = `${output}.${process.pid}.tmp`;
  await writeFile(temporary, source);
  await rename(temporary, output);
  if (options.report) {
    const report = path.resolve(options.report);
    if ([prepared.sourcePath, prepared.projectPath, output].includes(report))
      throw new Error("video_script_source_overwrite");
    await mkdir(path.dirname(report), { recursive: true });
    const reportTitle = options.project ? "项目完整流程稿" : "原生完整流程稿";
    const clock = (frame: number) =>
      `${Math.floor(frame / plan.fps / 60)}:${String(Math.floor(frame / plan.fps) % 60).padStart(2, "0")}`;
    await writeFile(
      report,
      `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>${reportTitle}</title><style>body{margin:40px auto;max-width:1120px;background:#10171f;color:#eee7d7;font:17px/1.8 system-ui;padding:0 24px}a{color:#ceb480}header{position:sticky;top:0;background:#10171ff5;padding:16px 0}input{width:90%;padding:12px;background:#202d39;color:white;border:1px solid #52616b}article{padding:24px 0;border-bottom:1px solid #394550}h2{font-size:22px}p{white-space:pre-wrap}small{color:#adbac4}.hidden{display:none}</style><header><h1>${reportTitle}</h1><div>${escape(plan.source.sessionId)} · ${flow.length} 镜头 · 估时 ${clock(plan.durationFrames)} · ${plan.fps}fps</div><small>${options.project ? "当前项目编排，包含显式微调。" : "前端原生编排，含完整发言与原生结算。"}当前时长由已编译计划给出；未绑定TTS时为阅读估时。</small><p><input id="search" placeholder="搜索玩家、台词、事件序号"></p></header>${flow
        .map(
          (shot, index) =>
            `<article id="${escape(shot.id)}"><small>${index + 1} / ${flow.length} · ${clock(shot.from)} · ${escape(shot.id)} · 事件 ${escape(shot.eventSeqs.join(","))} · 事实 ${escape(shot.factSeqs.join(","))} · ${shot.durationFrames} 帧</small><h2>${escape(shot.title)}</h2><p>${escape(shot.text)}</p>${shot.speech
              .filter((cue) => cue.text !== shot.text)
              .map(
                (cue) =>
                  `<details><summary>配音 · ${escape(cue.speaker)}</summary><p>${escape(cue.text)}</p></details>`,
              )
              .join("")}</article>`,
        )
        .join(
          "",
        )}<script>document.getElementById('search').addEventListener('input',e=>{for(const row of document.querySelectorAll('article'))row.classList.toggle('hidden',!row.textContent.toLowerCase().includes(e.target.value.toLowerCase()))})</script></html>`,
    );
  }
  return {
    source: plan.source,
    shots: flow.length,
    durationFrames: plan.durationFrames,
    fps: plan.fps,
    output,
  };
}
if (import.meta.main) {
  try {
    const { values } = parseArgs({
      args: process.argv.slice(2),
      strict: true,
      options: {
        input: { type: "string" },
        project: { type: "string" },
        output: { type: "string" },
        report: { type: "string" },
        editable: { type: "boolean" },
      },
    });
    if (!values.output) throw new Error("video_script_output_required");
    console.log(JSON.stringify(await generateVideoScript({ ...values, output: values.output })));
  } catch (error) {
    console.error(error instanceof Error ? error.message : "video_script_generation_failed");
    process.exitCode = 1;
  }
}
