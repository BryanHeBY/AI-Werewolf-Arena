/**
 * 负责对局卡片与详情标题；输入服务端核验的运行摘要，输出状态文案以及日志、回放、停止按钮。
 * 组件只展示摘要，不自行判断 PID 存活；停止按钮仅消费服务端明确给出的 canStop 能力。
 */
import type { Locale } from "@ai-werewolf-arena/game-text";
import type { SessionEntry } from "@ai-werewolf-arena/workbench-contract";
import type { Page, Translator } from "./types";
import { configUiText, winnerLabel } from "@ai-werewolf-arena/game-text/workbench-config-ui";
export function RunCard({
  run,
  t,
  locale,
  open,
  stop,
  remove,
}: {
  run: SessionEntry;
  t: Translator;
  locale: Locale;
  open: (page: Page, id: string) => void;
  stop: (id: string) => Promise<void>;
  remove?: (run: SessionEntry) => void;
}) {
  const active = ["starting", "running", "finalizing"].includes(run.state);
  return (
    <article className="run-card panel">
      <div className={`run-icon ${active ? "is-live" : ""}`}>{active ? "◉" : "◇"}</div>
      <div className="run-main">
        <div className="run-title">
          <h3>{run.gameName ?? run.board}</h3>
          <span className={`badge ${active ? "live" : ""}`}>{t(run.state)}</span>
        </div>
        <p>
          <code>{run.sessionId}</code>
          <span> · {new Date(run.startedAt).toLocaleString(locale)}</span>
        </p>
        <div className="status-row">
          <span>{t(run.game)}</span>
          <span>{t(run.recording)}</span>
          {run.origin && <span>{t(run.origin === "cli" ? "originCli" : "originWorkbench")}</span>}
          {run.winner && (
            <span>
              {t("winner")}: {winnerLabel(locale, run.winner)}
            </span>
          )}
        </div>
      </div>
      <div className="actions">
        {remove && (
          <button
            className="danger"
            disabled={!run.canDelete}
            title={run.canDelete ? "" : configUiText(locale, "deleteBlocked")}
            onClick={() => remove(run)}
          >
            {configUiText(locale, "remove")}
          </button>
        )}
        <button onClick={() => open("logs", run.sessionId)}>{t("logs")}</button>
        {run.canReplay && (
          <button className="primary subtle" onClick={() => open("replay", run.sessionId)}>
            {t("replay")} ↗
          </button>
        )}
        {run.canStop && (
          <button
            className="danger"
            title={t("confirmStop")}
            onClick={() => void stop(run.sessionId)}
          >
            {t("stop")}
          </button>
        )}
      </div>
    </article>
  );
}
export function SessionHeading({
  run,
  id,
  t,
  back,
  replay,
  logs,
  stop,
  remove,
  locale = "zh-CN",
}: {
  run?: SessionEntry;
  id: string;
  t: Translator;
  back: () => void;
  replay?: () => void;
  logs?: () => void;
  stop?: () => void;
  remove?: () => void;
  locale?: Locale;
}) {
  return (
    <div className="section-heading">
      <div>
        <button className="text-link" onClick={back}>
          ← {t("back")}
        </button>
        <h2>{run?.gameName ?? run?.board ?? id}</h2>
        <code>{id}</code>
        {run?.board && (
          <p>
            {run.board} · {run.gameName ?? ""}
          </p>
        )}
      </div>
      <div className="actions">
        {remove && (
          <button
            className="danger"
            disabled={!run?.canDelete}
            title={run?.canDelete ? "" : configUiText(locale, "deleteBlocked")}
            onClick={remove}
          >
            {configUiText(locale, "remove")}
          </button>
        )}
        {run?.canStop && stop && (
          <button className="danger" title={t("confirmStop")} onClick={stop}>
            {t("stop")}
          </button>
        )}
        {run?.canReplay && replay && (
          <button className="primary" onClick={replay}>
            {t("replay")}
          </button>
        )}
        {logs && <button onClick={logs}>{t("logs")}</button>}
      </div>
    </div>
  );
}
