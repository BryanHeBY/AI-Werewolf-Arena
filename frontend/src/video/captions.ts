/**
 * 负责将长字幕按保守字宽预算分页。输入为原文字串、行宽与行数，输出原文的连续切片，拼接后与原文一致。
 * 行宽只用于计算页边界，浏览器自然换行；原有换行保留，分页不依赖字体测量，预览与导出使用同一结果。
 */
export function paginateVideoCaption(text: string, columns = 72, maxLines = 3): string[] {
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
  for (const glyph of text) {
    if (glyph === "\n") {
      page += glyph;
      nextLine();
      continue;
    }
    const units =
      !/[\x20-\x7e]/.test(glyph) || /[@MWmw#%&]/.test(glyph)
        ? 2
        : /[A-Z]/.test(glyph)
          ? 1.5
          : /[0-9]/.test(glyph)
            ? 1.3
            : 1;
    if (width + units > columns) nextLine();
    page += glyph;
    width += units;
  }
  if (page || !pages.length) pages.push(page);
  return pages;
}
