/**
 * 负责左右固定名册和中央语义场景的主题化视频画面。输入仅为已编译计划与显式帧，输出发言、技能、票型及结算视觉。
 * 所有动画围绕编译节拍计算；人物目标、库存和结果只读结构化场景，不解析台词意图，也不从用药推导救活。
 */
import { AbsoluteFill, Img } from "remotion";
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
  const night = current.snapshot.phase === "night";
  const basePalette = themePalette(theme, night ? "night" : "day");
  const palette =
    theme.options.highContrast === true
      ? { ...basePalette, border: basePalette.text, muted: basePalette.text }
      : basePalette;
  const compact = theme.options.density === "compact";
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
      <Component {...props} {...(playerId === undefined ? {} : { playerId })} />
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
          <Img
            src={resolveVideoMediaSource(asset.src, mediaBaseUrl)}
            width={size}
            height={size}
            style={{ objectFit: "contain" }}
          />
        );
    }
    return <AvatarMark avatar={player.avatar} size={size} />;
  };
  const medallion = (id: number, size = 72) => (
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
          border: `1px solid ${palette.border}`,
          borderRadius: "50%",
          display: "grid",
          placeItems: "center",
          background: palette.panel,
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
  const backdrop = (
    <AbsoluteFill style={{ background: palette.canvas }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse at 50% 15%, ${palette.border}33, transparent 70%)`,
        }}
      />
      {theme.id === "gothic-v1" && (
        <svg
          width={plan.width}
          height={plan.height}
          viewBox="0 0 1280 720"
          preserveAspectRatio="none"
          aria-hidden="true"
          style={{ position: "absolute", opacity: 0.11 }}
        >
          <path
            d="M320 136L354 112L384 136L404 118L425 136L425 156H320ZM835 136L856 118L883 136L916 110L946 136V156H835Z"
            fill={palette.muted}
          />
          {night && (
            <circle
              cx="640"
              cy="190"
              r="72"
              fill={scene.action?.kind.startsWith("wolf") ? palette.wolf : palette.muted}
            />
          )}
          <path
            d="M690 460L714 403L737 424L768 390L790 428L827 448L799 468L810 495L782 502L757 527L740 579L720 579L721 530L694 553L672 609L649 609L665 537L646 494Z"
            fill={palette.muted}
          />
        </svg>
      )}
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
            fontSize: (view.focusPlayerIds.length ? 24 : 30) * s,
            lineHeight: view.focusPlayerIds.length ? 1.4 : 1.58,
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
    const diagram = (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 28 * s }}>
        {scene.actorId !== undefined && medallion(scene.actorId)}
        {scene.actorId === undefined && scene.participantIds?.length ? (
          <div style={{ display: "flex", gap: 9 * s }}>
            {scene.participantIds.map((id) => (
              <div key={id}>{medallion(id, 45)}</div>
            ))}
          </div>
        ) : null}
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
              <SkillMark kind={kind} color={color} size={108 * s} />
            </div>,
          )}
          {(scene.actorId !== undefined || scene.participantIds?.length) &&
            scene.targetIds.length > 0 && <span style={{ color, fontSize: 35 * s }}>→</span>}
        </div>
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
          paddingTop: view.layout.stage.height * 0.32,
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          gap: 18 * s,
        }}
      >
        <div style={{ textAlign: "center", minHeight: 92 * s }}>
          <div
            data-scene-result
            style={{
              ...quiet,
              color: revealed ? color : palette.muted,
              fontSize: 26 * s,
              lineHeight: 1.5,
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
      style={{ fontFamily: theme.definition.fonts.body, color: palette.text, overflow: "hidden" }}
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
          borderBottom: `1px solid ${palette.border}`,
          color: palette.canvasText,
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
          style={{ fontSize: 20 * s, fontFamily: theme.definition.fonts.heading }}
        >
          {current.dayPhase}
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
        const active =
          view.focusPlayerIds.includes(player.playerId) ||
          scene.actorId === player.playerId ||
          scene.participantIds?.includes(player.playerId);
        const target =
          (scene.kind !== "ballot" || revealed) && scene.targetIds.includes(player.playerId);
        const accent = active ? palette.accent : target ? palette.wolf : palette.border;
        const portrait = (
          <div
            style={{
              position: "relative",
              width: 48 * s,
              height: 52 * s,
              display: "grid",
              placeItems: "center",
              flexShrink: 0,
              filter: player.alive ? undefined : "grayscale(1)",
            }}
          >
            {avatar(identity, 44 * s)}
            {slot(
              "seatBadge",
              <span
                style={{
                  position: "absolute",
                  bottom: -6 * s,
                  left: -3 * s,
                  minWidth: 22 * s,
                  height: 22 * s,
                  borderRadius: "50%",
                  background: palette.canvas,
                  border: `1px solid ${accent}`,
                  color: palette.canvasText,
                  fontSize: 14 * s,
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
        const metadata = (
          <div
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
                  color: palette.muted,
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
        );
        const role = (
          <div
            title={player.roleLabel}
            style={{
              ...twoLines,
              WebkitLineClamp: 3,
              width: (locale === "en" ? 56 : 34) * s,
              maxHeight: Math.min(58 * s, seat.height - 14 * s),
              textAlign: "center",
              flexShrink: 0,
              color:
                player.camp === "wolf"
                  ? palette.wolf
                  : player.camp === "good"
                    ? palette.good
                    : palette.neutral,
              fontFamily: theme.definition.fonts.heading,
              fontSize: (locale === "en" ? 11 : 15) * s,
              lineHeight: 1.2,
              overflowWrap: "anywhere",
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
              background: palette.panel,
              border: `1px solid ${accent}`,
              borderRadius: theme.definition.radii.card * s,
              color: palette.text,
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
            {!player.alive && (
              <span
                style={{
                  position: "absolute",
                  right: 5 * s,
                  bottom: 3 * s,
                  color: palette.wolf,
                  fontSize: 10 * s,
                  border: `1px solid ${palette.wolf}`,
                  padding: `0 ${3 * s}px`,
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
                  color: palette.accent,
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
        style={{
          position: "absolute",
          left: view.layout.stage.x,
          top: view.layout.stage.y,
          width: view.layout.stage.width,
          height: view.layout.stage.height,
          boxSizing: "border-box",
          backgroundColor: palette.panel,
          backgroundImage:
            theme.options.paperTexture === true
              ? `repeating-linear-gradient(0deg, ${palette.ink}06 0px, ${palette.ink}06 1px, transparent 1px, transparent 4px)`
              : undefined,
          border: `1px solid ${palette.border}`,
          borderRadius: theme.definition.radii.panel * s,
          overflow: "hidden",
        }}
      >
        {scene.kind === "action" && (
          <AbsoluteFill
            style={{
              clipPath: view.focusPlayerIds.length
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
                  top: view.focusPlayerIds.length ? "32%" : "24%",
                  height: "28%",
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
            gap: (view.focusPlayerIds.length ? 12 : 22) * s,
          }}
        >
          {view.focusPlayerIds.length > 0 && (
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
                  fontSize: 27 * s,
                  fontFamily: theme.definition.fonts.heading,
                  fontWeight: 700,
                  borderBottom: `1px solid ${palette.border}`,
                  paddingBottom: 16 * s,
                }}
              >
                {scene.title}
              </div>,
            )}
          <div style={{ flex: 1, minHeight: 0 }}>{content}</div>
        </div>
        {slot(
          "frame",
          <AbsoluteFill style={{ pointerEvents: "none" }}>
            {/* 低密度主题符号留在面板内，避免被不透明阅读面板遮住；自定义 frame 插槽可整体替换。 */}
            {theme.id === "gothic-v1" && (
              <>
                <svg
                  data-theme-moon
                  width={116 * s}
                  height={94 * s}
                  viewBox="0 0 116 94"
                  aria-hidden="true"
                  style={{ position: "absolute", right: 17 * s, top: 8 * s }}
                >
                  <circle
                    cx="75"
                    cy="41"
                    r="28"
                    fill={night ? palette.wolf : palette.good}
                    opacity=".12"
                  />
                  <circle
                    cx="75"
                    cy="41"
                    r="34"
                    stroke={palette.border}
                    strokeWidth=".7"
                    opacity=".45"
                    fill="none"
                  />
                  <path
                    d="M12 74V43Q12 24 28 14Q44 24 44 43V74M18 74V45Q18 32 28 24Q38 32 38 45V74"
                    stroke={palette.border}
                    opacity=".35"
                    fill="none"
                  />
                  {night && scene.action?.kind.startsWith("wolf") && (
                    <path
                      d="M62 24L53 60M75 20L65 62M88 25L78 58"
                      stroke={palette.wolf}
                      strokeWidth="2"
                      opacity=".4"
                    />
                  )}
                </svg>
                <svg
                  data-theme-wolf-shadow
                  width={160 * s}
                  height={132 * s}
                  viewBox="0 0 200 180"
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    right: 18 * s,
                    bottom: 20 * s,
                    opacity: night ? 0.065 : 0.045,
                  }}
                >
                  <path
                    d="M54 48L78 9L101 30L132 3L154 34L191 54L163 74L174 101L146 108L121 133L104 175H84L85 136L58 159L36 179H13L29 143L10 100Z"
                    fill={palette.text}
                  />
                </svg>
              </>
            )}
            {theme.options.ornamentalFrames === true && (
              <div
                data-theme-ornamental-frame
                style={{
                  position: "absolute",
                  inset: 6 * s,
                  border: `1px solid ${palette.border}`,
                  clipPath:
                    "polygon(0 0,22% 0,22% 1%,78% 1%,78% 0,100% 0,100% 100%,78% 100%,78% 99%,22% 99%,22% 100%,0 100%)",
                }}
              />
            )}
          </AbsoluteFill>,
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
          bottom: 18 * s,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 15 * s,
          color: palette.canvasMuted,
          fontSize: 12 * s,
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
