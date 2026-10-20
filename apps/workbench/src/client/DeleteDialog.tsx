/** 负责删除确认；输入为具名对象、影响范围及删除用例，输出明确确认或取消动作。只传对象和版本摘要，服务端仍拥有删除权限与关联校验。 */
import { useEffect, useRef, useState } from "react";
import type { Locale } from "@ai-werewolf-arena/game-text";
import { ApiError } from "./api";
import { configUiText } from "@ai-werewolf-arena/game-text/workbench-config-ui";
import { workbenchServiceMessage } from "@ai-werewolf-arena/game-text/workbench-service";
export function DeleteDialog({
  name,
  kind,
  locale,
  cancel,
  remove,
}: {
  name: string;
  kind: "game" | "board" | "run";
  locale: Locale;
  cancel: () => void;
  remove: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [references, setReferences] = useState<string[]>([]);
  const dialog = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.current?.querySelector<HTMLButtonElement>("button")?.focus();
    return () => previous?.focus();
  }, []);
  return (
    <div className="dialog-backdrop">
      <section
        ref={dialog}
        className="panel delete-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={configUiText(locale, "confirmDelete")}
        onKeyDown={(event) => {
          if (event.key === "Escape" && !busy) cancel();
          if (event.key !== "Tab") return;
          const buttons = [
            ...(dialog.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? []),
          ];
          if (!buttons.length) {
            event.preventDefault();
            return;
          }
          const first = buttons[0],
            last = buttons.at(-1)!;
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
          }
        }}
      >
        <h2>{configUiText(locale, "confirmDelete")}</h2>
        <code>{name}</code>
        <p>
          {configUiText(
            locale,
            kind === "game" ? "deleteGame" : kind === "board" ? "deleteBoard" : "deleteRun",
          )}
        </p>
        {error && (
          <div className="notice error" role="alert">
            {workbenchServiceMessage(locale, error) ?? error}
            {references.length > 0 && (
              <>
                <p>{configUiText(locale, "references")}</p>
                <ul>
                  {references.map((id) => (
                    <li key={id}>{id}</li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
        <div className="actions">
          <button disabled={busy} onClick={cancel}>
            {configUiText(locale, "cancel")}
          </button>
          <button
            className="danger"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              setError("");
              setReferences([]);
              void remove()
                .catch((e) => {
                  setError(e.message);
                  if (e instanceof ApiError) setReferences(e.references);
                })
                .finally(() => setBusy(false));
            }}
          >
            {configUiText(locale, "confirmDelete")}
          </button>
        </div>
      </section>
    </div>
  );
}
