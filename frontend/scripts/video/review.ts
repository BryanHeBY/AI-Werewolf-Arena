/** 负责制作审片页、实际章节与全文对照。输入为已编译项目及JSONL，输出审片文件和媒体索引；不修改台词或生成声音。 */
import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { prepareVideo } from "../prepare-video";
import { speechScriptReport } from "../generate-speech-script";
import { readSpeechScript } from "./speech-script";

export interface ProductionBuild {
  output: string;
  audio: string;
  subtitles: string | null;
}
export interface VideoReview {
  title: string;
  model: string;
  video: string;
  audio: string;
  subtitles: string | null;
  credits?: string;
  seconds: number;
  width: number;
  height: number;
  fps: number;
  scenes: number;
  chapters: Array<{ id: string; from: number; title: string }>;
}
const escape = (value: string) =>
  value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;");
const clock = (seconds: number) =>
  [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, Math.floor(seconds) % 60]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");

export async function writeVideoReview(options: {
  title: string;
  model: string;
  script: string;
  build: ProductionBuild;
  video: string;
  audio?: string;
  directory: string;
}) {
  const { plan } = await prepareVideo({ project: options.build.output, assets: false });
  const document = readSpeechScript(options.script);
  const timeline = await Bun.file(
    path.join(path.dirname(options.build.output), "speech-timeline.json"),
  ).json();
  if (
    timeline.durationFrames !== plan.durationFrames ||
    document.scenes.length !== timeline.scenes.length ||
    document.scenes.some((scene, index) => scene.id !== timeline.scenes[index]?.id)
  )
    throw new Error("video_review_timeline_mismatch");
  const chapters = plan.shots
    .filter(
      (shot) =>
        shot.id.startsWith("intro:") ||
        shot.scene.kind === "phase" ||
        shot.scene.ballot ||
        shot.scene.visual?.family === "duel" ||
        shot.scene.visual?.family === "death_action" ||
        shot.scene.visual?.victory,
    )
    .map((shot) => ({
      id: shot.id,
      from: shot.from / plan.fps,
      title:
        shot.scene.kind === "phase" && !shot.id.startsWith("intro:")
          ? shot.scene.body
          : shot.scene.title,
    }));
  const data: VideoReview = {
    title: options.title,
    model: options.model,
    video: path.resolve(options.video),
    audio: options.audio ?? options.build.audio,
    subtitles: options.build.subtitles,
    seconds: plan.durationFrames / plan.fps,
    width: plan.width,
    height: plan.height,
    fps: plan.fps,
    scenes: plan.shots.length,
    chapters,
  };
  const credits = path.join(path.dirname(data.video), "credits.txt");
  if (await Bun.file(credits).exists()) data.credits = credits;
  const directory = path.resolve(options.directory);
  await mkdir(directory, { recursive: true });
  let index = 0;
  let report = speechScriptReport(document).replaceAll("<article>", () => {
    const scene = timeline.scenes[index++];
    return `<article id="scene-${index}"><a href="./?t=${scene.from / timeline.fps}">${clock(scene.from / timeline.fps)} · 在视频中查看</a>`;
  });
  for (const scene of timeline.scenes)
    for (const line of scene.lines)
      report = report.replace(
        `<small>${line.id}`,
        `<small>${clock((scene.from + line.from) / timeline.fps)} · ${line.id}`,
      );
  await writeFile(path.join(directory, "script-review.html"), report);
  await writeFile(
    path.join(directory, "index.html"),
    `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(data.title)}</title><style>body{margin:0;background:#10171f;color:#eee7d7;font:16px/1.75 system-ui}main{max-width:1440px;margin:28px auto;padding:0 24px}h1{font-size:27px}p{color:#aebcc8}a{color:#9ad3e5}video{display:block;width:100%;max-height:78vh;background:#000}nav{display:flex;gap:12px;flex-wrap:wrap;margin:18px 0}button{background:#202d39;color:#eee7d7;border:1px solid #52616b;padding:8px 12px;border-radius:6px;cursor:pointer}</style><main><h1>${escape(data.title)}</h1><p>${escape(data.model)} · ${clock(data.seconds)} · ${data.width}×${data.height} / ${data.fps}fps</p><video controls preload="metadata" src="./movie.mp4"></video><nav><a href="./movie.mp4" download>下载完整MP4</a><a href="./script-review.html">带时间完整台词</a>${data.subtitles ? '<a href="./subtitles.srt" download>下载SRT字幕</a>' : ""}${data.credits ? '<a href="./credits.txt" download>音乐与音效署名</a>' : ""}</nav><nav>${chapters.map((chapter) => `<button data-time="${chapter.from}">${clock(chapter.from)} ${escape(chapter.title)}</button>`).join("")}</nav></main><script>const v=document.querySelector('video');v.addEventListener('loadedmetadata',()=>{const t=Number(new URLSearchParams(location.search).get('t'));if(Number.isFinite(t)&&t>0&&t<v.duration)v.currentTime=t},{once:true});document.querySelectorAll('[data-time]').forEach(b=>b.onclick=()=>{v.currentTime=Number(b.dataset.time);v.play().catch(()=>{})});</script></html>`,
  );
  await writeFile(path.join(directory, "review.json"), JSON.stringify(data, null, 2) + "\n");
  return { directory, ...data };
}
