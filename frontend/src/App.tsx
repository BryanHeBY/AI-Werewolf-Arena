import { Player } from "@remotion/player";
import { useState } from "react";
import type { ReplayDocument } from "@ai-werewolf-arena/replay-contract";
import { ReplayComposition, FRAMES_PER_EVENT } from "./replay/ReplayComposition";
import { eventLabel, readOfflineReplay } from "./replay/offline-replay";

function App() {
  const [replay, setReplay] = useState<ReplayDocument | null>(null);
  const [sourceName, setSourceName] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  async function onFileChange(file: File | undefined) {
    if (!file) return;
    try {
      const parsed = await readOfflineReplay(file);
      setReplay(parsed);
      setSourceName(file.name);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "无法读取复盘文件。");
    }
  }

  return <main className="shell">
    <header className="topbar">
      <div><p className="eyebrow">Offline replay studio</p><h1>狼人杀复盘播放器</h1><p className="subtitle">React + Remotion · 仅消费后端导出的离线复盘文件</p></div>
      <label className="file-label">打开 .replay.json<input type="file" accept="application/json,.json" onChange={(event) => void onFileChange(event.target.files?.[0])} /></label>
    </header>
    {error && <p className="error" role="alert">{error}</p>}
    {!replay ? <section className="empty-state"><div><h2>选择一份离线对局复盘</h2><p>先由后端执行以下命令，再将生成文件拖入或选择到这里。</p><code>bun run --cwd backend export:replay --session &lt;session_id&gt; --out /tmp/game.replay.json</code></div></section> : <ReplayWorkspace replay={replay} sourceName={sourceName} />}
  </main>;
}

function ReplayWorkspace({ replay, sourceName }: { replay: ReplayDocument; sourceName: string }) {
  return <section className="workspace">
    <article className="stage"><div className="stage-header"><h2>可交互预览</h2><span className="badge">{sourceName}</span></div><div className="player-wrap"><Player component={ReplayComposition} inputProps={{ replay }} durationInFrames={Math.max(replay.events.length * FRAMES_PER_EVENT, 1)} compositionWidth={1280} compositionHeight={720} fps={30} controls /></div><div className="metadata"><div><span>棋盘</span><strong>{replay.meta.board}</strong></div><div><span>胜方</span><strong>{replay.result.winner ?? "未结束"}</strong></div><div><span>事件</span><strong>{replay.events.length} 条</strong></div></div></article>
    <aside className="timeline"><div className="timeline-header"><h2>原始对局时间线</h2><span className="badge">{replay.perspective}</span></div><div className="timeline-list">{replay.events.map((event) => <div className="event" key={event.seq}><div className="event-head"><span>#{event.seq} · D{event.day}</span><span>{event.phase}</span></div><p>{eventLabel(event)}</p></div>)}</div></aside>
  </section>;
}

export default App;
