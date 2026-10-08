import { expect, test } from "bun:test";
import path from "node:path";
import { readFile, writeFile } from "node:fs/promises";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { COMPONENT, Camp, Role, type GameEvent, type RoleComponent } from "../../../src/core";
import { sixPlayerMvpConfig } from "../../../src/runtime/scenarios/six_player_mvp";
import { grantNightAbility } from "../../../src/game/mechanisms/roles/ability_changes";
import { allNightAbilities } from "../../../src/game/mechanisms/roles/abilities";
import { NightPipeline } from "../../../src/game/engine/phase_pipeline/night_pipeline";
import { ToolGateway } from "../../../src/game/gateway/tool_gateway";
import { DamageResolutionSystem } from "../../../src/core/domain/systems/damage_resolution_system";
import { BaselineBotActionProvider } from "../../../src/ai/agents/providers/action_providers";
import { createPlayerAgentRuntime } from "../../../src/runtime/player_agent_factory";
import type { ResolvedAgentRuntimeProfile } from "../../../src/runtime/config/contracts";
import { createTestTempDirectory } from "../../support/temp_directory";

for (const locale of ["zh-CN", "en"] as const) for (const kind of ["llm", "acp"] as const)
  test(`${locale}/${kind}: a Villager's granted inspection crosses the actual transport and is applied only to its bound instance`, async () => {
    const root = await createTestTempDirectory("awa-granted-transport-"), events: GameEvent[] = [], messages: any[] = [];
    const { world } = bootstrapGame(sixPlayerMvpConfig, { locale, fixedRoles: [Role.Wolf, Role.Wolf, Role.Seer, Role.Guard, Role.Villager, Role.Villager] });
    grantNightAbility(world, 5, { id: "gift:transport", kind: "seer_check", state: { lastTarget: null, lastIsWerewolf: null, lastResult: null, history: [] }, source: { kind: "gift", actorId: 3 }, startsOnDay: 1, maxUses: 1 }, events);
    const planFile = path.join(root, "plan.json");
    await writeFile(planFile, JSON.stringify({ actorId: 5, role: "villager", locale, turns: [{ day: 1, stage: "seer", action: { name: "check_identity", args: { target_id: 1 } } }] }));
    const server = kind === "llm" ? Bun.serve({ hostname: "127.0.0.1", port: 0, async fetch(request) {
      const body = await request.json() as any; messages.push(...body.messages);
      expect(body.messages.at(-1).content).toContain("gift:transport");
      const turn = /turn_id (?:must be|必须为) (t\d+)/.exec(body.messages.at(-1).content)![1];
      return Response.json({ id: "granted", object: "chat.completion", created: 1, model: "synthetic", choices: [{ index: 0, finish_reason: "tool_calls", message: { role: "assistant", content: null, tool_calls: [{ id: "call", type: "function", function: { name: "submit_action", arguments: JSON.stringify({ turn_id: turn, action: "check_identity", arguments: { target_id: 1 } }) } }] } }], usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } });
    } }) : undefined;
    const profile: ResolvedAgentRuntimeProfile = kind === "llm" ? { name: "synthetic", providerName: "synthetic", kind, model: "synthetic", provider: { type: "openai", apiKey: "synthetic-only", baseURL: `${server!.url.origin}/v1` } } : { name: "synthetic", providerName: "synthetic", kind, provider: { type: "acp", transport: "stdio", command: process.execPath, args: [path.resolve(process.cwd(), "tests/fixtures/acp_game_agent.ts"), planFile] } };
    const workspace = path.join(root, "workspace");
    const runtime = await createPlayerAgentRuntime({ world, boardConfig: sixPlayerMvpConfig, profilesByActor: new Map([[5, profile]]), acpWorkspaceRoot: workspace, llmTimeoutMs: 3000, printLlmIo: false, printThinking: false, trace: false, displayLocale: locale, colorizeLogs: false });
    try {
      const pipeline = new NightPipeline({ world, events, toolGateway: new ToolGateway(), damageResolutionSystem: new DamageResolutionSystem() });
      await pipeline.execute(sixPlayerMvpConfig, { getAction: request => request.actorId === 5 ? runtime.provider.getAction(request) : new BaselineBotActionProvider(world).getAction(request) }, 1);
      const ability = allNightAbilities(world.getComponent<RoleComponent>(5, COMPONENT.Role))[0];
      expect(ability.uses).toBe(1); expect(ability.lastUsedDay).toBe(1);
      expect(events.filter(event => event.type === "seer_checked" && event.payload.actorId === 5).map(event => event.payload)).toEqual([{ actorId: 5, abilityId: "gift:transport", targetId: 1, isWerewolf: true, result: { kind: "camp", camp: "wolf" } }]);
      expect(world.getComponent<RoleComponent>(5, COMPONENT.Role)).toMatchObject({ role: Role.Villager, camp: Camp.Good });
      await runtime.close();
      if (kind === "llm") {
        const visible = messages.filter(message => typeof message.content === "string" && message.content.startsWith('{"event":')).map(message => JSON.parse(message.content).event);
        expect(visible.find(([, type]: any) => type === "ability_changed")[2].source).toEqual({ kind: "gift" });
      } else {
        const facts = JSON.parse(await readFile(path.join(workspace, "player-5", "game-fixture.json"), "utf8"));
        expect(facts.failure).toBe(""); expect(facts.consumed).toBe(1); expect(facts.submitted).toBe(1);
        expect(facts.prompts.at(-1)).toContain("gift:transport");
        for (const pid of [facts.agentPid, facts.mcpPid]) expect(() => process.kill(pid, 0)).toThrow();
      }
    } finally { await runtime.close(); server?.stop(true); }
  }, 15000);
