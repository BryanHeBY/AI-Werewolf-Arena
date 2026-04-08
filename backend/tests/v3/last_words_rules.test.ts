import { bootstrapGame } from "../../src/app/bootstrap";
import { COMPONENT } from "../../src/domain/components/names";
import { AliveComponent } from "../../src/domain/components/alive";
import { Phase } from "../../src/domain/model";
import { EventRegistry } from "../../src/engine/event_registry";
import { twelvePlayerStandardConfig } from "../../src/scenarios/twelve_player_standard";

describe("last words rules", () => {
  test("only first night deaths can receive last words at night", () => {
    const { world, playerIds } = bootstrapGame(twelvePlayerStandardConfig);
    const registry = new EventRegistry();
    const events: any[] = [];
    const deadId = playerIds[0];
    const alive = world.getComponent<AliveComponent>(deadId, COMPONENT.Alive)!;
    alive.alive = false;

    registry.recordLastWords(world, [deadId], Phase.Night, 1, events);
    expect(events.some((event) => event.type === "last_words_granted")).toBe(true);

    events.length = 0;
    registry.recordLastWords(world, [deadId], Phase.Night, 2, events);
    expect(events.some((event) => event.type === "last_words_granted")).toBe(false);
  });

  test("voted out players receive last words, day self-destruct style deaths do not", () => {
    const { world, playerIds } = bootstrapGame(twelvePlayerStandardConfig);
    const registry = new EventRegistry();
    const events: any[] = [];
    const deadId = playerIds[1];
    const alive = world.getComponent<AliveComponent>(deadId, COMPONENT.Alive)!;
    alive.alive = false;

    registry.recordLastWords(world, [deadId], Phase.Voting, 3, events);
    expect(events.some((event) => event.type === "last_words_granted")).toBe(true);

    events.length = 0;
    registry.recordLastWords(world, [deadId], Phase.Day, 3, events);
    expect(events.some((event) => event.type === "last_words_granted")).toBe(false);
  });

  test("grant rule helper matches expected matrix", () => {
    const registry = new EventRegistry();
    expect(registry.shouldGrantLastWords(Phase.Night, 1)).toBe(true);
    expect(registry.shouldGrantLastWords(Phase.Night, 2)).toBe(false);
    expect(registry.shouldGrantLastWords(Phase.Voting, 4)).toBe(true);
    expect(registry.shouldGrantLastWords(Phase.Day, 1)).toBe(false);
  });
});

