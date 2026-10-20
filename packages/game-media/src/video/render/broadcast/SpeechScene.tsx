/**
 * 负责发言场景的固定阅读面、真实署名、转译来源和接收席。输入为本段字幕与裁剪玩家资料，输出原有发言DOM及尺寸。
 * 编导actor与原话作者分别显示；不从内容推发言指向，不访问整局计划或计算事实。
 */
import { text } from "@ai-werewolf-arena/game-text";
import { SceneText, CaptionCounter } from "./SceneText";
import { ReadingViewport } from "./ReadingViewport";
import { quiet, twoLines, textRows, localSurface } from "./style";
import type { SceneRenderProps } from "./contracts";
import { PlayerAvatar, playerLabels } from "./PlayerVisual";
import type { ResolvedPlayerPresentation } from "../../../presentation";
import type { VideoPlan } from "../../types";

export function SpeechScene({
  scene,
  caption,
  metrics,
  appearance,
  locale,
  players,
  media,
  mediaBaseUrl,
}: SceneRenderProps & {
  players: readonly ResolvedPlayerPresentation[];
  media: VideoPlan["media"];
  mediaBaseUrl?: string;
}) {
  const { scale, stage, readingWidth, lineHeight } = metrics;
  const { theme, surface, gothic, palette } = appearance;
  const t = theme.definition.typography,
    mutedInk = surface.readingMuted;
  // 发言使用独立密度；largeText是明确选择，不能因整段较长暗降其字号。
  const bodySize =
    (theme.options.largeText === true
      ? t.bodyLarge
      : locale === "en"
        ? t.speechBodyEn
        : t.speechBodyZh) * scale;
  const { profile, label, seatLabel } = playerLabels(players, locale);
  const speechActor =
    (scene.bodyLayout ?? "structured") === "structured" && scene.visual?.dialogue
      ? scene.visual.actorId
      : (scene.actorId ??
        (scene.speaker?.startsWith("player:") ? Number(scene.speaker.slice(7)) : undefined));

  const flow = Boolean(caption.reading);
  // 新阅读面由真实内容与flex收缩决定高度；旧明确分页仍保整段最大页的固定槽。
  const lines = flow
    ? 0
    : Math.max(
        1,
        ...caption.pages.map((page) => textRows(page, readingWidth - 60 * scale, bodySize)),
      );
  const signatures =
    (scene.visual?.recipientIds.length ? 32 : 0) +
    (scene.visual?.dialogue?.originalSpeakerId !== undefined ? 32 : 0);
  const safeTop = scene.editorial ? 120 * scale : 28 * scale;
  const safeBottom = metrics.subtitleSafeArea ? 0 : 32 * scale;
  const maxHeight = Math.min(
    stage.height * surface.speechReadingMaxHeightRatio,
    stage.height - safeTop - safeBottom,
  );
  const height = flow
    ? undefined
    : Math.min(
        stage.height * 0.88,
        Math.max(stage.height * 0.4, lines * bodySize * lineHeight + (240 + signatures) * scale),
      );
  return (
    <div
      data-surface="speech"
      style={{
        ...localSurface(appearance, scale),
        position: "absolute",
        bottom: safeBottom,
        left: (stage.width - readingWidth) / 2,
        width: readingWidth,
        height,
        maxHeight: flow ? maxHeight : undefined,
        padding: 30 * scale,
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        gap: 18 * scale,
        overflow: "hidden",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 18 * scale, flexShrink: 0 }}>
        {speechActor !== undefined && (
          <PlayerAvatar
            player={profile(speechActor)}
            size={48 * scale}
            media={media}
            mediaBaseUrl={mediaBaseUrl}
            visibleRole={appearance.visibleRoles?.[speechActor]}
            themeId={theme.id}
          />
        )}
        <div style={{ ...quiet, flex: 1 }}>
          <div
            data-speech-speaker={speechActor}
            style={{ ...twoLines, fontSize: t.speaker * scale, fontWeight: 700 }}
          >
            {speechActor === undefined ? scene.title : label(speechActor)}
          </div>
          <div style={{ fontSize: t.aux * scale, color: mutedInk, marginTop: 6 * scale }}>
            {scene.title}
            {scene.visual?.dialogue?.kind === "end_chat" && (
              <span data-dialogue-ended>{` · ${text(locale, "video.end_chat")}`}</span>
            )}
          </div>
        </div>
      </div>
      {scene.visual?.recipientIds.length ? (
        <div
          data-dialogue-recipients
          style={{ color: mutedInk, fontSize: t.aux * scale, flexShrink: 0 }}
        >
          {text(locale, "video.recipient")} · {scene.visual.recipientIds.map(seatLabel).join(" / ")}
        </div>
      ) : null}
      {scene.visual?.dialogue?.originalSpeakerId !== undefined && (
        <div
          data-original-speaker={scene.visual.dialogue.originalSpeakerId}
          style={{ color: mutedInk, fontSize: t.aux * scale, flexShrink: 0 }}
        >
          {text(locale, "video.original_speaker")} ·{" "}
          {label(scene.visual.dialogue.originalSpeakerId)}
        </div>
      )}
      {flow ? (
        <ReadingViewport
          caption={caption}
          emphasis={scene.emphasis}
          accent={gothic ? "#efb4a8" : palette.wolf}
          kind="speech"
          fontSize={bodySize}
          lineHeight={lineHeight}
        />
      ) : (
        <div
          data-scene-speech
          style={{
            ...quiet,
            fontSize: bodySize,
            lineHeight,
            whiteSpace: "pre-wrap",
            flex: 1,
            fontWeight: 400,
          }}
        >
          {
            <SceneText
              caption={caption}
              emphasis={scene.emphasis}
              accent={gothic ? "#efb4a8" : palette.wolf}
            />
          }
        </div>
      )}
      {!flow && caption.pages.length > 1 && (
        <div
          style={{ alignSelf: "flex-end", color: mutedInk, fontSize: t.aux * scale, flexShrink: 0 }}
        >
          {<CaptionCounter caption={caption} locale={locale} />}
        </div>
      )}
    </div>
  );
}
