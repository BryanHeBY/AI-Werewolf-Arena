/**
 * 负责复盘页面的加载状态、浏览器文件切换和显示偏好入口。输入为本地端点或用户文件，输出工作台及可重试的加载状态。
 * 用户语言优先于归档语言；每次读取都有独立代次，取消或迟到的旧读取不得覆盖新文件，不修改归档或驱动规则。
 */
import { lazy, Suspense, useEffect, useRef, useState, type CSSProperties } from "react";
import { text, renderMessage, type Locale } from "@ai-werewolf-arena/game-text";
import {
  loadReplay,
  readOfflineReplay,
  ReplayLoadError,
  type ReplayLoadState,
} from "./replay/offline-replay";
import { ReplayDisplayControls } from "./replay/ReplayDisplayControls";
import { DEFAULT_REPLAY_TIME_ZONE, type ReplayDisplayOptions } from "./replay/replay-display";
import { themeToCssVariables } from "./themes";
import { useWebAppearance } from "./themes/useWebAppearance";

// 空页和文件导入先可交互；Remotion 与工作台只在取得合法复盘后加载。
const ReplayWorkspace = lazy(() =>
  import("./replay/ReplayWorkspace").then((module) => ({ default: module.ReplayWorkspace })),
);

type ReplaySource = { kind: "server" } | { kind: "file"; file: File };

function App() {
  const webAppearance = useWebAppearance();
  const [state, setState] = useState<ReplayLoadState>({ status: "loading" });
  const [request, setRequest] = useState<{ id: number; source: ReplaySource }>({
    id: 0,
    source: { kind: "server" },
  });
  const requestId = useRef(0);
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
  const requestReplay = (source: ReplaySource) => {
    // 在事件回调里立即失效旧代次，覆盖 effect 尚未清理时已完成的文件读取。
    const id = ++requestId.current;
    setState({ status: "loading" });
    setRequest({ id, source });
  };

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const read = async (): Promise<ReplayLoadState> => {
      if (request.source.kind === "server") return loadReplay(controller.signal);
      try {
        return { status: "ready", replay: await readOfflineReplay(request.source.file) };
      } catch (error) {
        return {
          status: "error",
          message:
            error instanceof ReplayLoadError ? error.messageRef : { key: "replay.read_failed" },
        };
      }
    };
    void read().then((value) => {
      if (active && request.id === requestId.current) setState(value);
    });
    return () => {
      active = false;
      controller.abort();
    };
  }, [request]);
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const fileControls = (
    <div className="replay-file-controls">
      <label className="text-button file-import">
        {text(locale, state.status === "ready" ? "replay.switch_file" : "replay.open_file")}
        <input
          type="file"
          accept=".json,application/json"
          aria-label={text(locale, "replay.open_file")}
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            // 清空后仍可重新选择同一个文件，失败后无需刷新页面。
            event.currentTarget.value = "";
            if (file) requestReplay({ kind: "file", file });
          }}
        />
      </label>
      {state.status !== "loading" && (
        <button type="button" className="text-button" onClick={() => requestReplay(request.source)}>
          {text(locale, "replay.retry")}
        </button>
      )}
      {request.source.kind === "file" && (
        <span className="replay-file-name">{request.source.file.name}</span>
      )}
    </div>
  );

  const content =
    state.status === "ready" ? (
      <Suspense
        fallback={
          <main className="shell centered">
            <section>
              <p role="status">{text(locale, "replay.loading")}</p>
              {fileControls}
            </section>
          </main>
        }
      >
        <ReplayWorkspace
          key={request.id}
          replay={state.replay}
          display={display}
          onDisplayChange={onDisplayChange}
          fileControls={fileControls}
          webAppearance={webAppearance}
        />
      </Suspense>
    ) : (
      <main className="shell centered">
        <section className={state.status === "error" ? "load-error" : "empty-state"}>
          <ReplayDisplayControls display={display} onChange={onDisplayChange} />
          {state.status === "loading" && <p role="status">{text(locale, "replay.loading")}</p>}
          {state.status === "error" && (
            <>
              <h1>{text(locale, "replay.load_error")}</h1>
              <p role="alert">{renderMessage(locale, state.message)}</p>
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
          {fileControls}
        </section>
      </main>
    );
  return (
    <div
      className="app-surface"
      data-web-theme={webAppearance.theme.id}
      data-reduced-motion={webAppearance.appearance.reduceMotion}
      style={themeToCssVariables(webAppearance.theme, "day") as CSSProperties}
    >
      {content}
    </div>
  );
}
export default App;
