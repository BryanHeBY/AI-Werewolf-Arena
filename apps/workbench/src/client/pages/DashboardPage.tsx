/**
 * 负责汇总配置和对局状态；输入服务端核验的运行摘要、目录和主题，输出首页与导航动作。
 * 页面只展示摘要及复用视频素材，不推断进程存活或读取配置文件；初始化与停止由应用处理。
 */
import type { Locale } from "@ai-werewolf-arena/game-text";
import { workbenchArt, type ThemeId } from "@ai-werewolf-arena/game-media/appearance";
import type { SessionEntry } from "@ai-werewolf-arena/workbench-contract";
import type { Catalog, Page, Translator } from "../types";
import { RunCard } from "../session-summary";
export function DashboardPage({
  active,
  runs,
  catalog,
  t,
  locale,
  themeId,
  navigate,
  stop,
  initialize,
}: {
  active: SessionEntry[];
  runs: SessionEntry[];
  catalog: Catalog;
  t: Translator;
  locale: Locale;
  themeId: ThemeId;
  navigate: (page: Page, id?: string) => void;
  stop: (id: string) => Promise<void>;
  initialize: () => Promise<void>;
}) {
  return (
    <>
      <section className="hero">
        <div>
          <span className="eyebrow">MULTI-AGENT WEREWOLF ARENA</span>
          <h1>{t("title")}</h1>
          <p>{t("intro")}</p>
          <button className="primary" onClick={() => navigate("boards")}>
            {t("newGame")} <span>↗</span>
          </button>
        </div>
        <div className="hero-art" aria-hidden="true">
          {themeId === "gothic-v1" && <img src={workbenchArt.emblem} alt="" />}
          <div className="moon" />
          <div className="orbit" />
          <span>AWA</span>
        </div>
      </section>
      <div className="metric-grid">
        <Metric value={active.length} label={t("running")} />
        <Metric value={runs.length - active.length} label={t("history")} />
        <Metric value={catalog.agents.length} label={t("agents")} />
      </div>
      <section>
        <div className="section-heading">
          <h2>{t("home")}</h2>
          <button onClick={() => navigate("games")}>{t("setup")} →</button>
        </div>
        {runs.length === 0 ? (
          <div className="panel empty">
            <h3>{t("noRuns")}</h3>
            <button onClick={() => void initialize()}>{t("initialize")}</button>
          </div>
        ) : (
          <div className="run-list">
            {runs.map((run) => (
              <RunCard
                key={run.sessionId}
                run={run}
                t={t}
                locale={locale}
                open={navigate}
                stop={stop}
              />
            ))}
          </div>
        )}
      </section>
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
