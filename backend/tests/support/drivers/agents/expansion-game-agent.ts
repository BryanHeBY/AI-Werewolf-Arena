/**
 * 负责新扩展角色的本地合成ACP/MCP真实协议测试；输入私有玩家计划，输出协议回执及工作区trace。
 * 沿用冻结game-agent的协议/清理流程，仅显式接入新事实oracle；旧fixture及声明保持原字节。
 * 这是可维护的当前测试驱动，不调用付费模型、不读个人认证，真实库存与动作仍由正式引擎处理。
 */
import { fixtureObject } from "../../oracles/fixture-values";
/** 每个进程只读自己的计划，并只访问引擎注入的本局MCP。 */
import { createInterface } from "node:readline";
import { readFile, writeFile } from "node:fs/promises";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { AcpMcpServerConfig } from "../../../../src/adapters/acp/acp-mcp-bridge";
import type { ActorTransportPlan } from "../../transport/contracts";
import {
  assertSubmitActionWireSchema,
  type MistWireState,
} from "../../features/mist-raven/oracles/transport";
import {
  assertTransportPrompt,
  assertTransportIdentity,
} from "../../oracles/transport/observations";

import { assertExpansionTransportEvents as assertTransportEvents } from "../../oracles/transport/expansion-observations";

const plan: ActorTransportPlan = JSON.parse(
  await readFile(process.argv[2] ?? process.env.AWA_TEST_PLAN_FILE!, "utf8"),
);
const trace = {
  agentPid: process.pid,
  mcpPid: 0,
  controlUrl: "",
  controlToken: "",
  locale: "",
  prompts: [] as string[],
  arrivals: [] as Array<{
    day: number;
    stage: string;
    actorOrdinal: number;
    turnId: string;
    arrivedAtMs: number;
    terminalFailure?: string;
  }>,
  submitted: 0,
  rejected: 0,
  consumed: 0,
  visibleSeerTargets: [] as number[],
  schemaChecked: false,
  activeSchemas: [] as Array<{ actorOrdinal: number; body: unknown }>,
  initializationSeen: false,
  failure: "",
};
const wireState: MistWireState = {};
let client: Client | undefined;
const send = (value: unknown) => process.stdout.write(JSON.stringify(value) + "\n");
const save = () => writeFile("game-fixture.json", JSON.stringify(trace), { mode: 0o600 });
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
      trace.controlUrl = env.WEREWOLF_MCP_CONTROL_URL;
      trace.controlToken = env.WEREWOLF_MCP_TOKEN;
      client = new Client({ name: `synthetic-game-${plan.actorId}`, version: "1.0.0" });
      const transport = new StdioClientTransport({
        command: config.command,
        args: config.args,
        env,
      });
      await client.connect(transport);
      trace.mcpPid = transport.pid!;
      if (plan.mistWire || plan.verifyGameWire) {
        const listed = await client.listTools();
        assertSubmitActionWireSchema(
          listed.tools.find((t) => t.name === "submit_action")?.inputSchema,
        );
        if (plan.locale === "en" && /[\u4e00-\u9fff]/.test(JSON.stringify(listed.tools)))
          throw new Error("fixture_tool_schema_locale_mismatch");
      }
      const schema = await client.callTool({ name: "get_game_schema", arguments: {} });
      const calibration = schema.structuredContent as Record<string, unknown> | undefined;
      // session/new尚未绑定会话：session_not_ready证明认证通过，unauthorized不得用于校准所有权。
      if (
        schema.isError &&
        (calibration?.ok !== false || calibration?.error !== "session_not_ready")
      )
        throw new Error("fixture_control_owner_calibration_failed");
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
        wireState.currentDay = turn.day;
        wireState.currentRequestOrdinal = plan.turns.indexOf(turn) + 1;
        const turnId = assertTransportPrompt(plan, turn, prompt);
        trace.arrivals.push({
          day: turn.day,
          stage: turn.stage,
          actorOrdinal: plan.turns.indexOf(turn) + 1,
          turnId,
          arrivedAtMs: Date.now(),
          terminalFailure: turn.terminalFailure,
        });
        if (plan.verifyGameWire) {
          const schema = await client!.callTool({ name: "get_game_schema", arguments: {} });
          if (schema.isError) throw Error("fixture_active_schema_failed");
          trace.activeSchemas.push({
            actorOrdinal: plan.turns.indexOf(turn) + 1,
            body: schema.structuredContent,
          });
        }
        const batch = prompt.split("\n").find((line) => line.includes('{"events":'));
        if (batch) {
          const events = JSON.parse(batch.slice(batch.indexOf('{"events":'))).events as Array<
            [number, string, Record<string, unknown>]
          >;
          assertTransportEvents(
            plan.eventRole ?? plan.role,
            events,
            plan.actorId,
            plan.mistWire,
            wireState,
          );
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
        if (turn.terminalFailure === "late" || turn.responseDelayMs) {
          await save();
          await new Promise((resolve) =>
            setTimeout(resolve, turn.terminalFailure === "late" ? 2200 : turn.responseDelayMs),
          );
        }
        if (turn.action) {
          let result = await client!.callTool({
            name: "submit_action",
            arguments: { turn_id: turnId, action: turn.action.name, arguments: turn.action.args },
          });
          const proposal = fixtureObject(result.structuredContent);
          if (proposal.status === "confirmation_required") {
            if (
              proposal.accepted !== false ||
              proposal.applied !== false ||
              typeof proposal.confirmation_id !== "string" ||
              typeof proposal.warning !== "string"
            )
              throw new Error("fixture_confirmation_invalid");
            result = await client!.callTool({
              name: "submit_action",
              arguments: {
                turn_id: turnId,
                action: turn.action.name,
                arguments: turn.action.args,
                confirmation_id: proposal.confirmation_id,
              },
            });
          }
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
