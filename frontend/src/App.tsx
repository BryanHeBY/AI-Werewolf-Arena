import { useEffect, useState } from "react";
import { loadReplay, type ReplayLoadState } from "./replay/offline-replay";
import { ReplayWorkspace } from "./replay/ReplayWorkspace";

function App() {
  const [state, setState] = useState<ReplayLoadState>({ status: "loading" });

  useEffect(() => {
    void loadReplay().then(setState);
  }, []);

  if (state.status === "loading") {
    return (
      <main className="shell centered">
        <p>正在载入复盘…</p>
      </main>
    );
  }

  if (state.status === "missing") {
    return <EmptyState />;
  }

  if (state.status === "error") {
    return (
      <main className="shell centered">
        <section className="load-error">
          <h1>无法打开复盘</h1>
          <p>{state.message}</p>
        </section>
      </main>
    );
  }

  return <ReplayWorkspace replay={state.replay} />;
}

function EmptyState() {
  return (
    <main className="shell centered">
      <section className="empty-state">
        <p className="eyebrow">Replay workbench</p>
        <h1>狼人杀复盘播放器</h1>
        <p>此版本只读取一份指定的离线复盘，不写入项目，也没有导入或首页流程。</p>
        <code>bun run replay:dev -- --input /absolute/path/to/game.replay.json</code>
      </section>
    </main>
  );
}

export default App;
