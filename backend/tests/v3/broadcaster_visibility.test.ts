import { Broadcaster, RealtimeGameEvent } from "../../src/infra/transport/broadcaster";

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
      type: "phase_changed",
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
      type: "wolf_discussion",
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
      type: "seer_checked",
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
