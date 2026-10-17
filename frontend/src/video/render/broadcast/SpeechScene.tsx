/**
 * 负责发言场景的固定阅读面、真实署名、转译来源和接收席。输入为本段字幕与裁剪玩家资料，输出原有发言DOM及尺寸。
 * 编导actor与原话作者分别显示；不从内容推发言指向，不访问整局计划或计算事实。
 */
import { text } from "@ai-werewolf-arena/game-text";
import { SceneText, CaptionCounter } from "./SceneText";
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
  const { scale, stage, readingWidth, bodySize, lineHeight } = metrics;
  const { theme, surface, gothic, palette } = appearance;
  const t = theme.definition.typography,
    mutedInk = surface.readingMuted;
  const { profile, label, seatLabel } = playerLabels(players, locale);
  const speechActor =
    scene.bodySource === "event" && scene.visual?.dialogue ? scene.visual.actorId : scene.actorId;

  // 按整段最大页固定阅读面高度；翻页不推动署名、行宽或背景。
  const lines = Math.max(
    1,
    ...caption.pages.map((page) => textRows(page, readingWidth - 60 * scale, bodySize)),
  );
  const signatures =
    (scene.visual?.recipientIds.length ? 32 : 0) +
    (scene.visual?.dialogue?.originalSpeakerId !== undefined ? 32 : 0);
  const height = Math.min(
    stage.height * (caption.scheduled ? surface.readingMaxHeightRatio : 0.88),
    Math.max(stage.height * 0.4, lines * bodySize * lineHeight + (240 + signatures) * scale),
  );
  return (
    <div
      data-surface="speech"
      style={{
        ...localSurface(appearance, scale),
        position: "absolute",
        bottom: 32 * scale,
        left: (stage.width - readingWidth) / 2,
        width: readingWidth,
        height,
        padding: 30 * scale,
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        gap: 18 * scale,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 18 * scale }}>
        {speechActor !== undefined && (
          <PlayerAvatar
            player={profile(speechActor)}
            size={48 * scale}
            media={media}
            mediaBaseUrl={mediaBaseUrl}
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
          </div>
        </div>
      </div>
      {scene.visual?.recipientIds.length ? (
        <div data-dialogue-recipients style={{ color: mutedInk, fontSize: t.aux * scale }}>
          {text(locale, "video.recipient")} · {scene.visual.recipientIds.map(seatLabel).join(" / ")}
        </div>
      ) : null}
      {scene.visual?.dialogue?.originalSpeakerId !== undefined && (
        <div
          data-original-speaker={scene.visual.dialogue.originalSpeakerId}
          style={{ color: mutedInk, fontSize: t.aux * scale }}
        >
          {text(locale, "video.original_speaker")} ·{" "}
          {label(scene.visual.dialogue.originalSpeakerId)}
        </div>
      )}
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
      <div style={{ alignSelf: "flex-end", color: mutedInk, fontSize: t.aux * scale }}>
        {<CaptionCounter caption={caption} locale={locale} />}
      </div>
    </div>
  );
}
