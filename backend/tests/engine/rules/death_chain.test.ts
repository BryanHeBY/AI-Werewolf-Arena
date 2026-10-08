import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { COMPONENT, Camp, DeathCause, Phase, Role, WinCondition, type ActionRequest, type GameEvent, type RoleComponent } from "../../../src/core";
import { sixPlayerMvpConfig } from "../../../src/runtime/scenarios/six_player_mvp";
import { DeathResolution } from "../../../src/game/engine/death_resolution";
import { EventRegistry } from "../../../src/game/engine/event_registry";
import { ToolGateway } from "../../../src/game/gateway/tool_gateway";
import { HookRegistry } from "../../../src/game/mechanisms/hooks/hook_registry";
import { LastWordsMechanism } from "../../../src/game/mechanisms/last_words/last_words_mechanism";

const scene = (locale: "zh-CN" | "en") => bootstrapGame({ ...sixPlayerMvpConfig, enableSheriff: true, initialSheriffSeat: 2, sheriff: { voteWeight: 2.25 }, roleSetups: [{ role: Role.Wolf, count: 1 }, { role: Role.Hunter, count: 2 }, { role: Role.Villager, count: 3 }] }, { locale, fixedRoles: [Role.Wolf, Role.Hunter, Role.Hunter, Role.Villager, Role.Villager, Role.Villager] });

for (const locale of ["zh-CN", "en"] as const) test(`${locale}: a whole wave is dead before last words; badge precedes guns and additional deaths receive no last words`, async () => {
  const { world } = scene(locale), events: GameEvent[] = [], asks: ActionRequest[] = [], tries = new Map<number, number>();
  const resolver = new DeathResolution(world, events, new ToolGateway(), new EventRegistry(), { day: 1, phase: Phase.Day, gameOver: false, result: null });
  await resolver.resolve([2, 2, 3], { 2: [DeathCause.WolfKill], 3: [DeathCause.WolfKill] }, { async getAction(request) {
    asks.push(request); expect(world.getComponent<{ alive: boolean }>(2, COMPONENT.Alive)!.alive).toBe(false); expect(world.getComponent<{ alive: boolean }>(3, COMPONENT.Alive)!.alive).toBe(false);
    if (request.context.stage === "last_words") return { name: "speak", args: { text: `raw-${request.actorId}` } };
    const attempt = (tries.get(request.actorId) ?? 0) + 1; tries.set(request.actorId, attempt);
    if (request.actorId === 3) expect(world.getComponent<{ alive: boolean }>(4, COMPONENT.Alive)!.alive).toBe(false);
    return { name: "shoot", args: { target_id: request.actorId === 2 || attempt === 1 ? 4 : 5 } };
  } }, Phase.Night, Phase.Day);
  expect(world.getAliveEntityIds()).toEqual([1, 6]); expect(world.activeDeathActionCount).toBe(0);
  expect(asks.filter(request => request.context.stage === "last_words").map(request => request.actorId)).toEqual([2, 3]);
  expect(events.filter(event => event.type === "hunter_shot").map(event => event.payload)).toEqual([{ hunterId: 2, targetId: 4 }, { hunterId: 3, targetId: 5 }]);
  expect(tries.get(3)).toBe(2);
  const kinds = events.map(event => event.type);
  expect(kinds.lastIndexOf("last_words_spoken")).toBeLessThan(kinds.indexOf("sheriff_badge_transferred"));
  expect(kinds.indexOf("sheriff_badge_transferred")).toBeLessThan(kinds.indexOf("hunter_shot"));
  expect(events.filter(event => event.type === "sheriff_badge_transferred").map(event => event.payload)).toEqual([{ fromId: 2, toId: 1, reason: "night_death" }]);
});

for (const locale of ["zh-CN", "en"] as const) test(`${locale}: real exile settles words, badge, gun, the shot sheriff's badge and then victory`, async () => {
  const game = bootstrapGame({ ...sixPlayerMvpConfig, enableSheriff: true, initialSheriffSeat: 2, sheriff: { voteWeight: 2.25 }, selfDestruct: { enabledWindows: [] }, winConditions: [WinCondition.SlaughterCity], roleSetups: [{ role: Role.Wolf, count: 1 }, { role: Role.Hunter, count: 1 }, { role: Role.Villager, count: 4 }] }, { locale, fixedRoles: [Role.Wolf, Role.Hunter, Role.Villager, Role.Villager, Role.Villager, Role.Villager] });
  const requests: ActionRequest[] = [];
  const result = await game.phaseManager.runSingleCycle({ async getAction(request) {
    requests.push(request);
    if (request.allowedTools.includes("kill_vote")) return { name: "kill_vote", args: { target_id: null, abstain: true } };
    if (request.allowedTools.includes("choose_direction")) return { name: "choose_direction", args: { direction: "clockwise" } };
    if (request.allowedTools.includes("vote")) return { name: "vote", args: { target_id: 2, abstain: false } };
    if (request.allowedTools.includes("shoot")) return { name: "shoot", args: { target_id: 1 } };
    if (request.allowedTools.includes("speak")) return { name: "speak", args: { text: "raw" } };
    return null;
  } });
  expect(result.result).toEqual({ winner: Camp.Good, reason: "all_wolves_eliminated", outcome: { kind: "victory", primary: { kind: "faction", faction: "good", winningPlayerIds: [2, 3, 4, 5, 6] }, additional: [], winningPlayerIds: [2, 3, 4, 5, 6] }, decidedAt: { day: 1, phase: Phase.Voting, checkpoint: "exile_settled" } });
  expect(game.world.getAliveEntityIds()).toEqual([3, 4, 5, 6]); expect(game.world.activeDeathActionCount).toBe(0);
  const events = game.phaseManager.getEvents();
  const relevant = events.filter(event => ["voted_out", "last_words_spoken", "sheriff_badge_transferred", "hunter_shot", "game_over"].includes(event.type));
  expect(relevant.map(event => event.type)).toEqual(["voted_out", "last_words_spoken", "sheriff_badge_transferred", "hunter_shot", "sheriff_badge_transferred", "game_over"]);
  expect(relevant.filter(event => event.type === "sheriff_badge_transferred").map(event => [event.payload.fromId, event.payload.toId])).toEqual([[2, 1], [1, 3]]);
  expect(game.world.getComponent<{ weight: number }>(3, COMPONENT.VotingRight)!.weight).toBe(2.25);
  expect(requests.filter(request => request.context.stage === "last_words").map(request => request.actorId)).toEqual([2]);
});

for (const locale of ["zh-CN", "en"] as const) test(`${locale}: concurrent default self-destruction picks one wolf, settles the badge without last words, enters night and later ends naturally`, async () => {
  const game = bootstrapGame({ ...sixPlayerMvpConfig, enableSheriff: true, initialSheriffSeat: 1, sheriff: { voteWeight: 2.25 }, hooks: { onDaybreak: false, onPreElection: false, onPreVote: true, onPerSpeechGap: false }, winConditions: [WinCondition.SlaughterCity], roleSetups: [{ role: Role.Wolf, count: 2 }, { role: Role.Seer, count: 1 }, { role: Role.Villager, count: 3 }] }, { locale, fixedRoles: [Role.Wolf, Role.Wolf, Role.Seer, Role.Villager, Role.Villager, Role.Villager] });
  const requests: ActionRequest[] = [];
  const provider = { async getAction(request: ActionRequest) {
    requests.push(request);
    if (request.allowedTools.includes("kill_vote")) return { name: "kill_vote" as const, args: { target_id: null, abstain: true } };
    if (request.allowedTools.includes("check_identity")) return { name: "check_identity" as const, args: { target_id: 2 } };
    if (request.allowedTools.includes("choose_direction")) return { name: "choose_direction" as const, args: { direction: "clockwise" as const } };
    if (request.allowedTools.includes("self_destruct")) { await new Promise(resolve => setTimeout(resolve, request.actorId === 1 ? 3 : 0)); return { name: "self_destruct" as const, args: { confirm: true, reason: "raw" } }; }
    if (request.allowedTools.includes("speak")) return { name: "speak" as const, args: { text: "raw" } };
    return null;
  } };
  const first = await game.phaseManager.runSingleCycle(provider);
  expect(first).toMatchObject({ day: 2, phase: Phase.Night, gameOver: false });
  expect(game.world.getAliveEntityIds()).toEqual([2, 3, 4, 5, 6]); expect(game.world.getComponent<{ isSheriff: boolean }>(2, COMPONENT.Badge)!.isSheriff).toBe(true);
  expect(game.world.getComponent<{ weight: number }>(2, COMPONENT.VotingRight)!.weight).toBe(2.25);
  const last = await game.phaseManager.runSingleCycle(provider);
  expect(last.result).toEqual({ winner: Camp.Good, reason: "all_wolves_eliminated", outcome: { kind: "victory", primary: { kind: "faction", faction: "good", winningPlayerIds: [3, 4, 5, 6] }, additional: [], winningPlayerIds: [3, 4, 5, 6] }, decidedAt: { day: 2, phase: Phase.Voting, checkpoint: "day_interrupted" } });
  expect(game.world.getAliveEntityIds()).toEqual([3, 4, 5, 6]); expect(game.world.getComponent<{ isSheriff: boolean }>(3, COMPONENT.Badge)!.isSheriff).toBe(true);
  expect(game.world.activeDeathActionCount).toBe(0);
  expect(requests.filter(request => request.context.stage === "last_words" || request.allowedTools.includes("vote"))).toEqual([]);
  const events = game.phaseManager.getEvents();
  expect(events.filter(event => event.type === "wolf_self_destruct").map(event => event.payload.wolfId)).toEqual([1, 2]);
  expect(events.filter(event => event.type === "sheriff_badge_transferred").map(event => event.payload)).toEqual([{ fromId: 1, toId: 2, reason: "self_destruct" }, { fromId: 2, toId: 3, reason: "self_destruct" }]);
  const finalBadge = events.findLastIndex(event => event.type === "sheriff_badge_transferred"); expect(finalBadge).toBeLessThan(events.findIndex(event => event.type === "game_over"));
});

for (const locale of ["zh-CN", "en"] as const) test(`${locale}: the same life is settled once; revival allows a new death and cyclic proposals terminate`, async () => {
  const { world } = scene(locale), events: GameEvent[] = [], state = { day: 2, phase: Phase.Voting, gameOver: false, result: null };
  let words = 0;
  const provider = { async getAction() { words++; return { name: "speak" as const, args: { text: "raw" } }; } };
  const visits: number[] = [];
  const registry = new EventRegistry(new HookRegistry([], [async (_world, ids) => { const id = ids[0]; visits.push(id); return { extraDeaths: id === 5 ? [6, 6, 5, 4, 999] : id === 6 ? [5] : [], extraDeathSources: { 4: [DeathCause.Shot], 5: [DeathCause.Shot], 6: [DeathCause.Shot] } }; }]));
  const resolver = new DeathResolution(world, events, new ToolGateway(), registry, state);
  await resolver.resolve([4], { 4: [DeathCause.Exile] }, provider, Phase.Voting, Phase.Voting);
  await resolver.resolve([4], { 4: [DeathCause.Exile] }, provider, Phase.Voting, Phase.Voting); expect(words).toBe(1);
  world.getComponent<{ alive: boolean }>(4, COMPONENT.Alive)!.alive = true;
  await resolver.resolve([4], { 4: [DeathCause.Exile] }, provider, Phase.Voting, Phase.Voting); expect(words).toBe(2);
  await resolver.resolve([5], { 5: [DeathCause.Exile] }, provider, Phase.Voting, Phase.Voting);
  expect(visits).toEqual([4, 4, 5, 6]); expect(world.getAliveEntityIds()).not.toContain(5); expect(world.getAliveEntityIds()).not.toContain(6);
});

test("last words require explicit initial-night or exile facts; voting self-destruction and shot deaths remain silent", () => {
  const policy = new LastWordsMechanism();
  const table: Array<[Phase, number, DeathCause[], boolean]> = [[Phase.Night, 1, [DeathCause.WolfKill], true], [Phase.Night, 1, [DeathCause.Poison], true], [Phase.Night, 2, [DeathCause.WolfKill], false], [Phase.Voting, 2, [DeathCause.Exile], true], [Phase.Voting, 2, [DeathCause.SelfDestruct], false], [Phase.Voting, 2, [DeathCause.Shot], false], [Phase.Night, 1, [DeathCause.Shot], false], [Phase.Night, 1, [DeathCause.WolfKill, DeathCause.SelfDestruct], false], [Phase.Voting, 2, [], false]];
  for (const [phase, day, causes, expected] of table) expect(policy.shouldGrantLastWords(phase, day, causes)).toBe(expected);
});

test("multiple hooks retain compound causes without aliasing their returned source arrays", async () => {
  const { world } = scene("en"), poison = [DeathCause.Poison];
  const registry = new HookRegistry([], [async () => ({ extraDeaths: [4], extraDeathSources: { 4: [DeathCause.Shot] } }), async () => ({ extraDeaths: [4], extraDeathSources: { 4: poison } })]);
  const result = await registry.onDeath(world, [2], { 2: [DeathCause.Exile] }, async () => ({ kind: "invalid" }), []);
  poison.push(DeathCause.WolfKill);
  expect(result.extraDeathSources).toEqual({ 4: [DeathCause.Shot, DeathCause.Poison] });
});

test("a later hook failure keeps a completed gun death, original error and closed action windows", async () => {
  const { hunterDeathHook } = await import("../../../src/game/mechanisms/roles/hunter/death_hook");
  const { getHunterState } = await import("../../../src/game/mechanisms/roles/private_state");
  const { world } = scene("en"), events: GameEvent[] = [], error = new Error("synthetic-later-hook-error");
  let afterError = 0;
  const registry = new EventRegistry(new HookRegistry([], [hunterDeathHook, async () => { throw error; }, async () => { afterError++; return { extraDeaths: [], extraDeathSources: {} }; }]));
  const result = await new DeathResolution(world, events, new ToolGateway(), registry, { day: 2, phase: Phase.Voting, gameOver: false, result: null }).resolve([2], { 2: [DeathCause.Exile] }, { async getAction(request) {
    return request.allowedTools.includes("shoot") ? { name: "shoot", args: { target_id: 4 } } : null;
  } }, Phase.Voting, Phase.Voting).catch(failure => failure);
  expect(result).toBe(error); expect(world.activeDeathActionCount).toBe(0);
  expect(events.filter(event => event.type === "hunter_shot").map(event => event.payload)).toEqual([{ hunterId: 2, targetId: 4 }]);
  expect(world.getComponent<{ alive: boolean }>(4, COMPONENT.Alive)!.alive).toBe(false);
  expect(getHunterState(world.getComponent<RoleComponent>(2, COMPONENT.Role))!.canShoot).toBe(false);
  expect(afterError).toBe(0);
});
