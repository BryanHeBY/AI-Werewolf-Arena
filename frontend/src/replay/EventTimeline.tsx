import { text, type Locale } from "@ai-werewolf-arena/game-text";
import type { ReplayEvent } from "@ai-werewolf-arena/replay-contract";
import { eventLabel } from "./event-labels";
import { phaseName, eventStageName } from "./replay-localization";

interface EventTimelineProps {
  events: ReplayEvent[];
  locale: Locale;
  playerIds: readonly number[];
  activeEventSeq: number | null;
  focusedPlayerId: number | null;
  onJumpTo: (index: number) => void;
  onClearFocus: () => void;
}

export function EventTimeline({
  events,
  locale,
  playerIds,
  activeEventSeq,
  focusedPlayerId,
  onJumpTo,
  onClearFocus,
}: EventTimelineProps) {
  return (
    <section className="panel timeline">
      <div className="panel-heading">
        <div>
          <p className="section-kicker">{text(locale, "replay.kicker.timeline")}</p>
          <h2>
            {focusedPlayerId === null
              ? text(locale, "replay.timeline")
              : text(locale, "replay.player_timeline", { id: focusedPlayerId })}
          </h2>
        </div>
        {focusedPlayerId !== null && (
          <button type="button" className="text-button" onClick={onClearFocus}>
            {text(locale, "replay.clear_focus")}
          </button>
        )}
      </div>
      <div className="timeline-list">
        {events.map((event, index) => (
          <button
            type="button"
            className={`event ${event.seq === activeEventSeq ? "active" : ""}`}
            key={event.seq}
            onClick={() => onJumpTo(index)}
          >
            <span className="event-marker">D{event.day}</span>
            <div>
              <div className="event-head">
                <span>#{event.seq} · {phaseName(event.phase, locale)}</span>
                <span>{eventStageName(event, locale, playerIds)}</span>
              </div>
              <p>{eventLabel(event, locale, playerIds)}</p>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
