/**
 * 集成测试使用构造的本地 ACP 进程复现显示异常后的工具批准与更新排空，字面批准结果和原错误对象是独立预期。
 * 不启动模型、不读取认证或监听网络；单独注入队列失败，验证协议错误及时返回且不被结束回调覆盖。
 */
import { expect, spyOn, test } from "bun:test";
import { ActiveSession } from "@agentclientprotocol/sdk";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { AcpProcessClient } from "../../../../src/adapters/acp/acp-process-client";
import { AcpTurnRegistry } from "../../../../src/adapters/acp/acp-turn-registry";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import { sixPlayerMvpConfig } from "../../../../src/rulesets/presets/six-player-mvp";
import { createTestTempDirectory } from "../../../support/drivers/temp-directories";
import type { AcpProcessClientOptions } from "../../../../src/adapters/acp/session";

async function fixture(callbacks: Pick<AcpProcessClientOptions, "onUpdate" | "onPromptEnd">) {
  const cwd = await createTestTempDirectory("awa-acp-update-errors-"),
    script = path.join(cwd, "agent.ts");
  await writeFile(
    script,
    `
    import { createInterface } from "node:readline";
    import { writeFile } from "node:fs/promises";
    const send = value => process.stdout.write(JSON.stringify(value) + "\\n");
    const update = value => send({ jsonrpc: "2.0", method: "session/update", params: { sessionId: "display-errors", update: value } });
    let promptId, promptText;
    const outcomes = [];
    function permission(id, callId, server) {
      update({ sessionUpdate: "tool_call", toolCallId: callId, title: "fixture", status: "pending", rawInput: { server, tool: "submit_action" } });
      setTimeout(() => send({ jsonrpc: "2.0", id, method: "session/request_permission", params: {
        sessionId: "display-errors", toolCall: { toolCallId: callId, title: "fixture" },
        options: [{ optionId: "allow_session", kind: "allow_once", name: "Allow" }],
        _meta: { is_mcp_tool_approval: true }
      } }), 10);
    }
    for await (const line of createInterface({ input: process.stdin })) {
      const rpc = JSON.parse(line);
      if (rpc.method === "initialize") {
        send({ jsonrpc: "2.0", id: rpc.id, result: { protocolVersion: 1, agentCapabilities: {} } });
      } else if (rpc.method === "session/new") {
        send({ jsonrpc: "2.0", id: rpc.id, result: { sessionId: "display-errors" } });
      } else if (rpc.method === "session/prompt") {
        promptId = rpc.id; promptText = rpc.params.prompt[0].text;
        if (promptText === "hang") continue;
        update({ sessionUpdate: "agent_message_chunk", content: { type: "text", text: "display-trigger" } });
        permission(801, "allowed", "werewolf-game");
      } else if (rpc.id === 801) {
        outcomes.push(rpc.result.outcome);
        permission(802, "denied", "foreign-server");
      } else if (rpc.id === 802) {
        outcomes.push(rpc.result.outcome);
        await writeFile("permissions.json", JSON.stringify(outcomes));
        update({ sessionUpdate: "agent_thought_chunk", content: { type: "text", text: "after-display" } });
        send(promptText === "fail"
          ? { jsonrpc: "2.0", id: promptId, error: { code: -32603, message: "synthetic prompt failure" } }
          : { jsonrpc: "2.0", id: promptId, result: { stopReason: "end_turn" } });
      }
    }
  `,
  );
  const registry = new AcpTurnRegistry(bootstrapGame(sixPlayerMvpConfig).world);
  const factory = new AcpProcessClient({
    cwd,
    command: process.execPath,
    args: [script],
    ...callbacks,
    // 本反例只验证 ACP 的工具批准，不需要真实 MCP listener 或模型传输。
    mcpBridge: {
      serverName: "werewolf-game",
      serverEntrypoint: () => "unused.ts",
      createControl: () => ({
        async start(command, args) {
          return { name: "werewolf-game", command, args, env: [] };
        },
        bindSession() {},
        async close() {},
      }),
    },
  });
  return { cwd, registry, session: await factory.createSession({ actorId: 1, registry }) };
}

for (const mode of ["update", "end", "both"] as const)
  test(`${mode}: display errors do not prevent later MCP permissions or audit chunks and remain observable`, async () => {
    const displayError = new Error("display callback failed"),
      endError = new Error("end callback failed"),
      seen: unknown[] = [];
    let ends = 0;
    const f = await fixture({
      onUpdate({ update }) {
        seen.push(update);
        if (seen.length === 1 && mode !== "end") throw displayError;
      },
      onPromptEnd() {
        ends++;
        if (mode !== "update") throw endError;
      },
    });
    try {
      const error = await f.session.prompt("run").catch((error) => error);
      if (mode === "both") {
        expect(error).toBeInstanceOf(AggregateError);
        expect(error.errors).toEqual([displayError, endError]);
      } else expect(error).toBe(mode === "update" ? displayError : endError);
      expect(JSON.parse(await readFile(path.join(f.cwd, "permissions.json"), "utf8"))).toEqual([
        { outcome: "selected", optionId: "allow_session" },
        { outcome: "cancelled" },
      ]);
      expect(seen).toHaveLength(4);
      expect(ends).toBe(1);
      const trace = f.session.takeAuditTrace?.();
      expect(trace).toMatchObject({
        messages: ["display-trigger"],
        thoughts: ["after-display"],
      });
      expect(
        trace?.outputs?.filter((output) => output.type === "tool").map((output) => output.id),
      ).toEqual(["allowed", "denied"]);
    } finally {
      f.registry.close();
      await f.session.close({ force: true });
    }
  });

for (const endThrows of [false, true])
  test(`protocol failure returns before a hanging prompt and preserves end errors (${endThrows})`, async () => {
    const protocolError = new Error("update queue failed"),
      endError = new Error("flush failed");
    const f = await fixture({
      onPromptEnd() {
        if (endThrows) throw endError;
      },
    });
    const read = spyOn(ActiveSession.prototype, "nextUpdate").mockRejectedValueOnce(protocolError);
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      const result = await Promise.race([
        f.session.prompt("hang").catch((error) => error),
        new Promise<Error>((resolve) => {
          timeout = setTimeout(() => resolve(new Error("protocol failure was swallowed")), 1000);
        }),
      ]);
      if (endThrows) {
        expect(result).toBeInstanceOf(AggregateError);
        expect(result.errors).toEqual([protocolError, endError]);
      } else expect(result).toBe(protocolError);
    } finally {
      clearTimeout(timeout);
      read.mockRestore();
      f.registry.close();
      await f.session.close({ force: true });
    }
  });

test("prompt and display failures retain both causes after draining final updates", async () => {
  const displayError = new Error("display failure alongside prompt failure");
  let seen = 0;
  const f = await fixture({
    onUpdate() {
      if (++seen === 1) throw displayError;
    },
  });
  try {
    const error = await f.session.prompt("fail").catch((error) => error);
    expect(error).toBeInstanceOf(AggregateError);
    const flatten = (error: unknown): unknown[] =>
      error instanceof AggregateError ? error.errors.flatMap(flatten) : [error];
    const causes = flatten(error);
    expect(causes).toContain(displayError);
    expect(
      causes.some(
        (cause) => cause instanceof Error && cause.message.includes("synthetic prompt failure"),
      ),
    ).toBe(true);
    expect(f.session.takeAuditTrace?.().thoughts).toEqual(["after-display"]);
  } finally {
    f.registry.close();
    await f.session.close({ force: true });
  }
});
