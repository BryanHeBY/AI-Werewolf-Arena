/**
 * 负责固定双侧玩家名册的身份、存活、席位及展示资料。输入为当前只读玩家视图、固定席位几何和已裁剪资料，输出原有卡片DOM。
 * HUD不继承中央camera；头像、真实角色纹章、名字与模型分别排版，不从台词推身份或隐藏资料。
 */
import { text } from "@ai-werewolf-arena/game-text";
import { RoleCrest } from "../../../presentation/RoleCrest";
import { visibleIdentityRole } from "../../../presentation";
import { EliminatedStamp } from "../../../presentation/EliminatedStamp";
import { SheriffBadge } from "../../../presentation/SheriffBadge";
import { VideoImage } from "../../VideoImage";
import type { ResolvedPlayerPresentation } from "../../../presentation";
import { GothicMetalFrame } from "../../GothicArt";
import type { VideoFrameView } from "../../frame";
import type { VideoPlan, VideoScene } from "../../types";
import type { SceneAppearance, RenderThemeSlot, BroadcastSceneLayout } from "./contracts";
import { quiet, twoLines, alpha } from "./style";
import { PlayerAvatar, playerLabels } from "./PlayerVisual";

export function RosterHud({
  players,
  seats,
  presentation,
  focusPlayerIds,
  scene,
  layout,
  revealed,
  scale,
  appearance,
  locale,
  media,
  mediaBaseUrl,
  renderSlot,
}: {
  players: VideoFrameView["currentView"]["players"];
  seats: VideoFrameView["layout"]["seats"];
  presentation: readonly ResolvedPlayerPresentation[];
  focusPlayerIds: readonly number[];
  scene: VideoScene;
  layout: BroadcastSceneLayout;
  revealed: boolean;
  scale: number;
  appearance: SceneAppearance;
  locale: VideoPlan["display"]["locale"];
  media: VideoPlan["media"];
  mediaBaseUrl?: string;
  renderSlot: RenderThemeSlot;
}) {
  const { profile } = playerLabels(presentation, locale);
  const { theme, surface, gothic, palette, cards } = appearance;
  const tokens = theme.definition,
    t = tokens.typography;
  return (
    <>
      {players.map((player) => {
        const seat = seats.find((item) => item.playerId === player.playerId)!;
        const identity = profile(player.playerId);
        const visibleRole = visibleIdentityRole(player);
        const roleLabel =
          visibleRole === "unknown" ? text(locale, "replay.unknown") : player.roleLabel;
        const mirrored =
          seat.x >
          (Math.min(...seats.map((item) => item.x)) + Math.max(...seats.map((item) => item.x))) / 2;
        const hasMetadata = Boolean(identity?.displayName?.trim() || identity?.modelLabel?.trim());
        const hasSeparateRole = (identity?.avatar.kind ?? "auto") !== "auto";
        const compactSheriffInset =
          player.isSheriff && !hasMetadata && hasSeparateRole && locale === "en"
            ? 32 * scale
            : undefined;
        const active =
          focusPlayerIds.includes(player.playerId) ||
          scene.actorId === player.playerId ||
          scene.visual?.actorId === player.playerId ||
          scene.participantIds?.includes(player.playerId);
        const requested =
          (layout !== "ballot" || revealed) &&
          (scene.visual?.requestedTargetIds ?? scene.targetIds).includes(player.playerId);
        // 实际落点只有揭晓后才可高亮；明确空落点不借请求目标回填。
        const effective =
          revealed &&
          scene.visual?.effectiveTargetKnown === true &&
          scene.visual.effectiveTargetIds.includes(player.playerId);
        const target = requested || effective;
        const accent =
          active || target ? (gothic ? tokens.frame.light : palette.accent) : tokens.frame.color;
        const hiddenAvatar = identity?.avatar.kind === "none";
        const requestedAvatar =
          (hiddenAvatar ? 34 : hasMetadata ? 54 : locale === "en" ? 64 : 76) * scale;
        // 紧凑英文名册为两行完整身份留高；不靠裁末行或缩整局HUD规避溢出。
        const avatarSize =
          !hiddenAvatar && !hasMetadata && locale === "en"
            ? Math.min(
                requestedAvatar,
                Math.max(34 * scale, seat.height - (8 + t.roleEn * 2.7) * scale),
              )
            : requestedAvatar;
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
              border: hiddenAvatar ? undefined : `${tokens.frame.width * scale}px solid ${accent}`,
              background: hiddenAvatar ? undefined : alpha(cards.canvas, 0.9),
              filter: player.alive ? undefined : "grayscale(1)",
            }}
          >
            {
              <PlayerAvatar
                player={identity}
                size={avatarSize * 0.86}
                media={media}
                mediaBaseUrl={mediaBaseUrl}
                visibleRole={visibleRole}
                themeId={theme.id}
              />
            }
            {renderSlot(
              "seatBadge",
              <span
                style={{
                  position: "absolute",
                  bottom: hiddenAvatar ? undefined : hasMetadata ? -9 * scale : undefined,
                  top: hiddenAvatar ? 0 : hasMetadata ? undefined : 4 * scale,
                  left: hiddenAvatar ? 0 : mirrored ? undefined : (hasMetadata ? -7 : -42) * scale,
                  right: hiddenAvatar
                    ? undefined
                    : mirrored
                      ? (hasMetadata ? -7 : -42) * scale
                      : undefined,
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
            title={roleLabel}
            data-role-label
            style={{
              ...quiet,
              ...twoLines,
              color: roleColor,
              fontSize: (locale === "en" ? t.roleEn : t.roleZh) * scale,
              lineHeight: 1.35,
              fontWeight: 600,
              maxHeight: (locale === "en" ? t.roleEn : t.roleZh) * 2.7 * scale,
            }}
          >
            {roleLabel}
          </div>
        );
        return (
          <div
            key={player.playerId}
            data-composition-player={player.playerId}
            data-player-alive={player.alive ? "true" : "false"}
            data-player-seat={identity?.seat ?? player.playerId}
            data-roster-side={mirrored ? "right" : "left"}
            data-requested-target={requested ? "true" : undefined}
            data-effective-target={effective ? "true" : undefined}
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
              borderStyle: requested && !effective && !active ? "dashed" : "solid",
              color: cards.text,
              // 整卡去色，身份和编号仍保有对比；不以低透明度假装死亡，也不因获胜重新着色。
              filter: player.alive ? undefined : "grayscale(1) brightness(0.78)",
              overflow: "hidden",
              borderRadius: gothic ? 2 * scale : theme.definition.radii.card * scale,
            }}
          >
            {renderSlot(
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
                    flexDirection: mirrored ? "row-reverse" : "row",
                    alignItems: "center",
                    justifyContent: hasMetadata ? undefined : "center",
                    gap: 18 * scale,
                    width: "100%",
                    // 英文徽记与独立角色章同现时留出内侧间距；席位仍在头像外侧，不翻转字形。
                    paddingLeft: mirrored ? compactSheriffInset : undefined,
                    paddingRight: mirrored ? undefined : compactSheriffInset,
                    boxSizing: "border-box",
                  }}
                >
                  {portrait}
                  {hasSeparateRole && (
                    <RoleCrest role={visibleRole} size={24 * scale} color={roleColor} />
                  )}
                  {hasMetadata && (
                    <div
                      data-player-metadata
                      style={{
                        ...quiet,
                        flex: 1,
                        textAlign: mirrored ? "right" : "left",
                        // 警徽和原字号标签占用内侧角落；资料行预留同侧安全区，长英文名不能穿过图文徽记。
                        paddingLeft:
                          player.isSheriff && mirrored
                            ? (locale === "en" ? 72 : 50) * scale
                            : undefined,
                        paddingRight:
                          player.isSheriff && !mirrored
                            ? (locale === "en" ? 72 : 50) * scale
                            : undefined,
                        boxSizing: "border-box",
                      }}
                    >
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
              <EliminatedStamp
                label={text(locale, "video.eliminated")}
                width={seat.width * 0.72}
                themeId={theme.id}
                mirrored={mirrored}
                renderImage={(props) => <VideoImage {...props} />}
              />
            )}
            {player.isWinner && (
              <span
                data-roster-winner
                style={{
                  position: "absolute",
                  bottom: 2 * scale,
                  right: mirrored ? undefined : 4 * scale,
                  left: mirrored ? 4 * scale : undefined,
                  fontSize: 18 * scale,
                  background: cards.canvas,
                  color: cards.canvasText,
                }}
              >
                {text(locale, "victory.winner_badge")}
              </span>
            )}
            {player.isSheriff && (
              <span
                data-roster-sheriff
                style={{
                  position: "absolute",
                  right: mirrored ? undefined : 8 * scale,
                  left: mirrored ? 8 * scale : undefined,
                  top: 6 * scale,
                  color: cards.canvasText,
                  lineHeight: 0,
                }}
              >
                <SheriffBadge
                  label={player.sheriffLabel}
                  size={38 * scale}
                  labelSize={20 * scale}
                  labelBackground={cards.canvas}
                  themeId={theme.id}
                  renderImage={(props) => <VideoImage {...props} />}
                />
              </span>
            )}
          </div>
        );
      })}
    </>
  );
}
