import { Broadcaster } from "../../src/server/transport/broadcaster";
import { SessionManager } from "../../src/server/session_manager";

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("SessionManager", () => {
  test("can start a session and broadcast lifecycle events", async () => {
    const mockIo = {
      emit: jest.fn(),
      to: jest.fn().mockReturnThis(),
    };
    const broadcaster = new Broadcaster(mockIo as any);
    const sessions = new SessionManager(broadcaster, {
      defaultBoard: "six_player_mvp",
      maxDaysPerSession: 6,
      cycleDelayMs: 1,
    });

    const started = sessions.start();
    expect(started.running).toBe(true);
    expect(started.board).toBe("six_player_mvp");

    await wait(100);

    const calls = mockIo.emit.mock.calls
      .filter((call: any[]) => call[0] === "gameEvent")
      .map((call: any[]) => call[1]);

    expect(calls.some((event: any) => event.type === "session.game_started")).toBe(true);
    expect(calls.some((event: any) => event.type === "phase.changed")).toBe(true);
    expect(calls.some((event: any) => event.type === "game.over")).toBe(true);

    const firstEvent = calls[0];
    expect(firstEvent.id).toBeDefined();
    expect(firstEvent.seq).toBe(1);
    expect(firstEvent.sessionId).toBe(started.id);
    expect(firstEvent.publicState).toBeDefined();

    sessions.stop();
  });

  test("starting while running returns the current session", async () => {
    const mockIo = {
      emit: jest.fn(),
      to: jest.fn().mockReturnThis(),
    };
    const broadcaster = new Broadcaster(mockIo as any);
    const sessions = new SessionManager(broadcaster, {
      defaultBoard: "twelve_player_standard",
      maxDaysPerSession: 3,
      cycleDelayMs: 1,
    });

    const first = sessions.start();
    const second = sessions.start({ board: "six_player_mvp" });

    expect(second.id).toBe(first.id);
    expect(second.board).toBe(first.board);

    sessions.stop();
    await wait(10);
  });
});
