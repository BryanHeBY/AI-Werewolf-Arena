import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { COMPONENT, Phase, Role, type RoleComponent, type GameEvent } from "../../../src/core";
import { GameActionRequestFactory } from "../../../src/game/engine/action_request_factory";
import { ObservedPlayersActionProvider } from "../../../src/ai/agents/providers/observed_players";
import type { PlayerObservation } from "../../../src/ai/agents/player/observation";
import { AgentEventVisibilityRegistry } from "../../../src/game/mechanisms/broadcast/agent_event_visibility_registry";
import { magicianTwelveConfig } from "../../../src/runtime/scenarios/magician_twelve";
import {
  beginMagicianNight,
  commitMagicianExchange,
} from "../../../src/game/mechanisms/roles/magician/night_frame";
import { getMagicianState } from "../../../src/game/mechanisms/roles/magician/state";
for (const locale of ["zh-CN", "en"] as const)
  test(
    "Magician observation owns detached frozen history and never exposes another actor's mapping/" +
      locale,
    async () => {
      const config = structuredClone(magicianTwelveConfig),
        f = bootstrapGame(config, { locale });
      const actor = f.world
        .entityIds()
        .find(
          (id) => f.world.getComponent<RoleComponent>(id, COMPONENT.Role)?.role === Role.Magician,
        )!;
      const villager = f.world
        .entityIds()
        .find(
          (id) => f.world.getComponent<RoleComponent>(id, COMPONENT.Role)?.role === Role.Villager,
        )!;
      const seen: PlayerObservation[] = [];
      const provider = new ObservedPlayersActionProvider(
        f.world,
        new Map(
          [actor, villager].map((id) => [
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
      beginMagicianNight(f.world, 1);
      await provider.getAction(request(actor));
      expect(seen[0]!.ownState.magician?.history).toEqual([]);
      expect(Object.isFrozen(seen[0]!.ownState.magician)).toBe(true);
      expect(() => seen[0]!.ownState.magician!.history.push({ day: 1, pair: null })).toThrow();
      const pair: [number, number] = actor < villager ? [actor, villager] : [villager, actor];
      commitMagicianExchange(f.world, actor, 1, pair);
      await provider.getAction(request(actor));
      expect(seen[0]!.ownState.magician!.history).toEqual([]);
      expect(seen[1]!.ownState.magician!.history).toEqual([{ day: 1, pair }]);
      const state = getMagicianState(f.world.getComponent<RoleComponent>(actor, COMPONENT.Role))!;
      expect(seen[1]!.ownState.magician!.history).not.toBe(state.history);
      expect(seen[1]!.ownState.magician!.history[0]!.pair).not.toBe(state.history[0]!.pair);
      expect(Object.isFrozen(seen[1]!.ownState.magician!.history[0]!.pair)).toBe(true);
      await provider.getAction(request(villager));
      expect(seen[2]!.ownState.magician).toBeUndefined();
    },
  );
test("Magician exchange visibility requires valid fact and exact singleton owner audience", () => {
  const f = bootstrapGame(structuredClone(magicianTwelveConfig));
  const actor = f.world
    .entityIds()
    .find((id) => f.world.getComponent<RoleComponent>(id, COMPONENT.Role)?.role === Role.Magician)!;
  const other = f.world.entityIds().find((id) => id !== actor)!;
  const registry = new AgentEventVisibilityRegistry();
  const event: GameEvent = {
    timestamp: 0,
    type: "magician_exchange_committed",
    payload: { actorId: actor, day: 1, pair: null },
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
