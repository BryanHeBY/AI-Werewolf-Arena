import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { COMPONENT, Camp, DeathCause, Phase, Role, type ActionRequest, type GameEvent, type RoleComponent } from "../../../src/core";
import { createAliveComponent, type AliveComponent } from "../../../src/core/domain/components/alive";
import { sixPlayerMvpConfig } from "../../../src/runtime/scenarios/six_player_mvp";
import { allDeathGuns, grantDeathGun, armDeathGun, activeDeathGun, projectDeathGun, transferDeathGun, setDeathGunEnabled, copyDeathGun } from "../../../src/game/mechanisms/roles/death_abilities";
import { DeathResolution } from "../../../src/game/engine/death_resolution";
import { EventRegistry } from "../../../src/game/engine/event_registry";
import { ToolGateway } from "../../../src/game/gateway/tool_gateway";
import { ActionReception } from "../../../src/ai/agents/player/action_reception";
import { getHunterState } from "../../../src/game/mechanisms/roles/private_state";
import { buildAgentVisibleEventFeed } from "../../../src/game/engine/agent_visible_event_feed";
import { NightPipeline } from "../../../src/game/engine/phase_pipeline/night_pipeline";
import { DamageResolutionSystem } from "../../../src/core/domain/systems/damage_resolution_system";
import { World } from "../../../src/core/domain/world";
import { HookRegistry } from "../../../src/game/mechanisms/hooks/hook_registry";
import { giftGunDeathHook } from "../../../src/game/mechanisms/roles/gift_gun_death_hook";
import { captureNightLife } from "../../../src/core/domain/night_effects";
import { SessionRecordManager } from "../../../src/recording/session_recorder";
import { runWithSessionRecorder } from "../../../src/recording/recording_context";
import { GameEventRecorder } from "../../../src/runtime/game_event_recorder";
import { createTestTempDirectory } from "../../support/temp_directory";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { RoleCatalog, getDefaultRoleCatalog } from "../../../src/game/mechanisms/roles/catalog";
import { NightStageRegistry } from "../../../src/game/mechanisms/stages/night/night_stage_registry";

const roles = [Role.Wolf, Role.Hunter, Role.Seer, Role.Guard, Role.Villager, Role.Villager];
function fixture(locale: "en" | "zh-CN" = "en", target = 2) {
  const config = { ...sixPlayerMvpConfig, roleSetups: [...new Set(roles)].map(role => ({ role, count: roles.filter(r => r === role).length })) }, game = bootstrapGame(config, { fixedRoles: roles, locale }), events: GameEvent[] = [];
  const gun = grantDeathGun(game.world, 3, target, 1, events);
  return { ...game, config, events, gun, state: { day: 1, phase: Phase.Day, gameOver: false, result: null } };
}
type Game = ReturnType<typeof fixture>;
const role = (game: Game, id = 2) => game.world.getComponent<RoleComponent>(id, COMPONENT.Role)!;
const life = (game: Game, id = 2) => game.world.getComponent<AliveComponent>(id, COMPONENT.Alive)!;
function resolver(game: Game, gateway = new ToolGateway()) { return new DeathResolution(game.world, game.events, gateway, new EventRegistry(), game.state); }

test("sharing original component references with another World never transfers a gifted gun's authorization", () => {
  const game = fixture(); armDeathGun(game.world, 2, game.gun, 1, game.events); const other = new World("en");
  for (let i = 1; i <= 6; i++) other.createEntity(); other.addComponent(2, COMPONENT.Role, role(game)); other.addComponent(2, COMPONENT.Alive, life(game));
  expect(activeDeathGun(other, 2, game.gun.id, 1)).toBeUndefined(); expect(activeDeathGun(game.world, 2, game.gun.id, 1)).toBe(game.gun);
});

test("a direct gift hook refuses a numeric target ID paired with another player's life scope", async () => {
  const game = fixture("en", 5); armDeathGun(game.world, 5, game.gun, 1, game.events); life(game, 5).alive = false;
  const permit = game.world.openDeathAction(5, "shoot", Phase.Day, 1, () => true, game.gun.id);
  try { const result = await giftGunDeathHook(game.world, [5], { 5: [DeathCause.Exile] }, async () => ({ kind: "shot", targetId: 1, targetScope: captureNightLife(game.world, 6)!, deathActionId: permit.id }), game.events, { day: 1, nightEffect: false, blocksNightShot: () => false });
    expect(result.extraDeaths).toEqual([]); expect(game.gun.remaining).toBe(1); expect(game.events.some(e => e.type === "player_shot")).toBe(false);
  } finally { permit.close(); }
});

for (const locale of ["zh-CN", "en"] as const) for (const native of [null, 1]) test(`${locale}/${native}: actual native then gifted gun commits each death before opening a fresh bound request`, async () => {
  const game = fixture(locale); armDeathGun(game.world, 2, game.gun, 1, game.events); const requests: ActionRequest[] = [];
  await resolver(game).resolve([2], { 2: [DeathCause.WolfKill] }, { async getAction(request) {
    if (request.allowedTools.includes("speak")) return { name: "speak", args: { text: "Original words" } };
    requests.push(request); expect(game.world.activeDeathActionCount).toBe(1);
    if (requests.length === 1) { expect(request.context.ability_id).toBeUndefined(); expect(request.context.stage).toBe("hunter_shot"); return { name: "shoot", args: { target_id: native } }; }
    expect(request.context.ability_id).toBe(game.gun.id); expect(request.context.stage).toBe("death_shot"); expect(request.context.action_failure_policy).toBe("error");
    expect(life(game, 1).alive).toBe(native === null); expect(game.world.isDeathActionOpen(2, "shoot", requests[0].context.death_action_id!)).toBe(false);
    expect(new ActionReception(game.world).validate(requests[0], "shoot", { target_id: 5 }).ok).toBe(false);
    expect(new ActionReception(game.world).validate(request, "shoot", { target_id: 5 }).ok).toBe(true);
    return { name: "shoot", args: { target_id: 5 } };
  } }, Phase.Night, Phase.Day);
  expect(requests).toHaveLength(2); expect(requests[1].context.death_action_id).not.toBe(requests[0].context.death_action_id);
  expect(game.events.filter(e => e.type === "hunter_shot").map(e => e.payload)).toEqual(native === null ? [] : [{ hunterId: 2, targetId: 1 }]);
  expect(game.events.filter(e => e.type === "player_shot").map(e => e.payload)).toEqual([{ actorId: 2, targetId: 5 }]);
  expect(life(game, 5).alive).toBe(false); expect(getHunterState(role(game))!.canShoot).toBe(false); expect(game.gun).toMatchObject({ remaining: 0, disabled: true, deathExpired: true }); expect(game.world.activeDeathActionCount).toBe(0);
});

test("the second request rejects the first target's now-dead ID then accepts a new living target", async () => {
  const game = fixture(); armDeathGun(game.world, 2, game.gun, 1, game.events); let guns = 0;
  await resolver(game).resolve([2], { 2: [DeathCause.Exile] }, { async getAction(request) { if (request.allowedTools.includes("speak")) return { name: "speak", args: { text: "Raw" } }; return { name: "shoot", args: { target_id: ++guns <= 2 ? 1 : 5 } }; } }, Phase.Voting, Phase.Day);
  expect(guns).toBe(3); expect(life(game, 1).alive).toBe(false); expect(life(game, 5).alive).toBe(false); expect(game.events.filter(e => e.type === "player_shot")).toHaveLength(1); expect(game.gun.remaining).toBe(0);
});

for (const change of ["none", "private", "revive", "target_replace", "metadata"] as const) test(`${change}: accepted gifted shots preserve consumption but recheck ownership at the actual death commit`, async () => {
  const game = fixture("en", 5); armDeathGun(game.world, 5, game.gun, 1, game.events);
  const hooks = new HookRegistry([], [async (...args) => { const result = await giftGunDeathHook(...args); if (result.pendingShots?.length) {
    if (change === "private") role(game, 5).privateState = {};
    if (change === "revive") { life(game, 5).alive = true; life(game, 5).alive = false; }
    if (change === "target_replace") game.world.addComponent(1, COMPONENT.Alive, createAliveComponent());
    if (change === "metadata") game.gun.source.actorId = 4;
  } return result; }]);
  await new DeathResolution(game.world, game.events, new ToolGateway(), new EventRegistry(hooks), game.state).resolve([5], { 5: [DeathCause.Exile] }, { async getAction(request) { return request.allowedTools.includes("shoot") ? { name: "shoot", args: { target_id: 1 } } : { name: "speak", args: { text: "Raw" } }; } }, Phase.Voting, Phase.Day);
  expect(game.gun.remaining).toBe(0); expect(game.gun.deathExpired).toBe(true); expect(life(game, 1).alive).toBe(change !== "none"); expect(game.events.filter(e => e.type === "player_shot")).toHaveLength(change === "none" ? 1 : 0); expect(game.world.activeDeathActionCount).toBe(0);
});

test("three invalid gifted choices throw and expire the already-dead owner's gun without a fake public shot", async () => {
  const game = fixture("en", 5); armDeathGun(game.world, 5, game.gun, 1, game.events); let guns = 0;
  await expect(resolver(game).resolve([5], { 5: [DeathCause.Exile] }, { async getAction(request) { if (request.allowedTools.includes("shoot")) { guns++; return { name: "shoot", args: { target_id: 999 } }; } return { name: "speak", args: { text: "Raw" } }; } }, Phase.Voting, Phase.Day)).rejects.toThrow("gift_gun_valid_action_missing");
  expect(guns).toBe(3); expect(game.gun.deathExpired).toBe(true); expect(game.events.some(e => e.type === "player_shot")).toBe(false); expect(game.world.activeDeathActionCount).toBe(0);
});

test("a donor's later death does not revoke a paid gift owned by the recipient", async () => {
  const game = fixture("en", 5); armDeathGun(game.world, 5, game.gun, 1, game.events); life(game, 3).alive = false;
  await resolver(game).resolve([5], { 5: [DeathCause.Exile] }, { async getAction(request) { return request.allowedTools.includes("shoot") ? { name: "shoot", args: { target_id: null } } : { name: "speak", args: { text: "Raw" } }; } }, Phase.Voting, Phase.Day);
  expect(game.gun.remaining).toBe(0); expect(game.gun.deathExpired).toBe(true); expect(game.events.some(e => e.type === "player_shot")).toBe(false);
});

for (const first of [1, 3]) for (const locale of ["zh-CN", "en"] as const) test(`${first}/${locale}: a complete PhaseManager night finishes both guns and deaths before judging last Wolf or last God`, async () => {
  const deck = [Role.Wolf, Role.Hunter, Role.Seer, Role.Villager, Role.Villager, Role.Villager], config = { ...sixPlayerMvpConfig, roleSetups: [...new Set(deck)].map(role => ({ role, count: deck.filter(r => r === role).length })) }, game = bootstrapGame(config, { fixedRoles: deck, locale, playerNames: Object.fromEntries(deck.map((_, i) => [String(i + 1), `Seat ${i + 1}`])) });
  const initial: GameEvent[] = [], gun = grantDeathGun(game.world, 3, 2, 1, initial); const shoots: ActionRequest[] = [];
  const root = await createTestTempDirectory("awa-gift-gun-controlled-"), sessionId = `controlled-gift-${first}-${locale}`, opening = [...game.phaseManager.getEvents()], manager = await SessionRecordManager.create({ sessionId, board: "controlled_gift_gun", locale, startedAtIso: new Date(Math.min(...opening.map(e => e.timestamp), ...initial.map(e => e.timestamp))).toISOString() }, root), recorder = new GameEventRecorder({ world: game.world, replayManager: manager }, "night");
  recorder.flush([...opening, ...initial]);
  await runWithSessionRecorder(manager, () => game.phaseManager.runSingleCycle({ async getAction(request) {
    if (request.allowedTools.includes("speak_to_wolves")) return { name: "speak_to_wolves", args: { text: "Raw", end_chat: true } };
    if (request.allowedTools.includes("kill_vote")) return { name: "kill_vote", args: { target_id: 2, abstain: false } };
    if (request.allowedTools.includes("check_identity")) return { name: "check_identity", args: { target_id: 1 } };
    if (request.allowedTools.includes("speak")) return { name: "speak", args: { text: "Raw" } };
    if (request.allowedTools.includes("shoot")) { shoots.push(request); expect(game.phaseManager.getSnapshot().gameOver).toBe(false); return { name: "shoot", args: { target_id: shoots.length === 1 ? first : first === 1 ? 3 : 1 } }; }
    throw new Error("unexpected_phase_request");
  } }));
  expect(shoots).toHaveLength(2); expect(gun).toMatchObject({ armedOnNight: 1, remaining: 0, deathExpired: true }); expect(game.world.getAliveEntityIds()).toEqual([4, 5, 6]);
  const events = game.phaseManager.getEvents(); expect(events.filter(e => e.type === "hunter_shot" || e.type === "player_shot").map(e => e.payload.targetId)).toEqual([first, first === 1 ? 3 : 1]);
  expect(events.findIndex(e => e.type === "player_shot")).toBeLessThan(events.findIndex(e => e.type === "game_over")); expect(events.at(-1)!.type).toBe("game_over");
  expect(game.phaseManager.getSnapshot().result).toMatchObject({ winner: Camp.Good, reason: "all_wolves_eliminated", decidedAt: { day: 1, phase: Phase.Day, checkpoint: "night_settled" }, outcome: { winningPlayerIds: [2, 3, 4, 5, 6] } });
  recorder.flush([...opening, ...initial, ...events.slice(opening.length)]);
  await manager.finalize({ endedAtIso: new Date().toISOString(), winner: Camp.Good, finishReason: "test", gameResult: game.phaseManager.getSnapshot().result!, players: deck.map((role, i) => ({ player_id: i + 1, role, camp: i === 0 ? "wolf" : "good", alive: game.world.getAliveEntityIds().includes(i + 1), name: `Seat ${i + 1}` })) });
  await writeFile(`/tmp/awa-gift-gun-controlled-${first}-${locale}.replay.json`, await readFile(path.join(root, sessionId, "replay.json"), "utf8"));
});

for (const causes of [[DeathCause.Poison], [DeathCause.WolfKill, DeathCause.Poison], [DeathCause.Dream], [DeathCause.Charm], [DeathCause.Duel], [DeathCause.DuelFailure], [DeathCause.Ability]]) test(`${causes}: a gifted Villager never gets a gun request for a forbidden or compound death`, async () => {
  const game = fixture("en", 5); armDeathGun(game.world, 5, game.gun, 1, game.events); let guns = 0;
  await resolver(game).resolve([5], { 5: causes }, { async getAction(request) { if (request.allowedTools.includes("shoot")) guns++; return { name: "speak", args: { text: "Raw" } }; } }, Phase.Night, Phase.Day);
  expect(guns).toBe(0); expect(game.gun).toMatchObject({ remaining: 0, deathExpired: true }); life(game, 5).alive = true;
  expect(() => setDeathGunEnabled(game.world, 5, game.gun.id, true, game.events)).toThrow(); expect(activeDeathGun(game.world, 5, game.gun.id, 2)).toBeUndefined();
});

test("a pending unarmed gun expires on its first real death without a request", async () => {
  const game = fixture("en", 5); let guns = 0;
  await resolver(game).resolve([5], { 5: [DeathCause.Exile] }, { async getAction(request) { if (request.allowedTools.includes("shoot")) guns++; return { name: "speak", args: { text: "Raw" } }; } }, Phase.Voting, Phase.Day);
  expect(guns).toBe(0); expect(game.gun.armedOnNight).toBeNull(); expect(game.gun.deathExpired).toBe(true);
});

test("death expiry emits only captured facts without evaluating unknown private getters", async () => {
  const game = fixture("en", 5); armDeathGun(game.world, 5, game.gun, 1, game.events); let reads = 0;
  Object.defineProperty(game.gun, "internalLazyMetadata", { enumerable: true, get() { reads++; throw new Error("must_not_execute"); } });
  await resolver(game).resolve([5], { 5: [DeathCause.Exile] }, { async getAction(request) { return request.allowedTools.includes("shoot") ? { name: "shoot", args: { target_id: null } } : { name: "speak", args: { text: "Raw" } }; } }, Phase.Voting, Phase.Day);
  expect(reads).toBe(0); expect(game.gun.deathExpired).toBe(true); expect(game.events.filter(e => e.type === "death_ability_changed" && e.payload.operation === "disabled")).toHaveLength(1);
});

for (const change of ["revive", "replace", "private", "role", "camp", "source", "metadata", "clock", "cancel"] as const) test(`${change}: a late gifted gun reply cannot spend another owner or kill a target`, async () => {
  const game = fixture("en", 5); armDeathGun(game.world, 5, game.gun, 1, game.events); const original = game.gun;
  const run = resolver(game).resolve([5], { 5: [DeathCause.Exile] }, { async getAction(request) {
    if (!request.allowedTools.includes("shoot")) return { name: "speak", args: { text: "Raw" } };
    if (change === "revive") { life(game, 5).alive = true; life(game, 5).alive = false; }
    if (change === "replace") game.world.addComponent(5, COMPONENT.Alive, createAliveComponent(false));
    if (change === "private") role(game, 5).privateState = {};
    if (change === "role") role(game, 5).role = Role.Seer;
    if (change === "camp") role(game, 5).camp = Camp.Wolf;
    if (change === "source") original.source.actorId = 4;
    if (change === "metadata") original.grantedNight = 2;
    if (change === "clock") game.state.phase = Phase.Voting;
    if (change === "cancel") throw new DOMException("Cancelled", "AbortError");
    return { name: "shoot", args: { target_id: 1 } };
  } }, Phase.Voting, Phase.Day);
  if (change === "cancel") await expect(run).rejects.toThrow("Cancelled"); else await run;
  expect(life(game, 1).alive).toBe(true); expect(game.events.some(e => e.type === "player_shot")).toBe(false); expect(original.deathExpired).toBe(true); expect(game.world.activeDeathActionCount).toBe(0);
});

test("transfer preserves pending/armed, spent/disabled resources and source identity never enters private events", () => {
  const game = fixture(); armDeathGun(game.world, 2, game.gun, 1, game.events); setDeathGunEnabled(game.world, 2, game.gun.id, false, game.events);
  const received = transferDeathGun(game.world, 2, 5, game.gun.id, game.events);
  expect(received).toMatchObject({ id: game.gun.id, remaining: 1, disabled: true, armedOnNight: 1 }); expect(allDeathGuns(role(game))).toEqual([]);
  expect(projectDeathGun(received).source).toEqual({ kind: "transfer" }); expect(() => copyDeathGun()).toThrow("death_ability_copy_not_supported");
  expect(() => transferDeathGun(game.world, 5, 2, received.id, game.events)).toThrow(); expect(() => transferDeathGun(game.world, 5, 1, received.id, game.events)).toThrow();
  (received as any).secret = "synthetic-internal"; (received.source as any).secret = "synthetic-donor";
  expect(JSON.stringify(projectDeathGun(received))).not.toMatch(/synthetic|actorId/);
  const event = game.events.find(e => e.type === "death_ability_changed")!; (event.payload as any).secret = "synthetic-internal";
  for (const actor of game.world.entityIds()) { const feed = buildAgentVisibleEventFeed(game.world, [event], actor); expect(feed).toHaveLength(actor === 2 ? 1 : 0); expect(JSON.stringify(feed)).not.toMatch(/synthetic|source/); }
});

test("only actual final night activation arms a gift; same World/night cannot replay its committed activation", async () => {
  const game = fixture("en", 5), pipeline = new NightPipeline({ world: game.world, events: game.events, toolGateway: new ToolGateway(), damageResolutionSystem: new DamageResolutionSystem() });
  let current = true;
  const provider = { async getAction(request: ActionRequest) { if (request.allowedTools.includes("speak_to_wolves")) return { name: "speak_to_wolves" as const, args: { text: "Raw", end_chat: true } }; if (request.allowedTools.includes("kill_vote")) { current = false; return { name: "kill_vote" as const, args: { target_id: 5, abstain: false } }; } if (request.allowedTools.includes("guard")) return { name: "guard" as const, args: { target_id: null, abstain: true } }; if (request.allowedTools.includes("check_identity")) return { name: "check_identity" as const, args: { target_id: 1 } }; throw new Error("unexpected_tool"); } };
  expect((await pipeline.execute(game.config, provider, 1, { isCurrent: () => current })).interrupted).toBe(true); expect(game.gun.armedOnNight).toBeNull();
  current = true;
  const complete = { async getAction(request: ActionRequest) { if (request.allowedTools.includes("speak_to_wolves")) return { name: "speak_to_wolves" as const, args: { text: "Raw", end_chat: true } }; if (request.allowedTools.includes("kill_vote")) return { name: "kill_vote" as const, args: { target_id: 5, abstain: false } }; if (request.allowedTools.includes("guard")) return { name: "guard" as const, args: { target_id: null, abstain: true } }; if (request.allowedTools.includes("check_identity")) return { name: "check_identity" as const, args: { target_id: 1 } }; throw new Error("unexpected_tool"); } };
  expect((await pipeline.execute(game.config, complete, 2)).interrupted).toBe(false); expect(game.gun.armedOnNight).toBe(2);
  await expect(pipeline.execute(game.config, complete, 2)).rejects.toThrow("death_ability_night_reentry_after_commit");
});

test("a declared death capability collects final activation before a gift is produced during the night", async () => {
  const config = { ...sixPlayerMvpConfig, roleSetups: [...new Set(roles)].map(role => ({ role, count: roles.filter(r => r === role).length })) }, game = bootstrapGame(config, { fixedRoles: roles }), events: GameEvent[] = [];
  const catalog = new RoleCatalog(getDefaultRoleCatalog().all().map(profile => profile.role === Role.Seer ? { ...profile, possibleDeathAbilities: ["gun" as const], nightStages: [...(profile.nightStages ?? []), { id: "controlled_gift", priority: 230, async execute(ctx: import("../../../src/game/mechanisms/stages/night/contracts").NightStageContext) { grantDeathGun(ctx.world, 3, 5, ctx.currentDay(), ctx.events); } }] } : profile)), stageRegistry = new NightStageRegistry(catalog);
  expect(allDeathGuns(game.world.getComponent<RoleComponent>(5, COMPONENT.Role))).toHaveLength(0); expect(stageRegistry.getStages(config, game.world).some(stage => stage.id === "death_ability_activation")).toBe(true);
  const pipeline = new NightPipeline({ world: game.world, events, toolGateway: new ToolGateway(), damageResolutionSystem: new DamageResolutionSystem(), stageRegistry });
  const result = await pipeline.execute(config, { async getAction(request) { if (request.allowedTools.includes("speak_to_wolves")) return { name: "speak_to_wolves", args: { text: "Raw", end_chat: true } }; if (request.allowedTools.includes("kill_vote")) return { name: "kill_vote", args: { target_id: 5, abstain: false } }; if (request.allowedTools.includes("guard")) return { name: "guard", args: { target_id: null, abstain: true } }; return { name: "check_identity", args: { target_id: 1 } }; } }, 1);
  expect(result.interrupted).toBe(false); expect(allDeathGuns(game.world.getComponent<RoleComponent>(5, COMPONENT.Role))[0].armedOnNight).toBe(1);
});
