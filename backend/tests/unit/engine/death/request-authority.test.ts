/**
 * 单元测试验证有界死亡许可在接收和清理间绑定原 actor、工具、时钟及 generation。输入为新内存 World、字面死亡请求，以及注入错误、复活、阶段变化和微任务撤权；预期保留明确许可错误、枪／死亡计数及隐藏 generation 观察相等，不执行完整对局或 provider 传输。
 */
import { createAliveComponent } from "../../../../src/game/observation/component-presentation";
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import {
  COMPONENT,
  DeathCause,
  Phase,
  Role,
  type ActionRequest,
  type GameEvent,
  type RoleComponent,
} from "../../../../src/domain";
import { twelvePlayerStandardConfig } from "../../../../src/runtime/scenarios/twelve_player_standard";
import { ActionReception } from "../../../../src/game/gateway/action-reception";
import { ActionTurn } from "../../../../src/ai/agents/player/action-turn";
import { DeathResolution } from "../../../../src/game/engine/death_resolution";
import { EventRegistry } from "../../../../src/game/engine/event_registry";
import { ToolGateway } from "../../../../src/game/gateway/tool_gateway";
import { getHunterState } from "../../../../src/game/mechanisms/roles/hunter/ports";

import { PlayerPromptPolicy } from "../../../../src/ai/agents/player/player_prompt_policy";
import {
  getDefaultToolSpecRegistry,
  getDefaultRoleCatalog,
  getDefaultTargetHintRegistry,
  getDefaultPhaseStageLocalizationRegistry,
  getDefaultConfigRenderRegistry,
} from "../../../../src/game/mechanisms";

const roles = [
  Role.Wolf,
  Role.Wolf,
  Role.Wolf,
  Role.Wolf,
  Role.Seer,
  Role.Witch,
  Role.Hunter,
  Role.Idiot,
  Role.Villager,
  Role.Villager,
  Role.Villager,
  Role.Villager,
];
function fixture(locale: "zh-CN" | "en") {
  const game = bootstrapGame(twelvePlayerStandardConfig, { locale, fixedRoles: roles });
  game.world.getComponent(7, COMPONENT.Alive)!.alive = false;
  return game;
}
function gunRequest(id?: number): ActionRequest {
  return {
    actorId: 7,
    phase: Phase.Day,
    allowedTools: ["shoot"],
    context: {
      day: 2,
      stage: "hunter_shot",
      trigger: "on_death",
      death_phase: Phase.Night,
      death_sources: [DeathCause.WolfKill],
      ...(id === undefined ? {} : { death_action_id: id }),
      visible_events: [],
      turn_constraints: { min_valid_actions: 1, max_valid_actions: 1 },
    },
  };
}

for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}: a death permit binds actor, tool, day, phase and generation; metadata alone grants nothing`, () => {
    const { world } = fixture(locale),
      other = fixture(locale).world,
      receive = new ActionReception(world);
    expect(receive.validate(gunRequest(), "shoot", { target_id: 1 })).toMatchObject({
      ok: false,
      error: "death_action_unavailable",
    });
    const first = world.openDeathAction(7, "shoot", Phase.Day, 2);
    expect(() => world.openDeathAction(7, "shoot", Phase.Day, 2)).toThrow(
      "death_action_already_open",
    );
    expect(receive.validate(gunRequest(first.id), "shoot", { target_id: 1 }).ok).toBe(true);
    expect(
      new ActionReception(other).validate(gunRequest(first.id), "shoot", { target_id: 1 }),
    ).toMatchObject({ ok: false, error: "death_action_unavailable" });
    const mutations = [
      { actorId: 9 },
      { phase: Phase.Voting },
      { context: { ...gunRequest(first.id).context, day: 3 } },
      { context: { ...gunRequest(first.id).context, death_action_id: first.id + 1 } },
      { context: { ...gunRequest(first.id).context, stage: "day_speech" as const } },
    ];
    for (const mutation of mutations)
      expect(
        receive.validate({ ...gunRequest(first.id), ...mutation }, "shoot", { target_id: 1 }).ok,
      ).toBe(false);
    const words: ActionRequest = {
      ...gunRequest(first.id),
      allowedTools: ["speak"],
      context: { ...gunRequest(first.id).context, stage: "last_words", trigger: "last_words" },
    };
    expect(receive.validate(words, "speak", { text: "forged" })).toMatchObject({
      ok: false,
      error: "death_action_unavailable",
    });
    first.close();
    first.close();
    expect(world.activeDeathActionCount).toBe(0);
    const second = world.openDeathAction(7, "shoot", Phase.Day, 2);
    expect(second.id).not.toBe(first.id);
    first.close();
    expect(world.hasDeathAction(7, "shoot", Phase.Day, 2, second.id)).toBe(true);
    expect(receive.validate(gunRequest(first.id), "shoot", { target_id: 1 }).ok).toBe(false);
    const turn = new ActionTurn(receive, gunRequest(second.id), "t1");
    expect(turn.submit("t1", "shoot", { target_id: 1 })).toMatchObject({
      ok: true,
      applied: false,
    });
    second.close();
    expect(
      new ToolGateway().validateAndSanitize(world, 7, turn.action!, {
        phase: Phase.Day,
        day: 2,
        deathActionId: second.id,
      }),
    ).toMatchObject({ ok: false, error: "death_action_unavailable" });
    expect(getHunterState(world.getComponent(7, COMPONENT.Role)!)!.canShoot).toBe(
      true,
    );
    expect(world.getComponent(1, COMPONENT.Alive)!.alive).toBe(true);
    if (locale === "en")
      expect(JSON.stringify(receive.validate(gunRequest(), "shoot", { target_id: 1 }))).not.toMatch(
        /\p{Script=Han}/u,
      );
  });

for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}: living or resurrected players cannot use a death scope`, () => {
    const { world } = fixture(locale),
      receive = new ActionReception(world);
    expect(() => world.openDeathAction(1, "shoot", Phase.Day, 2)).toThrow(
      "death_action_invalid_actor_or_stage",
    );
    expect(() => world.openDeathAction(7, "shoot", Phase.GameOver, 2)).toThrow(
      "death_action_invalid_actor_or_stage",
    );
    expect(() => world.openDeathAction(7, "shoot", Phase.Day, 0)).toThrow(
      "death_action_invalid_actor_or_stage",
    );
    const permit = world.openDeathAction(7, "shoot", Phase.Day, 2);
    world.getComponent(7, COMPONENT.Alive)!.alive = true;
    expect(receive.validate(gunRequest(permit.id), "shoot", { target_id: null })).toMatchObject({
      ok: false,
      error: "death_action_unavailable",
    });
    expect(
      new ToolGateway().validateAndSanitize(
        world,
        7,
        { name: "shoot", args: { target_id: 1 } },
        { phase: Phase.Day, day: 2 },
      ),
    ).toMatchObject({ ok: false, error: "shoot_unavailable" });
    permit.close();
    expect(world.activeDeathActionCount).toBe(0);
  });

for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}: resolver closes scopes on success, pass, exhaustion, original errors and stage interruption`, async () => {
    for (const outcome of [
      "shot",
      "pass",
      "invalid",
      "error",
      "abort",
      "phase",
      "day",
      "closed",
    ] as const) {
      const { world } = fixture(locale),
        events: GameEvent[] = [],
        state = { day: 2, phase: Phase.Day, gameOver: false, result: null };
      const error =
        outcome === "abort"
          ? new DOMException("synthetic-abort", "AbortError")
          : new Error("synthetic-decision-error");
      let request: ActionRequest | undefined;
      const settled = await new DeathResolution(
        world,
        events,
        new ToolGateway(),
        new EventRegistry(),
        state,
      )
        .resolve(
          [7],
          { 7: [DeathCause.WolfKill] },
          {
            async getAction(input) {
              request = input;
              expect(world.activeDeathActionCount).toBe(1);
              expect(
                world.hasDeathAction(7, "shoot", Phase.Day, 2, input.context.death_action_id),
              ).toBe(true);
              if (outcome === "error" || outcome === "abort") throw error;
              if (outcome === "phase") state.phase = Phase.Voting;
              if (outcome === "day") state.day = 3;
              if (outcome === "closed") world.closeDeathActions();
              return {
                name: "shoot",
                args: { target_id: outcome === "pass" ? null : outcome === "invalid" ? 999 : 1 },
              };
            },
          },
          Phase.Night,
          Phase.Day,
        )
        .catch((failure) => failure);
      expect(settled).toBe(outcome === "error" || outcome === "abort" ? error : undefined);
      expect(world.activeDeathActionCount).toBe(0);
      expect(
        new ActionReception(world).validate(request!, "shoot", { target_id: 1 }),
      ).toMatchObject({ ok: false, error: "death_action_unavailable" });
      expect(world.getComponent(1, COMPONENT.Alive)!.alive).toBe(
        outcome !== "shot",
      );
      expect(getHunterState(world.getComponent(7, COMPONENT.Role)!)!.canShoot).toBe(
        !["shot", "pass"].includes(outcome),
      );
      expect(events.filter((event) => event.type === "hunter_shot")).toHaveLength(
        outcome === "shot" ? 1 : 0,
      );
    }
  });

for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}: last words use their own scope, preserve errors and cannot survive a PhaseManager phase change`, async () => {
    const { world, phaseManager } = fixture(locale),
      events: GameEvent[] = [],
      state = { day: 1, phase: Phase.Day, gameOver: false, result: null },
      error = new Error("synthetic-last-words-error");
    let request: ActionRequest | undefined;
    expect(
      await new DeathResolution(world, events, new ToolGateway(), new EventRegistry(), state)
        .resolve(
          [7],
          { 7: [DeathCause.Poison] },
          {
            async getAction(input) {
              request = input;
              expect(input.context.stage).toBe("last_words");
              expect(
                new ActionReception(world).validate(input, "speak", { text: "authorized" }).ok,
              ).toBe(true);
              expect(
                new ActionReception(world).validate(
                  { ...input, allowedTools: ["shoot"] },
                  "shoot",
                  { target_id: 1 },
                ).ok,
              ).toBe(false);
              throw error;
            },
          },
          Phase.Night,
          Phase.Day,
        )
        .catch((failure) => failure),
    ).toBe(error);
    expect(world.activeDeathActionCount).toBe(0);
    expect(events.filter((event) => event.type === "last_words_spoken")).toEqual([]);
    expect(new ActionReception(world).validate(request!, "speak", { text: "late" })).toMatchObject({
      ok: false,
      error: "death_action_unavailable",
    });
    const permit = world.openDeathAction(7, "speak", Phase.Day, 1);
    phaseManager.jumpTo(Phase.Day);
    expect(world.activeDeathActionCount).toBe(0);
    expect(world.hasDeathAction(7, "speak", Phase.Day, 1, permit.id)).toBe(false);
    permit.close();
  });

for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}: death-revival-death and component replacement permanently expire the old generation`, () => {
    for (const transition of ["revive", "replace"] as const) {
      const { world } = fixture(locale),
        receive = new ActionReception(world),
        old = world.openDeathAction(7, "shoot", Phase.Day, 2);
      if (transition === "revive") {
        const alive = world.getComponent(7, COMPONENT.Alive)!;
        alive.alive = true;
        alive.alive = false; // No intermediate permission query may be required.
      } else world.addComponent(7, COMPONENT.Alive, createAliveComponent(false, locale));
      expect(receive.validate(gunRequest(old.id), "shoot", { target_id: 1 })).toMatchObject({
        ok: false,
        error: "death_action_unavailable",
      });
      expect(world.activeDeathActionCount).toBe(0);
      const fresh = world.openDeathAction(7, "shoot", Phase.Day, 2);
      old.close();
      expect(world.isDeathActionOpen(7, "shoot", fresh.id)).toBe(true);
      expect(receive.validate(gunRequest(old.id), "shoot", { target_id: 1 }).ok).toBe(false);
      fresh.close();
      expect(world.activeDeathActionCount).toBe(0);
    }
  });

for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}: revocation after final gateway validation but before hook consumption discards shots and passes`, async () => {
    for (const revoke of ["phase", "day", "game_over", "closed", "revive"] as const)
      for (const pass of [false, true]) {
        const { world } = fixture(locale),
          events: GameEvent[] = [],
          state = { day: 2, phase: Phase.Day, gameOver: false, result: null };
        let revoked = false;
        await new DeathResolution(
          world,
          events,
          new ToolGateway(),
          new EventRegistry(),
          state,
        ).resolve(
          [7],
          { 7: [DeathCause.WolfKill] },
          {
            async getAction() {
              // The first microtask lets the async provider resume; the second runs after
              // the resolver's gateway but before the awaiting Hunter hook resumes.
              queueMicrotask(() =>
                queueMicrotask(() => {
                  revoked = true;
                  if (revoke === "phase") state.phase = Phase.Voting;
                  if (revoke === "day") state.day = 3;
                  if (revoke === "game_over") state.gameOver = true;
                  if (revoke === "closed") world.closeDeathActions();
                  if (revoke === "revive") {
                    const alive = world.getComponent(7, COMPONENT.Alive)!;
                    alive.alive = true;
                    alive.alive = false;
                  }
                }),
              );
              return { name: "shoot", args: { target_id: pass ? null : 1 } };
            },
          },
          Phase.Night,
          Phase.Day,
        );
        expect(revoked).toBe(true);
        expect(world.activeDeathActionCount).toBe(0);
        expect(world.getComponent(1, COMPONENT.Alive)!.alive).toBe(true);
        expect(
          getHunterState(world.getComponent(7, COMPONENT.Role)!)!.canShoot,
        ).toBe(true);
        expect(events.filter((event) => event.type === "hunter_shot")).toEqual([]);
      }
  });

for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}: private engine generations cannot reveal other actors' hidden windows through player observation`, () => {
    const observations: unknown[] = [],
      engineIds: number[] = [];
    for (const hiddenCount of [0, 1, 7]) {
      const { world } = fixture(locale);
      for (let i = 0; i < hiddenCount; i++) world.openDeathAction(7, "shoot", Phase.Day, 2).close();
      world.getComponent(9, COMPONENT.Alive)!.alive = false;
      const own = world.openDeathAction(9, "speak", Phase.Day, 2);
      const request: ActionRequest = {
        actorId: 9,
        phase: Phase.Day,
        allowedTools: ["speak"],
        context: {
          ...gunRequest().context,
          stage: "last_words",
          trigger: "last_words",
          death_action_id: own.id,
        },
      };
      const policy = new PlayerPromptPolicy(world, {
        toolSpecRegistry: getDefaultToolSpecRegistry(),
        roleCatalog: getDefaultRoleCatalog(),
        targetHintRegistry: getDefaultTargetHintRegistry(),
        phaseStageLocalizationRegistry: getDefaultPhaseStageLocalizationRegistry(),
        configRenderRegistry: getDefaultConfigRenderRegistry(),
        boardConfig: twelvePlayerStandardConfig,
      });
      const observation = policy.buildObservation(request);
      observations.push(observation);
      engineIds.push(own.id);
      expect(observation.request.context).not.toHaveProperty("death_action_id");
      expect(request.context.death_action_id).toBe(own.id); // Engine/reproduction input unchanged.
      expect(new ActionReception(world).validate(request, "speak", { text: "authorized" }).ok).toBe(
        true,
      );
      own.close();
    }
    expect(engineIds).toEqual([1, 2, 8]);
    expect(observations[0]).toEqual(observations[1]);
    expect(observations[0]).toEqual(observations[2]);
  });
