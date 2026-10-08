import { expect, test } from "bun:test";
import { RuleError, type Locale } from "@ai-werewolf-arena/game-catalog";
import { dictionaries, errorMessage, placeholders, toolFailure } from "@ai-werewolf-arena/game-text";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { COMPONENT, Phase, PotionType, Role, type ToolCall, type RoleComponent, type AliveComponent, type VotingRightComponent } from "../../../src/core";
import { twelvePlayerStandardConfig } from "../../../src/runtime/scenarios/twelve_player_standard";
import { ToolGateway } from "../../../src/game/gateway/tool_gateway";
import { ActionValidator } from "../../../src/game/gateway/action_validator";
import { ToolValidationRuleRegistry } from "../../../src/game/mechanisms/validation/tool_validation_rule_registry";
import { getGuardState, getHunterState, getWitchState } from "../../../src/game/mechanisms/roles/private_state";
import { sixPlayerMvpConfig } from "../../../src/runtime/scenarios/six_player_mvp";
import { LlmActionProvider } from "../../../src/ai/agents/llm/llm_action_provider";
import { AiSdkClient } from "../../../src/ai/integrations/llm/ai_sdk_client";
import { AcpTurnRegistry } from "../../../src/ai/integrations/acp/acp_turn_registry";
import { WerewolfMcpControlServer } from "../../../src/ai/integrations/acp/werewolf_mcp_control";

const twelveRoles = [Role.Wolf, Role.Wolf, Role.Wolf, Role.Wolf, Role.Seer, Role.Witch, Role.Hunter, Role.Idiot, Role.Villager, Role.Villager, Role.Villager, Role.Villager];
const han = /[\u4e00-\u9fff]/;

test("every declared rule code has an explicit bilingual explanation", () => {
  expect(Object.isFrozen(RuleError)).toBe(true);
  expect(new Set(Object.values(RuleError)).size).toBe(Object.values(RuleError).length);
  for (const code of Object.values(RuleError)) {
    expect(errorMessage("zh-CN", code)).toMatch(han);
    expect(errorMessage("en", code)).not.toMatch(han);
    expect(errorMessage("en", code)).not.toContain("Tool call failed:"); // Reject missing translations, not a fallback pass.
  }
});

test("generic failure builders need no turn context and old error-only ACP callbacks gain a local explanation", () => {
  for (const [locale, dictionary] of Object.entries(dictionaries)) {
    for (const [key, value] of Object.entries(dictionary)) if (key.startsWith("error.")) expect(placeholders(value)).toEqual([]);
    const lang = locale as Locale;
    const generic = toolFailure(lang, "turn_id_mismatch");
    expect(generic).toMatchObject({ ok: false, error: "turn_id_mismatch" });
    expect(generic.message).toContain("turn_id"); if (lang === "en") expect(generic.message).not.toMatch(han);
    expect(toolFailure(lang, "unknown").message).toContain("unknown");
    const registry = new AcpTurnRegistry(bootstrapGame(sixPlayerMvpConfig, { locale: lang }).world, () => ({ ok: false, error: "invalid_report_bug_category" }));
    const turn = registry.openTurn({ actorId: 1, phase: Phase.Day, allowedTools: ["speak"], context: { day: 1, stage: "day_speech", visible_events: [] } }, "own-session");
    const report = registry.reportBug("own-session", { turn_id: turn.turnId, category: "flow", severity: "high", message: "Original report" });
    expect(report).toEqual({ ok: false, error: "invalid_report_bug_category", message: lang === "en" ? "Invalid report_bug.category. Use a category declared in the tool schema." : "report_bug.category无效；请使用工具schema声明的类别。" });
    registry.close();
  }
});

test("gateway refusals have language-neutral codes and never change private resources or state", () => {
  const cases: Array<{ actor: number; tool: ToolCall; code: string; phase?: Phase; prepare?: (game: ReturnType<typeof bootstrapGame>) => void }> = [
    { actor: 999, tool: { name: "speak", args: { text: "original" } }, code: "actor_missing" },
    { actor: 9, tool: { name: "speak", args: { text: "original" } }, code: "actor_dead", prepare: game => { game.world.getComponent<AliveComponent>(9, COMPONENT.Alive)!.alive = false; } },
    { actor: 6, tool: { name: "use_potion", args: { target_id: 6, potion_type: PotionType.Heal } }, code: "self_heal" },
    { actor: 6, tool: { name: "use_potion", args: { target_id: 9, potion_type: PotionType.Heal } }, code: "heal_unavailable", prepare: game => { getWitchState(game.world.getComponent<RoleComponent>(6, COMPONENT.Role))!.heal = 0; } },
    { actor: 6, tool: { name: "use_potion", args: { target_id: 9, potion_type: PotionType.Poison } }, code: "two_potions", prepare: game => { getWitchState(game.world.getComponent<RoleComponent>(6, COMPONENT.Role))!.healUsedThisNight = true; } },
    { actor: 6, tool: { name: "use_potion", args: { target_id: 999, potion_type: PotionType.Poison } }, code: "poison_target" },
    { actor: 5, tool: { name: "check_identity", args: { target_id: 999 } }, code: "check_target" },
    { actor: 7, tool: { name: "shoot", args: { target_id: 9 } }, code: "shoot_unavailable", prepare: game => { getHunterState(game.world.getComponent<RoleComponent>(7, COMPONENT.Role))!.canShoot = false; } },
    { actor: 8, tool: { name: "vote", args: { target_id: 1, abstain: false } }, code: "vote_right", prepare: game => { game.world.getComponent<VotingRightComponent>(8, COMPONENT.VotingRight)!.canVote = false; } },
    { actor: 1, tool: { name: "self_destruct", args: { reason: "raw original", confirm: true } }, code: "blast_phase", phase: Phase.Night },
    { actor: 9, tool: { name: "choose_direction", args: { direction: "clockwise" } }, code: "sheriff_direction_only" },
    { actor: 9, tool: { name: "report_bug", args: { category: "invalid", severity: "high", message: "original" } } as unknown as ToolCall, code: "invalid_report_bug_category" },
  ];
  // Functions are deliberately excluded from the private-state snapshot.
  const facts = (game: ReturnType<typeof bootstrapGame>) => game.world.entityIds().map(id => ({ id, state: structuredClone(game.world.getComponent<RoleComponent>(id, COMPONENT.Role)!.privateState), alive: game.world.getComponent<AliveComponent>(id, COMPONENT.Alive)?.alive, vote: { canVote: game.world.getComponent<VotingRightComponent>(id, COMPONENT.VotingRight)?.canVote, weight: game.world.getComponent<VotingRightComponent>(id, COMPONENT.VotingRight)?.weight } }));
  for (const item of cases) for (const locale of ["zh-CN", "en"] as const) {
    const game = bootstrapGame(twelvePlayerStandardConfig, { locale, fixedRoles: twelveRoles }); item.prepare?.(game);
    const before = facts(game);
    const result = new ToolGateway().validateAndSanitize(game.world, item.actor, item.tool, { phase: item.phase ?? (["use_potion", "check_identity", "guard"].includes(item.tool.name) ? Phase.Night : Phase.Day) });
    expect(result.ok).toBe(false); expect(result.error).toBe(item.code);
    expect(result.message).toBeDefined(); if (locale === "en") expect(result.message).not.toMatch(han);
    expect(facts(game)).toEqual(before);
  }
  for (const locale of ["zh-CN", "en"] as const) {
    const game = bootstrapGame(sixPlayerMvpConfig, { locale, fixedRoles: [Role.Wolf, Role.Seer, Role.Villager, Role.Wolf, Role.Guard, Role.Villager] });
    getGuardState(game.world.getComponent<RoleComponent>(5, COMPONENT.Role))!.lastTarget = 2;
    const rejected = new ToolGateway().validateAndSanitize(game.world, 5, { name: "guard", args: { target_id: 2, abstain: false } }, { phase: Phase.Night });
    expect(rejected.error).toBe("guard_repeat"); expect(getGuardState(game.world.getComponent<RoleComponent>(5, COMPONENT.Role))!.lastTarget).toBe(2);
  }
});

test("explicit injected rule errors stay raw; an empty custom error keeps its existing accept behavior", () => {
  for (const locale of ["zh-CN", "en"] as const) {
    const game = bootstrapGame(sixPlayerMvpConfig, { locale });
    const custom = new ToolGateway(new ActionValidator(new ToolValidationRuleRegistry({ speak: () => "自定规则 {id}" })));
    expect(custom.validateAndSanitize(game.world, 1, { name: "speak", args: { text: "raw" } }, { phase: Phase.Day })).toEqual({ ok: false, error: "custom_rule_error", message: "自定规则 {id}" });
    const shaped = new ToolGateway(new ActionValidator(new ToolValidationRuleRegistry({ speak: () => "guard_repeat" })));
    expect(shaped.validateAndSanitize(game.world, 1, { name: "speak", args: { text: "raw" } }, { phase: Phase.Day })).toEqual({ ok: false, error: "custom_rule_error", message: "guard_repeat" });
    const empty = new ToolGateway(new ActionValidator(new ToolValidationRuleRegistry({ speak: () => "" })));
    expect(empty.validateAndSanitize(game.world, 1, { name: "speak", args: { text: "raw" } }, { phase: Phase.Day }).ok).toBe(true);
  }
});

for (const locale of ["zh-CN", "en"] as const) test(`actual SDK ${locale} corrects stale turn and unavailable potion from structured refusal`, async () => {
  const requests: any[] = [];
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, async fetch(input) {
    requests.push(await input.json());
    const calls = requests.length === 1 ? [
      { turn_id: "t99", action: "use_potion", arguments: { target_id: 6, potion_type: "none" } },
      { turn_id: "t1", action: "use_potion", arguments: { target_id: 9, potion_type: "heal" } },
    ] : [{ turn_id: "t1", action: "use_potion", arguments: { target_id: 6, potion_type: "none" } }];
    return Response.json({ id: "rejection-test", object: "chat.completion", created: 1, model: "test", choices: [{ index: 0, finish_reason: "tool_calls", message: { role: "assistant", content: null, tool_calls: calls.map((args, index) => ({ id: `call-${requests.length}-${index}`, type: "function", function: { name: "submit_action", arguments: JSON.stringify(args) } })) } }], usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } });
  } });
  const game = bootstrapGame(twelvePlayerStandardConfig, { locale, fixedRoles: twelveRoles });
  const witch = getWitchState(game.world.getComponent<RoleComponent>(6, COMPONENT.Role))!; witch.heal = 0;
  const before = structuredClone(witch);
  const provider = new LlmActionProvider(game.world, new AiSdkClient({ apiKey: "synthetic", baseURL: `${server.url.origin}/v1`, model: "test" }), { boardConfig: twelvePlayerStandardConfig, llmTimeoutMs: 2000, fallbackProvider: { async getAction() { throw new Error("unexpected_fallback"); } } });
  try {
    expect(await provider.getAction({ actorId: 6, phase: Phase.Night, allowedTools: ["use_potion"], context: { day: 1, stage: "witch", wolf_target: 9, visible_events: [], turn_constraints: { min_valid_actions: 1, max_valid_actions: 1 } } })).toEqual({ name: "use_potion", args: { target_id: 6, potion_type: "none" } });
    expect(requests.length).toBe(2);
    const replies = requests[1].messages.filter((message: any) => message.role === "tool").map((message: any) => JSON.parse(message.content));
    expect(replies.map((reply: any) => reply.error)).toEqual(["turn_id_mismatch", "heal_unavailable"]);
    expect(replies[0]).toMatchObject({ ok: false, expected_turn_id: "t1", received_turn_id: "t99" });
    expect(replies[1]).toEqual({ ok: false, error: "heal_unavailable", message: locale === "en" ? "Invalid action: antidote unavailable" : "非法操作，解药不可用" });
    if (locale === "en") expect(JSON.stringify(replies)).not.toMatch(han);
    expect(witch).toEqual(before);
  } finally { server.stop(true); }
});

for (const locale of ["zh-CN", "en"] as const) test(`loopback ${locale} rejects unauthorized and malformed requests without returning internal exceptions`, async () => {
  const registry = new AcpTurnRegistry(bootstrapGame(sixPlayerMvpConfig, { locale }).world); const control = new WerewolfMcpControlServer(registry);
  const config = await control.start(process.execPath, []); const env = Object.fromEntries(config.env.map(entry => [entry.name, entry.value]));
  try {
    const unauth = await fetch(`${env.WEREWOLF_MCP_CONTROL_URL}/invoke`, { method: "POST", body: "{}" });
    expect(unauth.status).toBe(401);
    const body = await unauth.json(); expect(body).toEqual({ ok: false, error: "unauthorized", message: locale === "en" ? "Control plane authorization failed." : "控制面认证失败。" });
    control.bindSession("own-session");
    const malformed = await fetch(`${env.WEREWOLF_MCP_CONTROL_URL}/invoke`, { method: "POST", headers: { authorization: `Bearer ${env.WEREWOLF_MCP_TOKEN}` }, body: '{"synthetic-private-value":' });
    expect(malformed.status).toBe(400);
    const failure = await malformed.json(); expect(failure.error).toBe("invalid_mcp_control_request"); expect(JSON.stringify(failure)).not.toContain("synthetic-private-value");
    if (locale === "en") expect(failure.message).not.toMatch(han);
  } finally { registry.close(); await control.close({ force: true }); }
});
