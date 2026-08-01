import { Broadcaster } from "../../src/server/transport/broadcaster";
import { RealtimeGameEvent } from "../../src/game/mechanisms/session/realtime_event_types";

describe("Broadcaster visibility routing", () => {
  test("public visibility should broadcast to all sockets", () => {
    const ioEmit = jest.fn();
    const socketEmit = jest.fn();
    const mockIo = {
      emit: ioEmit,
      to: jest.fn((socketId: string) => ({
        emit: (channel: string, event: RealtimeGameEvent) =>
          socketEmit(socketId, channel, event),
      })),
    };
    const broadcaster = new Broadcaster(mockIo as any);

    broadcaster.registerPlayer("socket-1", 1, "wolf");
    broadcaster.registerPlayer("socket-2", 2, "villager");

    const event: RealtimeGameEvent = {
      id: "game-1:evt:1",
      seq: 1,
      sessionId: "game-1",
      category: "phase",
      type: "phase.changed",
      day: 1,
      phase: "Sequential_Speech",
      timestamp: Date.now(),
      data: { phase: "day" },
      visibility: { scope: "public" },
    };
    broadcaster.broadcast(event);

    expect(ioEmit).toHaveBeenCalledWith("gameEvent", event);
    expect(socketEmit).not.toHaveBeenCalled();
  });

  test("wolves_only visibility should only route to wolf sockets", () => {
    const ioEmit = jest.fn();
    const socketEmit = jest.fn();
    const mockIo = {
      emit: ioEmit,
      to: jest.fn((socketId: string) => ({
        emit: (channel: string, event: RealtimeGameEvent) =>
          socketEmit(socketId, channel, event),
      })),
    };
    const broadcaster = new Broadcaster(mockIo as any);

    broadcaster.registerPlayer("socket-1", 1, "wolf");
    broadcaster.registerPlayer("socket-2", 2, "villager");
    broadcaster.registerPlayer("socket-3", 3, "wolf");

    const event: RealtimeGameEvent = {
      id: "game-1:evt:2",
      seq: 2,
      sessionId: "game-1",
      category: "agent",
      type: "agent.thinking",
      day: 1,
      phase: "Night_Start",
      timestamp: Date.now(),
      data: { actorId: 1, text: "test" },
      visibility: { scope: "wolves_only" },
    };
    broadcaster.broadcast(event);

    expect(ioEmit).not.toHaveBeenCalled();
    expect(socketEmit).toHaveBeenCalledTimes(2);
    expect(socketEmit).toHaveBeenCalledWith("socket-1", "gameEvent", event);
    expect(socketEmit).toHaveBeenCalledWith("socket-3", "gameEvent", event);
  });

  test("private_targets visibility should only route to target players", () => {
    const ioEmit = jest.fn();
    const socketEmit = jest.fn();
    const mockIo = {
      emit: ioEmit,
      to: jest.fn((socketId: string) => ({
        emit: (channel: string, event: RealtimeGameEvent) =>
          socketEmit(socketId, channel, event),
      })),
    };
    const broadcaster = new Broadcaster(mockIo as any);

    broadcaster.registerPlayer("socket-1", 1, "wolf");
    broadcaster.registerPlayer("socket-2", 2, "villager");
    broadcaster.registerPlayer("socket-3", 3, "seer");

    const event: RealtimeGameEvent = {
      id: "game-1:evt:3",
      seq: 3,
      sessionId: "game-1",
      category: "player_action",
      type: "player.action.check",
      day: 1,
      phase: "Night_Start",
      timestamp: Date.now(),
      data: { actorId: 3, targetId: 1, isWerewolf: true },
      visibility: { scope: "private_targets", targetPlayerIds: [2, 3, 99] },
    };
    broadcaster.broadcast(event);

    expect(ioEmit).not.toHaveBeenCalled();
    expect(socketEmit).toHaveBeenCalledTimes(2);
    expect(socketEmit).toHaveBeenCalledWith("socket-2", "gameEvent", event);
    expect(socketEmit).toHaveBeenCalledWith("socket-3", "gameEvent", event);
  });
});
