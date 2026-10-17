/**
 * 负责复用正式Remotion入口导出逐场景PNG图库与可追溯索引。输入为明确输出目录与本机浏览器，输出独占文件和失败集合。
 * 临时bundle和浏览器由本调用关闭，不改归档或生产计划；图片必须由评审者实际查看，机器导出成功不等于视觉验收通过。
 */
import path from "node:path";
import { parseArgs } from "node:util";
import { mkdir, mkdtemp, rm, writeFile, lstat, readFile } from "node:fs/promises";
import { bundle } from "@remotion/bundler";
import { openBrowser, selectComposition, renderStill, renderMedia } from "@remotion/renderer";
import { createArtGalleryCases } from "../tests/support/art-gallery-cases";
import { writeVideoEntry } from "./render-video-artifact";
import { createRecordedGalleryCases } from "./recorded-gallery-cases";
import { createRepairGalleryCases } from "./repair-gallery-cases";
import { videoGallerySource } from "./gallery-source";

const { values } = parseArgs({
  args: process.argv.slice(2),
  strict: true,
  options: {
    output: { type: "string" },
    browser: { type: "string" },
    only: { type: "string" },
    ids: { type: "string" },
    motion: { type: "boolean", default: false },
    resume: { type: "boolean", default: false },
    input: { type: "string" },
    locale: { type: "string" },
    repairs: { type: "boolean", default: false },
  },
});
if (!values.output) throw new Error("art_gallery_output_required");
const output = path.resolve(values.output);
await mkdir(output, { recursive: true });
const selectedIds = values.ids ? new Set(values.ids.split(",")) : undefined;
if (values.locale && !["zh-CN", "en"].includes(values.locale))
  throw new Error("art_gallery_locale_invalid");
if (values.input && values.repairs) throw new Error("art_gallery_source_conflict");
const cases = (
  values.input
    ? await createRecordedGalleryCases(
        path.resolve(values.input),
        values.locale as "zh-CN" | "en" | undefined,
      )
    : values.repairs
      ? createRepairGalleryCases()
      : await createArtGalleryCases()
).filter(
  (c) => (!values.only || c.id.includes(values.only!)) && (!selectedIds || selectedIds.has(c.id)),
);
if (selectedIds && cases.length !== selectedIds.size) throw new Error("art_gallery_unknown_id");
if (!cases.length) throw new Error("art_gallery_no_cases");
let previous: { sourceDigest: string; cases: Array<Record<string, unknown>> } | undefined;
if (values.resume) previous = JSON.parse(await readFile(path.join(output, "gallery.json"), "utf8"));
const records: Array<Record<string, unknown>> = (previous?.cases ?? []).map((record) => ({
  ...record,
  sourceDigest: record.sourceDigest ?? previous!.sourceDigest,
}));
const completedIds = new Set(records.map((record) => record.id));
for (const record of records) await lstat(path.join(output, String(record.file)));
for (const c of cases.filter((candidate) => !completedIds.has(candidate.id))) {
  try {
    await lstat(path.join(output, `${c.id}.png`));
    throw new Error(`art_gallery_output_exists:${c.id}`);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}
const temporary = await mkdtemp(path.join(output, ".art-gallery-"));
let browser: Awaited<ReturnType<typeof openBrowser>> | undefined;
const errors: unknown[] = [];
// 源码摘要在bundle前计算，人工复查能确认图片确实来自同一份实现；不把git提交号等同于工作区内容。
const { sourceDigest, sourceFileCount } = await videoGallerySource(
  path.resolve(import.meta.dir, ".."),
  ["game-contract", "game-catalog", "game-text", "game-presentation", "replay-contract"].map(
    (name) => path.resolve(import.meta.dir, "../../packages", name, "src"),
  ),
);
try {
  const publicDir = path.join(temporary, "public");
  await mkdir(publicDir);
  const first = cases[0]!;
  const entryPoint = await writeVideoEntry(
    { plan: first.plan, sourcePath: "", layerNames: [], assets: [] },
    temporary,
  );
  const serveUrl = await bundle({ entryPoint, outDir: path.join(temporary, "bundle"), publicDir });
  browser = await openBrowser("chrome", { browserExecutable: values.browser, logLevel: "error" });
  for (const c of cases.filter((candidate) => !completedIds.has(candidate.id))) {
    const common = {
      serveUrl,
      inputProps: { plan: c.plan },
      puppeteerInstance: browser,
      logLevel: "error" as const,
    };
    const composition = await selectComposition({ ...common, id: "Replay" });
    await renderStill({
      ...common,
      composition,
      frame: c.frame,
      output: path.join(output, `${c.id}.png`),
      imageFormat: "png",
      overwrite: false,
    });
    const shot = c.plan.shots.find(
      (s) => c.frame >= s.from && c.frame < s.from + s.durationFrames,
    )!;
    // 动画验收从该镜头起点开始，覆盖建立、命中与停稳；截短只用于验收片，不修改正式计划。
    const motionEnd = Math.min(shot.from + shot.durationFrames - 1, shot.from + c.plan.fps * 6 - 1);
    if (values.motion)
      await renderMedia({
        ...common,
        composition,
        codec: "h264",
        pixelFormat: "yuv420p",
        crf: 18,
        frameRange: [shot.from, motionEnd],
        concurrency: 2,
        outputLocation: path.join(output, `${c.id}.mp4`),
        overwrite: false,
      });
    records.push({
      id: c.id,
      file: `${c.id}.png`,
      sourceKind: c.sourceKind,
      provenance: c.provenance,
      frame: c.frame,
      template: shot.scene.visual?.template,
      family: shot.scene.visual?.family,
      process: shot.scene.visual?.process,
      cues: shot.scene.cues,
      report: shot.scene.visual?.report,
      source: c.plan.source,
      sourceSeqs: shot.sourceSeqs,
      body: shot.scene.body,
      theme: c.plan.theme.id,
      width: c.plan.width,
      height: c.plan.height,
      reviewedBy: [],
      sourceDigest,
      ...(values.motion ? { motionFile: `${c.id}.mp4`, motionRange: [shot.from, motionEnd] } : {}),
    });
    await writeFile(
      path.join(output, "gallery.json"),
      JSON.stringify(
        {
          description:
            "Records actual rendered PNGs and manual review; empty reviewedBy means unreviewed.",
          createdAt: new Date().toISOString(),
          sourceDigest,
          sourceFileCount,
          cases: records,
        },
        null,
        2,
      ) + "\n",
    );
    console.log(`${records.length}/${cases.length} ${c.id}`);
  }
  const html = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>Rendered scene gallery</title><style>body{background:#111a23;color:#eee;font:16px sans-serif;margin:24px}article{margin:24px 0}img{width:min(100%,1280px);height:auto;display:block}p{max-width:1280px}a{color:#b7d4ed}</style><h1>Rendered scene gallery</h1><p>Teaching archives and explicit review fixtures are identified separately. Every image is rendered through VideoComposition and Remotion. Export success alone does not mean visual acceptance.</p>${records.map((r) => `<article id="${r.id}"><h2>${r.id}</h2><p>${r.sourceKind} · ${r.family} · ${r.template}</p><a href="${r.file}"><img loading="lazy" src="${r.file}" alt="${r.id}"></a></article>`).join("")}</html>`;
  await writeFile(path.join(output, "index.html"), html);
} catch (error) {
  errors.push(error);
} finally {
  if (browser)
    try {
      await browser.close({ silent: true });
    } catch (error) {
      errors.push(error);
    }
  try {
    await rm(temporary, { recursive: true, force: true });
  } catch (error) {
    errors.push(error);
  }
}
if (errors.length === 1) throw errors[0];
if (errors.length > 1) throw new AggregateError(errors, "art_gallery_render_and_cleanup_failed");
