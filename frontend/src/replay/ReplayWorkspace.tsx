import { replayEventPlayerIds } from "./replay-event-reader";
import type { ReplayDocument } from "@ai-werewolf-arena/replay-contract";
import { text, outcomeWinnersLabel, victoryPointLabel } from "@ai-werewolf-arena/game-text";
import { formatReplayTime, type ReplayDisplayOptions } from "./replay-display";
import { ReplayDisplayControls } from "./ReplayDisplayControls";
import { useMemo, useState } from "react";
import { buildReplaySnapshot } from "./replay-projection";
import { buildPresentationReplay } from "./replay-presentation";
import {
  replayResultLabel,
  phaseName,
  resultReasonName,
  eventStageName,
} from "./replay-localization";
import { eventLabel } from "./event-labels";
import { ReplayStage } from "./ReplayStage";
import { PlayerSeats } from "./PlayerSeats";
import { EventTimeline } from "./EventTimeline";
import { useReplayPlayback } from "./useReplayPlayback";

export function ReplayWorkspace({
  replay,
  display,
  onDisplayChange,
}: {
  replay: ReplayDocument;
  display: ReplayDisplayOptions;
  onDisplayChange: (next: Partial<ReplayDisplayOptions>) => void;
}) {
  const { locale } = display;
  const presentationReplay = useMemo(() => buildPresentationReplay(replay), [replay]);
  const {
    playerRef,
    activeIndex,
    currentFrame,
    durationInFrames,
    playing,
    jumpTo,
    seekToFrame,
    togglePlayback,
    toggleFullscreen,
  } = useReplayPlayback(presentationReplay.events.length);
  const [focusedPlayerId, setFocusedPlayerId] = useState<number | null>(null);
  const snapshot = buildReplaySnapshot(presentationReplay, activeIndex);
  const activeEvent = presentationReplay.events[activeIndex] ?? null;
  const playerIds = presentationReplay.players.map((player) => player.player_id);
  const visibleEvents =
    focusedPlayerId === null
      ? presentationReplay.events
      : presentationReplay.events.filter((event) =>
          replayEventPlayerIds(event, playerIds).includes(focusedPlayerId),
        );

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">AI Werewolf Arena · {text(locale, "replay.single_game")}</p>
          <h1>{replay.meta.board}</h1>
          <p className="subtitle">
            {text(locale, "replay.nodes", {
              session: replay.sessionId,
              nodes: presentationReplay.events.length,
              events: replay.events.length,
            })}
          </p>
        </div>
        <ReplayDisplayControls display={display} onChange={onDisplayChange} />
        <div className="result-chip">
          <span>{text(locale, "replay.final_result")}</span>
          <strong>{replayResultLabel(replay, locale)}</strong>
          <small>{resultReasonName(replay.result.reason, locale)}</small>
          {replay.result.decision && (
            <>
              <small>{outcomeWinnersLabel(replay.result.decision.outcome, locale)}</small>
              <small>{victoryPointLabel(replay.result.decision.decidedAt, locale)}</small>
              {replay.result.decision.reason !== replay.result.reason && (
                <small>
                  {text(locale, "victory.decision_reason", {
                    reason: resultReasonName(replay.result.decision.reason, locale),
                  })}
                </small>
              )}
            </>
          )}
        </div>
      </header>

      <section className="workspace">
        <ReplayStage
          replay={presentationReplay}
          display={display}
          activeIndex={activeIndex}
          currentFrame={currentFrame}
          durationInFrames={durationInFrames}
          playing={playing}
          onSeekToFrame={seekToFrame}
          onToggleFullscreen={toggleFullscreen}
          playerRef={playerRef}
          onJumpTo={jumpTo}
          onTogglePlayback={togglePlayback}
        />

        <aside className="side-stack">
          <section className="panel current-event">
            <div className="panel-heading compact">
              <span className="phase-pill">
                {text(locale, "replay.day_phase", {
                  day: snapshot.day,
                  phase: phaseName(snapshot.phase, locale),
                })}
              </span>
              <span>#{activeEvent?.seq ?? "—"}</span>
            </div>
            <p>
              {activeEvent
                ? eventLabel(activeEvent, locale, playerIds)
                : text(locale, "replay.no_events")}
            </p>
            <div className="event-meta">
              <span>{activeEvent ? eventStageName(activeEvent, locale, playerIds) : "—"}</span>
              <time>{formatReplayTime(activeEvent?.timestamp, display)}</time>
            </div>
          </section>
          <PlayerSeats
            players={snapshot.players}
            locale={locale}
            focusedPlayerId={focusedPlayerId}
            onToggleFocus={(playerId) =>
              setFocusedPlayerId((current) => (current === playerId ? null : playerId))
            }
          />
        </aside>
      </section>

      <EventTimeline
        events={visibleEvents}
        locale={locale}
        playerIds={playerIds}
        activeEventSeq={activeEvent?.seq ?? null}
        focusedPlayerId={focusedPlayerId}
        onJumpTo={(index) => {
          const event = visibleEvents[index];
          const originalIndex = presentationReplay.events.indexOf(event);
          jumpTo(originalIndex);
        }}
        onClearFocus={() => setFocusedPlayerId(null)}
      />
    </main>
  );
}
