/**
 * 负责本地工作台导航、配置目录及运行列表；输入同源 API 数据，输出配置到对局再到回放的交互。
 * 浏览器仅拥有页面状态；实际文件和进程归服务端，旧请求不能覆盖当前回放，不读取本机认证路径。
 */
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { workbenchText, type WorkbenchTextKey } from "@ai-werewolf-arena/game-text/workbench";
import { type Locale, text as gameText } from "@ai-werewolf-arena/game-text";
import {
  useWebAppearance,
  themeToCssVariables,
  THEME_IDS,
  resolveTheme,
  DEFAULT_VIDEO_THEME,
  workbenchArt,
  type ThemeId,
  type ThemeTone,
} from "@ai-werewolf-arena/game-media/appearance";
import type { SessionEntry } from "@ai-werewolf-arena/workbench-contract";
import type { Catalog, Page } from "./types";
import { api } from "./api";
import { TerminalPanel } from "./TerminalPanel";
import { DraftContext } from "./draft-context";
import { SessionHeading } from "./session-summary";
import { DashboardPage } from "./pages/DashboardPage";
import { GamesPage } from "./pages/GamesPage";
import { BoardsPage } from "./pages/BoardsPage";
import { AgentsPage } from "./pages/AgentsPage";
import { ReplayPage } from "./pages/ReplayPage";
import { DeleteDialog } from "./DeleteDialog";
import { workbenchServiceMessage } from "@ai-werewolf-arena/game-text/workbench-service";
import { configUiText } from "@ai-werewolf-arena/game-text/workbench-config-ui";
const emptyCatalog: Catalog = { games: [], agents: [], backends: [], boards: [] };
function route() {
  const [page, id, action] = location.hash.replace(/^#\/?/, "").split("/");
  let decodedId = "";
  try {
    decodedId = id ? decodeURIComponent(id) : "";
  } catch {
    // 地址栏可由用户直接编辑；不完整的百分号编码不能让整个工作台白屏。
  }
  return {
    page: (["home", "games", "boards", "agents", "logs", "replay"].includes(page)
      ? page
      : "home") as Page,
    id: decodedId,
    action: action === "edit" ? "edit" : "",
  };
}
export default function App() {
  const appearance = useWebAppearance(DEFAULT_VIDEO_THEME);
  const [tone, setTone] = useState<ThemeTone>(() => {
    try {
      return localStorage.getItem("awa.workbench.tone") === "day" ? "day" : "night";
    } catch {
      return "night";
    }
  });
  const themeVariables = useMemo(
    () => ({
      ...themeToCssVariables(appearance.theme, tone),
      "--workbench-hero-art": `url("${workbenchArt[tone]}")`,
    }),
    [appearance.theme, tone],
  );
  const terminalTheme = useMemo(() => {
    const tokens = themeToCssVariables(appearance.theme, "night");
    return {
      background: tokens["--awa-canvas"],
      foreground: tokens["--awa-canvasText"],
      black: tokens["--awa-canvas"],
      brightBlack: tokens["--awa-canvasMuted"],
      red: tokens["--awa-danger"],
      green: tokens["--awa-success"],
      yellow: tokens["--awa-neutral"],
      blue: tokens["--awa-accent"],
      magenta: tokens["--awa-wolf"],
      cyan: tokens["--awa-good"],
      white: tokens["--awa-canvasText"],
    };
  }, [appearance.theme]);
  useEffect(() => {
    try {
      localStorage.setItem("awa.workbench.tone", tone);
    } catch {}
  }, [tone]);
  const [locationState, setLocationState] = useState(route),
    [locale, setLocale] = useState<Locale>(() => {
      try {
        return localStorage.getItem("awa.workbench.locale") === "en" ? "en" : "zh-CN";
      } catch {
        return "zh-CN";
      }
    }),
    [catalog, setCatalog] = useState<Catalog>(emptyCatalog),
    [catalogReady, setCatalogReady] = useState(false),
    [runs, setRuns] = useState<SessionEntry[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [dirty, setDirty] = useState(false),
    [deletingRun, setDeletingRun] = useState<SessionEntry>();
  const t = useCallback((key: WorkbenchTextKey) => workbenchText(locale, key), [locale]);
  // 每个编辑器独立登记脏状态；某个子表单卸载不能清掉同页其他未保存输入。
  const dirtyOwners = useRef(new Set<string>());
  const reportDirty = useCallback((owner: string, value: boolean) => {
    if (value) dirtyOwners.current.add(owner);
    else dirtyOwners.current.delete(owner);
    setDirty(dirtyOwners.current.size > 0);
  }, []);
  const canLeave = useCallback(() => {
    if (dirty) {
      setError(t("discard"));
      return false;
    }
    return true;
  }, [dirty, t]);
  useEffect(() => {
    if (!dirty) return;
    const prevent = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", prevent);
    return () => window.removeEventListener("beforeunload", prevent);
  }, [dirty]);
  const catalogGeneration = useRef(0);
  const refresh = useCallback(async () => {
    const generation = ++catalogGeneration.current;
    try {
      const next = await api<Catalog>("catalog");
      if (generation !== catalogGeneration.current) return;
      setCatalog(next);
      setCatalogReady(true);
    } catch (error) {
      if (generation === catalogGeneration.current) throw error;
    }
  }, []);
  useEffect(() => {
    const handler = () => {
      if (!canLeave()) {
        // 浏览器后退和手改 hash 也属于离开编辑页，必须遵守同一草稿保护。
        history.replaceState(
          null,
          "",
          `#/${locationState.page}${locationState.id ? `/${encodeURIComponent(locationState.id)}` : ""}${locationState.action ? `/${locationState.action}` : ""}`,
        );
        return;
      }
      setLocationState(route());
    };
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, [canLeave, locationState]);
  useEffect(() => {
    document.documentElement.lang = locale;
    try {
      localStorage.setItem("awa.workbench.locale", locale);
    } catch {}
  }, [locale]);
  useEffect(() => {
    void refresh().catch((e) => setError(e.message));
  }, [refresh]);
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        setRuns(await api<SessionEntry[]>("runs", { signal: controller.signal }));
      } catch (e) {
        if (!controller.signal.aborted) setError(t("lost"));
      } finally {
        if (!controller.signal.aborted) timer = setTimeout(() => void poll(), 2500);
      }
    };
    void poll();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [t]);
  const navigate = (page: Page, id = "", action = "") => {
    if (!canLeave()) return;
    setError("");
    location.hash = `/${page}${id ? `/${encodeURIComponent(id)}` : ""}${action ? `/${action}` : ""}`;
  };
  const start = async (name: string, revision: string) => {
    setBusy(true);
    setError("");
    try {
      const result = await api<{ sessionId: string }>("runs", {
        method: "POST",
        body: { gameName: name, revision },
      });
      navigate("logs", result.sessionId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "request_failed");
    } finally {
      setBusy(false);
    }
  };
  const stop = async (id: string) => {
    setError("");
    try {
      await api(`runs/${encodeURIComponent(id)}/stop`, { method: "POST", body: {} });
    } catch (e) {
      setError(e instanceof Error ? e.message : "request_failed");
    }
  };
  const selected = runs.find((r) => r.sessionId === locationState.id),
    active = runs.filter((r) => ["starting", "running", "finalizing"].includes(r.state));
  const nav = [
    { page: "home", symbol: "◈" },
    { page: "games", symbol: "▤" },
    { page: "boards", symbol: "◇" },
    { page: "agents", symbol: "◎" },
  ] as const;
  return (
    <DraftContext.Provider value={{ setDirty: reportDirty, canLeave }}>
      <div
        className="workbench"
        data-web-theme={appearance.theme.id}
        data-tone={tone}
        data-reduced-motion={appearance.appearance.reduceMotion}
        style={themeVariables as CSSProperties}
      >
        <aside className="sidebar">
          <button className="brand" onClick={() => navigate("home")}>
            <span className="brand-mark">A</span>
            <span>
              AWA<small>WORKBENCH</small>
            </span>
          </button>
          <div className="sidebar-label">LOCAL ARENA</div>
          <nav>
            {nav.map((item) => (
              <button
                key={item.page}
                className={
                  locationState.page === item.page ||
                  (item.page === "home" && ["logs", "replay"].includes(locationState.page))
                    ? "active"
                    : ""
                }
                onClick={() => navigate(item.page)}
              >
                <span aria-hidden="true">{item.symbol}</span>
                {t(item.page)}
                {item.page === "home" && active.length > 0 && (
                  <b aria-hidden="true">{active.length}</b>
                )}
              </button>
            ))}
          </nav>
          <div className="sidebar-footer">
            <span className="status-dot" />
            {t("localFiles")}
            <label>
              {gameText(locale, "replay.web_theme")}
              <select
                aria-label={gameText(locale, "replay.web_theme")}
                value={appearance.theme.id}
                onChange={(e) => appearance.setTheme(e.target.value as ThemeId)}
              >
                {THEME_IDS.map((id) => (
                  <option key={id} value={id}>
                    {resolveTheme(id).definition.label[locale]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t("tone")}
              <select
                aria-label={t("tone")}
                value={tone}
                onChange={(e) => setTone(e.target.value as ThemeTone)}
              >
                <option value="day">{gameText(locale, "phase.day")}</option>
                <option value="night">{gameText(locale, "phase.night")}</option>
              </select>
            </label>
            <select
              aria-label={t("interfaceLanguage")}
              value={locale}
              onChange={(e) => setLocale(e.target.value as Locale)}
            >
              <option value="zh-CN">{t("chinese")}</option>
              <option value="en">English</option>
            </select>
          </div>
        </aside>
        <div className="main-shell">
          <header className="topbar">
            <div className="breadcrumb">
              AWA <span>/</span>{" "}
              {t(
                locationState.page === "logs"
                  ? "logs"
                  : locationState.page === "replay"
                    ? "replay"
                    : locationState.page,
              )}
            </div>
            <div className="actions">
              <span className="live-indicator">
                <span className="status-dot" />
                {active.length} {t("running")}
              </span>
              <button onClick={() => void refresh().catch((e) => setError(e.message))}>
                {t("refresh")}
              </button>
            </div>
          </header>
          <main className={`content ${locationState.page === "replay" ? "replay-content" : ""}`}>
            {error && (
              <div className="notice error" role="alert">
                <button className="dismiss" onClick={() => setError("")}>
                  ×
                </button>
                {t("error")}
                {workbenchServiceMessage(locale, error) && (
                  <p>{workbenchServiceMessage(locale, error)}</p>
                )}
                <code>{error}</code>
              </div>
            )}
            {!catalogReady &&
              ["home", "games", "boards", "agents"].includes(locationState.page) && (
                <p role="status">{configUiText(locale, "loading")}</p>
              )}
            {catalogReady && locationState.page === "home" && (
              <DashboardPage
                active={active}
                runs={runs}
                catalog={catalog}
                t={t}
                locale={locale}
                themeId={appearance.theme.id}
                navigate={navigate}
                stop={stop}
                start={(name, revision) => void start(name, revision)}
                busy={busy}
                remove={setDeletingRun}
              />
            )}
            {catalogReady && locationState.page === "games" && (
              <GamesPage
                key={`${locationState.id}/${locationState.action}`}
                catalog={catalog}
                t={t}
                locale={locale}
                refresh={refresh}
                start={(name, revision) => void start(name, revision)}
                busy={busy}
                routeId={locationState.id}
                action={locationState.action}
                configureAgents={() => navigate("agents")}
                showSavedGame={(name) => {
                  // 保存成功或从只读详情返回后同步地址；刷新不能把已保存文件重新打开成新建草稿。
                  history.replaceState(
                    null,
                    "",
                    `#/games${name ? `/${encodeURIComponent(name)}` : ""}`,
                  );
                  setLocationState({ page: "games", id: name, action: "" });
                }}
              />
            )}
            {catalogReady && locationState.page === "boards" && (
              <BoardsPage
                catalog={catalog}
                t={t}
                locale={locale}
                refresh={refresh}
                useBoard={async (board) => {
                  // 保存后的目录刷新可能仍在途；用户明确选择的板子先交给新建页，不能退回旧目录首项。
                  // 使此前的目录请求失效，防止迟到的旧快照抹掉这份已保存的公开板子元数据。
                  ++catalogGeneration.current;
                  setCatalog((current) => ({
                    ...current,
                    boards: [...current.boards.filter((item) => item.id !== board.id), board],
                  }));
                  sessionStorage.setItem("awa.new-game-board", JSON.stringify({ id: board.id }));
                  navigate("games", "new");
                }}
              />
            )}
            {catalogReady && locationState.page === "agents" && (
              <AgentsPage catalog={catalog} t={t} refresh={refresh} locale={locale} />
            )}
            {locationState.page === "logs" && (
              <>
                <SessionHeading
                  run={selected}
                  id={locationState.id}
                  t={t}
                  back={() => navigate("home")}
                  replay={() => navigate("replay", locationState.id)}
                  stop={() => void stop(locationState.id)}
                  locale={locale}
                  remove={selected ? () => setDeletingRun(selected) : undefined}
                />
                <TerminalPanel
                  sessionId={locationState.id}
                  t={t}
                  theme={terminalTheme}
                  fontFamily={appearance.theme.definition.fonts.mono}
                />
              </>
            )}
            {locationState.page === "replay" && (
              <>
                <SessionHeading
                  run={selected}
                  id={locationState.id}
                  t={t}
                  back={() => navigate("home")}
                  logs={() => navigate("logs", locationState.id)}
                  locale={locale}
                  remove={selected ? () => setDeletingRun(selected) : undefined}
                />
                <ReplayPage
                  sessionId={locationState.id}
                  t={t}
                  locale={locale}
                  appearance={appearance}
                  tone={tone}
                />
              </>
            )}
          </main>
          {deletingRun && (
            <DeleteDialog
              name={deletingRun.sessionId}
              kind="run"
              locale={locale}
              cancel={() => setDeletingRun(undefined)}
              remove={async () => {
                await api(`runs/${encodeURIComponent(deletingRun.sessionId)}`, {
                  method: "DELETE",
                  body: { revision: deletingRun.revision },
                });
                setRuns((previous) =>
                  previous.filter((run) => run.sessionId !== deletingRun.sessionId),
                );
                setDeletingRun(undefined);
                if (locationState.id === deletingRun.sessionId) navigate("home");
              }}
            />
          )}
        </div>
      </div>
    </DraftContext.Provider>
  );
}
