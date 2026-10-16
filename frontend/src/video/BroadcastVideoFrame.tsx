/**
 * 负责固定名册与中央观众场景的主题化视频宿主。输入是编译计划、显式帧和已打包插槽，输出发言、行动、票型、阶段及结算版式。
 * 事实只读currentView与typed visual；动画只移动中央美术，HUD、正文及结果文字不继承camera。无台词识别、规则复算或隐式库存。
 */
import { AbsoluteFill } from "remotion";
import { useMemo, type CSSProperties, type ReactNode } from "react";
import { text } from "@ai-werewolf-arena/game-text";
import { playerLabel } from "@ai-werewolf-arena/game-presentation";
import { AvatarMark } from "../presentation/AvatarMark";
import { RoleCrest } from "../presentation/RoleCrest";
import type { ResolvedPlayerPresentation } from "../presentation";
import {
  getThemeSlot,
  normalizeResolvedTheme,
  resolveTheme,
  themePalette,
  themeSurface,
  type ThemeSlot,
} from "../themes";
import { buildVideoFrame, resolveVideoMediaSource } from "./frame";
import { VideoImage } from "./VideoImage";
import { VideoLayers } from "./VideoLayers";
import type { VideoLayerRegistry, VideoPlan, VideoScene } from "./types";
import type { VideoThemeSlotProps, VideoThemeSlotRegistry } from "./theme-renderers";
import { GothicBackdrop, GothicMetalFrame, PhaseSigil } from "./GothicArt";
import { SceneConnector, SceneHero, RecordMark } from "./SceneVisual";

const quiet: CSSProperties = { minWidth: 0, overflowWrap: "anywhere" };
const twoLines: CSSProperties = {
  display: "-webkit-box",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
};
const alpha = (color: string, opacity: number) =>
  /^#[\da-f]{6}$/i.test(color)
    ? `${color}${Math.round(opacity * 255)
        .toString(16)
        .padStart(2, "0")}`
    : color;
/** 只估排版占幅，不解释语义；显式换行也计入，避免短但多行的编导文本溢出局部衬。 */
function textRows(value: string, width: number, font: number) {
  let rows = 1,
    line = 0;
  for (const glyph of value) {
    if (glyph === "\n") {
      rows++;
      line = 0;
      continue;
    }
    const advance = font * (/[^\x00-\x7f]/.test(glyph) || /[MWmw@#%&]/.test(glyph) ? 1 : 0.65);
    if (line + advance > width) {
      rows++;
      line = 0;
    }
    line += advance;
  }
  return rows;
}

/** 只选择版式，不更改scene.kind、来源、结果或事实时钟。旧无意图计划安全退到原scene语义。 */
export function broadcastSceneLayout(scene: VideoScene) {
  if (scene.kind === "speech") return "speech";
  if (scene.kind === "ballot") return "ballot";
  if (scene.visual?.family === "game_result") return "end";
  if (scene.kind === "phase" || scene.visual?.family === "phase_transition") return "phase";
  if (scene.kind === "settlement" || scene.visual?.family === "life_settlement")
    return "settlement";
  if (scene.stock) return "action";
  if (
    scene.visual?.fallbackReason ||
    scene.visual?.process === "notice" ||
    scene.visual?.process === "unknown" ||
    scene.visual?.process === "skipped"
  )
    return "notice";
  return scene.kind === "action" || scene.visual ? "action" : "notice";
}

export function BroadcastVideoFrame({
  plan,
  frame,
  layerRegistry,
  themeSlots = {},
  mediaBaseUrl,
}: {
  plan: VideoPlan;
  frame: number;
  layerRegistry?: VideoLayerRegistry;
  themeSlots?: VideoThemeSlotRegistry;
  mediaBaseUrl?: string;
}) {
  const view = buildVideoFrame(plan, frame);
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
  const profile = (id: number) => roster.find((player) => player.playerId === id);
  const label = (id: number) =>
    playerLabel({ id, seat: profile(id)?.seat ?? id, name: profile(id)?.displayName }, locale);
  const seatLabel = (id: number) => playerLabel({ id, seat: profile(id)?.seat ?? id }, locale);
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
  const avatar = (player: ResolvedPlayerPresentation | undefined, size: number) => {
    if (!player) return null;
    if (player.avatar.kind === "asset") {
      const id = player.avatar.assetId;
      const asset = plan.media.find((item) => item.id === id && item.kind === "image");
      if (asset)
        return (
          <VideoImage
            src={resolveVideoMediaSource(asset.src, mediaBaseUrl)}
            width={size}
            height={size}
            style={{ objectFit: "contain" }}
          />
        );
    }
    return <AvatarMark avatar={player.avatar} size={size} />;
  };
  const readingInk = surface.readingText,
    mutedInk = surface.readingMuted;
  const padding = tokens.frame.padding * scale;
  const readingWidth = Math.min(stage.width - padding * 2, t.readingMaxWidth * scale);
  const bodySize =
    (theme.options.largeText === true ? t.bodyLarge : locale === "en" ? t.bodyEn : t.bodyZh) *
    scale;
  const lineHeight = locale === "en" ? t.lineHeightEn : t.lineHeightZh;
  const localSurface = (
    opacity = night ? surface.readingOpacityNight : surface.readingOpacityDay,
  ): CSSProperties => ({
    backgroundColor: alpha(surface.readingColor, opacity),
    color: readingInk,
    borderLeft: `${tokens.frame.width * scale}px solid ${alpha(tokens.frame.color, 0.7)}`,
    ...(theme.options.paperTexture === true
      ? {
          backgroundImage: `repeating-linear-gradient(0deg, ${alpha(readingInk, 0.018)} 0px, ${alpha(readingInk, 0.018)} 1px, transparent 1px, transparent 4px)`,
        }
      : {}),
  });

  function bodyParts() {
    const page = view.caption,
      offset = view.captionOffset;
    const result: ReactNode[] = [];
    let cursor = 0;
    for (const emphasis of scene.emphasis) {
      const start = Math.max(0, emphasis.start - offset),
        end = Math.min(page.length, emphasis.end - offset);
      if (end <= start || start < cursor) continue;
      result.push(
        page.slice(cursor, start),
        <mark
          key={`${start}:${end}`}
          style={{
            background: "transparent",
            color: gothic ? "#efb4a8" : palette.wolf,
            fontWeight: 700,
          }}
        >
          {page.slice(start, end)}
        </mark>,
      );
      cursor = end;
    }
    result.push(page.slice(cursor));
    return result;
  }
  function pageCounter() {
    return text(locale, "video.page", {
      page: view.captionPageIndex + 1,
      pages: view.shot.captionPages.length,
    });
  }
  function medallion(id: number, size: number, compact = false) {
    return (
      <div
        key={id}
        style={{
          width: size + (compact ? 24 : 42) * scale,
          display: "grid",
          justifyItems: "center",
          gap: 8 * scale,
        }}
      >
        <div
          style={{
            width: size,
            height: size,
            borderRadius: "50%",
            display: "grid",
            placeItems: "center",
            background: alpha(surface.readingColor, 0.85),
            border: `${2 * scale}px solid ${tokens.frame.color}`,
          }}
        >
          {avatar(profile(id), size * 0.72)}
        </div>
        <div
          title={label(id)}
          style={{
            ...quiet,
            ...twoLines,
            textAlign: "center",
            fontSize: (compact ? 22 : 26) * scale,
            color: readingInk,
            background: alpha(surface.readingColor, 0.86),
            padding: `${4 * scale}px ${8 * scale}px`,
          }}
        >
          {compact ? seatLabel(id) : label(id)}
        </div>
      </div>
    );
  }
  function speech() {
    // 按整段最大页固定阅读面高度；翻页不推动署名、行宽或背景。
    const lines = Math.max(
      1,
      ...view.shot.captionPages.map((page) => textRows(page, readingWidth - 60 * scale, bodySize)),
    );
    const signatures =
      (scene.visual?.recipientIds.length ? 32 : 0) +
      (scene.visual?.dialogue?.originalSpeakerId !== undefined ? 32 : 0);
    const height = Math.min(
      stage.height * (view.shot.captionPageRanges ? surface.readingMaxHeightRatio : 0.88),
      Math.max(stage.height * 0.4, lines * bodySize * lineHeight + (240 + signatures) * scale),
    );
    return (
      <div
        data-surface="speech"
        style={{
          ...localSurface(),
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
          {speechActor !== undefined && avatar(profile(speechActor), 48 * scale)}
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
            {text(locale, "video.recipient")} ·{" "}
            {scene.visual.recipientIds.map(seatLabel).join(" / ")}
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
          {bodyParts()}
        </div>
        <div style={{ alignSelf: "flex-end", color: mutedInk, fontSize: t.aux * scale }}>
          {pageCounter()}
        </div>
      </div>
    );
  }
  function ballot() {
    const data = scene.ballot;
    if (!data || !revealed)
      return (
        <div
          data-scene-ballot-pending
          style={{
            ...localSurface(),
            position: "absolute",
            bottom: "20%",
            left: "12%",
            right: "12%",
            padding,
            fontSize: bodySize,
          }}
        >
          {text(locale, data ? "video.waiting" : "video.no_ballots")}
        </div>
      );
    const targets = [
      ...new Set([
        ...Object.keys(data.tally ?? {}).map(Number),
        ...data.votes.flatMap((vote) => (vote.targetId === null ? [] : [vote.targetId])),
        ...(data.targetId === null ? [] : [data.targetId]),
      ]),
    ];
    const dense = targets.length > 4;
    const total = Math.max(1, ...Object.values(data.tally ?? {}));
    const abstentions = data.votes.filter((vote) => vote.abstain);
    const editorial = scene.bodySource === "script" || scene.emphasis.length > 0;
    const detailsMissing = data.votes.length === 0 && Object.keys(data.tally ?? {}).length === 0;
    return (
      <div
        data-scene-ballot
        data-surface="ballot"
        style={{
          ...localSurface(surface.ballotOpacity),
          position: "absolute",
          bottom: 24 * scale,
          left: padding,
          right: padding,
          padding,
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          gap: 16 * scale,
        }}
      >
        {editorial && (
          <div
            data-scene-editorial
            style={{
              ...quiet,
              fontSize: (locale === "en" ? 30 : 32) * scale,
              lineHeight,
              whiteSpace: "pre-wrap",
            }}
          >
            {bodyParts()}
          </div>
        )}
        {detailsMissing && (
          <div data-ballot-details-unavailable style={{ fontSize: t.aux * scale, color: mutedInk }}>
            {text(locale, "video.ballots_unavailable")}
          </div>
        )}
        {detailsMissing && data.targetId !== null && (
          <div data-ballot-recorded-result style={{ fontSize: t.result * scale }}>
            {text(locale, "video.result")} · {seatLabel(data.targetId)}
          </div>
        )}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: dense ? "minmax(0,1fr) minmax(0,1fr)" : "minmax(0,1fr)",
            gap: `${14 * scale}px ${26 * scale}px`,
          }}
        >
          {targets.map((id) => (
            <div
              key={id}
              data-ballot-target={id}
              style={{
                minWidth: 0,
                borderBottom: `${scale}px solid ${alpha(tokens.frame.color, 0.4)}`,
                paddingBottom: 12 * scale,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14 * scale,
                  marginBottom: 10 * scale,
                }}
              >
                <strong title={label(id)} style={{ minWidth: 58 * scale, fontSize: 28 * scale }}>
                  {seatLabel(id)}
                </strong>
                <strong
                  style={{
                    fontSize: (dense ? 30 : 36) * scale,
                    color:
                      id === data.targetId ? (gothic ? "#efb4a8" : palette.accent) : readingInk,
                  }}
                >
                  {data.tally && Object.hasOwn(data.tally, String(id))
                    ? text(locale, "video.votes", { count: data.tally[String(id)]! })
                    : "—"}
                </strong>
                <div
                  style={{
                    marginLeft: "auto",
                    display: "flex",
                    flexWrap: "wrap",
                    justifyContent: "flex-end",
                    gap: 6 * scale,
                    maxWidth: "56%",
                  }}
                >
                  {data.votes
                    .filter((vote) => vote.targetId === id && !vote.abstain)
                    .map((vote) => (
                      <span
                        key={vote.actorId}
                        style={{
                          fontSize: 24 * scale,
                          border: `${scale}px solid ${tokens.frame.color}`,
                          padding: `${2 * scale}px ${6 * scale}px`,
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {profile(vote.actorId)?.seat ?? vote.actorId}
                        {vote.weight !== null && vote.weight !== 1 ? ` ×${vote.weight}` : ""}
                      </span>
                    ))}
                </div>
              </div>
              {data.tally && Object.hasOwn(data.tally, String(id)) && (
                <div style={{ height: 5 * scale, background: alpha(tokens.frame.color, 0.25) }}>
                  <div
                    style={{
                      height: "100%",
                      width: `${data.tally ? (100 * (data.tally[String(id)] ?? 0)) / total : 0}%`,
                      background: id === data.targetId ? palette.accent : palette.good,
                    }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
        {abstentions.length > 0 && (
          <div style={{ fontSize: t.aux * scale, color: mutedInk }}>
            {text(locale, "video.abstentions")} ·{" "}
            {abstentions.map((vote) => seatLabel(vote.actorId)).join(" / ")}
          </div>
        )}
        {data.adjustments.length > 0 && (
          <div style={{ fontSize: t.aux * scale, color: mutedInk }}>
            {text(locale, "video.extra_votes")} ·{" "}
            {data.adjustments
              .map((item) => `${seatLabel(item.targetId)} +${item.weight}`)
              .join(" / ")}
          </div>
        )}
        {scene.resolution && view.localFrame >= scene.resolution.revealFrame && (
          <div
            data-scene-resolution
            style={{
              ...quiet,
              borderTop: `${scale}px solid ${tokens.frame.color}`,
              paddingTop: 16 * scale,
              fontSize: t.result * scale,
              color: gothic ? "#efb4a8" : palette.wolf,
              lineHeight: 1.35,
            }}
          >
            {scene.resolution.text}
          </div>
        )}
      </div>
    );
  }
  function action() {
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
      ...view.shot.captionPages.map((page) => textRows(page, readingWidth - 56 * scale, bodySize)),
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
            style={{ transform: view.stageTransform, transformOrigin: "50% 50%" }}
          >
            {visual && (
              <SceneConnector
                intent={visual}
                scene={scene}
                frame={view.localFrame}
                width={stage.width}
                height={stage.height}
                theme={theme}
                color={color}
                scale={scale}
              />
            )}
            <div style={{ position: "absolute", left: (stage.width - size) / 2, top: 68 * scale }}>
              {slot(
                "actionEffect",
                <SceneHero
                  scene={scene}
                  frame={view.localFrame}
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
                {sources.map((id) =>
                  medallion(id, (sources.length > 2 ? 44 : 86) * scale, sources.length > 2),
                )}
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
                {targets.map((id) =>
                  medallion(id, (targets.length > 2 ? 44 : 86) * scale, targets.length > 2),
                )}
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
                <span
                  style={{ background: alpha(surface.readingColor, 0.88), padding: 10 * scale }}
                >
                  {text(locale, "video.no_target")}
                </span>
              </div>
            )}
            {effectiveKnown &&
              requested.length > 0 &&
              requested.join(",") !== targets.join(",") && (
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
                  <span
                    style={{ background: alpha(surface.readingColor, 0.88), padding: 6 * scale }}
                  >
                    {text(locale, "video.choice")} · {requested.map(seatLabel).join(" / ")}
                  </span>
                </div>
              )}
          </AbsoluteFill>
        </div>
        <div
          data-surface="result"
          style={{
            ...localSurface(surface.resultOpacity),
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
            {revealed ? bodyParts() : text(locale, "video.waiting")}
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
  function announcement() {
    const end = layout === "end",
      phase = layout === "phase",
      settlement = layout === "settlement",
      compact = layout === "notice";
    const maxLength = Math.max(1, ...view.shot.captionPages.map((page) => page.length));
    const rows = Math.ceil(maxLength / Math.max(1, readingWidth / bodySize));
    const height = Math.max(
      stage.height * 0.21,
      Math.min(
        stage.height * (settlement ? 0.48 : 0.32),
        rows * bodySize * lineHeight + padding * 2,
      ),
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
              frame={view.localFrame}
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
            ...localSurface(surface.resultOpacity),
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
            {revealed ? bodyParts() : text(locale, "video.waiting")}
          </div>
        </div>
      </>
    );
  }
  const content =
    layout === "speech"
      ? slot("speech", speech())
      : layout === "ballot"
        ? slot("ballot", ballot())
        : layout === "action"
          ? action()
          : announcement();
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
      {current.players.map((player) => {
        const seat = view.layout.seats.find((item) => item.playerId === player.playerId)!;
        const identity = profile(player.playerId);
        const hasMetadata = Boolean(identity?.displayName?.trim() || identity?.modelLabel?.trim());
        const active =
          view.focusPlayerIds.includes(player.playerId) ||
          scene.actorId === player.playerId ||
          scene.visual?.actorId === player.playerId ||
          scene.participantIds?.includes(player.playerId);
        const target =
          (layout !== "ballot" || revealed) &&
          (scene.visual?.requestedTargetIds ?? scene.targetIds).includes(player.playerId);
        const accent =
          active || target ? (gothic ? tokens.frame.light : palette.accent) : tokens.frame.color;
        const avatarSize = (hasMetadata ? 54 : locale === "en" ? 64 : 76) * scale;
        const roleColor =
          player.camp === "wolf" ? cards.wolf : player.camp === "good" ? cards.good : cards.neutral;
        const portrait = (
          <div
            style={{
              position: "relative",
              width: avatarSize,
              height: avatarSize,
              flexShrink: 0,
              display: "grid",
              placeItems: "center",
              borderRadius: "50%",
              border: `${tokens.frame.width * scale}px solid ${accent}`,
              background: alpha(cards.canvas, 0.9),
              filter: player.alive ? undefined : "grayscale(1)",
            }}
          >
            {avatar(identity, avatarSize * 0.86)}
            {slot(
              "seatBadge",
              <span
                style={{
                  position: "absolute",
                  bottom: hasMetadata ? -9 * scale : undefined,
                  top: hasMetadata ? undefined : 4 * scale,
                  left: (hasMetadata ? -7 : -42) * scale,
                  minWidth: 34 * scale,
                  height: 34 * scale,
                  display: "grid",
                  placeItems: "center",
                  color: cards.canvasText,
                  background: cards.canvas,
                  border: `${tokens.frame.width * scale}px solid ${accent}`,
                  fontSize: 30 * scale,
                  fontVariantNumeric: "tabular-nums",
                  fontWeight: 700,
                }}
              >
                {identity?.seat ?? player.playerId}
              </span>,
              player.playerId,
            )}
          </div>
        );
        const role = (
          <div
            title={player.roleLabel}
            data-role-label
            style={{
              ...quiet,
              ...twoLines,
              color: roleColor,
              fontSize: (locale === "en" ? t.roleEn : t.roleZh) * scale,
              lineHeight: 1.2,
              fontWeight: 600,
              maxHeight: (locale === "en" ? t.roleEn : t.roleZh) * 2.4 * scale,
            }}
          >
            {player.roleLabel}
          </div>
        );
        return (
          <div
            key={player.playerId}
            data-composition-player={player.playerId}
            data-player-alive={player.alive ? "true" : "false"}
            data-player-seat={identity?.seat ?? player.playerId}
            data-testid={player.isWinner ? "composition-winner" : undefined}
            style={{
              position: "absolute",
              left: seat.x - seat.width / 2,
              top: seat.y - seat.height / 2,
              width: seat.width,
              height: seat.height,
              boxSizing: "border-box",
              background: alpha(cards.panel, surface.cardOpacity),
              border: `${(active || target ? tokens.frame.activeWidth : tokens.frame.width) * scale}px solid ${accent}`,
              color: cards.text,
              overflow: "hidden",
              borderRadius: gothic ? 2 * scale : theme.definition.radii.card * scale,
            }}
          >
            {slot(
              "playerCard",
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  gap: (hasMetadata ? 6 : 4) * scale,
                  height: "100%",
                  padding: `${(hasMetadata ? 4 : 2) * scale}px ${14 * scale}px`,
                  boxSizing: "border-box",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: hasMetadata ? undefined : "center",
                    gap: 18 * scale,
                    width: "100%",
                  }}
                >
                  {portrait}
                  <RoleCrest role={player.role} size={24 * scale} color={roleColor} />
                  {hasMetadata && (
                    <div data-player-metadata style={{ ...quiet, flex: 1 }}>
                      {identity?.displayName?.trim() && (
                        <div
                          title={identity.displayName}
                          style={{
                            ...twoLines,
                            WebkitLineClamp: 1,
                            paddingBlock: scale,
                            fontSize: t.name * scale,
                            lineHeight: 1.4,
                            fontWeight: 600,
                          }}
                        >
                          {identity.displayName}
                        </div>
                      )}
                      {identity?.modelLabel?.trim() && (
                        <div
                          title={identity.modelLabel}
                          style={{
                            fontSize: t.model * scale,
                            lineHeight: 1.3,
                            color: cards.muted,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            marginTop: 3 * scale,
                          }}
                        >
                          {identity.modelLabel}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: 7 * scale,
                    justifyContent: "center",
                    alignItems: "center",
                    minWidth: 0,
                    width: "100%",
                  }}
                >
                  {role}
                </div>
              </div>,
              player.playerId,
            )}
            {gothic && (
              <GothicMetalFrame
                scale={scale}
                active={Boolean(active || target)}
                color={accent}
                small
              />
            )}
            {!player.alive && (
              <span
                style={{
                  position: "absolute",
                  right: 4 * scale,
                  bottom: 2 * scale,
                  color: cards.wolf,
                  background: cards.canvas,
                  fontSize: 20 * scale,
                  borderBottom: `${2 * scale}px solid ${cards.wolf}`,
                  padding: `0 ${4 * scale}px`,
                }}
              >
                {text(locale, "video.eliminated")}
              </span>
            )}
            {player.isSheriff && (
              <span
                style={{
                  position: "absolute",
                  right: 4 * scale,
                  top: 2 * scale,
                  color: cards.canvasText,
                  background: cards.canvas,
                  fontSize: 20 * scale,
                }}
              >
                {player.sheriffLabel}
              </span>
            )}
          </div>
        );
      })}
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
        <span>{pageCounter()}</span>
      </div>
    </AbsoluteFill>
  );
}
