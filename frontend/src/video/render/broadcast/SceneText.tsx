/**
 * 负责中央字幕的分页文本、显式强调与页码。输入为已编译字幕切片和原文偏移，输出同一文字节点与mark顺序。
 * 不重新分页、不识别台词含义，也不改写原话或事实文案；范围裁剪保持原有跨页强调行为。
 */
import type { ReactNode } from "react";
import { text } from "@ai-werewolf-arena/game-text";
import type { VideoScene, VideoPlan } from "../../types";
import type { SceneCaption } from "./contracts";

export function SceneText({
  caption,
  emphasis,
  accent,
}: {
  caption: SceneCaption;
  emphasis: VideoScene["emphasis"];
  accent: string;
}) {
  const page = caption.text,
    offset = caption.offset;
  const result: ReactNode[] = [];
  let cursor = 0;
  for (const item of emphasis) {
    const start = Math.max(0, item.start - offset),
      end = Math.min(page.length, item.end - offset);
    if (end <= start || start < cursor) continue;
    result.push(
      page.slice(cursor, start),
      <mark
        key={`${start}:${end}`}
        style={{
          background: "transparent",
          color: accent,
          fontWeight: 700,
        }}
      >
        {page.slice(start, end)}
      </mark>,
    );
    cursor = end;
  }
  result.push(page.slice(cursor));
  return <>{result}</>;
}

export function CaptionCounter({
  caption,
  locale,
}: {
  caption: SceneCaption;
  locale: VideoPlan["display"]["locale"];
}) {
  return text(locale, "video.page", { page: caption.pageIndex + 1, pages: caption.pages.length });
}
