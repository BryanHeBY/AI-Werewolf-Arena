/**
 * 负责板子发现、复制与规则编辑；输入已支持的板子目录，输出选定板子的配置草稿和新局动作。
 * 页面只拥有当前选择，文件写入经统一编辑器校验；保存后以新 ID 使用，不直接启动进程。
 */
import type { Locale } from "@ai-werewolf-arena/game-text";
import type { Catalog, Translator } from "../types";
import { useState } from "react";
import { DocumentEditor } from "../DocumentEditor";
import { useCanLeaveDraft } from "../draft-context";
import { roleName } from "@ai-werewolf-arena/game-text";
import type { JsonObject, BoardCard } from "@ai-werewolf-arena/workbench-contract";
import { api } from "../api";
import { BoardExplorer, BoardForm } from "../BoardExplorer";
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
  const canLeave = useCanLeaveDraft();
  const [selected, setSelected] = useState<BoardCard | null>(null),
    [template, setTemplate] = useState<JsonObject | undefined>(),
    [error, setError] = useState("");
  const choose = async (board: BoardCard) => {
    setError("");
    try {
      const raw = await api<JsonObject>(`board-template/${board.id}`);
      setTemplate(board.source === "local" ? undefined : raw);
      setSelected(board);
    } catch (e) {
      setError(e instanceof Error ? e.message : "request_failed");
    }
  };
  return (
    <>
      {selected ? (
        <>
          <div className="section-heading">
            <div>
              <button
                className="text-link"
                onClick={() => {
                  if (canLeave()) setSelected(null);
                }}
              >
                ← {t("boards")}
              </button>
              <h1>
                {selected.roles
                  .filter((r) => !["wolf", "villager"].includes(r.role))
                  .map((r) => roleName(r.role, locale))
                  .join(" · ")}
              </h1>
            </div>
            <button className="accent" onClick={() => void useBoard(selected)}>
              {t("newGame")} →
            </button>
            {catalog.agents.length === 0 && (
              <button
                onClick={() =>
                  void api("initialize", { method: "POST", body: {} })
                    .then(refresh)
                    .catch((e) => setError(e.message))
                }
              >
                {t("initialize")}
              </button>
            )}
          </div>
          <DocumentEditor
            kind="boards"
            name={selected.id}
            initial={template}
            t={t}
            onSaved={(doc) => {
              setTemplate(undefined);
              setSelected({ ...selected, id: doc.name, source: "local" });
              void refresh();
            }}
          >
            {(raw, change) => <BoardForm raw={raw} change={change} t={t} locale={locale} />}
          </DocumentEditor>
        </>
      ) : (
        <BoardExplorer
          boards={catalog.boards}
          t={t}
          locale={locale}
          onChoose={(board) => void choose(board)}
        />
      )}{" "}
      {error && <p role="alert">{error}</p>}
    </>
  );
}
