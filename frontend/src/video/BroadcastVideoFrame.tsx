/**
 * 负责固定名册与中央观众场景的主题化视频宿主。输入是编译计划、显式帧和已打包插槽，输出发言、行动、票型、阶段及结算版式。
 * 事实只读currentView与typed visual；动画只移动中央美术，HUD、正文及结果文字不继承camera。无台词识别、规则复算或隐式库存。
 */
import { AbsoluteFill } from "remotion";
import { useMemo, type ReactNode } from "react";
import { text } from "@ai-werewolf-arena/game-text";
import {
  getThemeSlot,
  normalizeResolvedTheme,
  resolveTheme,
  themePalette,
  themeSurface,
  type ThemeSlot,
} from "../themes";
import { buildVideoFrame, type VideoFrameView } from "./frame";
import { VideoLayers } from "./VideoLayers";
import type { VideoLayerRegistry, VideoPlan } from "./types";
import type { VideoThemeSlotProps, VideoThemeSlotRegistry } from "./theme-renderers";
import { GothicBackdrop, GothicMetalFrame, PhaseSigil } from "./GothicArt";
import { RosterHud } from "./render/broadcast/RosterHud";
import { SpeechScene } from "./render/broadcast/SpeechScene";
import { BallotScene } from "./render/broadcast/BallotScene";
import { ActionScene } from "./render/broadcast/ActionScene";
import { AnnouncementScene } from "./render/broadcast/AnnouncementScene";
import { CaptionCounter } from "./render/broadcast/SceneText";
import { playerLabels } from "./render/broadcast/PlayerVisual";
import { quiet, twoLines, alpha } from "./render/broadcast/style";
import { broadcastSceneLayout } from "./render/broadcast/scene-layout";
export { broadcastSceneLayout } from "./render/broadcast/scene-layout";

export function BroadcastVideoFrame({
  plan,
  frame,
  layerRegistry,
  themeSlots = {},
  mediaBaseUrl,
  view: providedView,
}: {
  plan: VideoPlan;
  frame: number;
  layerRegistry?: VideoLayerRegistry;
  themeSlots?: VideoThemeSlotRegistry;
  mediaBaseUrl?: string;
  /** 宿主共用已求值帧；省略时保留旧直接调用入口。 */
  view?: VideoFrameView;
}) {
  const view = providedView ?? buildVideoFrame(plan, frame);
  const current = view.currentView,
    scene = view.scene,
    locale = plan.display.locale;
  const theme = useMemo(() => normalizeResolvedTheme(plan.theme ?? resolveTheme()), [plan.theme]);
  const gothic = theme.id === "gothic-v1";
  const night = current.snapshot.phase === "night";
  const tone = night ? "night" : "day";
  const base = themePalette(theme, tone);
  const palette =
    theme.options.highContrast === true ? { ...base, border: base.text, muted: base.text } : base;
  const cards = gothic ? themePalette(theme, "night") : palette;
  const surface = themeSurface(theme, tone),
    tokens = theme.definition;
  const scale = Math.min(
    plan.width / tokens.typography.referenceWidth,
    plan.height / tokens.typography.referenceHeight,
  );
  const t = tokens.typography,
    stage = view.layout.stage;
  const revealed = view.localFrame >= scene.cues.impact;
  const layout = broadcastSceneLayout(scene);
  // 编导可单独标注actor，但记录原话仍署真实说话者；不改既有SpeechCue/声音来源。
  const speechActor =
    scene.bodySource === "event" && scene.visual?.dialogue ? scene.visual.actorId : scene.actorId;
  const roster = plan.playersPresentation;
  const { label } = playerLabels(roster, locale);
  const slotProps: VideoThemeSlotProps = { plan, view, theme, palette, mediaBaseUrl };
  const slot = (key: ThemeSlot, fallback: ReactNode, playerId?: number) => {
    const Component = getThemeSlot(themeSlots, theme, key);
    return Component ? (
      <Component
        {...slotProps}
        palette={key === "playerCard" || key === "seatBadge" ? cards : palette}
        {...(playerId === undefined ? {} : { playerId })}
      />
    ) : (
      fallback
    );
  };
  const readingInk = surface.readingText,
    mutedInk = surface.readingMuted;
  const padding = tokens.frame.padding * scale;
  const readingWidth = Math.min(stage.width - padding * 2, t.readingMaxWidth * scale);
  const bodySize =
    (theme.options.largeText === true ? t.bodyLarge : locale === "en" ? t.bodyEn : t.bodyZh) *
    scale;
  const lineHeight = locale === "en" ? t.lineHeightEn : t.lineHeightZh;
  const appearance = { theme, palette, cards, surface, gothic, night };
  const metrics = { scale, stage, readingWidth, bodySize, lineHeight, padding };
  const caption = {
    text: view.caption,
    offset: view.captionOffset,
    pageIndex: view.captionPageIndex,
    pages: view.shot.captionPages,
    scheduled: Boolean(view.shot.captionPageRanges),
  };
  const sceneProps = { scene, caption, localFrame: view.localFrame, metrics, appearance, locale };
  const content =
    layout === "speech" ? (
      slot(
        "speech",
        <SpeechScene
          {...sceneProps}
          players={roster}
          media={plan.media}
          mediaBaseUrl={mediaBaseUrl}
        />,
      )
    ) : layout === "ballot" ? (
      slot("ballot", <BallotScene {...sceneProps} players={roster} />)
    ) : layout === "action" ? (
      <ActionScene
        {...sceneProps}
        players={roster}
        media={plan.media}
        mediaBaseUrl={mediaBaseUrl}
        stageTransform={view.stageTransform}
        renderSlot={slot}
      />
    ) : (
      <AnnouncementScene {...sceneProps} layout={layout} />
    );
  const focus = view.focusPlayerIds.filter((id) => !(layout === "speech" && id === scene.actorId));

  return (
    <AbsoluteFill
      data-video-shot={view.shot.id}
      data-video-layout="broadcast-v1"
      data-theme={theme.id}
      data-state-seq={view.sourceSeq}
      style={{
        fontFamily: theme.definition.fonts.body,
        lineHeight: 1.2,
        color: palette.text,
        overflow: "hidden",
      }}
    >
      {slot(
        "background",
        gothic ? (
          <GothicBackdrop night={night} />
        ) : (
          <AbsoluteFill style={{ background: palette.canvas }} />
        ),
      )}
      <header
        style={{
          position: "absolute",
          left: 42 * scale,
          right: 42 * scale,
          top: 28 * scale,
          height: 74 * scale,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: `${scale}px solid ${alpha(tokens.frame.color, 0.7)}`,
          color: palette.canvasText,
          textShadow: gothic ? "0 2px 5px #000a" : undefined,
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 20 * scale }}>
          <strong
            style={{
              fontFamily: theme.definition.fonts.heading,
              fontSize: t.title * scale,
              fontWeight: 700,
            }}
          >
            {text(locale, "video.game_title")}
          </strong>
          <span style={{ fontSize: t.aux * scale, color: palette.canvasMuted }}>
            {text(locale, "video.god_view")}
          </span>
        </div>
        <span
          data-testid="composition-phase"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14 * scale,
            fontSize: 34 * scale,
            fontFamily: theme.definition.fonts.heading,
          }}
        >
          {gothic && current.snapshot.day > 0 && <PhaseSigil night={night} size={34 * scale} />}
          {current.snapshot.day < 1 ? text(locale, "video.setup") : current.dayPhase}
        </span>
        <span style={{ fontSize: 26 * scale }}>
          {text(locale, "video.alive", {
            count: current.players.filter((player) => player.alive).length,
            total: current.players.length,
          })}
        </span>
      </header>
      <RosterHud
        players={current.players}
        seats={view.layout.seats}
        presentation={roster}
        focusPlayerIds={view.focusPlayerIds}
        scene={scene}
        layout={layout}
        revealed={revealed}
        scale={scale}
        appearance={appearance}
        locale={locale}
        media={plan.media}
        mediaBaseUrl={mediaBaseUrl}
        renderSlot={slot}
      />
      <section
        data-video-stage
        data-scene-layout={layout}
        data-video-focus={focus.length ? focus.join(",") : undefined}
        style={{
          position: "absolute",
          left: stage.x,
          top: stage.y,
          width: stage.width,
          height: stage.height,
          boxSizing: "border-box",
          background: "transparent",
          overflow: "hidden",
          color: readingInk,
        }}
      >
        {layout !== "speech" &&
          slot(
            "sceneHeading",
            <div
              style={{
                position: "absolute",
                top: 0,
                left: "6%",
                right: "6%",
                textAlign: "center",
                zIndex: 1,
              }}
            >
              <span
                style={{
                  ...quiet,
                  ...twoLines,
                  display: "inline-block",
                  maxWidth: "100%",
                  fontSize: (layout === "phase" || layout === "end" ? t.chapter : t.scene) * scale,
                  lineHeight: 1.25,
                  fontFamily: theme.definition.fonts.heading,
                  color: readingInk,
                  background: alpha(surface.readingColor, 0.84),
                  borderBottom: `${tokens.frame.width * scale}px solid ${tokens.frame.color}`,
                  padding: `${10 * scale}px ${20 * scale}px`,
                }}
              >
                {scene.title}
              </span>
            </div>,
          )}
        {content}
        {scene.editorial && (
          <div
            data-editorial-targets={scene.editorial.targetIds?.join(",")}
            data-editorial-actor={scene.editorial.actorId}
            style={{
              position: "absolute",
              top: layout === "speech" ? 18 * scale : 92 * scale,
              left: "10%",
              right: "10%",
              textAlign: "center",
              zIndex: 2,
              fontSize: t.aux * scale,
              color: mutedInk,
            }}
          >
            <span style={{ background: alpha(surface.readingColor, 0.88), padding: 6 * scale }}>
              {text(locale, "video.editorial_targets")} ·{" "}
              {[
                ...(scene.editorial.actorId === undefined ? [] : [scene.editorial.actorId]),
                ...(scene.editorial.targetIds ?? []),
              ]
                .map(label)
                .join(" / ")}
            </span>
          </div>
        )}
        {focus.length > 0 && (
          <div
            data-focus-labels
            style={{
              position: "absolute",
              top: layout === "speech" ? 20 * scale : 78 * scale,
              left: 16 * scale,
              right: 16 * scale,
              display: "flex",
              justifyContent: "center",
              gap: 14 * scale,
              pointerEvents: "none",
            }}
          >
            {focus.map((id) => (
              <span
                key={id}
                style={{
                  ...quiet,
                  ...twoLines,
                  maxWidth: 220 * scale,
                  fontSize: t.aux * scale,
                  color: mutedInk,
                  background: alpha(surface.readingColor, 0.85),
                  padding: 6 * scale,
                }}
              >
                {label(id)}
              </span>
            ))}
          </div>
        )}
        {slot(
          "frame",
          gothic && theme.options.ornamentalFrames === true ? (
            <GothicMetalFrame scale={scale} ornamental />
          ) : null,
        )}
      </section>
      <VideoLayers
        plan={plan}
        view={view}
        space="world"
        layerRegistry={layerRegistry}
        mediaBaseUrl={mediaBaseUrl}
      />
      <VideoLayers
        plan={plan}
        view={view}
        space="screen"
        layerRegistry={layerRegistry}
        mediaBaseUrl={mediaBaseUrl}
      />
      {slot("transition", null)}
      <div
        data-testid="composition-caption"
        data-caption-page={view.captionPageIndex}
        style={{
          position: "absolute",
          left: stage.x,
          width: stage.width,
          bottom: 16 * scale,
          display: "grid",
          gridTemplateColumns: "minmax(0,1fr) max-content",
          alignItems: "center",
          gap: 18 * scale,
          color: palette.canvasMuted,
          fontSize: t.aux * scale,
        }}
      >
        <span
          data-testid="composition-event"
          data-event-seq={view.sourceSeq}
          style={{ ...quiet, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
        >
          {text(locale, layout === "speech" ? "video.speaking" : "video.narrator")}
          {layout === "speech" && speechActor !== undefined ? ` · ${label(speechActor)}` : ""}
          {current.victory && (
            <span data-testid="composition-victory" title={current.victory}>
              {` · ${current.victory}`}
            </span>
          )}
        </span>
        <span>{<CaptionCounter caption={caption} locale={locale} />}</span>
      </div>
    </AbsoluteFill>
  );
}
