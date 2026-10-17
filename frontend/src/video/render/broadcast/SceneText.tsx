/**
 * 负责中央正文、词组换行保护、显式强调与旧分页页码。输入为原文切片和偏移，输出原字符顺序与精确mark区间。
 * 新全文阅读只保护词法边界，不识别台词含义；旧计划保持原有跨页强调及DOM兼容，不改原话或事实。
 */
import { memo, type ReactNode } from "react";
import { text } from "@ai-werewolf-arena/game-text";
import type { VideoScene, VideoPlan } from "../../types";
import type { SceneCaption } from "./contracts";
import { readingTextRuns } from "./reading-text";

export const SceneText = memo(
  function SceneText({
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
    function slice(from: number, until: number): ReactNode[] {
      const result: ReactNode[] = [];
      let cursor = from;
      for (const item of emphasis) {
        const start = Math.max(from, item.start - offset),
          end = Math.min(until, item.end - offset);
        if (end <= start || start < cursor) continue;
        result.push(
          page.slice(cursor, start),
          <mark
            key={`${start}:${end}`}
            style={{ background: "transparent", color: accent, fontWeight: 700 }}
          >
            {page.slice(start, end)}
          </mark>,
        );
        cursor = end;
      }
      result.push(page.slice(cursor, until));
      return result;
    }
    if (!caption.reading) return <>{slice(0, page.length)}</>;
    return (
      <>
        {readingTextRuns(page, caption.protectedTerms).map((run) =>
          run.keep ? (
            <span key={run.start} data-reading-token style={{ whiteSpace: "nowrap" }}>
              {slice(run.start, run.end)}
            </span>
          ) : (
            <span key={run.start}>{slice(run.start, run.end)}</span>
          ),
        )}
      </>
    );
  },
  (previous, next) =>
    previous.caption.text === next.caption.text &&
    previous.caption.offset === next.caption.offset &&
    Boolean(previous.caption.reading) === Boolean(next.caption.reading) &&
    previous.caption.protectedTerms === next.caption.protectedTerms &&
    previous.emphasis === next.emphasis &&
    previous.accent === next.accent,
);

export function CaptionCounter({
  caption,
  locale,
}: {
  caption: SceneCaption;
  locale: VideoPlan["display"]["locale"];
}) {
  if (caption.reading || caption.pages.length < 2) return null;
  return text(locale, "video.page", { page: caption.pageIndex + 1, pages: caption.pages.length });
}
