/**
 * 负责玩家档案文本的无损分片；输入原文，输出不超过 schema 2 单项限制的连续切片。
 * 不切断有效 Unicode 代理对，空文本保留一个空片；不裁剪、规整或解释正文。
 */
export const PLAYER_RECORD_TEXT_LIMIT = 8000;

export function splitPlayerRecordText(value: string): string[] {
  const chunks: string[] = [];
  for (let offset = 0; offset < value.length;) {
    let end = Math.min(offset + PLAYER_RECORD_TEXT_LIMIT, value.length);
    const last = value.charCodeAt(end - 1),
      next = value.charCodeAt(end);
    if (last >= 0xd800 && last <= 0xdbff && next >= 0xdc00 && next <= 0xdfff) end--;
    chunks.push(value.slice(offset, end));
    offset = end;
  }
  return chunks.length ? chunks : [""];
}
