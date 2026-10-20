/**
 * 负责显式请求当前草稿的附加指令投影；输入草稿与假设座位／角色，输出最终文本和来源，不发牌、不调用模型、不取连接认证。
 * 预览绑定请求时的完整草稿，后续编辑会隐藏旧结果，取消在途请求，避免旧结论误标新配置。
 */
import { useEffect, useRef, useState } from "react";
import type {
  BoardCard,
  GameInstructionPreview as Preview,
  JsonObject,
} from "@ai-werewolf-arena/workbench-contract";
import { roleName, type Locale } from "@ai-werewolf-arena/game-text";
import { configUiText } from "@ai-werewolf-arena/game-text/workbench-config-ui";
import {
  workbenchConfigLocation,
  workbenchServiceMessage,
} from "@ai-werewolf-arena/game-text/workbench-service";
import { api, ApiError } from "./api";
import type { Translator } from "./types";

export function GameInstructionPreview({
  raw,
  board,
  t,
  locale,
}: {
  raw: JsonObject;
  board?: BoardCard;
  t: Translator;
  locale: Locale;
}) {
  const [seat, setSeat] = useState(1),
    [role, setRole] = useState("");
  const effectiveSeat = Math.min(seat, board?.size || 1);
  const effectiveRole = board?.roles.some((entry) => entry.role === role) ? role : "";
  const signature = JSON.stringify([raw, effectiveSeat, effectiveRole]);
  const [result, setResult] = useState<{ signature: string; data: Preview }>();
  const [error, setError] = useState<{ signature: string; code: string }>();
  const [busy, setBusy] = useState(false);
  const request = useRef<AbortController | null>(null);
  useEffect(() => {
    request.current?.abort();
    setBusy(false);
    return () => request.current?.abort();
  }, [signature]);
  const preview = async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setError(undefined);
    try {
      const data = await api<Preview>("preview-game", {
        method: "POST",
        signal: controller.signal,
        body: { game: raw, seat: effectiveSeat, ...(effectiveRole ? { role: effectiveRole } : {}) },
      });
      if (!controller.signal.aborted) setResult({ signature, data });
    } catch (cause) {
      if (!controller.signal.aborted)
        setError({ signature, code: cause instanceof ApiError ? cause.code : "request_failed" });
    } finally {
      if (request.current === controller) setBusy(false);
    }
  };
  const current = result?.signature === signature ? result.data : undefined;
  return (
    <details>
      <summary>{configUiText(locale, "previewTitle")}</summary>
      <p className="muted">{configUiText(locale, "previewHelp")}</p>
      <div className="two-columns">
        <label>
          {t("seat")}
          <select
            aria-label={t("seat")}
            value={effectiveSeat}
            onChange={(event) => setSeat(Number(event.target.value))}
          >
            {Array.from({ length: board?.size ?? 0 }, (_, index) => index + 1).map((id) => (
              <option value={id} key={id}>
                {id}
              </option>
            ))}
          </select>
        </label>
        <label>
          {configUiText(locale, "previewRole")}
          <select
            aria-label={configUiText(locale, "previewRole")}
            value={effectiveRole}
            onChange={(event) => setRole(event.target.value)}
          >
            <option value="">{configUiText(locale, "previewNoRole")}</option>
            {board?.roles.map(({ role }) => (
              <option key={role} value={role}>
                {roleName(role, locale)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <button type="button" disabled={busy || !board} onClick={() => void preview()}>
        {configUiText(locale, busy ? "previewing" : "previewAction")}
      </button>
      {error?.signature === signature && (
        <p className="notice error" role="alert">
          {workbenchServiceMessage(locale, error.code) ?? configUiText(locale, "previewFailed")}{" "}
          <code>{error.code}</code>
        </p>
      )}
      {current && (
        <div className="notice" role="status">
          <p>
            {configUiText(locale, "agentSource")}:{" "}
            {configUiText(locale, `source_${current.agent.source}`)} → {current.agent.name}
          </p>
          <p>
            {t("language")}: {current.locale}
          </p>
          <pre style={{ whiteSpace: "pre-wrap" }}>
            {current.customInstructions ?? configUiText(locale, "previewEmpty")}
          </pre>
          {current.warnings?.map((warning, index) => (
            <p key={index}>
              {workbenchServiceMessage(locale, warning.code) ??
                configUiText(locale, "previewFailed")}
              {warning.path ? ` · ${workbenchConfigLocation(locale, warning.path)}` : ""}
            </p>
          ))}
        </div>
      )}
    </details>
  );
}
