import type { ReplayDocument, ReplayEvent } from "@ai-werewolf-arena/replay-contract";
import { useMemo, useState } from "react";
import { buildReplaySnapshot } from "./replay-projection";
import { buildPresentationReplay } from "./replay-presentation";
import { campName, phaseName, resultReasonName, stageName } from "./replay-localization";
import { eventLabel } from "./event-labels";
import { ReplayStage } from "./ReplayStage";
import { PlayerSeats } from "./PlayerSeats";
import { EventTimeline } from "./EventTimeline";
import { useReplayPlayback } from "./useReplayPlayback";

export function ReplayWorkspace({ replay }: { replay: ReplayDocument }) {
  const presentationReplay = useMemo(() => buildPresentationReplay(replay), [replay]);
  const { playerRef, activeIndex, jumpTo, togglePlayback } = useReplayPlayback(presentationReplay.events.length);
  const [focusedPlayerId, setFocusedPlayerId] = useState<number | null>(null);
  const snapshot = buildReplaySnapshot(presentationReplay, activeIndex);
  const activeEvent = presentationReplay.events[activeIndex] ?? null;
  const visibleEvents = focusedPlayerId === null
    ? presentationReplay.events
    : presentationReplay.events.filter((event) => mentionsPlayer(event, focusedPlayerId));

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">AI Werewolf Arena · single game replay</p>
          <h1>{replay.meta.board}</h1>
          <p className="subtitle">
            {replay.sessionId} · {presentationReplay.events.length} 个叙事节点 / {replay.events.length} 个原始事件
          </p>
        </div>
        <div className="result-chip">
          <span>最终结果</span>
          <strong>{replay.result.winner ? campName(replay.result.winner) : "未结束"}</strong>
          <small>{resultReasonName(replay.result.reason)}</small>
        </div>
      </header>

      <section className="workspace">
        <ReplayStage
          replay={presentationReplay}
          activeIndex={activeIndex}
          playerRef={playerRef}
          onJumpTo={jumpTo}
          onTogglePlayback={togglePlayback}
        />

        <aside className="side-stack">
          <section className="panel current-event">
            <div className="panel-heading compact">
              <span className="phase-pill">第 {snapshot.day} 天 · {phaseName(snapshot.phase)}</span>
              <span>#{activeEvent?.seq ?? "—"}</span>
            </div>
            <p>{activeEvent ? eventLabel(activeEvent) : "暂无事件"}</p>
            <div className="event-meta">
              <span>{activeEvent ? stageName(activeEvent.stage ?? activeEvent.type) : "—"}</span>
              <time>{formatTime(activeEvent?.timestamp)}</time>
            </div>
          </section>
          <PlayerSeats
            players={snapshot.players}
            focusedPlayerId={focusedPlayerId}
            onToggleFocus={(playerId) => setFocusedPlayerId((current) => current === playerId ? null : playerId)}
          />
        </aside>
      </section>

      <EventTimeline
        events={visibleEvents}
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

function mentionsPlayer(event: ReplayEvent, playerId: number): boolean {
  const payload = event.payload;
  return [payload.actorId, payload.target, payload.targetId, payload.playerId, payload.winnerId, payload.sheriffId, payload.fromId, payload.toId, payload.wolfId, payload.hunterId]
    .some((value) => value === playerId)
    || Object.values(payload).some((value) => Array.isArray(value) && value.includes(playerId));
}

function formatTime(timestamp: string | undefined): string {
  if (!timestamp) return "—";
  const date = new Date(timestamp);
  return Number.isNaN(date.valueOf())
    ? timestamp
    : date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
