/**
 * 负责对已解析 Agent 做一次显式连接探测；输入 profile 和取消信号，输出脱敏阶段结果。
 * 使用真实传输但不注入游戏工具、不创建对局或录制；Pi 全内存，ACP 临时工作区由本用例关闭后回收。
 */
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { AgentConnectionTestResult } from "@ai-werewolf-arena/workbench-contract";
import type { ResolvedAgentRuntimeProfile } from "./contracts";
import { AiSdkClient } from "../../adapters/llm/ai-sdk-client";
import { PiRuntime } from "../../adapters/pi/pi-runtime";
import { AcpProcessClient } from "../../adapters/acp/acp-process-client";
import type { AcpSession } from "../../adapters/acp/session";
import { awaitWithAbort } from "../../agents/runtime/turn-deadline";
import { describeError } from "../../utils/error-diagnostic";

export async function testAgentConnection(
  profile: ResolvedAgentRuntimeProfile,
  options: { signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<AgentConnectionTestResult> {
  const started = Date.now();
  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? 30_000;
  const abort = () => controller.abort(options.signal?.reason);
  options.signal?.addEventListener("abort", abort, { once: true });
  if (options.signal?.aborted) abort();
  const timer = setTimeout(
    () => controller.abort(new DOMException("Connection test timed out", "TimeoutError")),
    timeoutMs,
  );
  let stage: AgentConnectionTestResult["stage"] = "initialize";
  let result: AgentConnectionTestResult;
  let pi: PiRuntime | undefined;
  let acp: AcpSession | undefined;
  let workspace: string | undefined;
  const prompt =
    "This is a connection test. Reply with OK only. Do not call tools or access files.";
  try {
    controller.signal.throwIfAborted();
    let text = "";
    if (
      profile.kind === "llm" &&
      (profile.provider.type === "openai" || profile.provider.type === "anthropic")
    ) {
      const client = new AiSdkClient({
        providerType: profile.provider.type,
        providerName: profile.providerName,
        apiKey: profile.provider.apiKey,
        baseURL: profile.provider.baseURL,
        userAgent: profile.provider.userAgent,
        model: profile.model!,
        maxTokens: 128,
        temperature: profile.temperature,
        reasoningEffort: profile.reasoningEffort,
        thinkingEnabled: profile.thinkingEnabled,
      });
      stage = "request";
      text = await client.chat([{ role: "user", content: prompt }], {
        signal: controller.signal,
        maxRetries: 0,
      });
    } else if (profile.kind === "pi" && profile.provider.type === "pi") {
      pi = await PiRuntime.create({ models: profile.provider.models, auth: profile.provider.auth });
      const session = await pi.createSession({
        settings: {
          ...profile.piSettings,
          retry: { enabled: false, provider: { maxRetries: 0 } },
          cacheWarming: "off",
        },
        systemPrompt: prompt,
        tools: [],
      });
      stage = "request";
      text = (
        await session.prompt(prompt, {
          signal: controller.signal,
          maxSteps: 1,
          onToolCall: async () => ({
            toolResult: { error: "connection_test_has_no_tools" },
            stop: true,
          }),
        })
      ).assistantText;
    } else if (profile.kind === "acp" && profile.provider.type === "acp") {
      workspace = await fs.mkdtemp(path.join(os.tmpdir(), "awa-connection-test-"));
      const client = new AcpProcessClient<null>({
        command: profile.provider.command,
        args: [...profile.provider.args, ...(profile.spawnArgs ?? [])],
        env: profile.provider.env,
        cwd: profile.provider.cwd ?? workspace,
        initializeTimeoutMs: profile.provider.initializeTimeoutMs,
        sessionConfigOptions: profile.provider.sessionConfigOptions,
        mcpBridge: null,
      });
      acp = await client.createSession({
        actorId: 0,
        registry: null,
        signal: controller.signal,
        deadlineAtMs: started + timeoutMs,
      });
      stage = "request";
      await awaitWithAbort(acp.prompt(prompt), controller.signal);
      text = acp.takeAuditTrace?.().messages.join("") ?? "";
    } else throw new Error("connection_test_profile_invalid");
    controller.signal.throwIfAborted();
    if (!text.trim()) throw new Error("connection_test_empty_response");
    result = { ok: true, kind: profile.kind, stage: "complete", elapsedMs: 0 };
  } catch (error) {
    const diagnostic = describeError(controller.signal.aborted ? controller.signal.reason : error);
    result = {
      ok: false,
      kind: profile.kind,
      stage,
      elapsedMs: 0,
      diagnostic: {
        code:
          error instanceof Error && error.message === "connection_test_empty_response"
            ? "connection_test_empty_response"
            : diagnostic.code,
        ...(diagnostic.statusCode ? { statusCode: diagnostic.statusCode } : {}),
      },
    };
  } finally {
    clearTimeout(timer);
    // 取消只结束请求；这里等待实际资源关闭，再移除本次创建的临时目录。
    const closing = await Promise.allSettled([
      pi?.close(),
      acp?.close({ force: controller.signal.aborted }),
    ]);
    let cleanupFailed = closing.some((entry) => entry.status === "rejected");
    if (workspace && !cleanupFailed) {
      try {
        await fs.rm(workspace, { recursive: true, force: true });
      } catch {
        cleanupFailed = true;
      }
    }
    options.signal?.removeEventListener("abort", abort);
    if (cleanupFailed) {
      if (result!.ok)
        result = {
          ok: false,
          kind: profile.kind,
          stage: "cleanup",
          elapsedMs: 0,
          diagnostic: { code: "connection_test_cleanup_failed" },
        };
      else result!.cleanupFailed = true;
    }
  }
  return { ...result, elapsedMs: Date.now() - started };
}
