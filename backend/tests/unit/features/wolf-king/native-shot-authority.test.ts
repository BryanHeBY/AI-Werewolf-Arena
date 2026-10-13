/**
 * Unit tests verify Wolf King native shot causes, independent resources, bounded chained resolution and fail-closed late choices.
 * Input: Original locale/cause/change tables, explicit death permits and local role/life/resource state.
 * Output and oracle: Exact consumption, reception, visibility, death-wave and stale-selection assertions remain unchanged; no PM cycle or recorder executes.
 */
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import {
  COMPONENT,
  Camp,
  Role,
  Phase,
  DeathCause,
  WinCondition,
  ActionWindow,
  type RoleComponent,
  type GameEvent,
  type ActionRequest,
} from "../../../../src/core";
import { sixPlayerMvpConfig } from "../../../../src/runtime/scenarios/six_player_mvp";
import {
  getDefaultRoleCatalog,
  knownWolfTeammates,
  getDefaultToolSpecRegistry,
  getDefaultTargetHintRegistry,
  getDefaultConfigRenderRegistry,
  getDefaultPhaseStageLocalizationRegistry,
} from "../../../../src/game/mechanisms";
import {
  getWolfKingState,
  setWolfKingState,
} from "../../../../src/game/mechanisms/roles/wolf_king/state";
import { getHunterState } from "../../../../src/game/mechanisms/roles/hunter/ports";
import { DeathResolution } from "../../../../src/game/engine/death_resolution";
import { EventRegistry } from "../../../../src/game/engine/event_registry";
import { ToolGateway } from "../../../../src/game/gateway/tool_gateway";
import { ActionReception } from "../../../../src/ai/agents/player/action_reception";
import { PlayerPromptPolicy } from "../../../../src/ai/agents/player/player_prompt_policy";
import { AgentEventVisibilityRegistry } from "../../../../src/game/mechanisms/broadcast/agent_event_visibility_registry";

const config = {
  ...sixPlayerMvpConfig,
  boardSize: 6,
  winConditions: [WinCondition.SlaughterCity],
  roleSetups: [
    { role: Role.WolfKing, count: 1 },
    { role: Role.Hunter, count: 1 },
    { role: Role.Seer, count: 1 },
    { role: Role.Wolf, count: 1 },
    { role: Role.Villager, count: 2 },
  ],
};

const fixture = (locale: "zh-CN" | "en") =>
  bootstrapGame(config, {
    locale,
    fixedRoles: [Role.WolfKing, Role.Hunter, Role.Seer, Role.Wolf, Role.Villager, Role.Villager],
  });

const role = (world: ReturnType<typeof fixture>["world"], id: number) =>
  world.getComponent<RoleComponent>(id, COMPONENT.Role)!;

const dead = (world: ReturnType<typeof fixture>["world"], id: number) => {
  world.getComponent<{ alive: boolean }>(id, COMPONENT.Alive)!.alive = false;
};

const gun = (actorId: number, deathActionId: number): ActionRequest => ({
  actorId,
  phase: Phase.Day,
  allowedTools: ["shoot"],
  context: {
    day: 2,
    stage: actorId === 2 ? "hunter_shot" : "death_shot",
    trigger: "on_death",
    death_action_id: deathActionId,
    death_sources: [DeathCause.Exile],
    visible_events: [],
    turn_constraints: {},
  },
});

for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}: explicit wolf-king cause table and one-shot/pass/invalid consumption use a real permit`, async () => {
    const cases: Array<[DeathCause[], boolean]> = [
      [[DeathCause.WolfKill], true],
      [[DeathCause.Exile], true],
      [[DeathCause.Shot], true],
      [[DeathCause.WolfKill, DeathCause.Shot], true],
      [[], false],
      [[DeathCause.Poison], false],
      [[DeathCause.WolfKill, DeathCause.Poison], false],
      [[DeathCause.SelfDestruct], false],
      [[DeathCause.Duel], false],
      [[DeathCause.Lovers], false],
      [[DeathCause.Dream], false],
      [[DeathCause.Ability], false],
    ];
    for (const [sources, allowed] of cases) {
      const { world } = fixture(locale);
      dead(world, 1);
      const permit = world.openDeathAction(1, "shoot", Phase.Day, 2),
        events: GameEvent[] = [];
      let choices = 0;
      try {
        const hook = getDefaultRoleCatalog().require(Role.WolfKing).deathHook!;
        const result = await hook(
          world,
          [1],
          { 1: sources },
          async () => {
            choices++;
            return { kind: "shot", targetId: 3, deathActionId: permit.id };
          },
          events,
        );
        expect(choices).toBe(allowed ? 1 : 0);
        expect(result).toEqual(
          allowed
            ? { extraDeaths: [3], extraDeathSources: { 3: [DeathCause.Shot] } }
            : { extraDeaths: [], extraDeathSources: {} },
        );
        expect(getWolfKingState(role(world, 1))!.canShoot).toBe(false);
        expect(world.getComponent<{ alive: boolean }>(3, COMPONENT.Alive)!.alive).toBe(true); // Hook proposes; resolver kills.
        expect(events.map((event) => event.type)).toEqual(allowed ? ["wolf_king_shot"] : []);
        await hook(
          world,
          [1],
          { 1: sources },
          async () => {
            throw new Error("second_shot");
          },
          events,
        );
        expect(events.length).toBe(allowed ? 1 : 0);
      } finally {
        permit.close();
      }
      expect(world.activeDeathActionCount).toBe(0);
    }
    for (const kind of ["pass", "invalid", "bad_target", "unscoped"] as const) {
      const { world } = fixture(locale);
      dead(world, 1);
      const permit = world.openDeathAction(1, "shoot", Phase.Day, 2),
        events: GameEvent[] = [];
      try {
        const result = await getDefaultRoleCatalog().require(Role.WolfKing).deathHook!(
          world,
          [1],
          { 1: [DeathCause.Exile] },
          async () =>
            kind === "pass"
              ? { kind, deathActionId: permit.id }
              : kind === "invalid"
                ? { kind }
                : {
                    kind: "shot",
                    targetId: kind === "bad_target" ? 999 : 3,
                    deathActionId: kind === "unscoped" ? permit.id + 1 : permit.id,
                  },
          events,
        );
        expect(result.extraDeaths).toEqual([]);
        expect(events).toEqual([]);
        expect(getWolfKingState(role(world, 1))!.canShoot).toBe(kind !== "pass");
      } finally {
        permit.close();
      }
    }
  });

for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}: Hunter and Wolf King own independent shoot rules, living shooters and fake stage metadata cannot act`, () => {
    const { world } = fixture(locale),
      receive = new ActionReception(world),
      gateway = new ToolGateway();
    expect(getWolfKingState(role(world, 1))).toEqual({ canShoot: true });
    expect(getHunterState(role(world, 1))).toBeUndefined();
    expect(
      gateway.validateAndSanitize(
        world,
        1,
        { name: "shoot", args: { target_id: 3 } },
        { phase: Phase.Day, day: 2 },
      ).ok,
    ).toBe(false);
    for (const actor of [1, 2]) {
      dead(world, actor);
      const permit = world.openDeathAction(actor, "shoot", Phase.Day, 2);
      try {
        expect(receive.validate(gun(actor, permit.id), "shoot", { target_id: "3" })).toMatchObject({
          ok: true,
          action: { name: "shoot", args: { target_id: 3 } },
        });
        expect(receive.validate(gun(actor, permit.id), "shoot", { target_id: 999 })).toMatchObject({
          ok: false,
          error: "shoot_target",
        });
        expect(
          receive.validate(
            {
              ...gun(actor, permit.id),
              context: { ...gun(actor, permit.id).context, stage: "day_speech" },
            },
            "shoot",
            { target_id: 3 },
          ).ok,
        ).toBe(false);
        expect(receive.validate(gun(actor, permit.id + 1), "shoot", { target_id: 3 }).ok).toBe(
          false,
        );
        expect(
          actor === 1
            ? getWolfKingState(role(world, actor))?.canShoot
            : getHunterState(role(world, actor))?.canShoot,
        ).toBe(true);
      } finally {
        permit.close();
      }
    }
  });

for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}: the central resolver settles Wolf King to Hunter to Seer without extra words and leaves victory to PhaseManager`, async () => {
    const { world } = fixture(locale),
      events: GameEvent[] = [],
      state = { day: 2, phase: Phase.Day, gameOver: false, result: null };
    const requests: ActionRequest[] = [];
    await new DeathResolution(world, events, new ToolGateway(), new EventRegistry(), state).resolve(
      [1],
      { 1: [DeathCause.Shot] },
      {
        async getAction(request) {
          requests.push(request);
          expect(request.context.death_sources).toEqual([DeathCause.Shot]);
          expect(request.context.trigger).toBe("on_death");
          expect(request.context.stage).toBe(request.actorId === 1 ? "death_shot" : "hunter_shot");
          return { name: "shoot", args: { target_id: request.actorId === 1 ? 2 : 3 } };
        },
      },
      Phase.Day,
      Phase.Day,
    );
    expect(requests.map((request) => request.actorId)).toEqual([1, 2]);
    expect(events.map((event) => [event.type, event.payload])).toEqual([
      ["wolf_king_shot", { actorId: 1, targetId: 2 }],
      ["hunter_shot", { hunterId: 2, targetId: 3 }],
    ]);
    expect(world.getAliveEntityIds()).toEqual([4, 5, 6]);
    expect(state.gameOver).toBe(false);
    expect(world.activeDeathActionCount).toBe(0);
    expect(getWolfKingState(role(world, 1))?.canShoot).toBe(false);
    expect(getHunterState(role(world, 2))?.canShoot).toBe(false);
  });

for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}: wolf pack and private shot resources remain separate; public shot updates observed deaths`, () => {
    const { world } = fixture(locale),
      gateway = new ToolGateway();
    expect(knownWolfTeammates(world, 1, getDefaultRoleCatalog())).toEqual([4]);
    expect(knownWolfTeammates(world, 4, getDefaultRoleCatalog())).toEqual([1]);
    expect(
      gateway.validateAndSanitize(
        world,
        1,
        { name: "kill_vote", args: { target_id: 1, abstain: false } },
        { phase: Phase.Night },
      ).ok,
    ).toBe(true);
    expect(
      gateway.validateAndSanitize(
        world,
        1,
        { name: "self_destruct", args: { reason: "raw", confirm: true } },
        { phase: Phase.Voting, actionWindow: ActionWindow.OnPreVote, allowSelfDestruct: true },
      ).ok,
    ).toBe(true);
    const policy = new PlayerPromptPolicy(world, {
      boardConfig: config,
      roleCatalog: getDefaultRoleCatalog(),
      toolSpecRegistry: getDefaultToolSpecRegistry(),
      targetHintRegistry: getDefaultTargetHintRegistry(),
      configRenderRegistry: getDefaultConfigRenderRegistry(),
      phaseStageLocalizationRegistry: getDefaultPhaseStageLocalizationRegistry(),
    });
    const request = {
      ...gun(1, 1),
      context: {
        ...gun(1, 1).context,
        visible_events: [{ seq: 1, type: "wolf_king_shot", payload: { actorId: 1, targetId: 3 } }],
      },
    };
    const own = policy.buildObservation(request);
    expect(own.identity).toMatchObject({ role: Role.WolfKing, camp: Camp.Wolf });
    expect(own.ownState.wolfKing).toEqual({ canShoot: true });
    expect(own.knownAliveIds).not.toContain(3);
    expect(policy.buildObservation({ ...request, actorId: 4 }).ownState).not.toHaveProperty(
      "wolfKing",
    );
    expect(policy.buildObservation({ ...request, actorId: 5 }).teammateIds).toEqual([]);
    const prompt = policy.buildUser(request, {
      turnId: "t1",
      allowedTools: ["shoot"],
      actionSubmissionHint: "submit",
    });
    expect(prompt).toContain(locale === "en" ? "Wolf King" : "狼王");
    expect(prompt).toContain(locale === "en" ? "Shots remaining: 1" : "剩余枪：1");
    if (locale === "en") expect(prompt).not.toMatch(/\p{Script=Han}/u);
    const event: GameEvent = {
      type: "wolf_king_shot",
      timestamp: 1,
      payload: { actorId: 1, targetId: 3 },
    };
    expect(new AgentEventVisibilityRegistry().canView(world, event, 5)).toBe(true);
  });

for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}: late choices after role/resource/life/window replacement cannot spend a wolf-king shot`, async () => {
    for (const mode of ["role", "resource", "life", "window", "error"] as const) {
      const { world } = fixture(locale);
      dead(world, 1);
      const permit = world.openDeathAction(1, "shoot", Phase.Day, 2),
        events: GameEvent[] = [],
        original = getWolfKingState(role(world, 1))!,
        failure = new Error("original-shot-failure");
      try {
        const task = getDefaultRoleCatalog().require(Role.WolfKing).deathHook!(
          world,
          [1],
          { 1: [DeathCause.Exile] },
          async () => {
            if (mode === "role") role(world, 1).role = Role.Wolf;
            if (mode === "resource") setWolfKingState(role(world, 1), { canShoot: true });
            if (mode === "life") {
              world.getComponent<{ alive: boolean }>(1, COMPONENT.Alive)!.alive = true;
              dead(world, 1);
            }
            if (mode === "window") permit.close();
            if (mode === "error") throw failure;
            return { kind: "shot", targetId: 3, deathActionId: permit.id };
          },
          events,
        );
        if (mode === "error") await expect(task).rejects.toBe(failure);
        else expect((await task).extraDeaths).toEqual([]);
        expect(events).toEqual([]);
        expect(original.canShoot).toBe(true);
      } finally {
        permit.close();
      }
      expect(world.activeDeathActionCount).toBe(0);
    }
  });
