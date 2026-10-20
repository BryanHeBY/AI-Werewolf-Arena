/**
 * 负责终局主结果、附加主张、原因与获胜者的分层展示。输入为typed内容、统一帧和主题，输出impact后才揭晓的终局版式。
 * 不按当前阵营补赢者，不把winner=null当无人获胜；死者胜利与生命灰卡相互独立，作者正文仍保留原阅读时钟。
 */
import { SceneHero } from "../../SceneVisual";
import { SceneContentBlocks } from "../../../presentation/SceneContentBlocks";
import { paletteSemanticColors } from "../../../presentation/semantic-colors";
import { presentationPlayers, type ResolvedPlayerPresentation } from "../../../presentation";
import { outcomeEmblem } from "../../../presentation/scene-content";
import { sceneContent } from "../../../presentation/scene-content";
import { SceneText } from "./SceneText";
import { ReadingViewport } from "./ReadingViewport";
import { localSurface } from "./style";
import type { SceneRenderProps } from "./contracts";
/** 简约徽记只表达typed主结果，未知/揭晓前始终中性，不使用角色图标代替获胜归属。 */
export function MinimalEndEmblem({
  emblem,
  size,
  color,
}: {
  emblem: ReturnType<typeof outcomeEmblem>;
  size: number;
  color: string;
}) {
  return (
    <svg
      data-end-emblem={emblem}
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      stroke={color}
      strokeWidth="2"
      aria-hidden="true"
    >
      <circle cx="50" cy="50" r="42" opacity=".5" />
      {emblem === "good" ? (
        <path d="M50 18L57 39L80 40L62 54L68 77L50 63L32 77L38 54L20 40L43 39Z" />
      ) : emblem === "wolf" ? (
        <path d="M34 24L28 74M54 20L44 78M75 26L61 74" strokeWidth="5" />
      ) : emblem === "third-party" ? (
        <>
          <circle cx="50" cy="50" r="24" />
          <path d="M50 18V82M22 66L78 34M22 34L78 66" />
        </>
      ) : emblem === "individual" ? (
        <>
          <circle cx="50" cy="42" r="13" />
          <path d="M28 75C28 50 72 50 72 75" />
        </>
      ) : emblem === "relationship" ? (
        <>
          <circle cx="37" cy="50" r="21" />
          <circle cx="63" cy="50" r="21" />
        </>
      ) : emblem === "no-winner" ? (
        <path d="M28 50H72" />
      ) : (
        <circle cx="50" cy="50" r="15" />
      )}
    </svg>
  );
}
export function EndScene({
  scene,
  caption,
  localFrame,
  metrics,
  appearance,
  locale,
  players = [],
}: SceneRenderProps & { players?: readonly ResolvedPlayerPresentation[] }) {
  const { scale, stage, readingWidth, bodySize, lineHeight, padding } = metrics;
  const { theme, palette, gothic, surface } = appearance;
  const revealed = localFrame >= scene.cues.impact;
  // 标题在stage顶部独立存在；长附加结果也必须在同一安全正文窗内滚动，不能上顶标题或下压footer。
  const safeTop = 90 * scale,
    safeBottom = 24 * scale,
    gap = 20 * scale;
  const availableHeight = stage.height - safeTop - safeBottom;
  const artSize = Math.min(220 * scale, availableHeight * 0.28);
  const panelMaxHeight = Math.min(stage.height * 0.65, availableHeight - artSize - gap);
  const content = scene.content ?? sceneContent(scene);
  return (
    <div
      data-end-scene
      style={{
        position: "absolute",
        top: safeTop,
        bottom: safeBottom,
        left: 0,
        right: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap,
      }}
    >
      {gothic ? (
        <SceneHero
          scene={scene}
          frame={localFrame}
          size={artSize}
          theme={theme}
          gothic
          color={theme.definition.frame.light}
        />
      ) : (
        <MinimalEndEmblem
          emblem={
            revealed
              ? outcomeEmblem(scene.visual?.victory?.outcome, scene.visual?.victory?.winner)
              : "unknown"
          }
          size={artSize}
          color={palette.accent}
        />
      )}
      <div
        data-surface="end"
        style={{
          ...localSurface(appearance, scale, surface.resultOpacity),
          width: readingWidth,
          maxHeight: panelMaxHeight,
          padding,
          boxSizing: "border-box",
          fontSize: bodySize,
          lineHeight,
          textAlign: "center",
        }}
      >
        {revealed ? (
          <ReadingViewport
            caption={caption}
            emphasis={scene.emphasis}
            accent={palette.accent}
            kind="announcement"
            fontSize={bodySize}
            lineHeight={lineHeight}
            textAlign="center"
            maxHeight={panelMaxHeight - padding * 2}
          >
            <div data-end-fields>
              <SceneContentBlocks
                content={content}
                locale={locale}
                players={presentationPlayers(players)}
                kinds={["outcome"]}
                colors={paletteSemanticColors(appearance.cards, surface.readingMuted)}
              />
            </div>
            {(scene.bodyLayout === "text" || scene.emphasis.length > 0) && (
              <div data-end-editorial style={{ marginTop: 20 * scale, whiteSpace: "pre-wrap" }}>
                <SceneText caption={caption} emphasis={scene.emphasis} accent={palette.accent} />
              </div>
            )}
            {!content.blocks.some((block) => block.kind === "outcome") && (
              <SceneText caption={caption} emphasis={scene.emphasis} accent={palette.accent} />
            )}
          </ReadingViewport>
        ) : null}
      </div>
    </div>
  );
}
