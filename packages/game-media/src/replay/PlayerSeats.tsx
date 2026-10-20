/**
 * 负责展示投影后的席位、存活与胜者标记。输入为当前玩家视图和焦点，输出席位按钮及选择回调。
 * 角色／公开身份区分沿用输入，组件不从事件补全隐藏身份或以焦点授予额外信息。
 */
import { memo, type CSSProperties } from "react";
import { playerLabel } from "@ai-werewolf-arena/game-presentation";
import { text, type Locale } from "@ai-werewolf-arena/game-text";
import type { ReplayPlayerState } from "./replay-projection";
import { campName, roleName } from "./replay-localization";
import { IdentityAvatar } from "../presentation/IdentityAvatar";
import { EliminatedStamp } from "../presentation/EliminatedStamp";
import { SheriffBadge } from "../presentation/SheriffBadge";
import { visibleIdentityRole } from "../presentation";
import {
  resolveTheme,
  roleAppearance,
  type ThemeId,
  type ThemeTone,
  type ResolvedTheme,
} from "../themes";
import { playerActivityHighlight } from "../presentation/player-activity-highlight";
import { RoleCrest } from "../presentation/RoleCrest";
import type { ResolvedPlayerPresentation } from "../presentation";

interface PlayerSeatsProps {
  players: ReplayPlayerState[];
  locale: Locale;
  focusedPlayerId: number | null;
  onToggleFocus: (playerId: number) => void;
  presentations?: readonly ResolvedPlayerPresentation[];
  themeId?: ThemeId;
  theme?: ResolvedTheme;
  tone?: ThemeTone;
  /** 当前视频场景明确的行动/发言主体；焦点选择仍独立，不把点击当行动。 */
  activePlayerIds?: readonly number[];
  /** 当前结构化行动主体可临时使用动作主题色；普通发言和点击焦点不染身份底色。 */
  actingPlayerIds?: readonly number[];
  /** 当前动作语义已选定的主题色；集体狼刀不能按执行者角色变色。 */
  actionColor?: string;
  /** 仅由宿主已准备 image 媒体建立的映射；组件不读取原档路径或自行下载。 */
  avatarSources?: Readonly<Record<string, string>>;
}

export const PlayerSeats = memo(function PlayerSeats({
  players,
  locale,
  focusedPlayerId,
  onToggleFocus,
  presentations,
  themeId = "minimal-v1",
  theme: providedTheme,
  tone = "day",
  activePlayerIds = [],
  actingPlayerIds = [],
  actionColor,
  avatarSources,
}: PlayerSeatsProps) {
  // 存活统计只取当前帧投影；终局胜者与存活是两个独立标记。
  const aliveCount = players.filter((player) => player.alive).length;
  const theme = providedTheme ?? resolveTheme(themeId);

  return (
    <section className="panel player-panel">
      <div className="panel-heading compact">
        <div>
          <p className="section-kicker">{text(locale, "replay.kicker.seats")}</p>
          <h2>{text(locale, "replay.seats")}</h2>
        </div>
        <span>{text(locale, "replay.alive", { count: aliveCount })}</span>
      </div>
      <div className="seat-grid">
        {players.map((player) => {
          const profile = presentations?.find((item) => item.playerId === player.playerId);
          const name = presentations ? profile?.displayName : player.name;
          const seat = profile?.seat ?? player.playerId;
          const visibleRole = visibleIdentityRole(player);
          const roleSkin = roleAppearance(theme, tone, visibleRole);
          const roleLabel =
            visibleRole === "unknown"
              ? text(locale, "replay.unknown")
              : roleName(visibleRole, locale);
          const avatar = profile?.avatar ?? { kind: "auto" as const };
          const assetField =
            avatar.kind === "asset" && avatarSources
              ? Object.getOwnPropertyDescriptor(avatarSources, avatar.assetId)
              : undefined;
          const assetSource =
            assetField && "value" in assetField && typeof assetField.value === "string"
              ? assetField.value
              : undefined;
          const activity = player.alive ? player.rosterActivity : undefined;
          const highlight = playerActivityHighlight(
            activity,
            player.alive && activePlayerIds.includes(player.playerId),
            theme.definition.frame.activity,
            actingPlayerIds.includes(player.playerId) && actionColor
              ? actionColor
              : "var(--awa-accent)",
          );
          return (
            <button
              type="button"
              key={player.playerId}
              aria-pressed={focusedPlayerId === player.playerId}
              aria-label={playerLabel({ id: player.playerId, seat, name }, locale)}
              data-player-id={player.playerId}
              data-seat={seat}
              data-has-metadata={Boolean(name || profile?.modelLabel)}
              data-visible-role={visibleRole}
              data-role-color-key={roleSkin.key}
              data-roster-activity={activity?.kind}
              data-roster-activity-status={activity?.status}
              data-player-current={highlight.strong ? "true" : undefined}
              data-player-acting={actingPlayerIds.includes(player.playerId) ? "true" : undefined}
              style={
                {
                  "--awa-role-ink": roleSkin.ink,
                  ...(highlight.color
                    ? {
                        borderColor: highlight.color,
                        borderWidth: highlight.strong ? 3 : 2,
                        borderStyle: highlight.withdrawn ? "dashed" : "solid",
                        background: highlight.fillOpacity
                          ? `color-mix(in srgb, ${highlight.color} ${highlight.fillOpacity * 100}%, var(--awa-panel))`
                          : undefined,
                        transition: "none",
                      }
                    : {}),
                } as CSSProperties
              }
              className={`seat ${player.alive ? "alive" : "dead"} ${player.isWinner ? "winner-seat" : ""} ${player.camp} ${focusedPlayerId === player.playerId ? "focused" : ""}`}
              onClick={() => onToggleFocus(player.playerId)}
            >
              <span className="seat-identity">
                <span className="seat-number">{seat}</span>
                <IdentityAvatar
                  avatar={avatar}
                  visibleRole={visibleRole}
                  themeId={theme.id}
                  assetSource={assetSource}
                  size={32}
                />
                {avatar.kind !== "auto" && <RoleCrest role={visibleRole} size={24} />}
                {player.isSheriff && (
                  <span className="sheriff">
                    <SheriffBadge
                      label={text(locale, "replay.sheriff")}
                      size={26}
                      themeId={theme.id}
                    />
                  </span>
                )}
              </span>
              {player.isWinner && (
                <span className="winner">{text(locale, "victory.winner_badge")}</span>
              )}
              {name && (
                <span className="seat-name" title={name}>
                  {name}
                </span>
              )}
              {profile?.modelLabel && (
                <span className="seat-model" title={profile.modelLabel}>
                  {profile.modelLabel}
                </span>
              )}
              <strong className="seat-role" title={roleLabel}>
                <span>{roleLabel}</span>
              </strong>
              <small>{campName(player.camp, locale)}</small>
              {player.publicRole && (
                <small>
                  {text(locale, "replay.role_revealed_badge", {
                    role: roleName(player.publicRole, locale),
                  })}
                </small>
              )}
              {!player.alive && (
                <EliminatedStamp
                  label={text(locale, "video.eliminated")}
                  width={112}
                  themeId={theme.id}
                />
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
});
