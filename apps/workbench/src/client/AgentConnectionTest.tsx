/** 负责已保存 Agent 的显式连接测试；输入 Agent 标识，输出阶段、耗时和脱敏错误界面，不接收模型正文或认证。 */
import { useEffect, useRef, useState } from "react";
import type { Locale } from "@ai-werewolf-arena/game-text";
import { errorMessage } from "@ai-werewolf-arena/game-text";
import type { AgentConnectionTestResult } from "@ai-werewolf-arena/workbench-contract";
import { configUiText } from "@ai-werewolf-arena/game-text/workbench-config-ui";
import { workbenchServiceMessage } from "@ai-werewolf-arena/game-text/workbench-service";
import { api } from "./api";

export function AgentConnectionTest({
  name,
  locale,
  disabled = false,
}: {
  name: string;
  locale: Locale;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<AgentConnectionTestResult>();
  const [error, setError] = useState("");
  const request = useRef<AbortController | undefined>(undefined);
  useEffect(() => {
    setResult(undefined);
    setError("");
    setBusy(false);
    return () => request.current?.abort();
  }, [name, disabled]);
  const test = async () => {
    const controller = new AbortController();
    request.current?.abort();
    request.current = controller;
    setBusy(true);
    setResult(undefined);
    setError("");
    try {
      const next = await api<AgentConnectionTestResult>("test-agent", {
        method: "POST",
        body: { name },
        signal: controller.signal,
      });
      if (!controller.signal.aborted) setResult(next);
    } catch (error) {
      if (!controller.signal.aborted)
        setError(error instanceof Error ? error.message : "request_failed");
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  };
  return (
    <section className="field-section connection-test">
      <code>{name}</code>
      <p className="muted">
        {configUiText(locale, disabled ? "connectionSaveFirst" : "connectionTestHelp")}
      </p>
      <button type="button" disabled={disabled || busy || !name} onClick={() => void test()}>
        {configUiText(locale, busy ? "connectionTesting" : "connectionTest")}
      </button>
      {result && (
        <div
          className={`notice ${result.ok ? "success" : "error"}`}
          role={result.ok ? "status" : "alert"}
        >
          <p>
            {configUiText(locale, result.ok ? "connectionSucceeded" : "connectionFailed")} ·{" "}
            {result.kind.toUpperCase()} · {configUiText(locale, `connectionStage_${result.stage}`)}{" "}
            · {(result.elapsedMs / 1000).toFixed(1)}s
          </p>
          {result.diagnostic && (
            <p>
              {workbenchServiceMessage(locale, result.diagnostic.code) ??
                errorMessage(locale, result.diagnostic.code)}
              {result.diagnostic.statusCode ? ` (HTTP ${result.diagnostic.statusCode})` : ""}
            </p>
          )}
          {result.cleanupFailed && (
            <p>{workbenchServiceMessage(locale, "connection_test_cleanup_failed")}</p>
          )}
        </div>
      )}
      {error && (
        <p className="notice error" role="alert">
          {workbenchServiceMessage(locale, error) ?? errorMessage(locale, error)}
        </p>
      )}
    </section>
  );
}
