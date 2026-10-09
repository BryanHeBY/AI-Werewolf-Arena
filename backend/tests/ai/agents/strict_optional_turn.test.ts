import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { COMPONENT, Phase, Role, type GameEvent, type RoleComponent } from "../../../src/core";
import { LlmActionProvider } from "../../../src/ai/agents/llm/llm_action_provider";
import { AcpActionProvider } from "../../../src/ai/agents/acp/acp_action_provider";
import { GameActionRequestFactory } from "../../../src/game/engine/action_request_factory";
import { getDefaultRoleCatalog } from "../../../src/game/mechanisms/roles/catalog";
import { AWAKENED_NIGHT_STAGES } from "../../../src/game/mechanisms/roles/awakened_hidden_wolf/night_stages";
import { getAwakenedState } from "../../../src/game/mechanisms/roles/awakened_hidden_wolf/state";
import { ToolGateway } from "../../../src/game/gateway/tool_gateway";
import { sixPlayerMvpConfig } from "../../../src/runtime/scenarios/six_player_mvp";
import type { NightStageContext } from "../../../src/game/mechanisms/stages/night/contracts";

const modes = ["clean_wait", "correct_after_one", "correct_after_two", "reject3", "valid_fourth", "malformed3", "transport_failure"] as const;
for (const transport of ["sdk", "acp"] as const) for (const locale of ["zh-CN", "en"] as const) for (const mode of modes) test(`${transport}/${locale}/${mode}: strict optional turns distinguish intentional waiting from failure`, async () => {
  const roles = [Role.AwakenedHiddenWolf, Role.Wolf, Role.MirrorGirl, Role.Witch, Role.Guard, Role.Villager];
  const config = { ...sixPlayerMvpConfig, roleSetups: roles.map(role => ({ role, count: 1 })) }, game = bootstrapGame(config, { fixedRoles: roles, locale });
  const events: GameEvent[] = [], denials: any[] = [], factory = new GameActionRequestFactory(game.world, events, 1); let fallbackCalls = 0, closes = 0;
  const fallbackProvider = { async getAction() { fallbackCalls++; return null; } };
  const submissions = async (submit: (args: any) => Promise<any> | any) => {
    const count = mode === "correct_after_one" ? 1 : mode === "correct_after_two" ? 2 : ["reject3", "valid_fourth", "malformed3"].includes(mode) ? 3 : 0;
    for (let i = 0; i < count; i++) denials.push(await submit(mode === "malformed3" ? { turn_id: "t1", action: "awakened_mimic" } : { turn_id: "t1", action: "awakened_mimic", arguments: { target_id: 1 } }));
    if (["correct_after_one", "correct_after_two", "valid_fourth"].includes(mode)) return submit({ turn_id: "t1", action: "awakened_mimic", arguments: { target_id: 3 } });
  };
  const client: any = { async chat() { throw new Error("unexpected_chat"); }, async runToolLoop(_messages: any, _tools: any, callbacks: any) {
    if (mode === "transport_failure") throw new Error("synthetic_transport_failure");
    const result = await submissions(async args => {
      const result = await callbacks.onToolCall({ name: "submit_action", args }); return { ...result.toolResult, finalAction: result.finalAction };
    });
    return { finalAction: result?.finalAction ?? null, assistantText: "Synthetic end" };
  } };
  const provider = transport === "sdk" ? new LlmActionProvider(game.world, client, { boardConfig: config, fallbackProvider, maxConcurrentRequests: 1, llmTimeoutMs: 1500 }) : new AcpActionProvider(game.world, {
    boardConfig: config, fallbackProvider, maxConcurrentRequests: 1, turnTimeoutMs: 1500, sessionFactory: { async createSession(input) {
      if (mode === "transport_failure") throw new Error("synthetic_transport_failure");
      return { sessionId: "strict-optional", async prompt() { await submissions(args => input.registry.submitAction("strict-optional", args)); }, async cancel() {}, async close() { closes++; } };
    } },
  });
  const ctx = { world: game.world, roleCatalog: getDefaultRoleCatalog(), toolGateway: new ToolGateway(), events, isCurrent: () => true, currentDay: () => 1, state: {}, actionProvider: provider,
    makeRequest: (actorId, allowedTools, extra) => { const { stage, requiresAction, ...context } = extra; return factory.create({ actorId, phase: Phase.Night, allowedTools, stage, requiresAction, context, summary: { key: "request.summary.night_action" } }); },
  } as NightStageContext;
  await AWAKENED_NIGHT_STAGES.find(stage => stage.id === "awakened_opening")!.execute(ctx);
  const action = () => AWAKENED_NIGHT_STAGES.find(stage => stage.id === "awakened_mimic")!.execute(ctx);
  try {
    const success = ["clean_wait", "correct_after_one", "correct_after_two"].includes(mode);
    if (success) await action(); else await expect(action()).rejects.toThrow("action_turn_failed");
    const state = getAwakenedState(game.world.getComponent<RoleComponent>(1, COMPONENT.Role))!;
    expect(fallbackCalls).toBe(0);
    if (mode === "clean_wait") { expect(state.learned).toBeNull(); expect(state.mimicClosedDay).toBe(1); expect(events.map(e => e.type)).toEqual(["awakened_mimic_skipped"]); }
    else if (success) { expect(state.learned).toMatchObject({ targetId: 3, role: "mirror_girl", activationNight: null }); expect(events.map(e => e.type)).toEqual(["awakened_mimicked"]); }
    else { expect(state.learned).toBeNull(); expect(state.mimicClosedDay).toBeNull(); expect(events).toEqual([]); }
    expect(denials.every(result => result.ok === false)).toBe(true);
  } finally { await provider.close(); }
  if (transport === "acp") expect(closes).toBe(mode === "transport_failure" ? 0 : 1);
});
