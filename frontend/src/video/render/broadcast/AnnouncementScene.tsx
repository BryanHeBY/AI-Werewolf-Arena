/**
 * 负责阶段、生命结算与普通上帝记录的紧凑公告阅读面。输入为宿主分类、局部帧及全文，输出按内容居中的局部衬与必要身份行。
 * 普通播报不画文件图，不把notice升级成技能或生命事实；正文只在原impact后挂载，未知原因由宿主诊断保留。
 */
import { SceneHero } from "../../SceneVisual";
import { PhaseSigil } from "../../GothicArt";
import { text } from "@ai-werewolf-arena/game-text";
import { SceneText } from "./SceneText";
import { ReadingViewport } from "./ReadingViewport";
import { quiet, localSurface } from "./style";
import type { SceneRenderProps } from "./contracts";
import { SceneContentBlocks } from "../../../presentation/SceneContentBlocks";
import { paletteSemanticColors } from "../../../presentation/semantic-colors";
import type { ResolvedPlayerPresentation } from "../../../presentation";

import type { BroadcastSceneLayout } from "./contracts";
export function AnnouncementScene({
  scene,
  caption,
  localFrame,
  metrics,
  appearance,
  locale,
  layout,
  players = [],
}: SceneRenderProps & {
  layout: BroadcastSceneLayout;
  players?: readonly ResolvedPlayerPresentation[];
}) {
  const { scale, stage, readingWidth, bodySize, lineHeight, padding } = metrics;
  const { theme, surface, gothic, palette, cards, night } = appearance;
  const tokens = theme.definition;
  const revealed = localFrame >= scene.cues.impact;
  const structured =
    // 旧逐页时钟和作者精确强调仍以原文为准，不能每一页重复整个名单或吞掉UTF16强调范围。
    Boolean(caption.reading) &&
    scene.bodySource === "event" &&
    scene.emphasis.length === 0 &&
    scene.content?.blocks.some((block) => block.kind === "announcement" || block.kind === "life");
  const fields = structured ? (
    <SceneContentBlocks
      content={scene.content!}
      locale={locale}
      kinds={["announcement", "life"]}
      players={players.map((player) => ({
        id: player.playerId,
        seat: player.seat,
        name: player.displayName,
      }))}
      colors={paletteSemanticColors(cards, surface.readingMuted)}
      iconSize={bodySize * 0.8}
    />
  ) : undefined;

  const phase = layout === "phase",
    settlement = layout === "settlement";
  const safeTop = 150 * scale,
    safeBottom = 32 * scale;
  const available = Math.max(0, stage.height - safeTop - safeBottom);
  const artSize = settlement ? 150 * scale : 0;
  const maxHeight = Math.max(
    0,
    Math.min(stage.height * surface.readingMaxHeightRatio, available) -
      (artSize ? artSize + 20 * scale : 0),
  );
  return (
    <div
      style={{
        position: "absolute",
        top: safeTop,
        left: (stage.width - readingWidth) / 2,
        width: readingWidth,
        height: available,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 20 * scale,
      }}
    >
      {settlement && (
        <div data-announcement-art style={{ flexShrink: 0 }}>
          <SceneHero
            scene={scene}
            frame={localFrame}
            size={artSize}
            theme={theme}
            gothic={gothic}
            color={tokens.frame.light}
          />
        </div>
      )}
      <div
        data-surface={layout}
        style={{
          ...localSurface(appearance, scale, surface.resultOpacity),
          width: readingWidth,
          minHeight: 0,
          maxHeight,
          padding,
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          gap: 16 * scale,
          overflow: "hidden",
        }}
      >
        <div
          data-announcement-identity
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12 * scale,
            color: surface.readingMuted,
            fontSize: tokens.typography.aux * scale,
            flexShrink: 0,
          }}
        >
          {phase && <PhaseSigil night={night} size={28 * scale} />}
          {text(locale, "video.narrator")}
        </div>
        {revealed && caption.reading ? (
          <ReadingViewport
            caption={caption}
            emphasis={scene.emphasis}
            accent={gothic ? "#efb4a8" : palette.wolf}
            kind="announcement"
            fontSize={bodySize}
            lineHeight={lineHeight}
          >
            {fields}
          </ReadingViewport>
        ) : (
          <div
            data-scene-announcement
            style={{
              ...quiet,
              fontSize: bodySize,
              lineHeight,
              whiteSpace: "pre-wrap",
              textAlign: "left",
            }}
          >
            {revealed
              ? (fields ?? (
                  <SceneText
                    caption={caption}
                    emphasis={scene.emphasis}
                    accent={gothic ? "#efb4a8" : palette.wolf}
                  />
                ))
              : null}
          </div>
        )}
        {revealed && scene.content?.blocks.some((block) => block.kind === "inventory") && (
          <div
            style={{
              color: surface.readingMuted,
              fontSize: tokens.typography.aux * scale,
              flexShrink: 0,
            }}
          >
            <SceneContentBlocks
              content={scene.content}
              locale={locale}
              kinds={["inventory"]}
              players={players.map((player) => ({
                id: player.playerId,
                seat: player.seat,
                name: player.displayName,
              }))}
            />
          </div>
        )}
      </div>
    </div>
  );
}
