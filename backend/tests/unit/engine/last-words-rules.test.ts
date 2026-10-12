/**
 * Unit tests: Last-word eligibility uses fixed first-night, exile and self-destruct
 * deaths; literal allow/deny assertions check the request rule without running an election
 * or full game. Inputs and expected outcomes remain the original literal or
 * immutable-fixture oracle; these module assertions invoke no model or complete-game
 * driver.
 */
import { bootstrapGame } from "../../../src/app/bootstrap";
import { COMPONENT } from "../../../src/core/domain/components/names";
import { AliveComponent } from "../../../src/core/domain/components/alive";
import { Phase, DeathCause } from "../../../src/core/domain/model";
import { LastWordsMechanism } from "../../../src/game/mechanisms/last_words/last_words_mechanism";
import { twelvePlayerStandardConfig } from "../../../src/runtime/scenarios/twelve_player_standard";

describe("last words rules", () => {
  test("only first night deaths can receive last words", () => {
    const { world, playerIds } = bootstrapGame(twelvePlayerStandardConfig);
    const mechanism = new LastWordsMechanism();
    const events: any[] = [];
    const deadId = playerIds[0];
    const alive = world.getComponent<AliveComponent>(deadId, COMPONENT.Alive)!;
    alive.alive = false;

    mechanism.recordLastWordsGranted(world, [deadId], Phase.Night, Phase.Day, 1, events, {
      [deadId]: [DeathCause.WolfKill],
    });
    expect(events.some((event) => event.type === "last_words_granted")).toBe(true);

    events.length = 0;
    mechanism.recordLastWordsGranted(world, [deadId], Phase.Night, Phase.Day, 2, events, {
      [deadId]: [DeathCause.WolfKill],
    });
    expect(events.some((event) => event.type === "last_words_granted")).toBe(false);
  });

  test("voted out players receive last words, day self-destruct style deaths do not", () => {
    const { world, playerIds } = bootstrapGame(twelvePlayerStandardConfig);
    const mechanism = new LastWordsMechanism();
    const events: any[] = [];
    const deadId = playerIds[1];
    const alive = world.getComponent<AliveComponent>(deadId, COMPONENT.Alive)!;
    alive.alive = false;

    mechanism.recordLastWordsGranted(world, [deadId], Phase.Voting, Phase.Voting, 3, events, {
      [deadId]: [DeathCause.Exile],
    });
    expect(events.some((event) => event.type === "last_words_granted")).toBe(true);

    events.length = 0;
    mechanism.recordLastWordsGranted(world, [deadId], Phase.Day, Phase.Day, 3, events, {
      [deadId]: [DeathCause.SelfDestruct],
    });
    expect(events.some((event) => event.type === "last_words_granted")).toBe(false);
  });
});
