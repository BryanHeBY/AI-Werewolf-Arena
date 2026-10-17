/**
 * 负责固定双侧玩家名册的身份、存活、席位及展示资料。输入为当前只读玩家视图、固定席位几何和已裁剪资料，输出原有卡片DOM。
 * HUD不继承中央camera；头像、真实角色纹章、名字与模型分别排版，不从台词推身份或隐藏资料。
 */
import { text } from "@ai-werewolf-arena/game-text";
import { RoleCrest } from "../../../presentation/RoleCrest";
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
        const hasMetadata = Boolean(identity?.displayName?.trim() || identity?.modelLabel?.trim());
        const active =
          focusPlayerIds.includes(player.playerId) ||
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
            {
              <PlayerAvatar
                player={identity}
                size={avatarSize * 0.86}
                media={media}
                mediaBaseUrl={mediaBaseUrl}
              />
            }
            {renderSlot(
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
    </>
  );
}
