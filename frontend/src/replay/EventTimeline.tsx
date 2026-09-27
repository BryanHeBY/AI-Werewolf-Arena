import type { ReplayEvent } from "@ai-werewolf-arena/replay-contract";
import { eventLabel } from "./event-labels";
import { phaseName, stageName } from "./replay-localization";

interface EventTimelineProps {
  events: ReplayEvent[];
  activeEventSeq: number | null;
  focusedPlayerId: number | null;
  onJumpTo: (index: number) => void;
  onClearFocus: () => void;
}

export function EventTimeline({
  events,
  activeEventSeq,
  focusedPlayerId,
  onJumpTo,
  onClearFocus,
}: EventTimelineProps) {
  return (
    <section className="panel timeline">
      <div className="panel-heading">
        <div>
          <p className="section-kicker">TIMELINE</p>
          <h2>
            {focusedPlayerId === null
              ? "全局对局时间线"
              : `与 ${focusedPlayerId} 号相关的事件`}
          </h2>
        </div>
        {focusedPlayerId !== null && (
          <button type="button" className="text-button" onClick={onClearFocus}>
            清除席位筛选
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
                <span>#{event.seq} · {phaseName(event.phase)}</span>
                <span>{stageName(event.stage ?? event.type)}</span>
              </div>
              <p>{eventLabel(event)}</p>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
