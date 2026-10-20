/**
 * 负责选择既有游戏与创建新局草稿；输入配置目录、界面语言和启动回调，输出配置编辑页面。
 * 草稿仅存在当前编辑器，文件校验和保存归统一编辑器，开始对局只使用已保存的配置 ID。
 */
import type { Locale } from "@ai-werewolf-arena/game-text";
import type { Catalog, Translator } from "../types";
import { useState, useMemo } from "react";
import { DocumentEditor } from "../DocumentEditor";
import { useCanLeaveDraft } from "../draft-context";
import type { JsonObject } from "@ai-werewolf-arena/workbench-contract";
import { GameForm } from "../GameForm";
export function GamesPage({
  catalog,
  t,
  locale,
  refresh,
  start,
  busy,
}: {
  catalog: Catalog;
  t: Translator;
  locale: Locale;
  refresh: () => Promise<void>;
  start: (name: string) => void;
  busy: boolean;
}) {
  const canLeave = useCanLeaveDraft();
  const [selection, setSelection] = useState(() =>
    location.hash.endsWith("/new") ? "new" : (catalog.games[0] ?? "new"),
  );
  const initial = useMemo(() => {
    if (selection !== "new") return undefined;
    let board = "twelve_player_standard";
    try {
      const saved = JSON.parse(sessionStorage.getItem("awa.new-game-board") ?? "null");
      if (saved?.id) board = saved.id;
    } catch {}
    return {
      board,
      agent: catalog.defaultAgent ?? catalog.agents[0]?.name ?? "",
      locale: "zh-CN",
      streamEvents: true,
      printThinking: true,
      printPrivateEvents: false,
      maxDays: 8,
      maxRuntimeMs: 1800000,
      llmTimeoutMs: 45000,
    } satisfies JsonObject;
  }, [selection, catalog.defaultAgent]);
  return (
    <>
      <div className="section-heading">
        <div>
          <span className="eyebrow">{t("setup")}</span>
          <h1>{t("games")}</h1>
        </div>
        <div className="actions">
          <select
            aria-label={t("chooseGame")}
            value={selection}
            onChange={(e) => {
              if (canLeave()) setSelection(e.target.value);
            }}
          >
            <option value="new">+ {t("newGame")}</option>
            {catalog.games.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <button
            onClick={() => {
              if (canLeave()) setSelection("new");
            }}
          >
            + {t("newGame")}
          </button>
        </div>
      </div>
      <DocumentEditor
        key={selection}
        kind="games"
        name={selection === "new" ? "my_game" : selection}
        initial={initial}
        t={t}
        onSaved={() => void refresh()}
        onStart={busy ? undefined : start}
      >
        {(raw, change) => (
          <GameForm raw={raw} change={change} catalog={catalog} t={t} locale={locale} />
        )}
      </DocumentEditor>
    </>
  );
}
