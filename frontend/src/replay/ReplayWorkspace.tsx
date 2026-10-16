/**
 * 负责复盘工作台的文件状态、席位筛选、播放与显示交互。输入为加载的复盘及用户选项；输出为阶段画面、时间线与控制区。实际画面仍由 frame 和纯投影形成，工作台状态不授予游戏行动或更改归档事实。
 */
import { replayEventPlayerIds } from "./replay-event-reader";
import type { ReplayDocument } from "@ai-werewolf-arena/replay-contract";
import { text } from "@ai-werewolf-arena/game-text";
import {
  createPlayerText,
  outcomeWinnersLabel,
  victoryPointLabel,
} from "@ai-werewolf-arena/game-presentation";
import { formatReplayTime, type ReplayDisplayOptions } from "./replay-display";
import { ReplayDisplayControls } from "./ReplayDisplayControls";
import { useCallback, useMemo, useState, type ReactNode } from "react";
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
import { PlayerAgentOutput } from "./PlayerAgentOutput";
import { useReplayPlayback } from "./useReplayPlayback";
import { compileVideoPlan } from "../video";

export function ReplayWorkspace({
  replay,
  display,
  onDisplayChange,
  fileControls,
}: {
  replay: ReplayDocument;
  display: ReplayDisplayOptions;
  onDisplayChange: (next: Partial<ReplayDisplayOptions>) => void;
  fileControls?: ReactNode;
}) {
  const { locale } = display;
  const presentationReplay = useMemo(() => buildPresentationReplay(replay), [replay]);
  const videoPlan = useMemo(
    () => compileVideoPlan(replay, undefined, { locale, timeZone: display.timeZone }),
    [replay, locale, display.timeZone],
  );
  const playbackTimeline = useMemo(
    () => ({
      starts: videoPlan.shots.map((shot) => shot.from),
      durationInFrames: videoPlan.durationFrames,
    }),
    [videoPlan],
  );
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
  } = useReplayPlayback(presentationReplay.events.length, playbackTimeline);
  const [focusedPlayerId, setFocusedPlayerId] = useState<number | null>(null);
  const [playbackRate, setPlaybackRate] = useState(1);
  // 帧更新只更新播放控件；席位投影、玩家名单与事件文案仅在事件／归档／语言边界重新计算。
  const snapshot = useMemo(
    () => buildReplaySnapshot(presentationReplay, activeIndex),
    [presentationReplay, activeIndex],
  );
  const activeEvent = presentationReplay.events[activeIndex] ?? null;
  const playerIds = useMemo(
    () => presentationReplay.players.map((player) => player.player_id),
    [presentationReplay],
  );
  const players = useMemo(
    () => presentationReplay.players.map((player) => ({ id: player.player_id, name: player.name })),
    [presentationReplay],
  );
  const resultLabel = useMemo(() => replayResultLabel(replay, locale), [replay, locale]);
  const currentLabel = useMemo(
    () =>
      activeEvent
        ? eventLabel(activeEvent, locale, playerIds, players)
        : text(locale, "replay.no_events"),
    [activeEvent, locale, playerIds, players],
  );
  // 焦点只筛时间线，不裁剪驱动画面／席位的完整展示事件；公开信息边界由加载文档决定。
  const visibleEvents = useMemo(
    () =>
      focusedPlayerId === null
        ? presentationReplay.events
        : presentationReplay.events.filter((event) =>
            replayEventPlayerIds(event, playerIds).includes(focusedPlayerId),
          ),
    [presentationReplay, focusedPlayerId, playerIds],
  );
  const toggleFocus = useCallback((playerId: number) => {
    setFocusedPlayerId((current) => (current === playerId ? null : playerId));
  }, []);
  const clearFocus = useCallback(() => setFocusedPlayerId(null), []);
  const jumpToVisibleEvent = useCallback(
    (index: number) => {
      // 时间线返回筛后下标；按同一事件引用找回完整展示数组位置，不以原始 seq 推算帧。
      const event = visibleEvents[index];
      if (event) jumpTo(presentationReplay.events.indexOf(event));
    },
    [visibleEvents, presentationReplay, jumpTo],
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
        <div className="workbench-controls">
          <ReplayDisplayControls display={display} onChange={onDisplayChange} />
          {fileControls}
        </div>
        <div className="result-chip">
          <span>{text(locale, "replay.final_result")}</span>
          <strong>{resultLabel}</strong>
          <small>{resultReasonName(replay.result.reason, locale)}</small>
          {replay.result.decision && (
            <>
              <small>
                {outcomeWinnersLabel(
                  replay.result.decision.outcome,
                  locale,
                  createPlayerText(players),
                )}
              </small>
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
          videoPlan={videoPlan}
          replay={presentationReplay}
          display={display}
          activeIndex={activeIndex}
          currentFrame={currentFrame}
          durationInFrames={durationInFrames}
          playing={playing}
          playbackRate={playbackRate}
          onPlaybackRateChange={setPlaybackRate}
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
            <p tabIndex={0} aria-label={text(locale, "replay.current_event_text")}>
              {currentLabel}
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
            onToggleFocus={toggleFocus}
          />
        </aside>
      </section>

      <EventTimeline
        players={players}
        events={visibleEvents}
        locale={locale}
        playerIds={playerIds}
        activeEventSeq={activeEvent?.seq ?? null}
        focusedPlayerId={focusedPlayerId}
        onJumpTo={jumpToVisibleEvent}
        onClearFocus={clearFocus}
      />
      <PlayerAgentOutput key={replay.sessionId} locale={locale} />
    </main>
  );
}
