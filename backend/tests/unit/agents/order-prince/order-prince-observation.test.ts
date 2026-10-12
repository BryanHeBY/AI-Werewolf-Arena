/**
 * Unit tests: Order Prince observations use private receipts and forged audiences; literal
 * owner fields and immutability assertions check exact audience authorization and detached
 * history. Inputs and expected outcomes remain the original literal or immutable-fixture
 * oracle; these module assertions invoke no model or complete-game driver.
 */
import { AgentEventVisibilityRegistry } from "../../../../src/game/mechanisms/broadcast/agent_event_visibility_registry";
import type { GameEvent } from "../../../../src/core";
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import { COMPONENT, Phase, Role, type RoleComponent } from "../../../../src/core";
import { GameActionRequestFactory } from "../../../../src/game/engine/action_request_factory";
import { ObservedPlayersActionProvider } from "../../../../src/ai/agents/providers/observed_players";
import type { PlayerObservation } from "../../../../src/ai/agents/player/observation";
import { orderPrinceTwelveConfig } from "../../../../src/runtime/scenarios/order_prince_twelve";
import {
  openOrderPrinceChoice,
  commitOrderPrinceChoice,
} from "../../../../src/game/mechanisms/roles/order_prince/authority";
import { getOrderPrinceState } from "../../../../src/game/mechanisms/roles/order_prince/state";
for (const locale of ["zh-CN", "en"] as const)
  test("Order Prince private observation is frozen and detached/" + locale, async () => {
    const config = structuredClone(orderPrinceTwelveConfig),
      f = bootstrapGame(config, { locale });
    const actor = f.world
      .entityIds()
      .find(
        (id) => f.world.getComponent<RoleComponent>(id, COMPONENT.Role)?.role === Role.OrderPrince,
      )!;
    const other = f.world.entityIds().find((id) => id !== actor)!;
    const seen: PlayerObservation[] = [];
    const provider = new ObservedPlayersActionProvider(
      f.world,
      new Map(
        [actor, other].map((id) => [
          id,
          {
            async decide(o: PlayerObservation) {
              seen.push(o);
              return null;
            },
          },
        ]),
      ),
      config,
    );
    const factory = new GameActionRequestFactory(f.world, f.phaseManager.getEvents(), 1);
    const request = (id: number) =>
      factory.create({
        actorId: id,
        phase: Phase.Voting,
        allowedTools: ["vote"],
        stage: "voting",
        requiresAction: false,
        summary: "Vote",
      });
    await provider.getAction(request(actor));
    expect(seen[0]!.ownState.orderPrince?.history).toEqual([]);
    expect(Object.isFrozen(seen[0]!.ownState.orderPrince)).toBe(true);
    expect(openOrderPrinceChoice(f.world, 1)).toBe(actor);
    commitOrderPrinceChoice(f.world, actor, 1, false);
    await provider.getAction(request(actor));
    const current = getOrderPrinceState(
      f.world.getComponent<RoleComponent>(actor, COMPONENT.Role),
    )!;
    expect(seen[0]!.ownState.orderPrince?.history).toEqual([]);
    expect(seen[1]!.ownState.orderPrince?.history).toEqual([{ day: 1, activate: false }]);
    expect(seen[1]!.ownState.orderPrince!.history[0]).not.toBe(current.history[0]);
    expect(Object.isFrozen(seen[1]!.ownState.orderPrince!.history[0])).toBe(true);
    await provider.getAction(request(other));
    expect(seen[2]!.ownState.orderPrince).toBeUndefined();
  });

test("Order Prince private receipt requires an exact owner audience", () => {
  const config = structuredClone(orderPrinceTwelveConfig),
    f = bootstrapGame(config);
  const actor = f.world
    .entityIds()
    .find(
      (id) => f.world.getComponent<RoleComponent>(id, COMPONENT.Role)?.role === Role.OrderPrince,
    )!;
  const other = f.world.entityIds().find((id) => id !== actor)!;
  const registry = new AgentEventVisibilityRegistry();
  const event: GameEvent = {
    timestamp: 0,
    type: "order_prince_choice_committed",
    payload: { actorId: actor, day: 1, activate: false },
    audience: [actor],
  };
  for (const id of f.world.entityIds())
    expect(registry.canView(f.world, event, id)).toBe(id === actor);
  expect(registry.canView(f.world, { ...event, audience: [actor, other] }, actor)).toBe(false);
  expect(registry.canView(f.world, { ...event, audience: [other] }, other)).toBe(false);
  const malformed = {
    ...event,
    payload: { ...event.payload, secret: "leak" },
  } as unknown as GameEvent;
  expect(registry.canView(f.world, malformed, actor)).toBe(false);
});
