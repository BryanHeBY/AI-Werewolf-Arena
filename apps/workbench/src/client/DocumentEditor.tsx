/**
 * 负责同一原始文档的表单／源码编辑和保存冲突提示；输入文件标识及可选模板，输出用户保存动作。
 * 文档与 revision 由本组件拥有；取消旧加载、校验不覆盖草稿，密钥原值只经显式显示请求取得。
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import type {
  ConfigDocument,
  ConfigKind,
  JsonObject,
  Diagnostic,
} from "@ai-werewolf-arena/workbench-contract";
import { api, ApiError } from "./api";
import type { Translator } from "./types";
import { useDraft } from "./draft-context";
export function DocumentEditor({
  kind,
  name,
  initial,
  t,
  children,
  onSaved,
  onStart,
}: {
  kind: ConfigKind;
  name: string;
  initial?: JsonObject;
  t: Translator;
  children?: (raw: JsonObject, change: (raw: JsonObject) => void) => ReactNode;
  onSaved?: (document: ConfigDocument) => void;
  onStart?: (name: string) => void;
}) {
  const [document, setDocument] = useState<ConfigDocument | null>(null),
    [target, setTarget] = useState(name),
    [text, setText] = useState(""),
    [original, setOriginal] = useState(""),
    [mode, setMode] = useState<"form" | "source">("form"),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const generation = useRef(0);
  useEffect(() => {
    if (document?.kind === kind && document.name === name && document.revision !== null && !initial)
      return;
    const controller = new AbortController(),
      id = ++generation.current;
    setDocument(null);
    setTarget(name);
    setError("");
    setMessage("");
    const ready = (doc: ConfigDocument) => {
      if (generation.current === id) {
        setDocument(doc);
        setText(doc.text);
        setOriginal(doc.text);
      }
    };
    if (initial) ready({ kind, name, revision: null, text: JSON.stringify(initial, null, 2) });
    else
      void api<ConfigDocument>(`documents/${kind}/${encodeURIComponent(name)}`, {
        signal: controller.signal,
      })
        .then(ready)
        .catch((e) => {
          if (!controller.signal.aborted) setError(e.code ?? "request_failed");
        });
    return () => controller.abort();
  }, [kind, name, initial]);
  let raw: JsonObject | null = null;
  try {
    const value = JSON.parse(text);
    if (value && typeof value === "object" && !Array.isArray(value)) raw = value;
  } catch {}
  const dirty = text !== original || target !== document?.name || document?.revision === null;
  useDraft(!!document && (text !== original || target !== document.name));
  const change = (next: JsonObject) => {
    setText(JSON.stringify(next, null, 2));
    setMessage("");
  };
  const run = async (operation: () => Promise<void>) => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await operation();
    } catch (e) {
      setError(e instanceof ApiError ? e.code + (e.path ? ` · ${e.path}` : "") : "request_failed");
    } finally {
      setBusy(false);
    }
  };
  const save = () =>
    run(async () => {
      if (!document) return;
      if (!/^[a-z][a-z0-9_-]*$/.test(target)) throw new ApiError("invalid_config_name", 400);
      const saved = await api<ConfigDocument>(`documents/${kind}/${encodeURIComponent(target)}`, {
        method: "PUT",
        body: { revision: target === document.name ? document.revision : null, text },
      });
      setDocument(saved);
      setOriginal(saved.text);
      setText(saved.text);
      setMessage(t("saved"));
      onSaved?.(saved);
    });
  return (
    <section className="editor panel">
      <div className="editor-head">
        <label>
          {t("gameName")}
          <input
            aria-label={t("gameName")}
            value={target}
            disabled={kind === "agents" || kind === "backends"}
            onChange={(e) => {
              setTarget(e.target.value);
              if (kind === "boards" && raw) change({ ...raw, id: e.target.value });
            }}
          />
        </label>
        <div className="segments">
          <button className={mode === "form" ? "selected" : ""} onClick={() => setMode("form")}>
            {t("form")}
          </button>
          <button className={mode === "source" ? "selected" : ""} onClick={() => setMode("source")}>
            {t("source")}
          </button>
        </div>
      </div>
      {document &&
        (mode === "source" ? (
          <textarea
            className="source"
            aria-label={t("source")}
            value={text}
            spellCheck={false}
            onChange={(e) => {
              setText(e.target.value);
              setMessage("");
            }}
          />
        ) : raw && children ? (
          children(raw, change)
        ) : (
          <p role="alert">{t("invalid")}</p>
        ))}
      {kind === "backends" && (
        <div className="hint">
          <p>{t("credentialsHelp")}</p>
          <button
            disabled={busy || (!!document && (text !== original || target !== document.name))}
            onClick={() =>
              void run(async () => {
                const next = await api<ConfigDocument>(`documents/backends/backends?reveal=true`);
                setDocument(next);
                setOriginal(next.text);
                setText(next.text);
                setMode("source");
              })
            }
          >
            {t("reveal")}
          </button>
        </div>
      )}
      <div className="editor-footer">
        <span className="muted">{dirty ? t("unsaved") : t("saved")}</span>
        <div className="actions">
          <button
            disabled={busy || !document}
            onClick={() =>
              void run(async () => {
                if (document!.revision === null) {
                  // 新模板尚无对应文件；“重新读取”恢复本地模板即可，不请求不存在的路径。
                  const restored = JSON.stringify(initial ?? JSON.parse(original), null, 2);
                  setDocument({ kind, name, revision: null, text: restored });
                  setTarget(name);
                  setText(restored);
                  setOriginal(restored);
                  return;
                }
                const next = await api<ConfigDocument>(
                  `documents/${kind}/${encodeURIComponent(document!.name)}`,
                );
                setDocument(next);
                setTarget(next.name);
                setText(next.text);
                setOriginal(next.text);
              })
            }
          >
            {t("reload")}
          </button>
          <button
            disabled={busy || !document}
            onClick={() =>
              void run(async () => {
                const result = await api<{ valid: boolean; diagnostics: Diagnostic[] }>(
                  "validate",
                  { method: "POST", body: { kind, name: target, text } },
                );
                if (!result.valid) {
                  setError(
                    result.diagnostics
                      .map((d) => `${d.code}${d.path ? ` · ${d.path}` : ""}`)
                      .join("\n"),
                  );
                  return;
                }
                setMessage(t("valid"));
              })
            }
          >
            {t("validate")}
          </button>
          <button
            className="primary"
            disabled={busy || !document || !raw}
            onClick={() => void save()}
          >
            {target !== name ? t("saveAs") : t("save")}
          </button>
          {onStart && (
            <button
              className="accent"
              disabled={busy || dirty || !document}
              title={dirty ? t("savedBeforeStart") : ""}
              onClick={() => onStart(document!.name)}
            >
              {t("start")}
            </button>
          )}
        </div>
      </div>
      {error && (
        <div className="notice error" role="alert">
          {error.startsWith("config_conflict") ? t("conflict") : t("error")}
          <code>{error}</code>
        </div>
      )}
      {message && (
        <p className="notice success" role="status">
          {message}
        </p>
      )}
    </section>
  );
}
