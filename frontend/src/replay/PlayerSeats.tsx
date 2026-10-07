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
            aria-label={`${text(locale, "replay.player", { id: player.playerId })}${player.name ? ` · ${player.name}` : ""}`}
            className={`seat ${player.alive ? "alive" : "dead"} ${player.camp} ${focusedPlayerId === player.playerId ? "focused" : ""}`}
            onClick={() => onToggleFocus(player.playerId)}
          >
            <span className="seat-number">{player.playerId}</span>
            {player.isSheriff && <span className="sheriff">{text(locale, "replay.sheriff_short")}</span>}
            {player.name && <span className="seat-name">{player.name}</span>}
            <strong>{roleName(player.role, locale)}</strong>
            <small>{campName(player.camp, locale)}</small>
          </button>
        ))}
      </div>
    </section>
  );
}
