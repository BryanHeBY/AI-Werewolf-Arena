import { completedNight } from "../night_stage_fixture";
import { PotionType } from "../../../src/core";
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { COMPONENT, Camp, Phase, Role, StatusMark, DeathCause, WitchSelfHealRule, type ActionRequest, type GameEvent, type RoleComponent, type StatusMarksComponent } from "../../../src/core";
import { twelvePlayerStandardConfig } from "../../../src/runtime/scenarios/twelve_player_standard";
import { sixPlayerMvpConfig } from "../../../src/runtime/scenarios/six_player_mvp";
import { getWitchState, getHunterState } from "../../../src/game/mechanisms/roles/private_state";
import { ActionReception, ActionTurn } from "../../../src/ai/agents/player/action_reception";
import { ToolGateway } from "../../../src/game/gateway/tool_gateway";
import { DamageResolutionSystem } from "../../../src/core/domain/systems/damage_resolution_system";
import { NightPipeline } from "../../../src/game/engine/phase_pipeline/night_pipeline";
import { BaselineBotActionProvider } from "../../../src/ai/agents/providers/action_providers";
import { grantNightAbility } from "../../../src/game/mechanisms/roles/ability_changes";
import { hunterDeathHook } from "../../../src/game/mechanisms/roles/hunter/death_hook";
import { buildAgentVisibleEventFeed } from "../../../src/game/engine/agent_visible_event_feed";
import { PlayerPromptPolicy } from "../../../src/ai/agents/player/player_prompt_policy";
import { getDefaultRoleCatalog, getDefaultToolSpecRegistry, getDefaultTargetHintRegistry, getDefaultConfigRenderRegistry, getDefaultPhaseStageLocalizationRegistry } from "../../../src/game/mechanisms";
import { text } from "@ai-werewolf-arena/game-text";

const roles12 = [Role.Wolf, Role.Wolf, Role.Wolf, Role.Wolf, Role.Seer, Role.Witch, Role.Hunter, Role.Idiot, Role.Villager, Role.Villager, Role.Villager, Role.Villager];
const fixture = (locale: "zh-CN" | "en") => bootstrapGame(twelvePlayerStandardConfig, { locale, fixedRoles: roles12 });
const role = (world: ReturnType<typeof fixture>["world"], id: number) => world.getComponent<RoleComponent>(id, COMPONENT.Role)!;
const marks = (world: ReturnType<typeof fixture>["world"], id: number) => world.getComponent<StatusMarksComponent>(id, COMPONENT.StatusMarks)!;
const request: ActionRequest = { actorId: 6, phase: Phase.Night, allowedTools: ["use_potion"], context: { day: 1, stage: "witch", ability_id: "native:potion", wolf_target: 9, visible_events: [], turn_constraints: { min_valid_actions: 1, max_valid_actions: 1 } } };

for (const locale of ["zh-CN", "en"] as const) test(`${locale}: only the living current marked wolf target is healable; rejected calls keep the turn and resources intact`, () => {
  const { world } = fixture(locale), potion = getWitchState(role(world, 6))!, receive = new ActionReception(world), turn = new ActionTurn(receive, request, "t1");
  marks(world, 9).add(StatusMark.WolfKillMark);
  const before = structuredClone(role(world, 6).privateState);
  for (const target of [999, 10]) {
    expect(turn.submit("t1", "use_potion", { target_id: target, potion_type: PotionType.Heal })).toMatchObject({ ok: false, error: "heal_target" });
    expect(role(world, 6).privateState).toEqual(before); expect(turn.action).toBeNull();
  }
  world.getComponent<{ alive: boolean }>(9, COMPONENT.Alive)!.alive = false;
  expect(turn.submit("t1", "use_potion", { target_id: 9, potion_type: PotionType.Heal })).toMatchObject({ ok: false, error: "heal_target" });
  world.getComponent<{ alive: boolean }>(9, COMPONENT.Alive)!.alive = true;
  expect(turn.submit("t1", "use_potion", { target_id: 9, potion_type: PotionType.Heal })).toEqual({ ok: true, accepted: true, applied: false, action: "use_potion" });
  expect(potion.heal).toBe(1); // Reception never applies or spends.
  marks(world, 9).remove(StatusMark.WolfKillMark);
  expect(new ToolGateway().validateAndSanitize(world, 6, turn.action!, { phase: Phase.Night, day: 1, abilityId: "native:potion" })).toMatchObject({ ok: false, error: "heal_target" });
  expect(role(world, 6).privateState).toEqual(before);
  // A forged visible context cannot create a real knife.
  expect(receive.validate(request, "use_potion", { target_id: 9, potion_type: PotionType.Heal })).toMatchObject({ ok: false, error: "heal_target" });
});

for (const locale of ["zh-CN", "en"] as const) test(`${locale}: an exhausted antidote removes the knife from requests and prompts but preserves legitimate past knowledge`, async () => {
  const { world } = fixture(locale), events: GameEvent[] = [], requests: ActionRequest[] = [], rejectionCodes: string[] = [];
  const pipeline = new NightPipeline({ world, events, toolGateway: new ToolGateway(), damageResolutionSystem: new DamageResolutionSystem() });
  const provider = { async getAction(input: ActionRequest) {
    if (input.context.stage === "wolf_vote") return { name: "kill_vote" as const, args: { target_id: input.context.day === 1 ? 9 : 10, abstain: false } };
    if (input.actorId === 6 && input.context.stage === "witch") {
      requests.push(structuredClone(input));
      if (input.context.day === 2) for (const target of [9, 10, 999]) {
        const receipt = new ActionReception(world).validate(input, "use_potion", { target_id: target, potion_type: PotionType.Heal });
        rejectionCodes.push(receipt.ok ? "accepted" : receipt.error);
      }
      return { name: "use_potion" as const, args: { target_id: input.context.day === 1 ? 9 : 6, potion_type: input.context.day === 1 ? PotionType.Heal as const : PotionType.None as const } };
    }
    return new BaselineBotActionProvider(world).getAction(input);
  } };
  await pipeline.execute(twelvePlayerStandardConfig, provider, 1);
  expect(requests[0].context.wolf_target).toBe(9); expect(getWitchState(role(world, 6))!.heal).toBe(0);
  await pipeline.execute(twelvePlayerStandardConfig, provider, 2);
  expect(Object.hasOwn(requests[1].context, "wolf_target")).toBe(false);
  const policy = new PlayerPromptPolicy(world, { boardConfig: twelvePlayerStandardConfig, roleCatalog: getDefaultRoleCatalog(), toolSpecRegistry: getDefaultToolSpecRegistry(), targetHintRegistry: getDefaultTargetHintRegistry(), phaseStageLocalizationRegistry: getDefaultPhaseStageLocalizationRegistry(), configRenderRegistry: getDefaultConfigRenderRegistry() });
  const prompt = policy.buildUser(requests[1], { turnId: "t2", allowedTools: ["use_potion"], actionSubmissionHint: "submit" });
  expect(prompt).not.toContain(text(locale, "prompt.stage.wolf_target", { target: 10 }));
  expect(prompt).toContain(text(locale, "prompt.stage.unknown_wolf_target"));
  expect(requests[1].context.visible_events.filter(event => event.type === "witch_potion_used").map(event => event.payload.targetId)).toEqual([9]);
  expect(buildAgentVisibleEventFeed(world, events, 6).some(event => event.type === "wolf_kill_vote_cast")).toBe(false);
  expect(rejectionCodes).toEqual(["heal_unavailable", "heal_unavailable", "heal_unavailable"]);
});

// Literal rule table, not computed by the tested resolution algorithm.
const cases: Array<[StatusMark[], DeathCause[]]> = [
  [[], []], [[StatusMark.GuardMark], []], [[StatusMark.HealMark], []], [[StatusMark.WolfKillMark], [DeathCause.WolfKill]], [[StatusMark.PoisonMark], [DeathCause.Poison]],
  [[StatusMark.GuardMark, StatusMark.HealMark], []], [[StatusMark.GuardMark, StatusMark.WolfKillMark], []], [[StatusMark.HealMark, StatusMark.WolfKillMark], []],
  [[StatusMark.GuardMark, StatusMark.PoisonMark], [DeathCause.Poison]], [[StatusMark.HealMark, StatusMark.PoisonMark], [DeathCause.Poison]],
  [[StatusMark.WolfKillMark, StatusMark.PoisonMark], [DeathCause.Poison, DeathCause.WolfKill]],
  [[StatusMark.GuardMark, StatusMark.HealMark, StatusMark.WolfKillMark], [DeathCause.WolfKill]],
  [[StatusMark.GuardMark, StatusMark.HealMark, StatusMark.PoisonMark], [DeathCause.Poison]],
  [[StatusMark.GuardMark, StatusMark.WolfKillMark, StatusMark.PoisonMark], [DeathCause.Poison]],
  [[StatusMark.HealMark, StatusMark.WolfKillMark, StatusMark.PoisonMark], [DeathCause.Poison]],
  [[StatusMark.GuardMark, StatusMark.HealMark, StatusMark.WolfKillMark, StatusMark.PoisonMark], [DeathCause.Poison, DeathCause.WolfKill]],
];
for (const locale of ["zh-CN", "en"] as const) test(`${locale}: all 16 knife/poison/guard/heal combinations retain the independent lethal sources and clear marks`, () => {
  for (const [input, expected] of cases) {
    const { world } = fixture(locale); input.forEach(mark => marks(world, 7).add(mark));
    const result = new DamageResolutionSystem().resolve(world);
    expect(result).toEqual({ deaths: expected.length ? [7] : [], deathSources: expected.length ? { 7: expected } : {} });
    expect(marks(world, 7).values()).toEqual([]);
    expect(world.getComponent<{ alive: boolean }>(7, COMPONENT.Alive)!.alive).toBe(true); // PhaseManager owns death settlement.
  }
});

for (const locale of ["zh-CN", "en"] as const) test(`${locale}: actual guard+heal+poison night preserves compound sources and never authorizes a poisoned Hunter's gun`, async () => {
  const { world } = fixture(locale), events: GameEvent[] = [];
  grantNightAbility(world, 9, { id: "gift:guard", kind: "guard", state: { lastTarget: null }, source: { kind: "gift", actorId: 5 }, startsOnDay: 1, maxUses: 1 }, events);
  grantNightAbility(world, 10, { id: "gift:poison", kind: "potion", state: { heal: 0, poison: 1, selfHealRule: WitchSelfHealRule.Disabled, canSelfHeal: false, healUsedThisNight: false, poisonUsedThisNight: false }, source: { kind: "gift", actorId: 5 }, startsOnDay: 1, maxUses: 1 }, events);
  const pipeline = new NightPipeline({ world, events, toolGateway: new ToolGateway(), damageResolutionSystem: new DamageResolutionSystem() });
  const result = await pipeline.execute(twelvePlayerStandardConfig, { async getAction(input) {
    if (input.context.stage === "wolf_vote") return { name: "kill_vote", args: { target_id: 7, abstain: false } };
    if (input.actorId === 9) return { name: "guard", args: { target_id: 7, abstain: false } };
    if (input.actorId === 6 && input.context.stage === "witch") return { name: "use_potion", args: { target_id: 7, potion_type: PotionType.Heal } };
    if (input.actorId === 10) return { name: "use_potion", args: { target_id: 7, potion_type: PotionType.Poison } };
    return new BaselineBotActionProvider(world).getAction(input);
  } }, 1);
  expect(completedNight(result).damage).toEqual({ deaths: [7], deathSources: { 7: [DeathCause.Poison, DeathCause.WolfKill] } });
  let shots = 0;
  world.getComponent<{ alive: boolean }>(7, COMPONENT.Alive)!.alive = false;
  await hunterDeathHook(world, [7], completedNight(result).damage.deathSources, async () => { shots++; return { kind: "invalid" }; }, events);
  expect(shots).toBe(0); expect(getHunterState(role(world, 7))!.canShoot).toBe(false);
  expect(getWitchState(role(world, 6))!.heal).toBe(0);
});
