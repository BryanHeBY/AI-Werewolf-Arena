import { Player, type PlayerRef } from "@remotion/player";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ReplayDocument, ReplayEvent } from "@ai-werewolf-arena/replay-contract";
import { FRAMES_PER_EVENT, ReplayComposition } from "./replay/ReplayComposition";
import { eventLabel, parseOfflineReplayJson } from "./replay/offline-replay";
import {
  buildReplaySnapshot,
  campName,
  phaseName,
  roleName,
} from "./replay/replay-projection";

type ReplayLoadState =
  | { status: "loading" }
  | { status: "ready"; replay: ReplayDocument }
  | { status: "missing" }
  | { status: "error"; message: string };

async function loadReplay(): Promise<ReplayLoadState> {
  try {
    const response = await fetch("/api/replay");
    if (response.status === 404) return { status: "missing" };
    if (!response.ok) throw new Error(`读取复盘失败（HTTP ${response.status}）`);
    return { status: "ready", replay: parseOfflineReplayJson(await response.text()) };
  } catch (cause) {
    return { status: "error", message: cause instanceof Error ? cause.message : "无法读取复盘文件。" };
  }
}

function App() {
  const [state, setState] = useState<ReplayLoadState>({ status: "loading" });

  useEffect(() => {
    void loadReplay().then(setState);
  }, []);

  if (state.status === "loading") return <main className="shell centered"><p>正在载入复盘…</p></main>;
  if (state.status === "missing") return <EmptyState />;
  if (state.status === "error") return <main className="shell centered"><section className="load-error"><h1>无法打开复盘</h1><p>{state.message}</p></section></main>;
  return <ReplayWorkspace replay={state.replay} />;
}

function EmptyState() {
  return <main className="shell centered">
    <section className="empty-state">
      <p className="eyebrow">Replay workbench</p>
      <h1>狼人杀复盘播放器</h1>
      <p>此版本只读取一份指定的离线复盘，不写入项目，也没有导入或首页流程。</p>
      <code>bun run replay:dev -- --input /absolute/path/to/game.replay.json</code>
    </section>
  </main>;
}

function ReplayWorkspace({ replay }: { replay: ReplayDocument }) {
  const playerRef = useRef<PlayerRef>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [focusedPlayerId, setFocusedPlayerId] = useState<number | null>(null);
  const snapshot = buildReplaySnapshot(replay, activeIndex);
  const activeEvent = replay.events[activeIndex] ?? null;

  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    const onFrame = ({ detail }: { detail: { frame: number } }) => {
      const nextIndex = Math.min(Math.floor(detail.frame / FRAMES_PER_EVENT), replay.events.length - 1);
      setActiveIndex((current) => current === nextIndex ? current : nextIndex);
    };
    player.addEventListener("frameupdate", onFrame);
    return () => player.removeEventListener("frameupdate", onFrame);
  }, [replay.events.length]);

  const jumpTo = useCallback((index: number) => {
    const boundedIndex = Math.max(0, Math.min(index, replay.events.length - 1));
    playerRef.current?.seekTo(boundedIndex * FRAMES_PER_EVENT);
    setActiveIndex(boundedIndex);
  }, [replay.events.length]);

  const visibleEvents = focusedPlayerId === null
    ? replay.events
    : replay.events.filter((event) => mentionsPlayer(event, focusedPlayerId));

  return <main className="shell">
    <header className="topbar">
      <div><p className="eyebrow">AI Werewolf Arena · single game replay</p><h1>{replay.meta.board}</h1><p className="subtitle">{replay.sessionId} · 共 {replay.events.length} 个事件</p></div>
      <div className="result-chip"><span>最终结果</span><strong>{replay.result.winner ?? "未结束"}</strong><small>{replay.result.reason ?? "—"}</small></div>
    </header>

    <section className="workspace">
      <article className="stage panel">
        <div className="panel-heading"><div><p className="section-kicker">REPLAY</p><h2>对局舞台</h2></div><span className="progress">{replay.events.length === 0 ? "0 / 0" : `${activeIndex + 1} / ${replay.events.length}`}</span></div>
        <div className="player-wrap"><Player ref={playerRef} component={ReplayComposition} inputProps={{ replay }} durationInFrames={Math.max(replay.events.length * FRAMES_PER_EVENT, 1)} compositionWidth={1280} compositionHeight={720} fps={30} controls acknowledgeRemotionLicense /></div>
        <nav className="transport" aria-label="复盘跳转">
          <button type="button" onClick={() => jumpTo(activeIndex - 1)} disabled={activeIndex === 0}>上一事件</button>
          <button type="button" className="primary" onClick={() => playerRef.current?.toggle()}>播放 / 暂停</button>
          <button type="button" onClick={() => jumpTo(activeIndex + 1)} disabled={activeIndex >= replay.events.length - 1}>下一事件</button>
        </nav>
      </article>

      <aside className="side-stack">
        <section className="panel current-event">
          <div className="panel-heading compact"><span className="phase-pill">第 {snapshot.day} 天 · {phaseName(snapshot.phase)}</span><span>#{activeEvent?.seq ?? "—"}</span></div>
          <p>{activeEvent ? eventLabel(activeEvent) : "暂无事件"}</p>
          <div className="event-meta"><span>{activeEvent?.stage ?? activeEvent?.type ?? "—"}</span><time>{formatTime(activeEvent?.timestamp)}</time></div>
        </section>
        <section className="panel player-panel">
          <div className="panel-heading compact"><div><p className="section-kicker">TABLE</p><h2>席位状态</h2></div><span>{snapshot.players.filter((player) => player.alive).length} 人存活</span></div>
          <div className="seat-grid">
            {snapshot.players.map((player) => <button type="button" key={player.playerId} className={`seat ${player.alive ? "alive" : "dead"} ${player.camp} ${focusedPlayerId === player.playerId ? "focused" : ""}`} onClick={() => setFocusedPlayerId((current) => current === player.playerId ? null : player.playerId)}>
              <span className="seat-number">{player.playerId}</span>{player.isSheriff && <span className="sheriff">警</span>}<strong>{roleName(player.role)}</strong><small>{campName(player.camp)}</small>
            </button>)}
          </div>
        </section>
      </aside>
    </section>

    <section className="panel timeline">
      <div className="panel-heading"><div><p className="section-kicker">TIMELINE</p><h2>{focusedPlayerId === null ? "全局对局时间线" : `与 ${focusedPlayerId} 号相关的事件`}</h2></div>{focusedPlayerId !== null && <button type="button" className="text-button" onClick={() => setFocusedPlayerId(null)}>清除席位筛选</button>}</div>
      <div className="timeline-list">{visibleEvents.map((event) => {
        const originalIndex = replay.events.indexOf(event);
        return <button type="button" className={`event ${originalIndex === activeIndex ? "active" : ""}`} key={event.seq} onClick={() => jumpTo(originalIndex)}>
          <span className="event-marker">D{event.day}</span><div><div className="event-head"><span>#{event.seq} · {phaseName(event.phase)}</span><span>{event.stage ?? event.type}</span></div><p>{eventLabel(event)}</p></div>
        </button>;
      })}</div>
    </section>
  </main>;
}

function mentionsPlayer(event: ReplayEvent, playerId: number): boolean {
  const payload = event.payload;
  return [payload.actorId, payload.target, payload.playerId, payload.winnerId, payload.sheriffId, payload.fromId, payload.toId]
    .some((value) => value === playerId)
    || Object.values(payload).some((value) => Array.isArray(value) && value.includes(playerId));
}

function formatTime(timestamp: string | undefined): string {
  if (!timestamp) return "—";
  const date = new Date(timestamp);
  return Number.isNaN(date.valueOf()) ? timestamp : date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export default App;
