/**
 * 负责左右固定名册和中央语义场景的主题化视频画面。输入仅为已编译计划与显式帧，输出发言、技能、票型及结算视觉。
 * 所有动画围绕编译节拍计算；人物目标、库存和结果只读结构化场景，不解析台词意图，也不从用药推导救活。
 */
import { AbsoluteFill } from "remotion";
import { VideoImage } from "./VideoImage";
import type { CSSProperties, ReactNode } from "react";
import { text } from "@ai-werewolf-arena/game-text";
import { playerLabel } from "@ai-werewolf-arena/game-presentation";
import { AvatarMark } from "../presentation/AvatarMark";
import type { ResolvedPlayerPresentation } from "../presentation";
import { getThemeSlot, resolveTheme, themePalette, type ThemeSlot } from "../themes";
import { buildVideoFrame, resolveVideoMediaSource } from "./frame";
import { VideoLayers } from "./VideoLayers";
import type { VideoLayerRegistry, VideoPlan } from "./types";
import type { VideoThemeSlotProps, VideoThemeSlotRegistry } from "./theme-renderers";
import {
  GothicBackdrop,
  GothicMetalFrame,
  GothicSkillArt,
  PhaseSigil,
  gothicSurface,
  GOTHIC_METAL,
  GOTHIC_LIGHT,
  GOTHIC_DARK,
} from "./GothicArt";

const quiet: CSSProperties = { overflowWrap: "anywhere", minWidth: 0 };
const twoLines: CSSProperties = {
  display: "-webkit-box",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
};
const clamp = (value: number) => Math.max(0, Math.min(1, value));

/** 图形只表达技能种类；实际身份仍由独立角色徽章显示。 */
export function SkillMark({
  kind,
  color = "currentColor",
  size = 100,
}: {
  kind: string;
  color?: string;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      aria-hidden="true"
      style={{ color, flexShrink: 0 }}
    >
      {kind === "inspect" ? (
        <>
          <path d="M8 50Q50 8 92 50Q50 92 8 50Z" stroke="currentColor" strokeWidth="4" />
          <circle cx="50" cy="50" r="14" stroke="currentColor" strokeWidth="4" />
          <circle cx="50" cy="50" r="5" fill="currentColor" />
          <path d="M50 4V15M18 16L26 25M82 16L74 25" stroke="currentColor" strokeWidth="3" />
        </>
      ) : kind === "heal" || kind === "poison" ? (
        <>
          <path
            d="M39 10H61V19L58 22V37C81 49 82 83 65 89H35C18 83 19 49 42 37V22L39 19Z"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            d="M29 61Q50 51 71 61V76Q70 83 63 83H37Q30 83 29 76Z"
            fill="currentColor"
            opacity=".25"
          />
          {kind === "heal" ? (
            <path d="M50 53V73M40 63H60" stroke="currentColor" strokeWidth="5" />
          ) : (
            <>
              <circle cx="43" cy="62" r="4" fill="currentColor" />
              <circle cx="57" cy="62" r="4" fill="currentColor" />
              <path d="M43 75L57 75" stroke="currentColor" strokeWidth="3" />
            </>
          )}
        </>
      ) : kind === "guard" || kind === "protection" ? (
        <>
          <path
            d="M50 8L82 23V53Q80 77 50 94Q20 77 18 53V23Z"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path d="M33 50L45 64L69 36" stroke="currentColor" strokeWidth="5" />
        </>
      ) : kind === "exile" ? (
        <>
          <circle cx="50" cy="50" r="33" stroke="currentColor" strokeWidth="5" />
          <path d="M29 29L71 71M71 29L29 71" stroke="currentColor" strokeWidth="4" />
        </>
      ) : kind === "wolf-knife" || kind === "wolf-vote" ? (
        <>
          <path
            d="M17 11L33 32L50 25L67 32L83 11L80 61L65 84L50 93L35 84L20 61Z"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            d="M30 48L42 53M70 48L58 53M43 71L50 77L57 71"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path d="M43 60L50 65L57 60" fill="currentColor" />
        </>
      ) : (
        <>
          <path d="M50 8L87 50L50 92L13 50Z" stroke="currentColor" strokeWidth="3" />
          <path d="M50 28V72M28 50H72" stroke="currentColor" strokeWidth="3" />
        </>
      )}
    </svg>
  );
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
  const current = view.currentView;
  const scene = view.scene;
  const locale = plan.display.locale;
  const theme = plan.theme ?? resolveTheme();
  const gothic = theme.id === "gothic-v1";
  const night = current.snapshot.phase === "night";
  const basePalette = themePalette(theme, night ? "night" : "day");
  const palette =
    theme.options.highContrast === true
      ? { ...basePalette, border: basePalette.text, muted: basePalette.text }
      : basePalette;
  const compact = theme.options.density === "compact";
  const cardPalette = gothic ? themePalette(theme, "night") : palette;
  // 同一发言者已在正文抬头，不再多画一排重复的聚焦信息。
  const hasFocusPanel =
    view.focusPlayerIds.length > 0 &&
    !(
      scene.kind === "speech" &&
      view.focusPlayerIds.length === 1 &&
      view.focusPlayerIds[0] === scene.actorId
    );
  const s = Math.min(plan.width / 1280, plan.height / 720);
  const props: VideoThemeSlotProps = { plan, view, theme, palette, mediaBaseUrl };
  const revealed = view.localFrame >= scene.cues.impact;
  const enter = clamp(
    (view.localFrame - scene.cues.establish + 1) /
      Math.max(1, scene.cues.travel - scene.cues.establish),
  );
  const progress = clamp(
    (view.localFrame - scene.cues.travel) / Math.max(1, scene.cues.impact - scene.cues.travel),
  );
  const roster = plan.playersPresentation;
  const profile = (id: number) => roster.find((player) => player.playerId === id);
  const label = (id: number) => {
    const player = profile(id);
    return playerLabel({ id, seat: player?.seat ?? id, name: player?.displayName }, locale);
  };
  const seatLabel = (id: number) => playerLabel({ id, seat: profile(id)?.seat ?? id }, locale);
  const slot = (key: ThemeSlot, fallback: ReactNode, playerId?: number) => {
    const Component = getThemeSlot(themeSlots, theme, key);
    return Component ? (
      <Component
        {...props}
        palette={key === "playerCard" || key === "seatBadge" ? cardPalette : palette}
        {...(playerId === undefined ? {} : { playerId })}
      />
    ) : (
      fallback
    );
  };
  const avatar = (player: ResolvedPlayerPresentation | undefined, size: number) => {
    if (!player) return null;
    if (player.avatar.kind === "asset") {
      const assetId = player.avatar.assetId;
      const asset = plan.media.find((item) => item.id === assetId && item.kind === "image");
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
  const medallion = (id: number, size = gothic ? 96 : 72) => (
    <div
      style={{
        display: "grid",
        justifyItems: "center",
        gap: 9 * s,
        width: (size + 28) * s,
        minWidth: 0,
      }}
    >
      <div
        style={{
          width: size * s,
          height: size * s,
          border: `${gothic ? 3 * s : 1}px solid ${gothic ? GOTHIC_METAL : palette.border}`,
          borderRadius: "50%",
          display: "grid",
          placeItems: "center",
          background: gothic
            ? "radial-gradient(circle at 40% 30%, #29404b, #071018 80%)"
            : palette.panel,
          color: gothic ? GOTHIC_LIGHT : palette.text,
          boxShadow: gothic
            ? `0 0 0 ${3 * s}px #060c12, 0 0 0 ${4 * s}px ${GOTHIC_METAL}77, 0 ${5 * s}px ${12 * s}px #0008`
            : undefined,
        }}
      >
        {avatar(profile(id), size * 0.67 * s)}
      </div>
      <div
        title={label(id)}
        style={{
          ...twoLines,
          color: palette.text,
          fontSize: 18 * s,
          fontWeight: 650,
          ...quiet,
          maxWidth: "100%",
          textAlign: "center",
        }}
      >
        {label(id)}
      </div>
    </div>
  );
  const backdrop = gothic ? (
    <GothicBackdrop night={night} />
  ) : (
    <AbsoluteFill style={{ background: palette.canvas }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse at 50% 15%, ${palette.border}33, transparent 70%)`,
        }}
      />
    </AbsoluteFill>
  );

  function bodyParts() {
    // 分页使用编译器同一套字符网格，显式强调只标注作者选定的原文范围。
    const page = view.caption;
    const offset = view.captionOffset;
    const parts: ReactNode[] = [];
    let cursor = 0;
    for (const emphasis of scene.emphasis) {
      const start = Math.max(0, emphasis.start - offset),
        end = Math.min(page.length, emphasis.end - offset);
      if (end <= start || start < cursor) continue;
      parts.push(
        page.slice(cursor, start),
        <mark
          key={`${start}:${end}`}
          style={{ background: "transparent", color: palette.wolf, fontWeight: 800 }}
        >
          {page.slice(start, end)}
        </mark>,
      );
      cursor = end;
    }
    parts.push(page.slice(cursor));
    return parts;
  }
  function speech() {
    return (
      <div style={{ height: "100%", display: "flex", flexDirection: "column", gap: 20 * s }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 18 * s,
            paddingBottom: 15 * s,
            borderBottom: `1px solid ${palette.border}`,
          }}
        >
          {scene.actorId !== undefined && avatar(profile(scene.actorId), 52 * s)}
          <div style={{ minWidth: 0 }}>
            <div style={{ ...quiet, ...twoLines, fontSize: 26 * s, fontWeight: 700 }}>
              {scene.actorId === undefined ? scene.title : label(scene.actorId)}
            </div>
            <div style={{ fontSize: 13 * s, marginTop: 6 * s, color: palette.muted }}>
              {scene.title}
            </div>
          </div>
        </div>
        <div
          data-scene-speech
          style={{
            ...quiet,
            fontSize: (hasFocusPanel ? 24 : 30) * s,
            lineHeight: hasFocusPanel ? 1.4 : 1.48,
            fontFamily: gothic ? theme.definition.fonts.heading : undefined,
            fontWeight: 550,
            whiteSpace: "pre-wrap",
            flex: 1,
          }}
        >
          {bodyParts()}
        </div>
        <div style={{ alignSelf: "flex-end", fontSize: 12 * s, color: palette.muted }}>
          {text(locale, "video.page", {
            page: view.captionPageIndex + 1,
            pages: view.shot.captionPages.length,
          })}
        </div>
      </div>
    );
  }
  function ballot() {
    const data = scene.ballot;
    if (!data) return <p>{text(locale, "video.no_ballots")}</p>;
    if (!revealed)
      return (
        <p data-scene-ballot-pending style={{ fontSize: 24 * s, color: palette.muted }}>
          {text(locale, "video.waiting")}
        </p>
      );
    const targets = [
      ...new Set([
        ...Object.keys(data.tally ?? {}).map(Number),
        ...data.votes.filter((vote) => vote.targetId !== null).map((vote) => vote.targetId!),
      ]),
    ];
    const total = Math.max(1, ...Object.values(data.tally ?? {}));
    const abstentions = data.votes.filter((vote) => vote.abstain);
    // 显式重点可以直接定位默认原文；不能因为作者未替换整段文案而吞掉合法标记。
    const editorial = scene.bodySource === "script" || scene.emphasis.length > 0;
    const dense = targets.length > 4 || editorial;
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: (dense ? 8 : 15) * s,
          opacity: revealed ? 1 : 0.2,
        }}
        data-scene-ballot
      >
        {editorial && (
          <div
            data-scene-editorial
            style={{ ...quiet, fontSize: 17 * s, lineHeight: 1.45, whiteSpace: "pre-wrap" }}
          >
            {bodyParts()}
          </div>
        )}
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              editorial && targets.length > 8
                ? "repeat(3,minmax(0,1fr))"
                : dense
                  ? "minmax(0,1fr) minmax(0,1fr)"
                  : "minmax(0,1fr)",
            gap: (dense ? 9 : 15) * s,
          }}
        >
          {targets.map((id) => (
            <div
              key={id}
              data-ballot-target={id}
              style={{
                minWidth: 0,
                borderBottom: `1px solid ${palette.border}`,
                paddingBottom: (dense ? 7 : 16) * s,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: (dense ? 7 : 14) * s,
                  marginBottom: (dense ? 6 : 10) * s,
                }}
              >
                <strong
                  title={label(id)}
                  style={{ minWidth: (dense ? 40 : 70) * s, fontSize: (dense ? 15 : 20) * s }}
                >
                  {seatLabel(id)}
                </strong>
                <strong
                  style={{
                    fontSize: (dense ? 18 : 26) * s,
                    color: id === data.targetId ? palette.wolf : palette.accent,
                  }}
                >
                  {data.tally && revealed
                    ? text(locale, "video.votes", { count: data.tally[String(id)] ?? 0 })
                    : "—"}
                </strong>
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 6 * s,
                    marginLeft: "auto",
                    maxWidth: "52%",
                  }}
                >
                  {revealed &&
                    data.votes
                      .filter((vote) => vote.targetId === id && !vote.abstain)
                      .map((vote) => (
                        <span
                          key={vote.actorId}
                          style={{
                            fontSize: (dense ? 11 : 14) * s,
                            padding: `${(dense ? 2 : 4) * s}px ${(dense ? 4 : 7) * s}px`,
                            border: `1px solid ${palette.border}`,
                            borderRadius: 4 * s,
                          }}
                        >
                          {profile(vote.actorId)?.seat ?? vote.actorId}
                          {vote.weight !== null && vote.weight !== 1 ? ` ×${vote.weight}` : ""}
                        </span>
                      ))}
                </div>
              </div>
              <div style={{ height: (dense ? 5 : 8) * s, background: `${palette.border}44` }}>
                <div
                  style={{
                    height: "100%",
                    width: `${revealed && data.tally ? (100 * (data.tally[String(id)] ?? 0)) / total : 0}%`,
                    background: id === data.targetId ? palette.wolf : palette.good,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
        {revealed && abstentions.length > 0 && (
          <div style={{ fontSize: 16 * s, color: palette.muted }}>
            {text(locale, "video.abstentions")} ·{" "}
            {abstentions.map((vote) => seatLabel(vote.actorId)).join(" / ")}
          </div>
        )}
        {revealed && data.adjustments.length > 0 && (
          <div style={{ fontSize: 15 * s, color: palette.muted }}>
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
              ...twoLines,
              borderTop: `1px solid ${palette.border}`,
              paddingTop: 20 * s,
              fontSize: 24 * s,
              color: palette.wolf,
              fontFamily: theme.definition.fonts.heading,
            }}
          >
            {theme.options.waxSeals === true && (
              <SkillMark kind="exile" color={palette.wolf} size={27 * s} />
            )}
            {scene.resolution.text}
          </div>
        )}
        {!revealed && <p style={{ fontSize: 20 * s }}>{text(locale, "video.waiting")}</p>}
      </div>
    );
  }
  function action(diagramOnly = false) {
    const kind = scene.action?.kind ?? "generic";
    const color =
      kind === "heal" || kind === "protection" || kind === "guard"
        ? palette.success
        : kind === "poison" || kind.startsWith("wolf") || kind === "exile"
          ? palette.wolf
          : palette.accent;
    const paintedProp = gothic && ["inspect", "heal", "poison"].includes(kind);
    const diagram = (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: (gothic ? 32 : 28) * s,
        }}
      >
        {scene.actorId !== undefined && medallion(scene.actorId)}
        {scene.actorId === undefined && scene.participantIds?.length ? (
          <div style={{ display: "flex", gap: 9 * s }}>
            {scene.participantIds.map((id) => (
              <div key={id}>{medallion(id, 45)}</div>
            ))}
          </div>
        ) : null}
        {paintedProp && scene.actorId !== undefined && (
          <span style={{ color, fontSize: 30 * s, opacity: 0.5 + progress * 0.5 }}>→</span>
        )}
        <div
          style={{
            display: "grid",
            justifyItems: "center",
            gap: 10 * s,
            transform: `translateY(${(1 - enter) * 10 * s}px)`,
          }}
        >
          {slot(
            "actionEffect",
            <div
              style={{
                transform: `scale(${0.9 + 0.1 * progress})`,
                opacity: 0.55 + 0.45 * enter,
              }}
            >
              {paintedProp ? (
                <GothicSkillArt
                  kind={kind}
                  size={(kind === "inspect" ? 250 : 210) * s}
                  progress={progress}
                  frame={view.localFrame}
                />
              ) : (
                <div
                  style={
                    gothic
                      ? {
                          padding: 20 * s,
                          borderRadius: "50%",
                          background: `radial-gradient(circle, ${color}22, #05101999 65%, transparent 70%)`,
                          filter: `drop-shadow(0 0 ${14 * s}px ${color}44)`,
                        }
                      : undefined
                  }
                >
                  <SkillMark kind={kind} color={color} size={(gothic ? 155 : 108) * s} />
                </div>
              )}
            </div>,
          )}
          {(scene.actorId !== undefined || scene.participantIds?.length) &&
            scene.targetIds.length > 0 &&
            !paintedProp && <span style={{ color, fontSize: 35 * s }}>→</span>}
        </div>
        {paintedProp && scene.targetIds.length > 0 && (
          <span style={{ color, fontSize: 30 * s, opacity: 0.5 + progress * 0.5 }}>
            {kind === "inspect" ? "←" : "→"}
          </span>
        )}
        {scene.targetIds.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 12 * s }}>
            {scene.targetIds.map((id) => (
              <div key={id}>{medallion(id)}</div>
            ))}
          </div>
        )}
      </div>
    );
    if (diagramOnly) return diagram;
    return (
      <div
        style={{
          height: "100%",
          boxSizing: "border-box",
          paddingTop: view.layout.stage.height * (gothic ? 0.47 : 0.32),
          display: "flex",
          flexDirection: "column",
          justifyContent: gothic ? "flex-start" : "flex-end",
          gap: 18 * s,
        }}
      >
        <div style={{ textAlign: "center", minHeight: 92 * s }}>
          <div
            data-scene-result
            style={{
              ...quiet,
              color: revealed ? color : palette.muted,
              fontSize:
                (gothic
                  ? view.caption.length > 100
                    ? 22
                    : view.caption.length > 65
                      ? 26
                      : 32
                  : 26) * s,
              lineHeight: 1.4,
              fontFamily: gothic ? theme.definition.fonts.heading : undefined,
              whiteSpace: "pre-wrap",
            }}
          >
            {revealed
              ? scene.stock && scene.bodySource !== "script" && scene.emphasis.length === 0
                ? text(locale, "video.inventory", {
                    heal: scene.stock.heal,
                    poison: scene.stock.poison,
                  })
                : bodyParts()
              : text(locale, "video.waiting")}
          </div>
        </div>
        <div style={{ color: palette.muted, fontSize: 12 * s, textAlign: "center" }}>
          {text(
            locale,
            !revealed
              ? "video.waiting"
              : scene.action?.status === "revoked"
                ? "video.revoked"
                : scene.action?.status === "committed"
                  ? "video.committed"
                  : scene.action?.status === "choice"
                    ? "video.choice"
                    : "video.recorded",
          )}
        </div>
      </div>
    );
  }
  const content =
    scene.kind === "speech" ? (
      slot("speech", speech())
    ) : scene.kind === "ballot" ? (
      slot("ballot", ballot())
    ) : scene.kind === "action" ? (
      action()
    ) : (
      <div
        style={{
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: 25 * s,
          textAlign: "center",
        }}
      >
        <SkillMark
          kind={scene.action?.kind ?? (night ? "inspect" : "generic")}
          color={palette.accent}
          size={90 * s}
        />
        <div
          data-scene-announcement
          style={{
            ...quiet,
            fontSize: 30 * s,
            lineHeight: 1.55,
            whiteSpace: "pre-wrap",
            color: palette.text,
          }}
        >
          {revealed ? bodyParts() : text(locale, "video.waiting")}
        </div>
      </div>
    );
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
      {slot("background", backdrop)}
      <header
        style={{
          position: "absolute",
          left: 27 * s,
          right: 27 * s,
          top: 20 * s,
          height: 48 * s,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: `1px solid ${gothic ? `${GOTHIC_METAL}99` : palette.border}`,
          color: gothic ? GOTHIC_LIGHT : palette.canvasText,
          textShadow: gothic ? "0 2px 5px #000a" : undefined,
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 16 * s }}>
          <strong
            style={{
              fontFamily: theme.definition.fonts.heading,
              fontSize: 27 * s,
              letterSpacing: 2 * s,
            }}
          >
            {text(locale, "video.game_title")}
          </strong>
          <span style={{ fontSize: 12 * s, color: palette.canvasMuted }}>
            {text(locale, "video.god_view")}
          </span>
        </div>
        <span
          data-testid="composition-phase"
          style={{
            position: gothic ? "absolute" : undefined,
            left: gothic ? "50%" : undefined,
            top: gothic ? 0 : undefined,
            transform: gothic ? "translateX(-50%)" : undefined,
            fontSize: (gothic ? 24 : 20) * s,
            fontFamily: theme.definition.fonts.heading,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 12 * s,
            background: gothic ? `${GOTHIC_DARK}ed` : undefined,
            padding: gothic ? `${12 * s}px ${24 * s}px` : undefined,
            minWidth: gothic ? 240 * s : undefined,
          }}
        >
          {gothic && <PhaseSigil night={night} size={30 * s} />}
          {current.dayPhase}
          {gothic && <GothicMetalFrame scale={s} small />}
        </span>
        <span style={{ fontSize: 15 * s }}>
          {text(locale, "video.alive", {
            count: current.players.filter((player) => player.alive).length,
            total: current.players.length,
          })}
        </span>
      </header>
      {current.players.map((player) => {
        const seat = view.layout.seats.find((item) => item.playerId === player.playerId)!;
        const identity = profile(player.playerId);
        const right = view.layout.rosterRight.some((item) => item.playerId === player.playerId);
        const column = right ? view.layout.rosterColumns.right : view.layout.rosterColumns.left;
        const hasMetadata =
          column.hasMetadata &&
          Boolean(identity?.displayName?.trim() || identity?.modelLabel?.trim());
        const active =
          view.focusPlayerIds.includes(player.playerId) ||
          scene.actorId === player.playerId ||
          scene.participantIds?.includes(player.playerId);
        const target =
          (scene.kind !== "ballot" || revealed) && scene.targetIds.includes(player.playerId);
        // 目标边框只表达本次技能的选中对象；绿色用药不等于已经救活，生命仍取 currentView。
        const targetAccent = ["heal", "guard", "protection"].includes(scene.action?.kind ?? "")
          ? cardPalette.success
          : scene.action?.kind === "inspect"
            ? cardPalette.accent
            : cardPalette.wolf;
        const accent = active
          ? gothic
            ? GOTHIC_METAL
            : palette.accent
          : target
            ? targetAccent
            : gothic
              ? GOTHIC_METAL
              : palette.border;
        const portraitSize = gothic ? (locale === "en" ? 58 : 66) : 48;
        const portrait = (
          <div
            style={{
              position: "relative",
              width: portraitSize * s,
              height: portraitSize * s,
              display: "grid",
              placeItems: "center",
              flexShrink: 0,
              filter: player.alive ? undefined : "grayscale(1)",
              borderRadius: gothic ? "50%" : undefined,
              border: gothic
                ? `${2 * s}px solid ${active ? GOTHIC_LIGHT : GOTHIC_METAL}`
                : undefined,
              background: gothic
                ? "radial-gradient(circle at 35% 25%, #304650, #0a141c 75%)"
                : undefined,
              boxSizing: "border-box",
              boxShadow: gothic
                ? `inset 0 0 ${8 * s}px #0008, 0 0 0 ${2 * s}px #020a10, 0 0 0 ${3 * s}px ${GOTHIC_METAL}55`
                : undefined,
              color: gothic ? GOTHIC_LIGHT : undefined,
            }}
          >
            {avatar(identity, (gothic ? portraitSize * 0.76 : 44) * s)}
            {slot(
              "seatBadge",
              <span
                style={{
                  position: "absolute",
                  bottom: -6 * s,
                  left: -3 * s,
                  minWidth: (gothic ? 27 : 22) * s,
                  height: (gothic ? 27 : 22) * s,
                  borderRadius: "50%",
                  background: gothic
                    ? "linear-gradient(135deg, #544631, #161b1c 65%)"
                    : palette.canvas,
                  border: `${gothic ? 2 : 1}px solid ${gothic ? GOTHIC_METAL : accent}`,
                  color: gothic ? GOTHIC_LIGHT : palette.canvasText,
                  fontFamily: gothic ? theme.definition.fonts.heading : undefined,
                  fontSize: (gothic ? 19 : 14) * s,
                  display: "grid",
                  placeItems: "center",
                }}
              >
                {identity?.seat ?? player.playerId}
              </span>,
              player.playerId,
            )}
          </div>
        );
        const metadata = hasMetadata ? (
          <div
            data-player-metadata
            style={{
              ...quiet,
              flex: 1,
              textAlign: right ? "right" : "left",
              maxHeight: seat.height - 14 * s,
              overflow: "hidden",
            }}
          >
            {identity?.modelLabel && (
              <div
                title={identity.modelLabel}
                style={{
                  fontSize: 10 * s,
                  color: cardPalette.muted,
                  lineHeight: 1.3,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {identity.modelLabel}
              </div>
            )}
            {identity?.displayName && (
              <div
                title={identity.displayName}
                style={{
                  ...twoLines,
                  fontSize: 15 * s,
                  fontWeight: 650,
                  lineHeight: 1.25,
                  marginTop: 3 * s,
                  maxHeight: 39 * s,
                }}
              >
                {identity.displayName}
              </div>
            )}
          </div>
        ) : null;
        const role = (
          <div
            title={player.roleLabel}
            style={{
              ...twoLines,
              WebkitLineClamp: 3,
              width:
                (locale === "en" ? 56 : gothic ? (player.roleLabel.length > 3 ? 37 : 25) : 34) * s,
              maxHeight: Math.min((gothic ? 70 : 58) * s, seat.height - 14 * s),
              textAlign: "center",
              flexShrink: 0,
              color:
                player.camp === "wolf"
                  ? cardPalette.wolf
                  : player.camp === "good"
                    ? cardPalette.good
                    : cardPalette.neutral,
              fontFamily: theme.definition.fonts.heading,
              fontSize:
                (locale === "en" ? 11 : gothic ? (player.roleLabel.length > 3 ? 14 : 18) : 15) * s,
              lineHeight: gothic ? 1.1 : 1.2,
              overflowWrap: "anywhere",
              background: gothic
                ? player.camp === "wolf"
                  ? "linear-gradient(#54252b77, #29171b55)"
                  : "linear-gradient(#25404a66, #10212b55)"
                : undefined,
              padding: gothic ? `${3 * s}px ${2 * s}px` : undefined,
              boxSizing: "border-box",
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
              background: gothic ? "linear-gradient(125deg, #162630f0, #08141cf5)" : palette.panel,
              border: `1px solid ${accent}`,
              borderRadius: gothic ? 1 : theme.definition.radii.card * s,
              color: cardPalette.text,
              opacity: player.alive ? 1 : 0.72,
              overflow: "hidden",
            }}
          >
            {slot(
              "playerCard",
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8 * s,
                  height: "100%",
                  padding: `${7 * s}px ${9 * s}px`,
                  boxSizing: "border-box",
                  justifyContent: hasMetadata ? undefined : "center",
                }}
              >
                {right ? (
                  <>
                    {role}
                    {portrait}
                    {metadata}
                  </>
                ) : (
                  <>
                    {metadata}
                    {portrait}
                    {role}
                  </>
                )}
              </div>,
              player.playerId,
            )}
            {gothic && (
              <GothicMetalFrame scale={s} active={Boolean(active || target)} color={accent} small />
            )}
            {!player.alive && (
              <span
                style={{
                  position: "absolute",
                  right: 5 * s,
                  bottom: 3 * s,
                  color: cardPalette.wolf,
                  fontSize: (gothic ? 13 : 10) * s,
                  border: `${gothic ? 2 : 1}px solid ${cardPalette.wolf}`,
                  padding: `0 ${3 * s}px`,
                  transform: gothic ? "rotate(-12deg)" : undefined,
                  background: gothic ? "#171c20ee" : undefined,
                }}
              >
                {text(locale, "video.eliminated")}
              </span>
            )}
            {player.isSheriff && (
              <span
                style={{
                  position: "absolute",
                  left: 4 * s,
                  top: 2 * s,
                  color: gothic ? GOTHIC_LIGHT : palette.accent,
                  fontSize: 10 * s,
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
        data-video-focus={
          view.focusPlayerIds.length && !hasFocusPanel ? view.focusPlayerIds.join(",") : undefined
        }
        style={{
          position: "absolute",
          left: view.layout.stage.x,
          top: view.layout.stage.y,
          width: view.layout.stage.width,
          height: view.layout.stage.height,
          boxSizing: "border-box",
          backgroundColor: palette.panel,
          ...(gothic ? gothicSurface(night) : {}),
          backgroundImage:
            theme.options.paperTexture === true
              ? `repeating-linear-gradient(0deg, ${palette.ink}06 0px, ${palette.ink}06 1px, transparent 1px, transparent 4px)${gothic ? `, ${gothicSurface(night).backgroundImage}` : ""}`
              : gothic
                ? gothicSurface(night).backgroundImage
                : undefined,
          border: `1px solid ${palette.border}`,
          borderRadius: gothic ? 2 : theme.definition.radii.panel * s,
          overflow: "hidden",
        }}
      >
        {scene.kind === "action" && (
          <AbsoluteFill
            style={{
              clipPath: gothic
                ? hasFocusPanel
                  ? "inset(29% 2% 30% 2%)"
                  : "inset(17% 2% 33% 2%)"
                : hasFocusPanel
                  ? "inset(29% 2% 38% 2%)"
                  : "inset(19% 2% 38% 2%)",
              pointerEvents: "none",
            }}
          >
            <AbsoluteFill
              data-video-world
              style={{ transform: view.stageTransform, transformOrigin: "50% 50%" }}
            >
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  top: gothic ? (hasFocusPanel ? "30%" : "20%") : hasFocusPanel ? "32%" : "24%",
                  height: gothic ? "42%" : "28%",
                  display: "grid",
                  placeItems: "center",
                }}
              >
                {action(true)}
              </div>
            </AbsoluteFill>
          </AbsoluteFill>
        )}
        <div
          style={{
            position: "relative",
            height: "100%",
            padding: `${(compact ? 18 : 24) * s}px ${(compact ? 22 : 28) * s}px`,
            boxSizing: "border-box",
            display: "flex",
            flexDirection: "column",
            gap: (hasFocusPanel ? 12 : 22) * s,
          }}
        >
          {hasFocusPanel && (
            <div
              data-video-focus={view.focusPlayerIds.join(",")}
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                gap: 10 * s,
                paddingBottom: 8 * s,
                borderBottom: `1px solid ${palette.border}`,
              }}
            >
              {view.focusPlayerIds.map((id) => (
                <div
                  key={id}
                  style={{ display: "flex", alignItems: "center", gap: 6 * s, maxWidth: 165 * s }}
                >
                  {avatar(profile(id), 26 * s)}
                  <span
                    title={label(id)}
                    style={{ ...twoLines, fontSize: 14 * s, fontWeight: 650 }}
                  >
                    {label(id)}
                  </span>
                </div>
              ))}
            </div>
          )}
          {scene.kind !== "speech" &&
            slot(
              "sceneHeading",
              <div
                style={{
                  fontSize: (gothic ? 36 : 27) * s,
                  fontFamily: theme.definition.fonts.heading,
                  fontWeight: 700,
                  borderBottom: `1px solid ${palette.border}`,
                  paddingBottom: 16 * s,
                  textAlign: gothic ? "center" : undefined,
                  color: gothic && night ? GOTHIC_LIGHT : undefined,
                }}
              >
                {scene.title}
              </div>,
            )}
          <div style={{ flex: 1, minHeight: 0 }}>{content}</div>
        </div>
        {slot(
          "frame",
          gothic ? (
            <GothicMetalFrame scale={s} ornamental={theme.options.ornamentalFrames === true} />
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
          left: view.layout.stage.x,
          width: view.layout.stage.width,
          // 铭牌比旧文字条更高，靠下保留完整12席的垂直边界，避免压到最后一排。
          bottom: (gothic ? 2 : 18) * s,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 15 * s,
          color: palette.canvasMuted,
          fontSize: 12 * s,
          ...(gothic
            ? {
                background: `${GOTHIC_DARK}ed`,
                padding: `${10 * s}px ${24 * s}px`,
                boxSizing: "border-box",
                color: GOTHIC_LIGHT,
              }
            : {}),
        }}
      >
        <span>{text(locale, scene.kind === "speech" ? "video.speaking" : "video.narrator")}</span>
        <span
          data-testid="composition-event"
          data-event-seq={view.sourceSeq}
          style={{ ...quiet, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
        >
          {scene.kind === "speech" && scene.actorId !== undefined
            ? label(scene.actorId)
            : scene.title}
        </span>
        <span>
          {text(locale, "video.page", {
            page: view.captionPageIndex + 1,
            pages: view.shot.captionPages.length,
          })}
        </span>
        {gothic && <GothicMetalFrame scale={s} small />}
      </div>
      {current.victory && (
        <span
          data-testid="composition-victory"
          style={{
            position: "absolute",
            bottom: 7 * s,
            left: 25 * s,
            color: palette.accent,
            fontSize: 10 * s,
          }}
        >
          {current.victory}
        </span>
      )}
    </AbsoluteFill>
  );
}
