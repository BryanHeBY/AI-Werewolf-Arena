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
import type { Locale } from "@ai-werewolf-arena/game-text";
import { configUiText } from "@ai-werewolf-arena/game-text/workbench-config-ui";
export function DocumentEditor({
  kind,
  name,
  initial,
  t,
  children,
  onSaved,
  onStart,
  onCancel,
  locale = "zh-CN",
}: {
  kind: ConfigKind;
  name: string;
  initial?: JsonObject;
  t: Translator;
  children?: (raw: JsonObject, change: (raw: JsonObject) => void) => ReactNode;
  onSaved?: (document: ConfigDocument, newerChanges: boolean) => void;
  onStart?: (name: string) => void;
  onCancel?: () => void;
  locale?: Locale;
}) {
  const [document, setDocument] = useState<ConfigDocument | null>(null),
    [target, setTarget] = useState(name),
    [text, setText] = useState(""),
    [original, setOriginal] = useState(""),
    [mode, setMode] = useState<"form" | "source">("form"),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [reading, setReading] = useState(false);
  const generation = useRef(0);
  // 保存请求期间仍允许写作；响应仅更新已保存基线，不覆盖后来输入的内容。
  const latestText = useRef(text);
  latestText.current = text;
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
  const run = async (operation: () => Promise<void>, freezeDraft = false) => {
    setBusy(true);
    setReading(freezeDraft);
    setError("");
    setMessage("");
    try {
      await operation();
    } catch (e) {
      setError(e instanceof ApiError ? e.code + (e.path ? ` · ${e.path}` : "") : "request_failed");
    } finally {
      setBusy(false);
      setReading(false);
    }
  };
  const save = () =>
    run(async () => {
      if (!document) return;
      if (!/^[a-z][a-z0-9_-]*$/.test(target)) throw new ApiError("invalid_config_name", 400);
      const submitted = text;
      const saved = await api<ConfigDocument>(`documents/${kind}/${encodeURIComponent(target)}`, {
        method: "PUT",
        body: { revision: target === document.name ? document.revision : null, text },
      });
      setDocument(saved);
      setOriginal(saved.text);
      const newerChanges = latestText.current !== submitted;
      if (!newerChanges) setText(saved.text);
      setMessage(newerChanges ? configUiText(locale, "savedSnapshot") : t("saved"));
      onSaved?.(saved, newerChanges);
    });
  return (
    <section className="editor panel">
      <div className="editor-head">
        <label>
          {t("gameName")}
          <input
            aria-label={t("gameName")}
            value={target}
            disabled={
              busy || document?.revision !== null || kind === "agents" || kind === "backends"
            }
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
      <fieldset disabled={reading} className="editor-draft-fields">
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
      </fieldset>
      {kind === "backends" && (
        <div className="hint">
          <p>{t("credentialsHelp")}</p>
          <button
            disabled={busy || (!!document && (text !== original || target !== document.name))}
            onClick={() =>
              void run(async () => {
                const next = await api<ConfigDocument>(`documents/backends/backends?reveal=true`);
                // 显示密钥只揭示已读版本，不能趁此吸入外部修改并替换整份文档。
                if (next.revision !== document?.revision)
                  throw new ApiError("config_conflict", 409);
                setDocument(next);
                setOriginal(next.text);
                setText(next.text);
                setMode("source");
              }, true)
            }
          >
            {t("reveal")}
          </button>
        </div>
      )}
      <div className="editor-footer">
        <span className="muted">{dirty ? t("unsaved") : t("saved")}</span>
        <div className="actions">
          {onCancel && (
            <button
              disabled={busy}
              onClick={() => {
                if (
                  (text === original && target === document?.name) ||
                  window.confirm(configUiText(locale, "discardConfirm"))
                )
                  onCancel();
              }}
            >
              {configUiText(locale, "cancel")}
            </button>
          )}
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
              }, true)
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
                // 检查结论属于发出请求时的原文；用户后续输入不能收到旧版本“通过”的提示。
                if (latestText.current !== text) return;
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
            {document?.revision === null ? t("saveAs") : t("save")}
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
