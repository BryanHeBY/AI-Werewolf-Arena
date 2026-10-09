import { expect, test } from "bun:test";
import path from "node:path";
import { readFile, writeFile } from "node:fs/promises";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { COMPONENT, DeathCause, Phase, Role, type GameEvent } from "../../../src/core";
import { sixPlayerMvpConfig } from "../../../src/runtime/scenarios/six_player_mvp";
import { createPlayerAgentRuntime } from "../../../src/runtime/player_agent_factory";
import { parseRuntimeConfig } from "../../../src/runtime/config/parse_config";
import { resolveAgentProfileByName } from "../../../src/runtime/config/resolve_game_setup";
import { grantDeathGun, armDeathGun } from "../../../src/game/mechanisms/roles/death_abilities";
import { DeathResolution } from "../../../src/game/engine/death_resolution";
import { EventRegistry } from "../../../src/game/engine/event_registry";
import { ToolGateway } from "../../../src/game/gateway/tool_gateway";
import { SessionRecordManager } from "../../../src/recording/session_recorder";
import { runWithSessionRecorder } from "../../../src/recording/recording_context";
import { createTestTempDirectory } from "../../support/temp_directory";
import type { ActorTransportPlan, PlannedTurn } from "../../support/foundation_transport_plan";
import { assertTransportPrompt } from "../../support/transport_prompt_oracle";

for (const locale of ["zh-CN", "en"] as const) for (const transport of ["llm", "acp"] as const) for (const scenario of ["double", "pass", "villager", "invalid"] as const) test(`${locale}/${transport}/${scenario}: actual runtime serializes separate native/gift stocks, bound prompts, records and MCP cleanup`, async () => {
  const root = await createTestTempDirectory("awa-gift-gun-runtime-"), actor = (scenario === "villager" || scenario === "invalid") ? 5 : 2;
  const roles = [Role.Wolf, Role.Hunter, Role.Seer, Role.Guard, Role.Villager, Role.Villager], board = { ...sixPlayerMvpConfig, roleSetups: [...new Set(roles)].map(role => ({ role, count: roles.filter(r => r === role).length })) }, game = bootstrapGame(board, { fixedRoles: roles, locale }), events: GameEvent[] = [];
  const gun = grantDeathGun(game.world, 3, actor, 1, events); armDeathGun(game.world, actor, gun, 1, events);
  const turns: PlannedTurn[] = [{ day: 1, stage: "last_words", action: { name: "speak", args: { text: "Original words" } } }];
  if (actor === 2) turns.push({ day: 1, stage: "hunter_shot", action: { name: "shoot", args: { target_id: scenario === "pass" ? null : 1 } } });
  turns.push({ day: 1, stage: "death_shot", action: { name: "shoot", args: { target_id: actor === 2 ? 5 : 1 } }, requiredPromptMarkers: [locale === "en" ? `This turn executes only the engine-bound ability ${gun.id}` : `本轮只执行引擎指定的能力 ${gun.id}`, locale === "en" ? `Gifted gun ${gun.id}: Effective` : `赠枪${gun.id}：已生效`] });
  if (scenario === "invalid") { const failed = { ...turns.at(-1)!, action: null, invalidActions: Array.from({ length: 3 }, () => ({ name: "shoot" as const, args: { target_id: 999 } })) }; turns[turns.length - 1] = failed; turns.push(structuredClone(failed), structuredClone(failed), structuredClone(failed)); }
  const plan: ActorTransportPlan = { actorId: actor, role: roles[actor - 1], locale, turns }, planFile = path.join(root, "plan.json"); await writeFile(planFile, JSON.stringify(plan));
  let consumed = 0; const replied = new Set<string>(); const failures: string[] = [], sdkPrompts: string[] = [];
  const server = transport === "llm" ? Bun.serve({ hostname: "127.0.0.1", port: 0, async fetch(request) {
    try {
      const body = await request.json() as any, turn = turns[consumed]; if (!turn) throw new Error("fixture_extra_turn");
      const prompt = [...body.messages].reverse().find((message: any) => message.role === "user" && typeof message.content === "string" && /(?:\[Action prompt\]|\[行动提示\])/.test(message.content))?.content;
      const turnId = assertTransportPrompt(plan, turn, prompt);
      if (replied.has(turnId)) return Response.json({ id: "gift-stop", object: "chat.completion", created: 1, model: "synthetic", choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content: "Stopped after refusals." } }], usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } });
      replied.add(turnId); sdkPrompts.push(prompt); consumed++;
      if (locale === "en") expect(JSON.stringify(body.messages)).not.toMatch(/\p{Script=Han}/u);
      const actions = turn.invalidActions ?? [turn.action!];
      return Response.json({ id: "gift-gun", object: "chat.completion", created: 1, model: "synthetic", choices: [{ index: 0, finish_reason: "tool_calls", message: { role: "assistant", content: null, tool_calls: actions.map((action, i) => ({ id: `gift-${consumed}-${i}`, type: "function", function: { name: "submit_action", arguments: JSON.stringify({ turn_id: turnId, action: action.name, arguments: action.args }) } })) } }], usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } });
    } catch (error) { failures.push(String(error)); return Response.json({ error: { message: "fixture_failure" } }, { status: 400 }); }
  } }) : undefined;
  const config = parseRuntimeConfig({ providers: { default: "provider", items: { provider: transport === "llm" ? { type: "openai", apiKey: "synthetic-only", baseURL: `${server!.url.origin}/v1` } : { type: "acp", transport: "stdio", command: process.execPath, args: [path.resolve(process.cwd(), "tests/fixtures/acp_game_agent.ts")] } } }, agents: { default: "actor", items: { actor: transport === "llm" ? { kind: "llm", provider: "provider", model: "synthetic" } : { kind: "acp", provider: "provider", spawnArgs: [planFile] } } }, game: { board: "synthetic", locale }, debugSummary: { agent: { enabled: false } } });
  const runtime = await createPlayerAgentRuntime({ world: game.world, boardConfig: board, profilesByActor: new Map([[actor, resolveAgentProfileByName(config)]]), acpWorkspaceRoot: path.join(root, "workspaces"), llmTimeoutMs: 3000, trace: false, colorizeLogs: false, printLlmIo: false, printThinking: false });
  const manager = await SessionRecordManager.create({ sessionId: `gift-${locale}-${transport}-${scenario}`, board: "synthetic", locale, startedAtIso: new Date(0).toISOString() }, path.join(root, "records"));
  try {
    await runWithSessionRecorder(manager, async () => { const run = new DeathResolution(game.world, events, new ToolGateway(), new EventRegistry(), { day: 1, phase: Phase.Day, gameOver: false, result: null }).resolve([actor], { [actor]: [DeathCause.WolfKill] }, runtime.provider, Phase.Night, Phase.Day); if (scenario === "invalid") await expect(run).rejects.toThrow("action_turn_failed"); else await run; });
  } finally { await runtime.close(); server?.stop(true); }
  const recording = await manager.finalize({ endedAtIso: new Date(1).toISOString(), winner: null, finishReason: "test", players: [] });
  expect(failures).toEqual([]); expect(gun).toMatchObject({ remaining: 0, disabled: true, deathExpired: true }); expect(game.world.activeDeathActionCount).toBe(0); expect(runtime.runtimeState.closed).toBe(true);
  expect(events.filter(event => event.type === "player_shot").map(event => event.payload)).toEqual(scenario === "invalid" ? [] : [{ actorId: actor, targetId: actor === 2 ? 5 : 1 }]);
  expect(events.filter(event => event.type === "hunter_shot").map(event => event.payload)).toEqual(scenario === "double" ? [{ hunterId: 2, targetId: 1 }] : []);
  const view = recording.playerViews.find(view => view.player_id === actor)!, logged = JSON.stringify(view);
  if (scenario === "invalid") { expect(game.world.getAliveEntityIds()).toContain(1); expect(logged).toContain("turn_invalid_action_limit"); expect(logged).not.toContain("transport_error"); }
  expect(logged).toContain(gun.id); expect(logged).not.toContain('"fallback_reason"');
  if (transport === "llm") { if (scenario === "invalid") { expect(consumed).toBeGreaterThanOrEqual(2); expect(consumed).toBeLessThanOrEqual(turns.length); } else expect(consumed).toBe(turns.length); expect(sdkPrompts.at(-1)).toContain(gun.id); }
  else {
    const trace = JSON.parse(await readFile(path.join(root, "workspaces", `player-${actor}`, "game-fixture.json"), "utf8"));
    if (scenario === "invalid") { expect(trace.consumed).toBeGreaterThanOrEqual(2); expect(trace.consumed).toBeLessThanOrEqual(turns.length); expect(trace.rejected).toBe(3 * (trace.consumed - 1)); } else { expect(trace.consumed).toBe(turns.length); expect(trace.rejected).toBe(0); } expect(trace.failure).toBe(""); expect(trace.schemaChecked).toBe(true);
    for (const pid of [trace.agentPid, trace.mcpPid]) { expect(Number.isSafeInteger(pid)).toBe(true); try { process.kill(pid, 0); throw new Error("acp_or_mcp_still_alive"); } catch (error) { expect((error as NodeJS.ErrnoException).code).toBe("ESRCH"); } }
  }
}, 20000);
