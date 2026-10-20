/** 负责在画面安全区显示配音字幕。输入为预编译时间轴和当前帧，输出固定屏幕文字；不继承镜头变换，不影响中央全文阅读。 */
import { normalizeResolvedTheme } from "../themes";
import type { VideoFrameView } from "./frame";
import type { VideoPlan } from "./types";
import { videoSubtitleAt } from "./subtitles";

export function VideoSubtitles({
  plan,
  frame,
  view,
}: {
  plan: VideoPlan;
  frame: number;
  view: VideoFrameView;
}) {
  const cue = videoSubtitleAt(plan, frame);
  if (!cue) return null;
  const scale = Math.min(plan.width / 1920, plan.height / 1080);
  const tokens = normalizeResolvedTheme(plan.theme).definition.subtitle;
  const region = view.layout.subtitle;
  return (
    <div
      data-testid="video-subtitle"
      data-subtitle-speaker={cue.speaker}
      style={{
        position: "absolute",
        left: region.x,
        width: region.width,
        bottom: plan.height - region.y - region.height,
        padding: `0 ${20 * scale}px`,
        boxSizing: "border-box",
        textAlign: "center",
        color: tokens.color,
        fontFamily: plan.theme.definition.fonts.body,
        fontSize: tokens.fontSize * scale,
        fontWeight: tokens.fontWeight,
        lineHeight: tokens.lineHeight,
        whiteSpace: "pre-wrap",
        overflowWrap: "anywhere",
        textShadow: tokens.textShadow,
        pointerEvents: "none",
        zIndex: 2000,
      }}
    >
      <span
        style={{
          background: tokens.background,
          boxDecorationBreak: "clone",
          padding: `${tokens.paddingY * scale}px ${tokens.paddingX * scale}px`,
          borderRadius: tokens.radius * scale,
        }}
      >
        {cue.text}
      </span>
    </div>
  );
}
