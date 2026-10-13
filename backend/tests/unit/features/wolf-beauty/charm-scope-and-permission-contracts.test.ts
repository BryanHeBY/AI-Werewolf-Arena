/**
 * Unit tests for wolf beauty relations. Inputs are original charm/cause/locale/victory inputs and
 * controlled late proposals. Original literal receipts, reference/getter/error traces, facts and expected
 * state remain the oracle. Bounded permitsCharm, single charm stage/scope and read-only pack receipts; no
 * complete central death/cycle. No complete game phase or paid model runs; existing local windows and
 * denied entry probes remain bounded.
 */
import { nightStageContext } from "../../../engine/night_stage_fixture";
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import {
  Role,
  Phase,
  COMPONENT,
  WinCondition,
  KnightDuelWindow,
  type BoardConfig,
  type ActionRequest,
  type RoleComponent,
} from "../../../../src/core";
import { sixPlayerMvpConfig } from "../../../../src/runtime/scenarios/six_player_mvp";
import { getWolfBeautyState } from "../../../../src/game/mechanisms/roles/wolf_beauty/state";
import { ActionReception } from "../../../../src/ai/agents/player/action_reception";
import { knownWolfTeammates, getDefaultRoleCatalog } from "../../../../src/game/mechanisms";
import { WOLF_BEAUTY_CHARM_STAGE } from "../../../../src/game/mechanisms/roles/wolf_beauty/night_stages";
import {
  activeCharm,
  bindCharm,
  permitsCharm,
} from "../../../../src/game/mechanisms/roles/wolf_beauty/relation";
import { DeathCause, type GameEvent } from "../../../../src/core";
import { GameActionRequestFactory } from "../../../../src/game/engine/action_request_factory";
import { ToolGateway } from "../../../../src/game/gateway/tool_gateway";

const deck = [Role.WolfBeauty, Role.Wolf, Role.Witch, Role.Knight, Role.Villager, Role.Villager];

const board = (roles = deck): BoardConfig => ({
  ...sixPlayerMvpConfig,
  winConditions: [WinCondition.SlaughterSide],
  roleSetups: [...new Set(roles)].map((role) => ({
    role,
    count: roles.filter((item) => item === role).length,
  })),
  knight: { enabledWindows: [KnightDuelWindow.AfterSpeeches] },
});

const role = (game: ReturnType<typeof bootstrapGame>, id: number) =>
  game.world.getComponent<RoleComponent>(id, COMPONENT.Role)!;

test("compound Duel/Dream suppress charm despite poison, while standalone exile/poison are its only trigger causes", () => {
  expect(permitsCharm([DeathCause.Exile])).toBe(true);
  expect(permitsCharm([DeathCause.Poison])).toBe(true);
  for (const sources of [
    [DeathCause.Poison, DeathCause.Duel],
    [DeathCause.Poison, DeathCause.Dream],
    [DeathCause.Shot],
    [DeathCause.WolfKill],
    [DeathCause.WhiteWolfBlast],
    [DeathCause.Charm],
  ])
    expect(permitsCharm(sources)).toBe(false);
});

for (const mutation of ["phase", "actor_life", "target_life", "state"] as const)
  test(`${mutation}: asynchronous charm replacement/revocation forms no late relationship or private fact`, async () => {
    const game = bootstrapGame(board(), { fixedRoles: deck }),
      events: GameEvent[] = [],
      old = getWolfBeautyState(role(game, 1))!;
    let current = true;
    const requests = new GameActionRequestFactory(game.world, events, 1);
    const ctx = nightStageContext({
      world: game.world,
      events,
      currentDay: () => 1,
      isCurrent: () => current,
      getAliveByRole: () => [1],
      toolGateway: new ToolGateway(),
      makeRequest: (
        actorId: number,
        allowedTools: ActionRequest["allowedTools"],
        context: { stage: "wolf_beauty" },
      ) =>
        requests.create({
          summary: "Offline stage fixture",
          actorId,
          phase: Phase.Night,
          allowedTools,
          stage: context.stage,
          requiresAction: false,
        }),
      actionProvider: {
        async getAction() {
          if (mutation === "phase") current = false;
          if (mutation === "actor_life") {
            const life = game.world.getComponent<{ alive: boolean }>(1, COMPONENT.Alive)!;
            life.alive = false;
            life.alive = true;
          }
          if (mutation === "target_life") {
            const life = game.world.getComponent<{ alive: boolean }>(5, COMPONENT.Alive)!;
            life.alive = false;
            life.alive = true;
          }
          if (mutation === "state")
            (role(game, 1).privateState as Record<string, unknown>).wolf_beauty = {
              targetId: null,
              lastActedDay: null,
              history: [],
            };
          return { name: "charm", args: { target_id: 5 } };
        },
      },
    });
    await WOLF_BEAUTY_CHARM_STAGE.execute(ctx);
    expect(old).toEqual({ targetId: null, lastActedDay: null, history: [] });
    expect(events).toEqual([]);
    expect(activeCharm(game.world, 1)).toBeNull();
  });

test("a restored or replaced target life cannot inherit a previous charm", () => {
  const game = bootstrapGame(board(), { fixedRoles: deck }),
    state = getWolfBeautyState(role(game, 1))!;
  (state as { targetId: number | null }).targetId = 5;
  bindCharm(game.world, 1, 5);
  expect(activeCharm(game.world, 1)).not.toBeNull();
  const life = game.world.getComponent<{ alive: boolean }>(5, COMPONENT.Alive)!;
  life.alive = false;
  life.alive = true;
  expect(activeCharm(game.world, 1)).toBeNull();
});

for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}: Beauty keeps ID-only pack permissions, no blast or own self-knife, and charm receipt is strict and read-only`, () => {
    const game = bootstrapGame(board(), { locale, fixedRoles: deck }),
      receive = new ActionReception(game.world);
    expect(knownWolfTeammates(game.world, 1, getDefaultRoleCatalog())).toEqual([2]);
    expect(knownWolfTeammates(game.world, 2, getDefaultRoleCatalog())).toEqual([1]);
    const request: ActionRequest = {
      actorId: 1,
      phase: Phase.Night,
      allowedTools: ["charm"],
      context: { day: 1, stage: "wolf_beauty", visible_events: [], turn_constraints: {} },
    };
    for (const target_id of [5, null])
      expect(receive.validate(request, "charm", { target_id }).ok).toBe(true);
    for (const target_id of [1, 999, 2.5])
      expect(receive.validate(request, "charm", { target_id }).ok).toBe(false);
    expect(
      receive.validate({ ...request, phase: Phase.Day }, "charm", { target_id: 5 }),
    ).toMatchObject({ ok: false, error: "ability_phase" });
    expect(
      receive.validate({ ...request, allowedTools: ["kill_vote"] }, "kill_vote", {
        target_id: 1,
        abstain: false,
      }),
    ).toMatchObject({ ok: false, error: "beauty_self_knife" });
    expect(
      receive.validate(
        { ...request, phase: Phase.Voting, allowedTools: ["self_destruct"] },
        "self_destruct",
        { confirm: true, reason: "Raw" },
      ).ok,
    ).toBe(false);
    expect(getWolfBeautyState(role(game, 1))).toEqual({
      targetId: null,
      lastActedDay: null,
      history: [],
    });
  });
