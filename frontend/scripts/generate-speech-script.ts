/**
 * 负责导出完整JSONL语音稿与可读对照。输入为原生项目或已编辑语音稿，输出逐场景台词及HTML。
 * 初次导出不覆盖作者文件；报告不合成语音，不把阅读估时写作真实字幕时间。
 */
import { parseArgs } from "node:util";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { prepareVideo } from "./prepare-video";
import { videoSpeechLineId } from "../src/speech";
import { parseSpeechScriptJsonl, speechScriptJsonl, type SpeechScript } from "../src/speech-script";

export function speechScriptReport(document: SpeechScript): string {
  const escape = (value: string) =>
    value.replace(
      /[&<>"']/g,
      (v) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[v]!,
    );
  const lines = document.scenes.flatMap((scene) => scene.lines);
  return `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>完整旁白与发言稿</title><style>body{max-width:1100px;margin:40px auto;padding:0 24px;background:#10171f;color:#e7e4db;font:18px/1.9 system-ui}header{position:sticky;top:0;background:#10171ff5;padding:12px 0}h1{font-size:28px}h2{font-size:23px;margin:0 0 10px}article{padding:28px 0;border-bottom:1px solid #394550}small{color:#9eacb8}p{white-space:pre-wrap;margin:12px 0 20px}b{color:#92d0df}input{box-sizing:border-box;width:100%;padding:12px;background:#202d39;border:1px solid #52616b;color:white;font:inherit}.hidden{display:none}</style><header><h1>完整旁白与发言稿</h1><small>${document.scenes.length} 个场景 · ${lines.length} 段台词 · ${lines.reduce((n, line) => n + Array.from(line.text).length, 0)} 字 · 时间由准备后的音频累加</small><input id="search" placeholder="搜索场景、说话者或正文"></header>${document.scenes.map((scene, index) => `<article><h2>${index + 1}. ${escape(scene.title)}</h2><small>${escape(scene.id)} · events ${scene.source.eventSeqs.join(",")} · facts ${scene.source.factSeqs.join(",")}</small>${scene.lines.map((line) => `<div><b>${line.speaker === "narrator" ? "作者旁白" : line.speaker === "god" ? "上帝" : `${line.speaker.slice(7)}号玩家`}</b> <small>${escape(line.id)}${line.cue ? ` · ${line.cue}` : ""}</small><p>${escape(line.text)}</p>${line.spokenText ? `<small>读音修正：${escape(line.spokenText)}</small>` : ""}</div>`).join("")}</article>`).join("")}<script>search.oninput=()=>document.querySelectorAll('article').forEach(a=>a.classList.toggle('hidden',!a.textContent.toLowerCase().includes(search.value.toLowerCase())))</script></html>`;
}
if (import.meta.main) {
  try {
    const { values } = parseArgs({
      args: process.argv.slice(2),
      strict: true,
      options: {
        project: { type: "string" },
        script: { type: "string" },
        output: { type: "string" },
        report: { type: "string" },
      },
    });
    if (Boolean(values.project) === Boolean(values.script) || (values.project && !values.output))
      throw new Error("speech_script_arguments_required");
    let document: SpeechScript;
    if (values.project) {
      const { plan } = await prepareVideo({ project: values.project, assets: false });
      document = {
        header: { type: "script", version: 1, source: plan.source, chunkGapMs: 0 },
        scenes: plan.shots.map((shot) => ({
          type: "scene",
          id: shot.id,
          title: shot.scene.title,
          source: { eventSeqs: shot.sourceSeqs, factSeqs: shot.sourceFacts },
          lines: shot.speech
            .filter((cue) => cue.text.trim())
            .map((cue, index) => ({
              id: videoSpeechLineId(shot.id, index),
              kind: cue.speaker.startsWith("player:") ? "dialogue" : "narration",
              speaker: cue.speaker,
              text: cue.text,
              ...(shot.scene.resolution && index === shot.speech.length - 1
                ? { cue: "result" as const }
                : index === 0
                  ? { cue: "impact" as const }
                  : {}),
            })),
        })),
      };
      parseSpeechScriptJsonl(speechScriptJsonl(document));
      await mkdir(path.dirname(path.resolve(values.output!)), { recursive: true });
      await writeFile(path.resolve(values.output!), speechScriptJsonl(document), { flag: "wx" });
    } else document = parseSpeechScriptJsonl(await readFile(path.resolve(values.script!), "utf8"));
    if (values.report) {
      await mkdir(path.dirname(path.resolve(values.report)), { recursive: true });
      await writeFile(path.resolve(values.report), speechScriptReport(document));
    }
    console.log(
      JSON.stringify({
        scenes: document.scenes.length,
        lines: document.scenes.reduce((sum, scene) => sum + scene.lines.length, 0),
        ...(values.output ? { output: path.resolve(values.output) } : {}),
      }),
    );
  } catch (error) {
    console.error(
      JSON.stringify({
        error:
          error instanceof Error && /^(speech_|video_)[a-zA-Z0-9_:.-]+$/.test(error.message)
            ? error.message
            : "speech_script_export_failed",
      }),
    );
    process.exitCode = 1;
  }
}
