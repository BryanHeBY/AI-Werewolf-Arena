import { useEffect, useState } from "react";
import { text, renderMessage, type Locale } from "@ai-werewolf-arena/game-text";
import { loadReplay, type ReplayLoadState } from "./replay/offline-replay";
import { ReplayWorkspace } from "./replay/ReplayWorkspace";
import { ReplayDisplayControls } from "./replay/ReplayDisplayControls";
import { DEFAULT_REPLAY_TIME_ZONE, type ReplayDisplayOptions } from "./replay/replay-display";

function App() {
  const [state, setState] = useState<ReplayLoadState>({ status: "loading" });
  const [selectedLocale, setSelectedLocale] = useState<Locale | null>(null);
  const [timeZone, setTimeZone] = useState(DEFAULT_REPLAY_TIME_ZONE);
  const locale = selectedLocale ?? (state.status === "ready" ? state.replay.meta.locale : undefined) ?? "zh-CN";
  const display = { locale, timeZone };
  const onDisplayChange = (next: Partial<ReplayDisplayOptions>) => {
    if (next.locale !== undefined) setSelectedLocale(next.locale);
    if (next.timeZone !== undefined) setTimeZone(next.timeZone);
  };

  useEffect(() => { let active = true; void loadReplay().then(value => { if (active) setState(value); }); return () => { active = false; }; }, []);
  useEffect(() => { document.documentElement.lang = locale; }, [locale]);

  if (state.status === "ready") return <ReplayWorkspace replay={state.replay} display={display} onDisplayChange={onDisplayChange} />;
  return (
    <main className="shell centered">
      <section className={state.status === "error" ? "load-error" : "empty-state"}>
        <ReplayDisplayControls display={display} onChange={onDisplayChange} />
        {state.status === "loading" && <p>{text(locale, "replay.loading")}</p>}
        {state.status === "error" && <><h1>{text(locale, "replay.load_error")}</h1><p>{renderMessage(locale, state.message)}</p></>}
        {state.status === "missing" && <>
          <p className="eyebrow">{text(locale, "replay.workbench")}</p>
          <h1>{text(locale, "replay.title")}</h1>
          <p>{text(locale, "replay.empty")}</p>
          <code>bun run replay:dev -- --input /absolute/path/to/game.replay.json</code>
        </>}
      </section>
    </main>
  );
}
export default App;
