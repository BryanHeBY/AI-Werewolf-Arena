/**
 * 负责复盘工作台的文件状态、席位筛选、播放与显示交互。输入为加载的复盘及用户选项；输出为阶段画面、时间线与控制区。实际画面仍由 frame 和纯投影形成，工作台状态不授予游戏行动或更改归档事实。
 */
import { SceneContentBlocks } from "../presentation/SceneContentBlocks";
import { resolveVideoMediaSource } from "../video/frame";
import { replayDisplayRoster } from "./replay-display-roster";
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
import { useCallback, useId, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { buildPresentationReplay } from "./replay-presentation";
import {
  replayResultLabel,
  phaseName,
  resultReasonName,
  eventStageName,
} from "./replay-localization";
import { ReplayStage } from "./ReplayStage";
import { PlayerSeats } from "./PlayerSeats";
import { EventTimeline } from "./EventTimeline";
import { PlayerAgentOutput } from "./PlayerAgentOutput";
import { useReplayPlayback } from "./useReplayPlayback";
import { buildVideoFrame, compileVideoPlan, getVideoEventFrame } from "../video/plan";
import { presentationPlayers } from "../presentation";
import { replayFrameNeighbours } from "./replay-video-navigation";
import { AvatarMark } from "../presentation/AvatarMark";
import { themeToCssVariables } from "../themes";
import type { WebAppearanceController } from "../themes/useWebAppearance";
import { WebAppearancePanel } from "../themes/WebAppearancePanel";
import { playerLabel } from "@ai-werewolf-arena/game-presentation";
import { campName, roleName } from "./replay-localization";

export function ReplayWorkspace({
  replay,
  display,
  onDisplayChange,
  fileControls,
  webAppearance,
}: {
  replay: ReplayDocument;
  display: ReplayDisplayOptions;
  onDisplayChange: (next: Partial<ReplayDisplayOptions>) => void;
  fileControls?: ReactNode;
  webAppearance: WebAppearanceController;
}) {
  const { locale } = display;
  const videoPlan = useMemo(
    () => compileVideoPlan(replay, undefined, { locale, timeZone: display.timeZone }),
    [replay, locale, display.timeZone],
  );
  const presentationReplay = useMemo(
    () => ({
      ...buildPresentationReplay({ ...replay, players: replayDisplayRoster(replay).players }),
      // 聚合只压缩视频，不删除审计入口；被吸收的逐票 seq 仍跳到同一事实揭晓帧。
      events: replay.events.filter((event) => getVideoEventFrame(videoPlan, event.seq) !== null),
    }),
    [replay, videoPlan],
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
    currentFrame,
    durationInFrames,
    playing,
    seekToFrame,
    togglePlayback,
    toggleFullscreen,
  } = useReplayPlayback(videoPlan.shots.length, playbackTimeline);
  const [focusedPlayerId, setFocusedPlayerId] = useState<number | null>(null);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [detailsTab, setDetailsTab] = useState<"events" | "players" | "private" | "appearance">(
    "events",
  );
  const detailsId = useId();
  const tabs = ["events", "players", "private", "appearance"] as const;
  const tabKeys = {
    events: "replay.timeline_tab",
    players: "replay.players_tab",
    private: "replay.private_tab",
    appearance: "replay.appearance_tab",
  } as const;
  // 镜头数、原事件数和提交事实数独立；侧栏与名册读取和视频相同的揭晓快照，不能提前应用镜头最终状态。
  const videoFrame = useMemo(
    () => buildVideoFrame(videoPlan, currentFrame),
    [videoPlan, currentFrame],
  );
  const currentView = videoFrame.currentView;
  const snapshot = currentView.snapshot;
  const activeEvent = snapshot.event;
  const activeIndex = useMemo(
    () =>
      presentationReplay.events.reduce(
        (current, event, index) => (event.seq <= videoFrame.sourceSeq ? index : current),
        -1,
      ),
    [presentationReplay, videoFrame.sourceSeq],
  );
  const factRevealed = videoFrame.shot.sourceFacts.some((seq) => seq <= videoFrame.sourceFactSeq);
  const playerIds = useMemo(
    () => presentationReplay.players.map((player) => player.player_id),
    [presentationReplay],
  );
  const playerProfiles = videoPlan.playersPresentation;
  const avatarSources = useMemo(
    () =>
      Object.fromEntries(
        videoPlan.media
          .filter((asset) => asset.kind === "image")
          .map((asset) => [asset.id, resolveVideoMediaSource(asset.src)]),
      ),
    [videoPlan.media],
  );
  const sceneRevealed = videoFrame.localFrame >= videoFrame.scene.cues.impact;
  const players = useMemo(() => presentationPlayers(playerProfiles), [playerProfiles]);
  const orderedPlayers = useMemo(
    () =>
      playerProfiles.flatMap((profile) =>
        snapshot.players.filter((player) => player.playerId === profile.playerId),
      ),
    [playerProfiles, snapshot.players],
  );
  const chapters = useMemo(
    () =>
      presentationReplay.events.flatMap((event, index, events) => {
        const previous = events[index - 1];
        return !previous || previous.day !== event.day || previous.phase !== event.phase
          ? [{ index, event }]
          : [];
      }),
    [presentationReplay],
  );
  const chapterIndex = chapters.reduce(
    (current, chapter, index) => (chapter.index <= activeIndex ? index : current),
    -1,
  );
  const tone = snapshot.phase === "night" ? "night" : "day";
  const resultLabel = useMemo(() => replayResultLabel(replay, locale), [replay, locale]);
  const currentLabel = factRevealed ? videoFrame.scene.body : currentView.label;
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
  const jumpTo = useCallback(
    (index: number) => {
      const event = presentationReplay.events[index];
      if (!event) return;
      const frame = getVideoEventFrame(videoPlan, event.seq);
      if (frame !== null) seekToFrame(frame);
    },
    [presentationReplay, videoPlan, seekToFrame],
  );
  const eventFrames = useMemo(
    () =>
      [
        ...new Set(
          presentationReplay.events.flatMap((event) => {
            const frame = getVideoEventFrame(videoPlan, event.seq);
            return frame === null ? [] : [frame];
          }),
        ),
      ].sort((first, last) => first - last),
    [presentationReplay, videoPlan],
  );
  const activeEventFrame = activeEvent ? getVideoEventFrame(videoPlan, activeEvent.seq) : null;
  const navigation = replayFrameNeighbours(
    eventFrames,
    currentFrame,
    videoFrame.shot.sourceFacts.length || videoFrame.shot.kind === "hold"
      ? currentFrame
      : (activeEventFrame ?? 0),
  );
  const jumpToVisibleEvent = useCallback(
    (index: number) => {
      // 时间线返回筛后下标；按同一事件引用找回完整展示数组位置，不以原始 seq 推算帧。
      const event = visibleEvents[index];
      if (event) jumpTo(presentationReplay.events.indexOf(event));
    },
    [visibleEvents, presentationReplay, jumpTo],
  );

  return (
    <main
      className="shell replay-workspace"
      data-web-theme={webAppearance.theme.id}
      data-tone={tone}
      data-density={webAppearance.theme.options.density ?? "comfortable"}
      data-high-contrast={webAppearance.theme.options.highContrast === true}
      style={themeToCssVariables(webAppearance.theme, tone) as CSSProperties}
    >
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
        <div className="workspace-main">
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
            previousEventFrame={navigation.previous}
            nextEventFrame={navigation.next}
          />
          <nav className="phase-navigation" aria-label={text(locale, "replay.all_phases")}>
            <button
              type="button"
              className="text-button"
              disabled={chapterIndex <= 0}
              onClick={() => jumpTo(chapters[chapterIndex - 1]!.index)}
            >
              ← {text(locale, "replay.previous_phase")}
            </button>
            <span className="phase-pill">
              {text(locale, "replay.day_phase", {
                day: snapshot.day,
                phase: phaseName(snapshot.phase, locale),
              })}
            </span>
            <button
              type="button"
              className="text-button"
              disabled={chapterIndex >= chapters.length - 1}
              onClick={() => jumpTo(chapters[chapterIndex + 1]!.index)}
            >
              {text(locale, "replay.next_phase")} →
            </button>
          </nav>
          <PlayerSeats
            players={orderedPlayers}
            presentations={playerProfiles}
            themeId={webAppearance.theme.id}
            avatarSources={avatarSources}
            locale={locale}
            focusedPlayerId={focusedPlayerId}
            onToggleFocus={toggleFocus}
          />
        </div>

        <aside className="side-stack">
          <section
            className="panel current-event"
            data-source-seq={videoFrame.sourceSeq}
            data-source-fact-seq={videoFrame.sourceFactSeq}
          >
            <div className="panel-heading compact">
              <span className="phase-pill">
                {text(locale, "replay.day_phase", {
                  day: snapshot.day,
                  phase: phaseName(snapshot.phase, locale),
                })}
              </span>
              <span>
                #{activeEvent?.seq ?? "—"}
                {factRevealed ? ` · F${videoFrame.sourceFactSeq}` : ""}
              </span>
            </div>
            <p tabIndex={0} aria-label={text(locale, "replay.current_event_text")}>
              {currentLabel}
            </p>
            {sceneRevealed && videoFrame.scene.content && (
              <div data-current-structured-content>
                <SceneContentBlocks
                  content={videoFrame.scene.content}
                  locale={locale}
                  players={players}
                  kinds={["action", "ballot", "report", "inventory", "outcome"]}
                />
              </div>
            )}
            <div className="event-meta">
              <span>
                {factRevealed
                  ? videoFrame.scene.title
                  : activeEvent
                    ? eventStageName(activeEvent, locale, playerIds)
                    : "—"}
              </span>
              <time>{formatReplayTime(activeEvent?.timestamp, display)}</time>
            </div>
          </section>
          <section className="details-panel" aria-label={text(locale, "replay.details")}>
            <div
              className="details-tabs"
              role="tablist"
              aria-label={text(locale, "replay.details")}
            >
              {tabs.map((tab, index) => (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  id={`${detailsId}-${tab}-tab`}
                  aria-controls={`${detailsId}-${tab}`}
                  aria-selected={detailsTab === tab}
                  tabIndex={detailsTab === tab ? 0 : -1}
                  onClick={() => setDetailsTab(tab)}
                  onKeyDown={(event) => {
                    const next =
                      event.key === "ArrowRight"
                        ? (index + 1) % tabs.length
                        : event.key === "ArrowLeft"
                          ? (index + tabs.length - 1) % tabs.length
                          : event.key === "Home"
                            ? 0
                            : event.key === "End"
                              ? tabs.length - 1
                              : null;
                    if (next === null) return;
                    event.preventDefault();
                    const nextTab = tabs[next]!;
                    setDetailsTab(nextTab);
                    document.getElementById(`${detailsId}-${nextTab}-tab`)?.focus();
                  }}
                >
                  {text(locale, tabKeys[tab])}
                </button>
              ))}
            </div>
            {/* 页签保持挂载，搜索、跟随和私有文件的本机状态不会因外观或切页而丢失。 */}
            <div
              role="tabpanel"
              id={`${detailsId}-events`}
              aria-labelledby={`${detailsId}-events-tab`}
              hidden={detailsTab !== "events"}
            >
              <EventTimeline
                players={players}
                events={visibleEvents}
                locale={locale}
                playerIds={playerIds}
                activeEventSeq={activeEvent?.seq ?? null}
                focusedPlayerId={focusedPlayerId}
                onJumpTo={jumpToVisibleEvent}
                onClearFocus={clearFocus}
                isVisible={detailsTab === "events"}
              />
            </div>
            <div
              role="tabpanel"
              id={`${detailsId}-players`}
              aria-labelledby={`${detailsId}-players-tab`}
              hidden={detailsTab !== "players"}
            >
              <section className="panel roster-panel">
                <h2>{text(locale, "replay.seats")}</h2>
                <ul className="roster-list">
                  {playerProfiles.map((profile) => {
                    const state = snapshot.players.find(
                      (player) => player.playerId === profile.playerId,
                    )!;
                    return (
                      <li key={profile.playerId} data-player-id={profile.playerId}>
                        <AvatarMark avatar={profile.avatar} size={32} />
                        <div>
                          <strong>
                            {playerLabel(
                              {
                                id: profile.playerId,
                                seat: profile.seat,
                                name: profile.displayName,
                              },
                              locale,
                            )}
                          </strong>
                          {profile.modelLabel && <small>{profile.modelLabel}</small>}
                        </div>
                        <span>
                          {roleName(state.role, locale)} · {campName(state.camp, locale)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            </div>
            <div
              role="tabpanel"
              id={`${detailsId}-private`}
              aria-labelledby={`${detailsId}-private-tab`}
              hidden={detailsTab !== "private"}
            >
              <PlayerAgentOutput key={replay.sessionId} locale={locale} />
            </div>
            <div
              role="tabpanel"
              id={`${detailsId}-appearance`}
              aria-labelledby={`${detailsId}-appearance-tab`}
              hidden={detailsTab !== "appearance"}
            >
              <WebAppearancePanel locale={locale} controller={webAppearance} />
            </div>
          </section>
        </aside>
      </section>
    </main>
  );
}
