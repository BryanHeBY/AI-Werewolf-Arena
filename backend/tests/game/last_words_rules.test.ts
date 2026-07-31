import { bootstrapGame } from "../../src/app/bootstrap";
import { COMPONENT } from "../../src/core/domain/components/names";
import { AliveComponent } from "../../src/core/domain/components/alive";
import { Phase } from "../../src/core/domain/model";
import { LastWordsMechanism } from "../../src/game/mechanisms/last_words/last_words_mechanism";
import { twelvePlayerStandardConfig } from "../../src/runtime/scenarios/twelve_player_standard";

describe("last words rules", () => {
  test("only first night deaths can receive last words", () => {
    const { world, playerIds } = bootstrapGame(twelvePlayerStandardConfig);
    const mechanism = new LastWordsMechanism();
    const events: any[] = [];
    const deadId = playerIds[0];
    const alive = world.getComponent<AliveComponent>(deadId, COMPONENT.Alive)!;
    alive.alive = false;

    mechanism.recordLastWordsGranted(world, [deadId], Phase.Night, Phase.Day, 1, events);
    expect(events.some((event) => event.type === "last_words_granted")).toBe(true);

    events.length = 0;
    mechanism.recordLastWordsGranted(world, [deadId], Phase.Night, Phase.Day, 2, events);
    expect(events.some((event) => event.type === "last_words_granted")).toBe(false);
  });

  test("voted out players receive last words, day self-destruct style deaths do not", () => {
    const { world, playerIds } = bootstrapGame(twelvePlayerStandardConfig);
    const mechanism = new LastWordsMechanism();
    const events: any[] = [];
    const deadId = playerIds[1];
    const alive = world.getComponent<AliveComponent>(deadId, COMPONENT.Alive)!;
    alive.alive = false;

    mechanism.recordLastWordsGranted(world, [deadId], Phase.Voting, Phase.Voting, 3, events);
    expect(events.some((event) => event.type === "last_words_granted")).toBe(true);

    events.length = 0;
    mechanism.recordLastWordsGranted(world, [deadId], Phase.Day, Phase.Day, 3, events);
    expect(events.some((event) => event.type === "last_words_granted")).toBe(false);
  });

  test("grant rule helper matches expected matrix", () => {
    const mechanism = new LastWordsMechanism();
    expect(mechanism.shouldGrantLastWords(Phase.Night, 1)).toBe(true);
    expect(mechanism.shouldGrantLastWords(Phase.Night, 2)).toBe(false);
    expect(mechanism.shouldGrantLastWords(Phase.Voting, 4)).toBe(true);
    expect(mechanism.shouldGrantLastWords(Phase.Day, 1)).toBe(false);
  });
});
