/** 负责首页配置启动与对局分组；输入已保存游戏摘要和核验的 session，输出明确启动、查看和管理动作。活动与历史记录分别展示，不把配置文件与每次执行混为一体。 */
import { roleName, type Locale } from "@ai-werewolf-arena/game-text";
import { workbenchArt, type ThemeId } from "@ai-werewolf-arena/game-media/appearance";
import type { SessionEntry } from "@ai-werewolf-arena/workbench-contract";
import type { Catalog, Page, Translator } from "../types";
import { RunCard } from "../session-summary";
import { configUiText } from "@ai-werewolf-arena/game-text/workbench-config-ui";
export function DashboardPage({
  active,
  runs,
  catalog,
  t,
  locale,
  themeId,
  navigate,
  stop,
  start,
  busy,
  remove,
}: {
  active: SessionEntry[];
  runs: SessionEntry[];
  catalog: Catalog;
  t: Translator;
  locale: Locale;
  themeId: ThemeId;
  navigate: (page: Page, id?: string, action?: string) => void;
  stop: (id: string) => Promise<void>;
  start: (id: string, revision: string) => void;
  busy: boolean;
  remove: (run: SessionEntry) => void;
}) {
  const history = runs.filter((run) => !active.some((r) => r.sessionId === run.sessionId));
  const hasAgent = catalog.agents.length > 0;
  const hasBoard = catalog.boards.some((board) => board.source === "local" && board.supported);
  const nextPage = !hasAgent ? "agents" : !hasBoard ? "boards" : "games";
  const nextLabel = !hasAgent
    ? t("newAgent")
    : !hasBoard
      ? configUiText(locale, "newBoard")
      : t("newGame");
  const next = () => navigate(nextPage, nextPage === "games" ? "new" : "");
  return (
    <>
      <section className="hero">
        <div>
          <span className="eyebrow">MULTI-AGENT WEREWOLF ARENA</span>
          <h1>{t("title")}</h1>
          <p>{t("intro")}</p>
          <button className="primary" onClick={next}>
            {nextLabel} <span>↗</span>
          </button>
        </div>
        <div className="hero-art" aria-hidden="true">
          {themeId === "gothic-v1" && <img src={workbenchArt.emblem} alt="" />}
          <div className="moon" />
          <div className="orbit" />
          <span>AWA</span>
        </div>
      </section>
      {(!hasAgent || !hasBoard || !catalog.games.length) && (
        <section
          className="panel config-detail setup-guide"
          aria-label={configUiText(locale, "setupTitle")}
        >
          <h2>{configUiText(locale, "setupTitle")}</h2>
          <p className="muted">{configUiText(locale, "setupHelp")}</p>
          <ol className="setup-steps">
            {[
              { page: "agents" as const, done: hasAgent, label: "configureAgent" as const },
              { page: "boards" as const, done: hasBoard, label: "newBoard" as const },
              {
                page: "games" as const,
                done: catalog.games.length > 0,
                label: "createGame" as const,
              },
            ].map((step) => (
              <li key={step.page}>
                <strong>{configUiText(locale, step.label)}</strong>
                <span>{configUiText(locale, step.done ? "setupDone" : "setupTodo")}</span>
                <button
                  disabled={step.page === "games" && (!hasAgent || !hasBoard)}
                  onClick={() => navigate(step.page)}
                >
                  {step.done ? configUiText(locale, "view") : configUiText(locale, step.label)} →
                </button>
              </li>
            ))}
          </ol>
        </section>
      )}
      <section className="quick-start">
        <div className="section-heading">
          <div>
            <h2>{configUiText(locale, "quickStart")}</h2>
            <p className="muted">{configUiText(locale, "quickHelp")}</p>
          </div>
          <button onClick={() => navigate("games")}>{configUiText(locale, "savedGames")} →</button>
        </div>
        {catalog.games.length ? (
          <div className="saved-config-list">
            {catalog.games.map((id) => {
              const card = catalog.gameCards?.find((c) => c.id === id);
              return (
                <article className="panel saved-config-card" key={id} data-config-id={id}>
                  <span className="eyebrow">{configUiText(locale, "startTarget")}</span>
                  <h3>{id}</h3>
                  <code>games/{id}.json</code>
                  {card && (
                    <p>
                      {card.board} · {card.size ?? "—"} · {t("defaultAgent")}:{" "}
                      {card.defaultAgent ?? catalog.defaultAgent ?? "—"}
                    </p>
                  )}
                  {card?.roleAgents && (
                    <p className="muted">
                      {configUiText(locale, "roleAgents")}:{" "}
                      {Object.entries(card.roleAgents)
                        .map(([role, agent]) => `${roleName(role, locale)} → ${agent}`)
                        .join(" · ") || t("inherited")}
                    </p>
                  )}
                  {card?.seatAgents && (
                    <p className="muted">
                      {configUiText(locale, "seatAgents")}:{" "}
                      {Object.entries(card.seatAgents)
                        .map(([seat, agent]) => `${seat} → ${agent}`)
                        .join(" · ") || t("inherited")}
                    </p>
                  )}
                  {card?.diagnostic && <p className="notice error">{card.diagnostic.code}</p>}
                  <div className="actions">
                    <button onClick={() => navigate("games", id)}>
                      {configUiText(locale, "view")}
                    </button>
                    <button onClick={() => navigate("games", id, "edit")}>
                      {configUiText(locale, "edit")}
                    </button>
                    <button
                      className="primary"
                      disabled={busy || !card?.revision || !catalog.agents.length}
                      onClick={() => card?.revision && start(id, card.revision)}
                    >
                      {t("start")}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <section className="panel empty">
            <p>
              {configUiText(locale, !hasAgent ? "noAgents" : !hasBoard ? "needsBoard" : "noGames")}
            </p>
            <button onClick={next}>{nextLabel}</button>
          </section>
        )}
      </section>
      <div className="metric-grid">
        <Metric value={active.length} label={t("running")} />
        <Metric value={history.length} label={t("history")} />
        <Metric value={catalog.agents.length} label={t("agents")} />
      </div>
      {[
        { title: "activeRuns" as const, list: active, empty: "noActive" as const },
        { title: "pastRuns" as const, list: history, empty: "noHistory" as const },
      ].map((group) => (
        <section className="session-group" key={group.title}>
          <div className="section-heading">
            <h2>{configUiText(locale, group.title)}</h2>
          </div>
          {group.list.length ? (
            <div className="run-list">
              {group.list.map((run) => (
                <RunCard
                  key={run.sessionId}
                  run={run}
                  t={t}
                  locale={locale}
                  open={navigate}
                  stop={stop}
                  remove={remove}
                />
              ))}
            </div>
          ) : (
            <p className="muted">{configUiText(locale, group.empty)}</p>
          )}
        </section>
      ))}
    </>
  );
}
function Metric({ value, label }: { value: number; label: string }) {
  return (
    <div className="metric panel">
      <span>{label}</span>
      <strong>{String(value).padStart(2, "0")}</strong>
      <div className="metric-line" />
    </div>
  );
}
