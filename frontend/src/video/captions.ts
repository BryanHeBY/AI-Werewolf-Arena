/**
 * 负责将长字幕按保守字宽预算分页。输入为原文字串、行宽与行数，输出保留正文的有限行文本页。
 * 这里仅插入展示换行，不改配音原文；分页不依赖浏览器测量或字体加载，预览与导出使用同一结果。
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
