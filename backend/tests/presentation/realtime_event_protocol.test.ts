import { GameEvent } from "../../src/core/domain/model";
import { RealtimeEventRegistry } from "../../src/game/mechanisms/session/realtime_event_registry";
import { FrontendGameState } from "../../src/server/view_mapper";

function makeState(overrides: Partial<FrontendGameState> = {}): FrontendGameState {
  return {
    phase: "Sequential_Speech",
    round: 2,
    players: [
      {
        id: 1,
        name: "玩家1",
        roleType: "wolf",
        faction: "wolf",
        isAlive: true,
        isSheriff: false,
        voteWeight: 1,
      },
      {
        id: 2,
        name: "玩家2",
        roleType: "villager",
        faction: "villager",
        isAlive: false,
        isSheriff: false,
        voteWeight: 1,
      },
    ],
    deadPlayerIds: [2],
    history: [],
    witchHasAntidote: false,
    witchHasPoison: false,
    currentSpeechIndex: 0,
    alive_count: 1,
    pending_marks: [],
    last_action_id: "2-day-0",
    ...overrides,
  };
}

describe("RealtimeEventRegistry protocol", () => {
  const registry = new RealtimeEventRegistry();

  test("phase_changed should emit phase.changed with publicState", () => {
    const state = makeState({ phase: "Night_Start", round: 3 });
    const event: GameEvent = {
      timestamp: 100,
      type: "phase_changed",
      payload: { phase: "day", day: 3 },
    };

    const realtime = registry.translate(event, {
      nowState: state,
      getPlayerName: (id) => `玩家${id}`,
      getPlayerRole: () => "villager",
    });

    expect(realtime).toHaveLength(1);
    expect(realtime[0]).toMatchObject({
      category: "phase",
      type: "phase.changed",
      day: 3,
      phase: "Sequential_Speech",
      stage: "started",
      publicState: state,
    });
  });

  test("night_resolved should emit publicState on both summary and death events", () => {
    const state = makeState({ phase: "Night_Start", round: 2 });
    const event: GameEvent = {
      timestamp: 200,
      type: "night_resolved",
      payload: { deaths: [2] },
    };

    const realtime = registry.translate(event, {
      nowState: state,
      getPlayerName: (id) => `玩家${id}`,
      getPlayerRole: () => "villager",
    });

    expect(realtime).toHaveLength(2);
    expect(realtime[0]).toMatchObject({
      category: "night",
      type: "night.resolved",
      stage: "resolved",
      data: {
        deadPlayerIds: [2],
        peacefulNight: false,
      },
      publicState: state,
    });
    expect(realtime[1]).toMatchObject({
      category: "player_state",
      type: "player.died",
      actorId: 2,
      targetIds: [2],
      data: {
        playerId: 2,
        cause: "night_kill",
        roleType: "villager",
      },
      publicState: state,
    });
  });

  test("voted_out should emit vote.resolved and player.died with publicState", () => {
    const state = makeState();
    const event: GameEvent = {
      timestamp: 300,
      type: "voted_out",
      payload: { target: 2 },
    };

    const realtime = registry.translate(event, {
      nowState: state,
      getPlayerName: (id) => `玩家${id}`,
      getPlayerRole: () => "villager",
    });

    expect(realtime).toHaveLength(2);
    expect(realtime[0]).toMatchObject({
      category: "vote",
      type: "vote.resolved",
      stage: "resolved",
      targetIds: [2],
      data: {
        eliminatedPlayerId: 2,
        eliminatedPlayerName: "玩家2",
      },
      publicState: state,
    });
    expect(realtime[1]).toMatchObject({
      category: "player_state",
      type: "player.died",
      data: {
        playerId: 2,
        cause: "vote_out",
      },
      publicState: state,
    });
  });

  test("game_over should emit game.over with publicState and winner.declared", () => {
    const state = makeState({
      phase: "Game_Over",
      winner: "wolf",
    });
    const event: GameEvent = {
      timestamp: 400,
      type: "game_over",
      payload: { winner: "wolf", reason: "wolves_reached_majority" },
    };

    const realtime = registry.translate(event, {
      nowState: state,
      getPlayerName: (id) => `玩家${id}`,
      getPlayerRole: () => "villager",
    });

    expect(realtime).toHaveLength(2);
    expect(realtime[0]).toMatchObject({
      category: "result",
      type: "game.over",
      stage: "completed",
      data: {
        winner: "wolf",
        reason: "wolves_reached_majority",
      },
      publicState: state,
    });
    expect(realtime[1]).toMatchObject({
      category: "result",
      type: "winner.declared",
      data: {
        winner: "wolf",
      },
    });
    expect(realtime[1].publicState).toBeUndefined();
  });
});
