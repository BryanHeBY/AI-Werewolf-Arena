/** 负责已保存配置的只读详情；输入为具名文件及界面操作，输出摘要、源码和显式编辑入口。文件读取不复用草稿，读取失败保留实际原因。 */
import { useEffect, useState, type ReactNode } from "react";
import type { ConfigDocument, ConfigKind, JsonObject } from "@ai-werewolf-arena/workbench-contract";
import type { Locale } from "@ai-werewolf-arena/game-text";
import { api } from "./api";
import { configUiText } from "@ai-werewolf-arena/game-text/workbench-config-ui";
import type { Translator } from "./types";
import { workbenchServiceMessage } from "@ai-werewolf-arena/game-text/workbench-service";
export function ConfigDetail({
  kind,
  name,
  t,
  locale,
  children,
  edit,
  copy,
  remove,
  start,
}: {
  kind: ConfigKind;
  name: string;
  t: Translator;
  locale: Locale;
  children: (raw: JsonObject) => ReactNode;
  edit: (document: ConfigDocument) => void;
  copy: (document: ConfigDocument) => void;
  remove: (document: ConfigDocument) => void;
  start?: (document: ConfigDocument) => void;
}) {
  const [document, setDocument] = useState<ConfigDocument>(),
    [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    void api<ConfigDocument>(`documents/${kind}/${encodeURIComponent(name)}`, {
      signal: controller.signal,
    })
      .then(setDocument)
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [kind, name]);
  let raw: JsonObject | null = null;
  try {
    const value = document ? JSON.parse(document.text) : null;
    if (value && typeof value === "object" && !Array.isArray(value)) raw = value;
  } catch {}
  return (
    <section className="panel config-detail">
      <p className="muted">{configUiText(locale, "readonly")}</p>
      <code>
        {kind}/{name}.json
      </code>
      {error && (
        <p className="notice error" role="alert">
          {workbenchServiceMessage(locale, error) ?? error}
        </p>
      )}
      {!document && !error && <p>{configUiText(locale, "loading")}</p>}
      {document && (
        <>
          {raw ? children(raw) : <p role="alert">{t("invalid")}</p>}
          <div className="actions">
            <button onClick={() => edit(document)}>{configUiText(locale, "edit")}</button>
            <button disabled={!raw} onClick={() => copy(document)}>
              {configUiText(locale, "copy")}
            </button>
            {start && (
              <button className="primary" disabled={!raw} onClick={() => start(document)}>
                {t("start")}
              </button>
            )}
            <button className="danger" onClick={() => remove(document)}>
              {configUiText(locale, "remove")}
            </button>
          </div>
          <details>
            <summary>{t("source")}</summary>
            <pre>{document.text}</pre>
          </details>
        </>
      )}
    </section>
  );
}
