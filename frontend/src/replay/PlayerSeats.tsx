/**
 * 负责展示投影后的席位、存活与胜者标记。输入为当前玩家视图和焦点，输出席位按钮及选择回调。
 * 角色／公开身份区分沿用输入，组件不从事件补全隐藏身份或以焦点授予额外信息。
 */
import { playerLabel } from "@ai-werewolf-arena/game-presentation";
import { text, type Locale } from "@ai-werewolf-arena/game-text";
import type { ReplayPlayerState } from "./replay-projection";
import { campName, roleName } from "./replay-localization";

interface PlayerSeatsProps {
  players: ReplayPlayerState[];
  locale: Locale;
  focusedPlayerId: number | null;
  onToggleFocus: (playerId: number) => void;
}

export function PlayerSeats({ players, locale, focusedPlayerId, onToggleFocus }: PlayerSeatsProps) {
  // 存活统计只取当前帧投影；终局胜者与存活是两个独立标记。
  const aliveCount = players.filter((player) => player.alive).length;

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
        {players.map((player) => (
          <button
            type="button"
            key={player.playerId}
            aria-label={playerLabel({ id: player.playerId, name: player.name }, locale)}
            className={`seat ${player.alive ? "alive" : "dead"} ${player.isWinner ? "winner-seat" : ""} ${player.camp} ${focusedPlayerId === player.playerId ? "focused" : ""}`}
            onClick={() => onToggleFocus(player.playerId)}
          >
            <span className="seat-number">{player.playerId}</span>
            {player.isSheriff && (
              <span className="sheriff">{text(locale, "replay.sheriff_short")}</span>
            )}
            {player.isWinner && (
              <span className="winner">{text(locale, "victory.winner_badge")}</span>
            )}
            {player.name && <span className="seat-name">{player.name}</span>}
            <strong>{roleName(player.role, locale)}</strong>
            <small>{campName(player.camp, locale)}</small>
            {player.publicRole && (
              <small>
                {text(locale, "replay.role_revealed_badge", {
                  role: roleName(player.publicRole, locale),
                })}
              </small>
            )}
          </button>
        ))}
      </div>
    </section>
  );
}
