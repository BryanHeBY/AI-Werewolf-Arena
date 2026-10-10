import { fixtureObject } from "../support/fixture_values";
/** Real ACP process with a private per-actor script, using only its injected game MCP. */
import { createInterface } from "node:readline";
import { readFile, writeFile } from "node:fs/promises";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { AcpMcpServerConfig } from "../../src/ai/integrations/acp/acp_mcp_bridge";
import type { ActorTransportPlan } from "../support/foundation_transport_plan";
import {
  assertTransportPrompt,
  assertTransportEvents,
  assertTransportIdentity,
} from "../support/transport_prompt_oracle";

const plan: ActorTransportPlan = JSON.parse(
  await readFile(process.argv[2] ?? process.env.AWA_TEST_PLAN_FILE!, "utf8"),
);
const trace = {
  agentPid: process.pid,
  mcpPid: 0,
  locale: "",
  prompts: [] as string[],
  submitted: 0,
  rejected: 0,
  consumed: 0,
  visibleSeerTargets: [] as number[],
  schemaChecked: false,
  initializationSeen: false,
  failure: "",
};
let client: Client | undefined;
const send = (value: unknown) => process.stdout.write(JSON.stringify(value) + "\n");
const save = () => writeFile("game-fixture.json", JSON.stringify(trace));
try {
  for await (const line of createInterface({ input: process.stdin })) {
    const request = JSON.parse(line);
    if (request.id === undefined) continue;
    if (request.method === "initialize")
      send({
        jsonrpc: "2.0",
        id: request.id,
        result: { protocolVersion: 1, agentCapabilities: {} },
      });
    else if (request.method === "session/new") {
      const config = request.params.mcpServers[0] as AcpMcpServerConfig;
      const env = Object.fromEntries(config.env.map((entry) => [entry.name, entry.value]));
      if (env.AWA_TASK_LOCALE !== plan.locale) throw new Error("fixture_mcp_locale_mismatch");
      trace.locale = env.AWA_TASK_LOCALE;
      client = new Client({ name: `synthetic-game-${plan.actorId}`, version: "1.0.0" });
      const transport = new StdioClientTransport({
        command: config.command,
        args: config.args,
        env,
      });
      await client.connect(transport);
      trace.mcpPid = transport.pid!;
      const schema = await client.callTool({ name: "get_game_schema", arguments: {} });
      const body = JSON.stringify(schema.structuredContent);
      if (plan.locale === "en" ? /[\u4e00-\u9fff]/.test(body) : !/[\u4e00-\u9fff]/.test(body))
        throw new Error("fixture_schema_locale_mismatch");
      trace.schemaChecked = true;
      await save();
      send({
        jsonrpc: "2.0",
        id: request.id,
        result: { sessionId: `game-fixture-${plan.actorId}` },
      });
    } else if (request.method === "session/prompt") {
      const prompt = String(request.params.prompt[0].text);
      trace.prompts.push(prompt);
      if (/(?:Current turn ID: |当前回合 ID：)t\d+/.test(prompt)) {
        const last = plan.turns.at(-1);
        const turn =
          plan.turns[
            last?.terminalFailure ? Math.min(trace.consumed, plan.turns.length - 1) : trace.consumed
          ];
        if (!turn) throw new Error("fixture_extra_turn");
        const turnId = assertTransportPrompt(plan, turn, prompt);
        const batch = prompt.split("\n").find((line) => line.includes('{"events":'));
        if (batch) {
          const events = JSON.parse(batch.slice(batch.indexOf('{"events":'))).events as Array<
            [number, string, Record<string, unknown>]
          >;
          assertTransportEvents(plan.eventRole ?? plan.role, events, plan.actorId);
          for (const [, type, payload] of events)
            if (type === "seer_checked") trace.visibleSeerTargets.push(payload.targetId as number);
        }
        trace.consumed++;
        for (const invalid of turn.invalidActions ?? []) {
          const result = await client!.callTool({
            name: "submit_action",
            arguments: { turn_id: turnId, action: invalid.name, arguments: invalid.args },
          });
          if (
            fixtureObject(result.structuredContent).ok !== false ||
            fixtureObject(result.structuredContent).error !==
              (turn.expectedInvalidError ?? "shoot_target")
          )
            throw new Error("fixture_invalid_action_not_rejected");
          trace.rejected++;
        }
        if (turn.terminalFailure === "late") {
          await save();
          await new Promise((resolve) => setTimeout(resolve, 1500));
        }
        if (turn.action) {
          const result = await client!.callTool({
            name: "submit_action",
            arguments: { turn_id: turnId, action: turn.action.name, arguments: turn.action.args },
          });
          if (
            fixtureObject(result.structuredContent).ok !== true ||
            fixtureObject(result.structuredContent).accepted !== true
          )
            throw new Error("fixture_submission_rejected");
          trace.submitted++;
        }
      } else {
        if (!prompt.includes(plan.locale === "en" ? "Use English" : "你必须使用中文"))
          throw new Error("fixture_initial_language_mismatch");
        if (plan.locale === "en" && /[\u4e00-\u9fff]/.test(prompt))
          throw new Error("fixture_initial_not_english");
        if (plan.expectedIdentityMarker && !prompt.includes(plan.expectedIdentityMarker))
          throw new Error("fixture_initial_identity_missing");
        if (plan.expectedName) {
          if (!prompt.includes(plan.expectedName)) throw new Error("fixture_persona_name_missing");
          if (plan.expectedPersona && !prompt.includes(plan.expectedPersona))
            throw new Error("fixture_persona_missing");
          if (plan.forbiddenPersonas?.some((marker) => prompt.includes(marker)))
            throw new Error("fixture_persona_cross_actor");
        }
        trace.initializationSeen = true;
        assertTransportIdentity(plan, prompt);
      }
      await save();
      send({ jsonrpc: "2.0", id: request.id, result: { stopReason: "end_turn" } });
    }
  }
} catch (error) {
  const message = error instanceof Error ? error.message : "";
  trace.failure = /^fixture_[a-zA-Z0-9_:]+$/.test(message) ? message : "fixture_failure";
  await save();
  throw new Error(trace.failure);
} finally {
  await client?.close();
}
