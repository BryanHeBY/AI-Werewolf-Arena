/**
 * Unit tests check badge policy configuration, direct Idiot badge handling and bounded dead-action permit validation. Inputs are original literal boards, holder data and malformed contexts; exact request rejection, roundtrip and badge-hook assertions are the oracle. No death-resolution chain, native transport or model executes.
 */
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import {
  COMPONENT,
  DeathCause,
  Phase,
  Role,
  type ActionRequest,
  type BoardConfig,
  type GameEvent,
  type RuntimeSnapshot,
  type ToolCall,
} from "../../../../src/core";
import type { AliveComponent } from "../../../../src/core/domain/components/alive";
import { DeathResolution } from "../../../../src/game/engine/death_resolution";
import { EventRegistry } from "../../../../src/game/engine/event_registry";
import { ToolGateway } from "../../../../src/game/gateway/tool_gateway";
import { ActionReception } from "../../../../src/ai/agents/player/action_reception";
import { GameActionRequestFactory } from "../../../../src/game/engine/action_request_factory";
import {
  boardDefinitionFromConfig,
  parseBoardDefinition,
} from "../../../../src/runtime/config/board_definition";

function fixture(locale: "zh-CN" | "en" = "en", choice = true, idiot = false) {
  const roles = [
    Role.Wolf,
    idiot ? Role.Idiot : Role.Seer,
    Role.Villager,
    Role.Villager,
    Role.Villager,
    Role.Villager,
  ];
  const config: BoardConfig = {
    boardSize: 6,
    enableSheriff: true,
    initialSheriffSeat: 2,
    sheriff: {
      voteWeight: 2.25,
      badgePolicy: choice ? "awa_holder_choice_v1" : "awa_next_seat_v1",
    },
    hooks: { onDaybreak: false, onPreElection: false, onPreVote: false, onPerSpeechGap: false },
    roleSetups: [...new Set(roles)].map((role) => ({
      role,
      count: roles.filter((r) => r === role).length,
    })),
  };
  const { world } = bootstrapGame(config, { locale, fixedRoles: roles });
  const events: GameEvent[] = [];
  const state: RuntimeSnapshot = { day: 2, phase: Phase.Voting, gameOver: false, result: null };
  const gateway = new ToolGateway();
  const registry = new EventRegistry();
  const resolution = new DeathResolution(world, events, gateway, registry, state);
  const requests: ActionRequest[] = [];
  async function resolve(
    callback: (r: ActionRequest) => ToolCall | null = () => ({
      name: "choose_badge_successor",
      args: { target_id: 5 },
    }),
  ) {
    await resolution.resolve(
      [2],
      { 2: [DeathCause.Exile] },
      {
        async getAction(r) {
          if (r.context.stage !== "sheriff_badge_choice") return null;
          requests.push(r);
          return callback(r);
        },
      },
      Phase.Voting,
      Phase.Voting,
    );
  }
  return { world, events, state, gateway, registry, resolution, resolve, config, requests };
}

test("revealed Idiot destroys directly under holder choice without a dead permit", () => {
  const f = fixture("en", true, true);
  expect(f.registry.onVotedOut(f.world, 2, f.events).prevented).toBe(true);
  expect(f.world.getComponent<AliveComponent>(2, COMPONENT.Alive)?.alive).toBe(true);
  expect(f.events.filter((e) => e.type === "sheriff_badge_destroyed")).toHaveLength(1);
  expect(f.events.some((e) => e.type === "sheriff_badge_transferred")).toBe(false);
  expect(f.world.activeDeathActionCount).toBe(0);
});

test("badge preflight metadata alone grants nothing; malformed, stage/day/phase and generation changes reject", () => {
  const f = fixture();
  f.world.getComponent<AliveComponent>(2, COMPONENT.Alive)!.alive = false;
  const make = (id?: number) =>
    new GameActionRequestFactory(f.world, f.events, 2).create({
      phase: Phase.Voting,
      actorId: 2,
      allowedTools: ["choose_badge_successor"],
      stage: "sheriff_badge_choice",
      requiresAction: true,
      summary: { key: "request.summary.badge_choice" },
      context: {
        trigger: "badge_handoff",
        badge_candidates: [1, 3, 4, 5, 6],
        ...(id ? { death_action_id: id } : {}),
      },
    });
  const receive = new ActionReception(f.world);
  expect(receive.validate(make(), "choose_badge_successor", { target_id: 5 }).ok).toBe(false);
  const permit = f.world.openDeathAction(2, "choose_badge_successor", Phase.Voting, 2);
  const request = make(permit.id);
  expect(receive.validate(request, "choose_badge_successor", { target_id: null }).ok).toBe(true);
  for (const args of [{}, { target_id: true }, { target_id: 0 }, { target_id: 5, extra: true }])
    expect(receive.validate(request, "choose_badge_successor", args).ok).toBe(false);
  for (const context of [
    { ...request.context, day: 3 },
    { ...request.context, stage: "day_speech" as const },
    { ...request.context, trigger: "on_death" },
    { ...request.context, death_action_id: permit.id + 1 },
  ])
    expect(
      receive.validate({ ...request, context }, "choose_badge_successor", { target_id: 5 }).ok,
    ).toBe(false);
  expect(
    receive.validate({ ...request, phase: Phase.Day }, "choose_badge_successor", { target_id: 5 })
      .ok,
  ).toBe(false);
  permit.close();
  expect(receive.validate(request, "choose_badge_successor", { target_id: 5 }).ok).toBe(false);
});

for (const choice of [false, true])
  test(`${choice}: badge policy public round trip`, () => {
    const f = fixture("en", choice);
    const definition = boardDefinitionFromConfig("badge", f.config);
    expect(
      parseBoardDefinition(JSON.parse(JSON.stringify(definition))).config.sheriff?.badgePolicy,
    ).toBe(f.config.sheriff?.badgePolicy);
  });

test("unknown and disabled badge policy parameters fail before play", () => {
  const definition = boardDefinitionFromConfig("badge", fixture().config);
  expect(() =>
    parseBoardDefinition({
      ...definition,
      mechanisms: {
        ...definition.mechanisms,
        sheriff: { ...definition.mechanisms.sheriff, badgePolicy: "foreign" },
      },
    }),
  ).toThrow();
  expect(() =>
    parseBoardDefinition({
      ...definition,
      mechanisms: {
        ...definition.mechanisms,
        sheriff: {
          ...definition.mechanisms.sheriff,
          enabled: false,
          initialSeat: undefined,
          voteWeight: 1.5,
        },
      },
    }),
  ).toThrow("board_config_disabled_mechanism_parameters");
});
