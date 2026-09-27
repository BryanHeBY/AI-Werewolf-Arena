import type { ReplayPlayerState } from "./replay-projection";
import { campName, roleName } from "./replay-localization";

interface PlayerSeatsProps {
  players: ReplayPlayerState[];
  focusedPlayerId: number | null;
  onToggleFocus: (playerId: number) => void;
}

export function PlayerSeats({ players, focusedPlayerId, onToggleFocus }: PlayerSeatsProps) {
  const aliveCount = players.filter((player) => player.alive).length;

  return (
    <section className="panel player-panel">
      <div className="panel-heading compact">
        <div>
          <p className="section-kicker">TABLE</p>
          <h2>席位状态</h2>
        </div>
        <span>{aliveCount} 人存活</span>
      </div>
      <div className="seat-grid">
        {players.map((player) => (
          <button
            type="button"
            key={player.playerId}
            className={`seat ${player.alive ? "alive" : "dead"} ${player.camp} ${focusedPlayerId === player.playerId ? "focused" : ""}`}
            onClick={() => onToggleFocus(player.playerId)}
          >
            <span className="seat-number">{player.playerId}</span>
            {player.isSheriff && <span className="sheriff">警</span>}
            <strong>{roleName(player.role)}</strong>
            <small>{campName(player.camp)}</small>
          </button>
        ))}
      </div>
    </section>
  );
}
