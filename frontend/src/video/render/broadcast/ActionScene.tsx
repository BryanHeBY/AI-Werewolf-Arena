/**
 * 负责行动场景的世界图形、来源目标小章与固定结果文字。输入为typed意图、有限帧及中央矩阵，输出原有行动DOM与图层位置。
 * requested/effective/recipient分别只读；唯一world容器只变换图形，不移动正文或名册，不补命中、死亡或库存。
 */
import { AbsoluteFill } from "remotion";
import { SceneHero, SceneConnector } from "../../SceneVisual";
import { PlayerMedallion } from "./PlayerMedallion";
import { text } from "@ai-werewolf-arena/game-text";
import { SceneText } from "./SceneText";
import { quiet, alpha, textRows, localSurface } from "./style";
import type { SceneRenderProps, RenderThemeSlot } from "./contracts";
import { playerLabels } from "./PlayerVisual";
import type { ResolvedPlayerPresentation } from "../../../presentation";
import type { VideoPlan } from "../../types";

export function ActionScene({
  scene,
  caption,
  localFrame,
  metrics,
  appearance,
  locale,
  players,
  media,
  mediaBaseUrl,
  stageTransform,
  renderSlot,
}: SceneRenderProps & {
  players: readonly ResolvedPlayerPresentation[];
  media: VideoPlan["media"];
  mediaBaseUrl?: string;
} & { stageTransform: string; renderSlot: RenderThemeSlot }) {
  const { scale, stage, readingWidth, bodySize, lineHeight } = metrics;
  const { theme, surface, gothic, palette } = appearance;
  const tokens = theme.definition,
    t = tokens.typography,
    readingInk = surface.readingText,
    mutedInk = surface.readingMuted;
  const { seatLabel } = playerLabels(players, locale);
  const revealed = localFrame >= scene.cues.impact;

  const visual = scene.visual;
  const sources = visual?.participantIds?.length
    ? visual.participantIds
    : visual?.actorId !== undefined
      ? [visual.actorId]
      : scene.actorId !== undefined
        ? [scene.actorId]
        : (scene.participantIds ?? []);
  const requested = visual?.requestedTargetIds ?? scene.targetIds;
  const effectiveKnown = revealed && visual?.effectiveTargetKnown === true;
  const targets = effectiveKnown ? visual!.effectiveTargetIds : requested;
  const rows = Math.max(
    1,
    ...caption.pages.map((page) => textRows(page, readingWidth - 56 * scale, bodySize)),
  );
  const resultHeight =
    rows * bodySize * lineHeight +
    ((scene.stock ? 130 : 90) + (visual?.effectSourceId !== undefined ? 34 : 0)) * scale;
  const bodyTop = Math.max(
    110 * scale,
    Math.min(stage.height * 0.585, stage.height - resultHeight - 24 * scale),
  );
  const size = Math.min(tokens.effect.heroSize * scale, stage.width * 0.4, bodyTop - 80 * scale);
  const color =
    visual?.family === "pack_attack" || scene.action?.kind === "poison"
      ? gothic
        ? "#c48186"
        : palette.wolf
      : tokens.frame.light;
  return (
    <>
      {/* 唯一world容器应用中央矩阵一次；正文、结果、HUD永远是它的兄弟。 */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          overflow: "hidden",
          clipPath: `inset(${70 * scale}px 0 ${Math.max(0, stage.height - bodyTop + 10 * scale)}px 0)`,
        }}
      >
        <AbsoluteFill
          data-video-world
          style={{ transform: stageTransform, transformOrigin: "50% 50%" }}
        >
          {visual && (
            <SceneConnector
              intent={visual}
              scene={scene}
              frame={localFrame}
              width={stage.width}
              height={stage.height}
              theme={theme}
              color={color}
              scale={scale}
            />
          )}
          <div style={{ position: "absolute", left: (stage.width - size) / 2, top: 68 * scale }}>
            {renderSlot(
              "actionEffect",
              <SceneHero
                scene={scene}
                frame={localFrame}
                size={size}
                theme={theme}
                gothic={gothic}
                color={color}
              />,
            )}
          </div>
          {sources.length > 0 && (
            <div
              data-action-sources
              style={{
                position: "absolute",
                top: 150 * scale,
                left: 24 * scale,
                width: stage.width * 0.25,
                display: "flex",
                flexWrap: "wrap",
                justifyContent: "center",
                gap: 8 * scale,
              }}
            >
              {sources.map((id) => (
                <PlayerMedallion
                  key={id}
                  id={id}
                  size={(sources.length > 2 ? 44 : 86) * scale}
                  compact={sources.length > 2}
                  scale={scale}
                  appearance={appearance}
                  locale={locale}
                  players={players}
                  media={media}
                  mediaBaseUrl={mediaBaseUrl}
                />
              ))}
            </div>
          )}
          {targets.length > 0 && (
            <div
              data-action-targets
              data-target-kind={effectiveKnown ? "effective" : "requested"}
              style={{
                position: "absolute",
                top: 150 * scale,
                right: 24 * scale,
                width: stage.width * 0.25,
                display: "flex",
                flexWrap: "wrap",
                justifyContent: "center",
                gap: 8 * scale,
              }}
            >
              {targets.map((id) => (
                <PlayerMedallion
                  key={id}
                  id={id}
                  size={(targets.length > 2 ? 44 : 86) * scale}
                  compact={targets.length > 2}
                  scale={scale}
                  appearance={appearance}
                  locale={locale}
                  players={players}
                  media={media}
                  mediaBaseUrl={mediaBaseUrl}
                />
              ))}
            </div>
          )}
          {effectiveKnown && targets.length === 0 && (
            <div
              data-action-no-target
              style={{
                position: "absolute",
                top: 170 * scale,
                right: 24 * scale,
                width: stage.width * 0.25,
                textAlign: "center",
                color: readingInk,
                fontSize: 28 * scale,
              }}
            >
              <span style={{ background: alpha(surface.readingColor, 0.88), padding: 10 * scale }}>
                {text(locale, "video.no_target")}
              </span>
            </div>
          )}
          {effectiveKnown && requested.length > 0 && requested.join(",") !== targets.join(",") && (
            <div
              data-requested-targets={requested.join(",")}
              style={{
                position: "absolute",
                top: bodyTop - 52 * scale,
                left: "20%",
                right: "20%",
                textAlign: "center",
                color: mutedInk,
                fontSize: t.aux * scale,
              }}
            >
              <span style={{ background: alpha(surface.readingColor, 0.88), padding: 6 * scale }}>
                {text(locale, "video.choice")} · {requested.map(seatLabel).join(" / ")}
              </span>
            </div>
          )}
        </AbsoluteFill>
      </div>
      <div
        data-surface="result"
        style={{
          ...localSurface(appearance, scale, surface.resultOpacity),
          position: "absolute",
          top: bodyTop,
          left: (stage.width - readingWidth) / 2,
          width: readingWidth,
          padding: `${20 * scale}px ${28 * scale}px`,
          boxSizing: "border-box",
        }}
      >
        <div
          data-scene-result
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
        {revealed && (
          <div
            style={{
              fontSize: t.aux * scale,
              color: mutedInk,
              marginTop: 16 * scale,
              textAlign: "center",
            }}
          >
            {text(
              locale,
              visual
                ? (
                    {
                      notice: "video.recorded",
                      choice: "video.choice",
                      used: "video.process_used",
                      paid: "video.process_paid",
                      reported: "video.report",
                      blocked: "video.process_blocked",
                      revoked: "video.revoked",
                      expired: "video.process_expired",
                      resolved: "video.committed",
                      skipped: "video.process_skipped",
                      suppressed: "video.process_suppressed",
                      unknown: "video.process_unknown",
                    } as const
                  )[visual.process]
                : scene.action?.status === "choice"
                  ? "video.choice"
                  : "video.recorded",
            )}
            {revealed && visual?.recipientIds.length ? (
              <span data-feedback-recipients>
                {" "}
                · {text(locale, "video.recipient")} ·{" "}
                {visual.recipientIds.map(seatLabel).join(" / ")}
              </span>
            ) : null}
          </div>
        )}
        {revealed && visual?.effectSourceId !== undefined && (
          <div
            data-original-effect-source={visual.effectSourceId}
            style={{
              marginTop: 10 * scale,
              textAlign: "center",
              color: mutedInk,
              fontSize: t.aux * scale,
            }}
          >
            {text(locale, "video.effect_source")} · {seatLabel(visual.effectSourceId)}
          </div>
        )}
        {revealed && scene.stock && scene.bodySource === "script" && (
          <div
            data-scene-stock
            data-stock-ability={scene.stock.abilityId}
            style={{
              marginTop: 10 * scale,
              textAlign: "center",
              color: mutedInk,
              fontSize: t.aux * scale,
            }}
          >
            {text(locale, "video.inventory", {
              heal: scene.stock.heal,
              poison: scene.stock.poison,
            })}
          </div>
        )}
      </div>
    </>
  );
}
