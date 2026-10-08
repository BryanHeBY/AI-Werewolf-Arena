/** Local protocol fixture: colliding wire IDs, real MCP, and owned descendants. */
import { createInterface } from "node:readline";
import { spawn } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const actor = Number(process.env.AWA_TEST_ACTOR ?? 1), mode = process.env.AWA_TEST_MODE ?? "normal";
const nested = mode === "stubborn" || mode === "init_hang" ? spawn(process.execPath, ["-e", 'process.on("SIGTERM",()=>{});setInterval(()=>{},1000)'], { stdio: "ignore" }) : undefined;
if (mode === "stubborn" || mode === "init_hang") process.on("SIGTERM", () => {});
const facts = { agentPid: process.pid, nestedPid: nested?.pid ?? 0, mcpPid: 0, locale: "", accepted: [] as unknown[] };
const save = () => writeFile("acp-owned.json", JSON.stringify(facts));
const send = (value: unknown) => process.stdout.write(JSON.stringify(value) + "\n");
let client: Client | undefined;
await save();
try {
  for await (const line of createInterface({ input: process.stdin })) {
    const rpc = JSON.parse(line); if (rpc.id === undefined) continue;
    if (rpc.method === "initialize") {
      if (mode === "init_hang") { await new Promise<never>(() => {}); continue; }
      send({ jsonrpc: "2.0", id: rpc.id, result: { protocolVersion: 1, agentCapabilities: {} } });
    } else if (rpc.method === "session/new") {
      const config = rpc.params.mcpServers[0], env = Object.fromEntries(config.env.map((item: any) => [item.name, item.value]));
      facts.locale = String(env.AWA_TASK_LOCALE);
      client = new Client({ name: "ownership-fixture", version: "1.0.0" });
      const transport = new StdioClientTransport({ command: config.command, args: config.args, env });
      await client.connect(transport); facts.mcpPid = transport.pid!; await save();
      // ACP session IDs are only unique within their own connection.
      send({ jsonrpc: "2.0", id: rpc.id, result: { sessionId: "shared-wire-session" } });
    } else if (rpc.method === "session/prompt") {
      if (process.env.AWA_TEST_LOGGING === "1") {
        for (const [sessionUpdate, fragments] of [["agent_thought_chunk", ["private-thought", "-delta"]], ["agent_message_chunk", ["raw-model", "-message"]]] as const) {
          for (const text of fragments) send({ jsonrpc: "2.0", method: "session/update", params: { sessionId: "shared-wire-session", update: { sessionUpdate, content: { type: "text", text } } } });
        }
      }
      const prompt = String(rpc.params.prompt[0].text), turn = /(?:Current turn ID: |当前回合 ID：)(t\d+)/.exec(prompt)?.[1];
      if (turn && mode === "stubborn") { send({ jsonrpc: "2.0", method: "session/update", params: { sessionId: "shared-wire-session", update: { sessionUpdate: "agent_message_chunk", content: { type: "text", text: "fixture_prompt_started" } } } }); await new Promise<never>(() => {}); continue; }
      if (turn) {
        const received = await client!.callTool({ name: "submit_action", arguments: { turn_id: turn, action: "speak", arguments: { text: `actor-${actor}` } } });
        facts.accepted.push(received.structuredContent); await save();
      }
      send({ jsonrpc: "2.0", id: rpc.id, result: { stopReason: "end_turn" } });
    }
  }
} finally { await client?.close(); nested?.kill("SIGKILL"); }
