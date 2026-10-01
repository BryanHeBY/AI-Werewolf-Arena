import { describe, expect, test } from "bun:test";
import { promises as fs } from "node:fs";
import * as path from "node:path";
import { AcpProcessClient } from "../../../src/ai/integrations/acp/acp_process_client";
import { AcpTurnRegistry } from "../../../src/ai/integrations/acp/acp_turn_registry";
import { createTestTempDirectory } from "../../support/temp_directory";

describe("AcpProcessClient initialization deadlines", () => {
  test("terminates a real child when ACP initialization never responds", async () => {
    const root = await createTestTempDirectory("awa-acp-init-timeout-");
    const pidFile = path.join(root, "agent.pid");
    const client = new AcpProcessClient({
      command: process.execPath,
      args: [
        "-e",
        `require("node:fs").writeFileSync(${JSON.stringify(pidFile)}, String(process.pid)); setInterval(() => {}, 1000);`,
      ],
      cwd: root,
      initializeTimeoutMs: 500,
    });

    const startedAt = Date.now();
    await expect(client.createSession({
      actorId: 1,
      registry: new AcpTurnRegistry(),
    })).rejects.toBeDefined();
    expect(Date.now() - startedAt).toBeLessThan(5_000);

    const pid = Number(await fs.readFile(pidFile, "utf8"));
    expect(() => process.kill(pid, 0)).toThrow();
  });
});

test("drains final ACP chunks on success, failure and forced closure", async () => {
  const root = await createTestTempDirectory("awa-acp-stream-");
  const script = path.join(root, "agent.ts");
  await fs.writeFile(script, `
    import { createInterface } from "node:readline";
    const send = value => process.stdout.write(JSON.stringify(value) + "\\n");
    for await (const line of createInterface({ input: process.stdin })) {
      const request = JSON.parse(line);
      if (request.id === undefined) continue;
      if (request.method === "initialize") {
        send({ jsonrpc: "2.0", id: request.id, result: { protocolVersion: 1, agentCapabilities: {} } });
      } else if (request.method === "session/new") {
        send({ jsonrpc: "2.0", id: request.id, result: { sessionId: "stream-test" } });
      } else if (request.method === "session/prompt") {
        for (const text of ["最", "后", "片段"]) {
          send({ jsonrpc: "2.0", method: "session/update", params: {
            sessionId: "stream-test", update: { sessionUpdate: "agent_message_chunk", content: { type: "text", text } }
          } });
        }
        if (request.params.prompt[0].text === "hang") continue;
        if (request.params.prompt[0].text === "fail") {
          send({ jsonrpc: "2.0", id: request.id, error: { code: -32603, message: "test failure" } });
        } else {
          send({ jsonrpc: "2.0", id: request.id, result: { stopReason: "end_turn" } });
        }
      }
    }
  `);
  const updates: string[] = [];
  let onLastChunk: (() => void) | undefined;
  const client = new AcpProcessClient({
    command: process.execPath, args: [script], cwd: root,
    onUpdate: ({ update }) => {
      const text = (update as { content: { text: string } }).content.text;
      updates.push(text);
      if (text === "片段") onLastChunk?.();
    },
    onPromptEnd: actorId => updates.push(`end:${actorId}`),
  });
  const session = await client.createSession({ actorId: 11, registry: new AcpTurnRegistry() });
  try {
    await session.prompt("ok");
    expect(updates).toEqual(["最", "后", "片段", "end:11"]);
    expect(session.takeAuditTrace?.().messages).toEqual(["最后片段"]);
    updates.length = 0;
    await expect(session.prompt("fail")).rejects.toBeDefined();
    expect(updates).toEqual(["最", "后", "片段", "end:11"]);
    updates.length = 0;
    const lastChunk = new Promise<void>(resolve => { onLastChunk = resolve; });
    const pending = session.prompt("hang").then(() => false, () => true);
    await lastChunk;
    await session.close({ force: true });
    expect(await pending).toBe(true);
    expect(updates).toEqual(["最", "后", "片段", "end:11"]);
  } finally {
    await session.close();
  }
});
