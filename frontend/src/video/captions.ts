/**
 * 负责将长字幕按保守字宽预算分页。输入为原文字串、行宽与行数，输出原文的连续切片，拼接后与原文一致。
 * 行宽只用于计算页边界，浏览器自然换行；原有换行保留，分页不依赖字体测量，预览与导出使用同一结果。
 */
import type { VideoLayoutId, VideoScene, VideoReading } from "./types";

/** 广播结果正文从揭晓后开始分页；玩家发言和旧布局沿用整段时钟，供纯帧与导航共用。 */
export function videoCaptionRange(
  layout: VideoLayoutId,
  scene: Pick<VideoScene, "kind" | "cues">,
  durationFrames: number,
) {
  const from = layout === "broadcast-v1" && scene.kind !== "speech" ? scene.cues.impact : 0;
  return { from, durationFrames: durationFrames - from };
}
/** 广播按真实阅读槽的保守预算分页，旧布局的连续切片预算保持不变。 */
export function videoCaptionBudget(layout: VideoLayoutId, largeText = false) {
  return layout === "broadcast-v1"
    ? { columns: largeText ? 40 : 44, maxLines: 3 }
    : { columns: 72, maxLines: 3 };
}
/** 机械读速只计算字数/词数，不分析台词意图；整数帧确保预览、导出及FPS切换可重复。 */
export function estimateVideoReadFrames(text: string, fps: number): number {
  const cjk = [...text].filter(
    (glyph) => /[^\x00-\x7f]/.test(glyph) && !/\s|[，。！？、；：“”‘’（）…—]/u.test(glyph),
  ).length;
  const words = (text.match(/[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*/g) ?? []).length;
  const punctuation = (text.match(/[，。！？；,.!?;:]/g) ?? []).length;
  return Math.max(Math.round(fps * 3), Math.ceil((cjk / 8 + words / 3 + punctuation * 0.1) * fps));
}
/** 首屏从impact可读并覆盖settled后的完整阅读预算，其后逐页独立；尾留只加入末页。 */
export function scheduleVideoCaptionPages(
  from: number,
  settled: number,
  durationFrames: number,
  readFrames: number[],
) {
  let cursor = from;
  return readFrames.map((duration, index) => {
    const end =
      index === readFrames.length - 1
        ? durationFrames
        : Math.max(index === 0 ? settled : cursor, cursor) + duration;
    const range = { from: cursor, durationFrames: end - cursor };
    cursor = end;
    return range;
  });
}
export function paginateVideoCaption(
  text: string,
  columns = 72,
  maxLines = 3,
  wordAware = false,
): string[] {
  if (
    !Number.isSafeInteger(columns) ||
    columns < 2 ||
    !Number.isSafeInteger(maxLines) ||
    maxLines < 1
  )
    throw new Error("video_caption_budget_invalid");
  const pages: string[] = [];
  let page = "",
    lines = 1,
    width = 0;
  const nextLine = () => {
    lines++;
    width = 0;
    if (lines > maxLines) {
      pages.push(page);
      page = "";
      lines = 1;
    }
  };
  const glyphUnits = (glyph: string) =>
    !/[\x20-\x7e]/.test(glyph) || /[@MWmw#%&]/.test(glyph)
      ? 2
      : /[A-Z]/.test(glyph)
        ? 1.5
        : /[0-9]/.test(glyph)
          ? 1.3
          : 1;
  // 新广播先预留完整英文单词的行宽；不写入换行，不把短单词硬切到下一页。
  const tokens = wordAware
    ? (text.match(/[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*|[\s\S]/gu) ?? [])
    : [...text];
  for (const token of tokens) {
    const tokenWidth = [...token].reduce((total, glyph) => total + glyphUnits(glyph), 0);
    if (token.length > 1 && tokenWidth <= columns && width > 0 && width + tokenWidth > columns)
      nextLine();
    for (const glyph of token) {
      if (glyph === "\n") {
        page += glyph;
        nextLine();
        continue;
      }
      const units = glyphUnits(glyph);
      if (width + units > columns) nextLine();
      page += glyph;
      width += units;
    }
  }
  if (page || !pages.length) pages.push(page);
  return pages;
}

/** 阅读位移只由帧与预编译区间计算；实际字高只影响距离，暂停、倒看及导出不累计滚动。 */
export function videoReadingProgress(reading: VideoReading, frame: number) {
  const age = frame - reading.from;
  const clamp = (value: number) => Math.max(0, Math.min(1, value));
  const scrollFrames = Math.max(
    1,
    reading.durationFrames - reading.headHoldFrames - reading.tailHoldFrames,
  );
  return {
    progress: clamp(age / Math.max(1, reading.durationFrames)),
    scrollProgress: clamp((age - reading.headHoldFrames) / scrollFrames),
    active: age >= 0 && age < reading.durationFrames,
  };
}

/** 主段和后续结果共用全文时钟工厂；头尾各最多占三分之一以保留连续滚动区间，长稿保留头尾三秒，绝不拉长作者镜头。 */
export function scheduleVideoReading(
  from: number,
  end: number,
  settled: number,
  fps: number,
): VideoReading {
  const durationFrames = end - from;
  return {
    version: 1,
    mode: "flow",
    from,
    durationFrames,
    headHoldFrames: Math.min(
      Math.floor(durationFrames / 3),
      Math.max(0, settled - from) + Math.round(fps * 3),
    ),
    tailHoldFrames: Math.min(Math.round(fps * 3), Math.floor(durationFrames / 3)),
  };
}
