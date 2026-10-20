/** 负责游戏列表、只读详情与创建／编辑状态；输入目录及显式用户动作，输出文件保存或具名启动。草稿由当前编辑器拥有，新建模板在点击时捕获，目录刷新不重建草稿。 */
import type { Locale } from "@ai-werewolf-arena/game-text";
import type { Catalog, Translator } from "../types";
import { useState } from "react";
import { DocumentEditor } from "../DocumentEditor";
import type { ConfigDocument, JsonObject } from "@ai-werewolf-arena/workbench-contract";
import { GameForm } from "../GameForm";
import { ConfigDetail } from "../ConfigDetail";
import { DeleteDialog } from "../DeleteDialog";
import { GameSummary } from "../GameSummary";
import { configUiText } from "@ai-werewolf-arena/game-text/workbench-config-ui";
import { api } from "../api";

type Screen =
  | { mode: "list" }
  | { mode: "view"; name: string }
  | { mode: "edit"; name: string }
  | { mode: "create"; key: number; initial: JsonObject };
function newGame(catalog: Catalog): JsonObject {
  let board = catalog.boards.find((b) => b.source === "local" && b.supported)?.id ?? "";
  try {
    const saved = JSON.parse(sessionStorage.getItem("awa.new-game-board") ?? "null");
    if (saved?.id) board = saved.id;
  } catch {}
  sessionStorage.removeItem("awa.new-game-board");
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
  };
}
export function GamesPage({
  catalog,
  t,
  locale,
  refresh,
  start,
  busy,
  routeId = "",
  action = "",
  configureAgents,
  showSavedGame,
}: {
  catalog: Catalog;
  t: Translator;
  locale: Locale;
  refresh: () => Promise<void>;
  start: (name: string, revision: string) => void;
  busy: boolean;
  routeId?: string;
  action?: string;
  configureAgents: () => void;
  showSavedGame: (name: string) => void;
}) {
  const [screen, setScreen] = useState<Screen>(() =>
      routeId === "new"
        ? { mode: "create", key: Date.now(), initial: newGame(catalog) }
        : routeId
          ? { mode: action === "edit" ? "edit" : "view", name: routeId }
          : { mode: "list" },
    ),
    [deleting, setDeleting] = useState<ConfigDocument>(),
    [error, setError] = useState("");
  const create = (initial = newGame(catalog)) =>
    setScreen({ mode: "create", key: Date.now(), initial });
  const title =
    screen.mode === "list"
      ? configUiText(locale, "savedGames")
      : screen.mode === "create"
        ? configUiText(locale, "createGame")
        : screen.mode === "edit"
          ? configUiText(locale, "editGame")
          : configUiText(locale, "viewGame");
  return (
    <>
      <div className="section-heading">
        <div>
          {screen.mode === "view" && (
            <button
              className="text-link"
              onClick={() => {
                setScreen({ mode: "list" });
                showSavedGame("");
              }}
            >
              ← {t("games")}
            </button>
          )}
          <h1>{title}</h1>
          {"name" in screen && <code>{screen.name}</code>}
        </div>
        {screen.mode === "list" && (
          <button className="primary" onClick={() => create()}>
            <span aria-hidden="true">+</span> {t("newGame")}
          </button>
        )}
      </div>
      {!catalog.agents.length && (
        <section className="panel config-detail notice" role="alert">
          <p>{configUiText(locale, "noAgents")}</p>
          <button className="primary" onClick={configureAgents}>
            {configUiText(locale, "configureAgent")}
          </button>
        </section>
      )}
      {screen.mode === "list" &&
        (catalog.games.length ? (
          <div className="saved-config-list">
            {catalog.games.map((name) => {
              const card = catalog.gameCards?.find((c) => c.id === name);
              return (
                <article className="panel saved-config-card" key={name} data-config-id={name}>
                  <h3>{name}</h3>
                  <code>games/{name}.json</code>
                  {card && (
                    <p>
                      {card.board} · {card.size ?? "—"} ·{" "}
                      {card.defaultAgent ?? catalog.defaultAgent ?? "—"}
                    </p>
                  )}
                  {card?.diagnostic && <p className="notice error">{card.diagnostic.code}</p>}
                  <div className="actions">
                    <button onClick={() => setScreen({ mode: "view", name })}>
                      {configUiText(locale, "view")}
                    </button>
                    <button onClick={() => setScreen({ mode: "edit", name })}>
                      {configUiText(locale, "edit")}
                    </button>
                    <button
                      className="primary"
                      disabled={busy || !card?.revision || !catalog.agents.length}
                      onClick={() => card?.revision && start(name, card.revision)}
                    >
                      {t("start")}
                    </button>
                    <button
                      className="danger"
                      onClick={() =>
                        void api<ConfigDocument>(`documents/games/${encodeURIComponent(name)}`)
                          .then(setDeleting)
                          .catch((e) => setError(e.message))
                      }
                    >
                      {configUiText(locale, "remove")}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <section className="panel empty">
            <p>{configUiText(locale, "noGames")}</p>
          </section>
        ))}
      {screen.mode === "view" && (
        <ConfigDetail
          key={screen.name}
          kind="games"
          name={screen.name}
          locale={locale}
          t={t}
          edit={() => setScreen({ mode: "edit", name: screen.name })}
          copy={(doc) => create(JSON.parse(doc.text))}
          remove={setDeleting}
          start={
            busy || !catalog.agents.length
              ? undefined
              : (doc) => doc.revision && start(screen.name, doc.revision)
          }
        >
          {(raw) => <GameSummary raw={raw} catalog={catalog} locale={locale} t={t} />}
        </ConfigDetail>
      )}
      {(screen.mode === "create" || screen.mode === "edit") && (
        <DocumentEditor
          key={screen.mode === "create" ? screen.key : screen.name}
          kind="games"
          name={screen.mode === "create" ? "my_game" : screen.name}
          initial={screen.mode === "create" ? screen.initial : undefined}
          locale={locale}
          saveBlocked={!catalog.agents.length}
          t={t}
          onCancel={() =>
            setScreen(
              screen.mode === "edit" ? { mode: "view", name: screen.name } : { mode: "list" },
            )
          }
          onSaved={(doc, newerChanges) => {
            void refresh();
            if (!newerChanges) {
              setScreen({ mode: "view", name: doc.name });
              showSavedGame(doc.name);
            }
          }}
        >
          {(raw, change) => (
            <GameForm raw={raw} change={change} catalog={catalog} t={t} locale={locale} />
          )}
        </DocumentEditor>
      )}
      {deleting && (
        <DeleteDialog
          name={deleting.name}
          kind="game"
          locale={locale}
          cancel={() => setDeleting(undefined)}
          remove={async () => {
            await api(`documents/games/${encodeURIComponent(deleting.name)}`, {
              method: "DELETE",
              body: { revision: deleting.revision },
            });
            setDeleting(undefined);
            setScreen({ mode: "list" });
            await refresh();
          }}
        />
      )}
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
