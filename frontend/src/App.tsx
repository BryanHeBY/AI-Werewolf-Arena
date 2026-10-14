/**
 * 负责复盘页面的加载状态与显示偏好入口。输入为加载结果和用户语言／时区选择，输出工作台或加载／错误／空白页面。
 * 默认语言随归档，用户显式选择优先；卸载后忽略迟到结果，不以页面状态修改归档或驱动游戏规则。
 */
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
  // null 表示尚无用户覆盖；加载前使用中文，加载后才采用归档语言。
  const locale =
    selectedLocale ?? (state.status === "ready" ? state.replay.meta.locale : undefined) ?? "zh-CN";
  const display = { locale, timeZone };
  const onDisplayChange = (next: Partial<ReplayDisplayOptions>) => {
    if (next.locale !== undefined) setSelectedLocale(next.locale);
    if (next.timeZone !== undefined) setTimeZone(next.timeZone);
  };

  useEffect(() => {
    // 只阻止卸载后的状态写入；该标记不取消已经发起的读取。
    let active = true;
    void loadReplay().then((value) => {
      if (active) setState(value);
    });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  if (state.status === "ready")
    return (
      <ReplayWorkspace replay={state.replay} display={display} onDisplayChange={onDisplayChange} />
    );
  return (
    <main className="shell centered">
      <section className={state.status === "error" ? "load-error" : "empty-state"}>
        <ReplayDisplayControls display={display} onChange={onDisplayChange} />
        {state.status === "loading" && <p>{text(locale, "replay.loading")}</p>}
        {state.status === "error" && (
          <>
            <h1>{text(locale, "replay.load_error")}</h1>
            <p>{renderMessage(locale, state.message)}</p>
          </>
        )}
        {state.status === "missing" && (
          <>
            <p className="eyebrow">{text(locale, "replay.workbench")}</p>
            <h1>{text(locale, "replay.title")}</h1>
            <p>{text(locale, "replay.empty")}</p>
            <code>bun run replay:dev -- --input /absolute/path/to/game.replay.json</code>
          </>
        )}
      </section>
    </main>
  );
}
export default App;
