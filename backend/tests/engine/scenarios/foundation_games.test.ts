import type { Locale } from "@ai-werewolf-arena/game-text";
import { PlayerPromptPolicy } from "../../../src/ai/agents/player/player_prompt_policy";
import { PlayerPromptSession } from "../../../src/ai/agents/llm/player_prompt_session";
import { getDefaultRoleCatalog, getDefaultToolSpecRegistry, getDefaultTargetHintRegistry, getDefaultPhaseStageLocalizationRegistry, getDefaultConfigRenderRegistry } from "../../../src/game/mechanisms";
import { expect, spyOn, test } from "bun:test";
import { assertReplayDocument } from "@ai-werewolf-arena/replay-contract";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { Camp, COMPONENT, Phase, PotionType, Role, type ActionRequest, type ActionStage, type BoardConfig, type RoleComponent, type ToolCall, type VotingRightComponent } from "../../../src/core";
import { createRandom } from "../../../src/core/domain/random";
import { getGuardState, getHunterState, getSeerState, getWitchState } from "../../../src/game/mechanisms/roles/private_state";
import { sixPlayerMvpConfig } from "../../../src/runtime/scenarios/six_player_mvp";
import { twelvePlayerStandardConfig } from "../../../src/runtime/scenarios/twelve_player_standard";
import { GameEventRecorder } from "../../../src/runtime/game_event_recorder";
import { SessionRecordManager } from "../../../src/recording/session_recorder";
import { runWithSessionRecorder } from "../../../src/recording/recording_context";
import type { ReplayPlayerView } from "../../../src/recording/contracts";
import { StrictScriptedPlayers, type ScriptStep } from "../../support/scripted_players";
import { createTestTempDirectory } from "../../support/temp_directory";

function plan() {
  const steps: ScriptStep[] = [];
  const add = (day: number, actors: readonly number[], stage: ActionStage, action: ToolCall | null | ((actor: number) => ToolCall | null), assertRequest?: (request: ActionRequest) => void) => {
    for (const actorId of actors) steps.push({ actorId, day, stage, turn: 1, action: typeof action === "function" ? action(actorId) : action, assertRequest });
  };
  const wolves = (day: number, actors: number[], target: number) => {
    add(day, actors, "wolf_discussion", { name: "speak_to_wolves", args: { text: "End discussion", end_chat: true } });
    add(day, actors, "wolf_vote", { name: "kill_vote", args: { target_id: target, abstain: false } });
  };
  const speech = (day: number, actors: number[]) => add(day, actors, "day_speech", actor => ({ name: "speak", args: { text: `Day ${day}, seat ${actor}` } }));
  const vote = (day: number, actors: number[], target: number) => add(day, actors, "voting", { name: "vote", args: { target_id: target, abstain: false } });
  const lastWords = (day: number, actor: number) => add(day, [actor], "last_words", { name: "speak", args: { text: `Last words ${actor}` } });
  return { steps, add, wolves, speech, vote, lastWords };
}

async function runRecorded(config: BoardConfig, fixedRoles: Role[], steps: ScriptStep[], locale: Locale = "zh-CN") {
  const root = await createTestTempDirectory("awa-scripted-game-");
  const context = bootstrapGame(config, { fixedRoles, random: createRandom("foundation"), locale, playerNames: Object.fromEntries(fixedRoles.map((_, index) => [index + 1, `Seat ${index + 1}`])) });
  const provider = new StrictScriptedPlayers(steps);
  const promptSession = new PlayerPromptSession({ maxPromptEvents: 8, promptPolicy: new PlayerPromptPolicy(context.world, {
    boardConfig: config, roleCatalog: getDefaultRoleCatalog(), toolSpecRegistry: getDefaultToolSpecRegistry(), targetHintRegistry: getDefaultTargetHintRegistry(),
    phaseStageLocalizationRegistry: getDefaultPhaseStageLocalizationRegistry(), configRenderRegistry: getDefaultConfigRenderRegistry(),
  }) });
  const promptedProvider = { async getAction(request: ActionRequest) {
    const prompt = promptSession.build(request);
    expect(prompt.systemPrompt).toContain(locale === "en" ? "Use English" : "你必须使用中文");
    if (locale === "en") {
      expect(prompt.systemPrompt).not.toMatch(/[\u4e00-\u9fff]/);
      expect(prompt.userPrompt).not.toMatch(/[\u4e00-\u9fff]/);
    }
    return provider.getAction(request);
  } };

  const manager = await SessionRecordManager.create({ sessionId: "scripted", board: "scripted", startedAtIso: "2026-10-07T00:00:00.000Z", random: context.random.metadata }, root);
  const recorder = new GameEventRecorder({ world: context.world, replayManager: manager }, Phase.Night);
  await runWithSessionRecorder(manager, async () => {
    const failures: unknown[] = [];
    try {
      while (!context.phaseManager.getSnapshot().gameOver) {
        await context.phaseManager.runSingleCycle(promptedProvider, 8);
        recorder.flush(context.phaseManager.getEvents());
      }
      provider.assertConsumed();
      const before = provider.trace.length;
      await context.phaseManager.runSingleCycle(promptedProvider, 8);
      expect(provider.trace.length).toBe(before);
      expect(context.phaseManager.getSnapshot().result?.reason).not.toBe("max_days_reached");
    } catch (error) { failures.push(error); }
    finally {
      try { recorder.flush(context.phaseManager.getEvents()); } catch (error) { failures.push(error); }
      try {
        const snapshot = context.phaseManager.getSnapshot();
        await manager.finalize({ endedAtIso: "2026-10-07T00:01:00.000Z", winner: snapshot.result?.winner ?? null, finishReason: failures.length ? "runtime_error" : snapshot.result!.reason,
          players: context.world.entityIds().map(id => {
            const role = context.world.getComponent<RoleComponent>(id, COMPONENT.Role)!;
            return { player_id: id, role: role.role, camp: role.camp, alive: context.world.getAliveEntityIds().includes(id) };
          }),
        });
      } catch (error) { failures.push(error); }
    }
    if (failures.length === 1) throw failures[0];
    if (failures.length) throw new AggregateError(failures, "scripted_game_failed");
  });
  const replay = JSON.parse(await readFile(path.join(root, "scripted/replay.json"), "utf8"));
  assertReplayDocument(replay);
  const manifest = JSON.parse(await readFile(path.join(root, "scripted/manifest.json"), "utf8"));
  expect(replay.result.winner).toBe(Camp.Good);
  expect(manifest.winner).toBe(Camp.Good);
  expect(manifest.players.map((player: { role: Role; camp: Camp }) => ({ role: player.role, camp: player.camp }))).toEqual(fixedRoles.map(role => ({ role, camp: role === Role.Wolf ? Camp.Wolf : Camp.Good })));
  expect(replay.players.map(player => ({ role: player.role, camp: player.camp }))).toEqual(fixedRoles.map(role => ({ role, camp: role === Role.Wolf ? Camp.Wolf : Camp.Good })));
  const playerViews: ReplayPlayerView[] = await Promise.all(fixedRoles.map((_, index) => readFile(path.join(root, "scripted/players", `player_${index + 1}.json`), "utf8").then(JSON.parse)));
  for (const view of playerViews) {
    const actorEvents = view.timeline.filter(entry => entry.kind === "event").map(entry => entry.event);
    expect(actorEvents.some(event => event.type === "god_private_game_info")).toBe(false);
    expect(actorEvents.map(event => event.seq)).toEqual(actorEvents.map((_, index) => index + 1));
    for (const event of actorEvents) {
      if (["seer_checked", "witch_potion_used", "witch_potion_skipped", "guard_applied"].includes(event.type)) expect(event.payload.actorId).toBe(view.player_id);
      if (event.type.startsWith("wolf_" ) && event.type !== "wolf_self_destruct") expect(view.role).toBe(Role.Wolf);
    }
  }
  const logic = JSON.parse(await readFile(path.join(root, "scripted/logic_ops.json"), "utf8"));
  expect(logic.ops.filter((op: { status: string }) => op.status === "fallback" || op.status === "rejected")).toEqual([]);
  expect(replay.events.map((event: { type: string; payload: unknown }) => ({ type: event.type, payload: event.payload }))).toEqual(context.phaseManager.getEvents().map(({ type, payload }) => ({ type, payload })));
  for (const { request } of provider.trace) {
    expect(request.context.visible_events.some(event => event.type === "god_private_game_info")).toBe(false);
    if (request.context.stage !== "witch") expect(request.context.wolf_target).toBeUndefined();
    if (request.actorId !== 5 && fixedRoles.length === 12) expect(request.context.visible_events.some(event => event.type === "seer_checked")).toBe(false);
  }
  return { ...context, provider, replay, manifest, playerViews };
}

for (const locale of ["zh-CN", "en"] as const) for (const blocked of [false, true]) test(`${locale} six-player strict game covers ${blocked ? "successful guard" : "guard skip"}, private checks and last words`, async () => {
  const p = plan();
  p.wolves(1, [1, 4], 3);
  p.add(1, [5], "guard", { name: "guard", args: { target_id: blocked ? 3 : 6, abstain: false } });
  p.add(1, [2], "seer", { name: "check_identity", args: { target_id: 1 } });
  if (!blocked) p.lastWords(1, 3);
  p.speech(1, blocked ? [1, 2, 3, 4, 5, 6] : [1, 2, 4, 5, 6]); p.vote(1, blocked ? [1, 2, 3, 4, 5, 6] : [1, 2, 4, 5, 6], 1); p.lastWords(1, 1);
  p.wolves(2, [4], 5);
  p.add(2, [5], "guard", { name: "guard", args: { target_id: blocked ? 6 : null, abstain: !blocked } });
  p.add(2, [2], "seer", { name: "check_identity", args: { target_id: 4 } });
  p.speech(2, blocked ? [2, 3, 4, 6] : [2, 4, 6]); p.vote(2, blocked ? [2, 3, 4, 6] : [2, 4, 6], 4); p.lastWords(2, 4);
  const game = await runRecorded(sixPlayerMvpConfig, [Role.Wolf, Role.Seer, Role.Villager, Role.Wolf, Role.Guard, Role.Villager], p.steps, locale);
  expect(game.phaseManager.getSnapshot().result?.winner).toBe(Camp.Good);
  expect(game.world.getAliveEntityIds()).toEqual(blocked ? [2, 3, 6] : [2, 6]);
  expect(game.manifest.players.filter((player: { alive: boolean }) => player.alive).map((player: { player_id: number }) => player.player_id)).toEqual(blocked ? [2, 3, 6] : [2, 6]);
  expect(game.replay.events.filter(event => event.type === "last_words_spoken").map(event => event.payload.playerId)).toEqual(blocked ? [1, 4] : [3, 1, 4]);
  expect(game.replay.events.filter(event => event.type === "night_resolved").map(event => event.payload.deaths)).toEqual([blocked ? [] : [3], [5]]);
  const checks = [{ actorId: 2, targetId: 1, isWerewolf: true }, { actorId: 2, targetId: 4, isWerewolf: true }];
  expect(game.replay.events.filter(event => event.type === "seer_checked").map(event => event.payload)).toEqual(checks);
  expect(game.playerViews[1].timeline.filter(entry => entry.kind === "event" && entry.event.type === "seer_checked").map(entry => entry.kind === "event" ? entry.event.payload : null)).toEqual(checks);
  expect(game.provider.trace.filter(({ request }) => request.actorId === 2).at(-1)?.request.context.visible_events.filter(event => event.type === "seer_checked").map(event => event.payload)).toEqual(checks);
  expect(getSeerState(game.world.getComponent<RoleComponent>(2, COMPONENT.Role)!)?.history).toEqual([{ targetId: 1, isWerewolf: true }, { targetId: 4, isWerewolf: true }]);
  expect(getGuardState(game.world.getComponent<RoleComponent>(5, COMPONENT.Role)!)?.lastTarget).toBe(blocked ? 6 : null);
  expect(game.provider.trace.filter(({ request }) => request.actorId !== 2).every(({ request }) => !request.context.visible_events.some(event => event.type === "seer_checked"))).toBe(true);
});

const twelveRoles = [Role.Wolf, Role.Wolf, Role.Wolf, Role.Wolf, Role.Seer, Role.Witch, Role.Hunter, Role.Idiot, Role.Villager, Role.Villager, Role.Villager, Role.Villager];

for (const locale of ["zh-CN", "en"] as const) for (const flipIdiot of [false, true]) {
  test(`${locale} twelve-player strict game: heal, poison, gun, sheriff ${flipIdiot ? "idiot reveal" : "election"} and final explosion`, async () => {
    const p = plan();
    p.wolves(1, [1, 2, 3, 4], 9);
    p.add(1, [6], "witch", { name: "use_potion", args: { target_id: 9, potion_type: PotionType.Heal } }, request => expect(request.context.wolf_target).toBe(9));
    p.add(1, [5], "seer", { name: "check_identity", args: { target_id: 1 } });
    const all = Array.from({ length: 12 }, (_, index) => index + 1);
    p.add(1, all, "sheriff_nomination", actor => ({ name: "run_for_sheriff", args: { run: actor === 8 || actor === 10 } }));
    p.add(1, [8, 10], "sheriff_campaign_speech", { name: "speak", args: { text: "Campaign" } });
    p.add(1, [8, 10], "sheriff_withdraw", actor => ({ name: "run_for_sheriff", args: { run: actor === 8 } }));
    p.add(1, all.filter(id => id !== 8), "sheriff_vote", { name: "vote_for_sheriff", args: { target_id: 8, abstain: false } });
    p.add(1, [8], "sheriff_choose_direction", { name: "choose_direction", args: { direction: "clockwise" } });
    p.speech(1, all); p.add(1, [1, 2, 3, 4], "on_pre_vote", null);
    p.vote(1, all, flipIdiot ? 8 : 1); if (!flipIdiot) p.lastWords(1, 1);
    p.wolves(2, flipIdiot ? [1, 2, 3, 4] : [2, 3, 4], 7);
    p.add(2, [6], "witch", { name: "use_potion", args: { target_id: 4, potion_type: PotionType.Poison } });
    p.add(2, [5], "seer", { name: "check_identity", args: { target_id: 2 } });
    p.add(2, [7], "hunter_shot", { name: "shoot", args: { target_id: 3 } });
    p.add(2, [flipIdiot ? 1 : 8], "sheriff_choose_direction", { name: "choose_direction", args: { direction: "clockwise" } });
    p.speech(2, flipIdiot ? [1, 2, 5, 6, 8, 9, 10, 11, 12] : [2, 5, 6, 8, 9, 10, 11, 12]);
    if (flipIdiot) {
      p.add(2, [1, 2], "on_pre_vote", null);
      p.vote(2, [1, 2, 5, 6, 9, 10, 11, 12], 1); p.lastWords(2, 1);
      p.wolves(3, [2], 5);
      p.add(3, [6], "witch", { name: "use_potion", args: { target_id: 6, potion_type: PotionType.None } });
      p.add(3, [5], "seer", { name: "check_identity", args: { target_id: 2 } });
      p.add(3, [2], "sheriff_choose_direction", { name: "choose_direction", args: { direction: "clockwise" } });
      p.speech(3, [2, 6, 8, 9, 10, 11, 12]);
    }
    p.add(flipIdiot ? 3 : 2, [2], "on_pre_vote", { name: "self_destruct", args: { reason: "Final wolf", confirm: true } });
    const game = await runRecorded(twelvePlayerStandardConfig, twelveRoles, p.steps, locale);
    expect(game.phaseManager.getSnapshot().result?.winner).toBe(Camp.Good);
    expect(game.world.getAliveEntityIds()).toEqual(flipIdiot ? [6, 8, 9, 10, 11, 12] : [5, 6, 8, 9, 10, 11, 12]);
    expect(game.manifest.players.filter((player: { alive: boolean }) => player.alive).map((player: { player_id: number }) => player.player_id)).toEqual(flipIdiot ? [6, 8, 9, 10, 11, 12] : [5, 6, 8, 9, 10, 11, 12]);
    const witch = getWitchState(game.world.getComponent<RoleComponent>(6, COMPONENT.Role));
    expect(witch?.heal).toBe(0); expect(witch?.poison).toBe(0);
    expect(getHunterState(game.world.getComponent<RoleComponent>(7, COMPONENT.Role))?.canShoot).toBe(false);
    expect(game.replay.events.filter((event: { type: string }) => event.type === "witch_potion_used")).toHaveLength(2);
    expect(game.replay.events.filter(event => event.type === "witch_potion_used").map(event => event.payload)).toEqual([{ actorId: 6, targetId: 9, potionType: "heal" }, { actorId: 6, targetId: 4, potionType: "poison" }]);
    expect(game.replay.events.filter(event => event.type === "hunter_shot").map(event => event.payload)).toEqual([{ hunterId: 7, targetId: 3 }]);
    expect(game.replay.events.filter(event => event.type === "night_resolved").map(event => event.payload.deaths)).toEqual(flipIdiot ? [[], [4, 7], [5]] : [[], [4, 7]]);
    const checks = [1, 2, ...(flipIdiot ? [2] : [])].map(targetId => ({ actorId: 5, targetId, isWerewolf: true }));
    expect(game.replay.events.filter(event => event.type === "seer_checked").map(event => event.payload)).toEqual(checks);
    expect(game.playerViews[4].timeline.filter(entry => entry.kind === "event" && entry.event.type === "seer_checked").map(entry => entry.kind === "event" ? entry.event.payload : null)).toEqual(checks);
    expect(game.playerViews[5].timeline.filter(entry => entry.kind === "event" && entry.event.type === "witch_potion_used").map(entry => entry.kind === "event" ? entry.event.payload : null)).toEqual([{ actorId: 6, targetId: 9, potionType: "heal" }, { actorId: 6, targetId: 4, potionType: "poison" }]);
    expect(game.replay.events.some((event: { type: string }) => event.type === "hunter_shot")).toBe(true);
    expect(game.replay.events.at(-1).type).toBe("game_over");
    const types = game.replay.events.map((event: { type: string }) => event.type);
    expect(types.indexOf("sheriff_elected")).toBeLessThan(types.indexOf("night_resolved"));
    expect(types.indexOf("witch_potion_used")).toBeLessThan(types.indexOf("sheriff_elected"));
    expect(types.indexOf("hunter_shot")).toBeLessThan(types.indexOf("wolf_self_destruct"));
    expect(types.indexOf("wolf_self_destruct")).toBeLessThan(types.indexOf("game_over"));
    if (flipIdiot) {
      expect(game.world.getComponent<VotingRightComponent>(8, COMPONENT.VotingRight)?.canVote).toBe(false);
      expect(game.replay.events.filter((event: { type: string }) => event.type === "idiot_revealed")).toHaveLength(1);
      expect(game.provider.trace.some(({ request }) => request.actorId === 8 && request.context.day === 2 && request.context.stage === "voting")).toBe(false);
    }
  });
}

test("strict scripts reject unexpected, duplicate and missing player turns", async () => {
  const step: ScriptStep = { actorId: 1, day: 1, stage: "day_speech", turn: 1, action: null };
  expect(() => new StrictScriptedPlayers([step, step])).toThrow("script_duplicate_step");
  const provider = new StrictScriptedPlayers([step]);
  expect(() => provider.assertConsumed()).toThrow("script_missing_requests");
  const request: ActionRequest = { actorId: 1, phase: Phase.Day, allowedTools: ["speak"], context: { day: 1, stage: "day_speech", visible_events: [], turn_constraints: {} } };
  await provider.getAction(request);
  provider.assertConsumed();
  await expect(provider.getAction(request)).rejects.toThrow("script_unexpected_request");
});

test("a final event flush failure still finalizes and preserves the script and persistence errors", async () => {
  const flushError = new Error("final_flush_failed");
  const persistError = new Error("final_record_failed");
  const flush = spyOn(GameEventRecorder.prototype, "flush").mockImplementation(() => { throw flushError; });
  const realFinalize = SessionRecordManager.prototype.finalize;
  let finalized = 0;
  const finalize = spyOn(SessionRecordManager.prototype, "finalize").mockImplementation(async function(meta) {
    finalized++;
    await realFinalize.call(this, meta);
    throw persistError;
  });
  try {
    let failure: unknown;
    try { await runRecorded(sixPlayerMvpConfig, [Role.Wolf, Role.Seer, Role.Villager, Role.Wolf, Role.Guard, Role.Villager], []); } catch (error) { failure = error; }
    expect(finalized).toBe(1);
    expect(failure).toBeInstanceOf(AggregateError);
    expect((failure as AggregateError).errors[0].message).toContain("script_unexpected_request");
    expect((failure as AggregateError).errors.slice(1)).toEqual([flushError, persistError]);
  } finally { flush.mockRestore(); finalize.mockRestore(); }
});
