/**
 * 负责阶段、终局、生命结算与普通记录的公告版式。输入为宿主已选layout、局部帧和字幕，输出原有局部阅读衬与静态标记。
 * 本层仅选择排版，不将普通notice升级成技能或生命事实；揭晓继续使用原cue。
 */
import { SceneHero, RecordMark } from "../../SceneVisual";
import { PhaseSigil } from "../../GothicArt";
import { text } from "@ai-werewolf-arena/game-text";
import { SceneText } from "./SceneText";
import { quiet, localSurface } from "./style";
import type { SceneRenderProps } from "./contracts";

import type { BroadcastSceneLayout } from "./contracts";
export function AnnouncementScene({
  scene,
  caption,
  localFrame,
  metrics,
  appearance,
  locale,
  layout,
}: SceneRenderProps & { layout: BroadcastSceneLayout }) {
  const { scale, stage, readingWidth, bodySize, lineHeight, padding } = metrics;
  const { theme, surface, gothic, palette, night } = appearance;
  const tokens = theme.definition;
  const revealed = localFrame >= scene.cues.impact;

  const end = layout === "end",
    phase = layout === "phase",
    settlement = layout === "settlement",
    compact = layout === "notice";
  const maxLength = Math.max(1, ...caption.pages.map((page) => page.length));
  const rows = Math.ceil(maxLength / Math.max(1, readingWidth / bodySize));
  const height = Math.max(
    stage.height * 0.21,
    Math.min(stage.height * (settlement ? 0.48 : 0.32), rows * bodySize * lineHeight + padding * 2),
  );
  const artSize = (end ? 330 : phase ? 54 : settlement ? 170 : 80) * scale;
  // 普通记录没有大动作：标记与正文组成同一居中组，不把小图留在上空、正文压到脚边。
  const compactTop = Math.max(90 * scale, (stage.height - height - artSize - 24 * scale) / 2);
  return (
    <>
      <div
        data-announcement-art
        style={{
          position: "absolute",
          top: compact ? compactTop : end ? "12%" : "22%",
          left: (stage.width - artSize) / 2,
        }}
      >
        {phase ? (
          <PhaseSigil night={night} size={artSize} />
        ) : end || settlement ? (
          <SceneHero
            scene={scene}
            frame={localFrame}
            size={artSize}
            theme={theme}
            gothic={gothic}
            color={tokens.frame.light}
          />
        ) : (
          <RecordMark size={artSize} color={tokens.frame.color} />
        )}
      </div>
      <div
        data-surface={layout}
        style={{
          ...localSurface(appearance, scale, surface.resultOpacity),
          position: "absolute",
          top: compact ? compactTop + artSize + 24 * scale : undefined,
          bottom: compact ? undefined : (end ? 30 : 90) * scale,
          left: (stage.width - readingWidth) / 2,
          width: readingWidth,
          minHeight: height,
          padding,
          boxSizing: "border-box",
          display: "grid",
          placeItems: "center",
        }}
      >
        <div
          data-scene-announcement
          style={{
            ...quiet,
            fontSize: bodySize,
            lineHeight,
            whiteSpace: "pre-wrap",
            textAlign: "center",
            textWrap: "balance",
          }}
        >
          {revealed ? (
            <SceneText
              caption={caption}
              emphasis={scene.emphasis}
              accent={gothic ? "#efb4a8" : palette.wolf}
            />
          ) : (
            text(locale, "video.waiting")
          )}
        </div>
      </div>
    </>
  );
}
