/** 负责本地板子管理与示例复制；输入公开目录及用户选择，输出查看、编辑或新建草稿。示例仅进入创建流程，不作为已有文件直接覆盖。 */
import type { Locale } from "@ai-werewolf-arena/game-text";
import { roleName } from "@ai-werewolf-arena/game-text";
import type { Catalog, Translator } from "../types";
import { useRef, useState } from "react";
import { DocumentEditor } from "../DocumentEditor";
import type { JsonObject, BoardCard, ConfigDocument } from "@ai-werewolf-arena/workbench-contract";
import { api } from "../api";
import { BoardExplorer, BoardForm } from "../BoardExplorer";
import { ConfigDetail } from "../ConfigDetail";
import { DeleteDialog } from "../DeleteDialog";
import { configUiText } from "@ai-werewolf-arena/game-text/workbench-config-ui";

type Screen =
  | { mode: "list" }
  | { mode: "templates" }
  | { mode: "view" | "edit"; board: BoardCard }
  | { mode: "create"; initial: JsonObject; key: number };
export function BoardsPage({
  catalog,
  t,
  locale,
  refresh,
  useBoard,
}: {
  catalog: Catalog;
  t: Translator;
  locale: Locale;
  refresh: () => Promise<void>;
  useBoard: (board: BoardCard) => Promise<void>;
}) {
  const [screen, setScreen] = useState<Screen>({ mode: "list" }),
    [error, setError] = useState(""),
    [deleting, setDeleting] = useState<ConfigDocument>();
  const templateRequest = useRef(0);
  const create = (initial: JsonObject) =>
    setScreen({ mode: "create", initial: { ...initial, id: "my_board" }, key: Date.now() });
  const choose = async (board: BoardCard) => {
    const request = ++templateRequest.current;
    setError("");
    try {
      const template = await api<JsonObject>(`board-template/${encodeURIComponent(board.id)}`);
      if (request === templateRequest.current) create(template);
    } catch (e) {
      if (request === templateRequest.current)
        setError(e instanceof Error ? e.message : "request_failed");
    }
  };
  const locals = catalog.boards.filter((b) => b.source === "local");
  const boardTitle = (board: BoardCard) =>
    board.roles
      .filter((r) => !["wolf", "villager"].includes(r.role))
      .map((r) => roleName(r.role, locale))
      .join(" · ") || board.id;
  return (
    <>
      <div className="section-heading">
        <div>
          {screen.mode !== "list" && screen.mode !== "edit" && screen.mode !== "create" && (
            <button
              className="text-link"
              onClick={() => {
                templateRequest.current++;
                setScreen({ mode: "list" });
              }}
            >
              ← {t("boards")}
            </button>
          )}
          <h1>
            {configUiText(
              locale,
              screen.mode === "list"
                ? "savedBoards"
                : screen.mode === "templates"
                  ? "templates"
                  : screen.mode === "create"
                    ? "newBoard"
                    : screen.mode === "edit"
                      ? "editBoard"
                      : "viewBoard",
            )}
          </h1>
          {"board" in screen && <code>{screen.board.id}</code>}
        </div>
        {screen.mode === "list" && (
          <button className="primary" onClick={() => setScreen({ mode: "templates" })}>
            <span aria-hidden="true">+</span> {configUiText(locale, "newBoard")}
          </button>
        )}
        {screen.mode === "view" && screen.board.supported && (
          <button className="primary" onClick={() => void useBoard(screen.board)}>
            {t("newGame")} <span aria-hidden="true">→</span>
          </button>
        )}
      </div>
      {screen.mode === "list" &&
        (locals.length ? (
          <div className="board-grid">
            {locals.map((board) => (
              <article className="panel board-card" key={board.id} data-config-id={board.id}>
                <span className="eyebrow">
                  {configUiText(locale, "local")} · {board.size}
                </span>
                <h3>{boardTitle(board)}</h3>
                <code>boards/{board.id}.json</code>
                <div className="role-chips">
                  {board.roles.map((r) => (
                    <span key={r.role}>
                      {roleName(r.role, locale)} ×{r.count}
                    </span>
                  ))}
                </div>
                {board.diagnostic && <p role="alert">{board.diagnostic.code}</p>}
                <div className="actions">
                  <button onClick={() => setScreen({ mode: "view", board })}>
                    {configUiText(locale, "view")}
                  </button>
                  <button onClick={() => setScreen({ mode: "edit", board })}>
                    {configUiText(locale, "edit")}
                  </button>
                  <button
                    className="danger"
                    onClick={() =>
                      void api<ConfigDocument>(`documents/boards/${encodeURIComponent(board.id)}`)
                        .then(setDeleting)
                        .catch((e) => setError(e.message))
                    }
                  >
                    {configUiText(locale, "remove")}
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <section className="panel empty">
            <p>{configUiText(locale, "noBoards")}</p>
          </section>
        ))}
      {screen.mode === "templates" && (
        <>
          <p className="muted">{configUiText(locale, "templateHelp")}</p>
          <span className="eyebrow">{configUiText(locale, "example")}</span>
          <BoardExplorer
            boards={catalog.boards.filter((b) => b.source === "example")}
            t={t}
            locale={locale}
            onChoose={(board) => void choose(board)}
          />
        </>
      )}
      {screen.mode === "view" && (
        <ConfigDetail
          key={screen.board.id}
          kind="boards"
          name={screen.board.id}
          t={t}
          locale={locale}
          edit={() => setScreen({ mode: "edit", board: screen.board })}
          copy={(doc) => create(JSON.parse(doc.text))}
          remove={setDeleting}
        >
          {(raw) => (
            <>
              <h2>{boardTitle(screen.board)}</h2>
              <div className="role-chips large">
                {screen.board.roles.map((r) => (
                  <span key={r.role}>
                    {roleName(r.role, locale)} ×{r.count}
                  </span>
                ))}
              </div>
              <fieldset disabled className="readonly-fields">
                <BoardForm raw={raw} change={() => {}} t={t} locale={locale} />
              </fieldset>
            </>
          )}
        </ConfigDetail>
      )}
      {(screen.mode === "edit" || screen.mode === "create") && (
        <DocumentEditor
          key={screen.mode === "create" ? screen.key : screen.board.id}
          kind="boards"
          name={screen.mode === "create" ? "my_board" : screen.board.id}
          initial={screen.mode === "create" ? screen.initial : undefined}
          t={t}
          locale={locale}
          onCancel={() =>
            setScreen(
              screen.mode === "edit"
                ? { mode: "view", board: screen.board }
                : { mode: "templates" },
            )
          }
          onSaved={(doc, newerChanges) => {
            if (!newerChanges)
              setScreen({
                mode: "view",
                board: {
                  id: doc.name,
                  source: "local",
                  supported: true,
                  size: Number((JSON.parse(doc.text).board ?? {}).size ?? 12),
                  roles: (JSON.parse(doc.text).board ?? {}).roleSetups ?? [],
                },
              });
            void refresh();
          }}
        >
          {(raw, change) => <BoardForm raw={raw} change={change} t={t} locale={locale} />}
        </DocumentEditor>
      )}
      {deleting && (
        <DeleteDialog
          name={deleting.name}
          kind="board"
          locale={locale}
          cancel={() => setDeleting(undefined)}
          remove={async () => {
            await api(`documents/boards/${encodeURIComponent(deleting.name)}`, {
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
