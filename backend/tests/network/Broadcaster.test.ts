import { Broadcaster } from "../../src/broadcaster/Broadcaster";
import { BroadcastEventType, BroadcastEvent } from "../../src/core/types";

describe("Broadcaster Network Tests", () => {
  let mockIo: any;
  let broadcaster: Broadcaster;

  beforeEach(() => {
    mockIo = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
    };
    broadcaster = new Broadcaster(mockIo as any);
  });

  test("should register and unregister players correctly", () => {
    broadcaster.registerPlayer("socket-1", 1);
    expect(broadcaster.getPlayerIdBySocket("socket-1")).toBe(1);
    expect(broadcaster.getSocketByPlayer(1)).toBe("socket-1");

    broadcaster.unregisterSocket("socket-1");
    expect(broadcaster.getPlayerIdBySocket("socket-1")).toBeUndefined();
    expect(broadcaster.getSocketByPlayer(1)).toBeUndefined();
  });

  test("should broadcast to specific player", () => {
    broadcaster.registerPlayer("socket-1", 1);

    const event: BroadcastEvent = {
      type: BroadcastEventType.PhaseChanged,
      data: {},
      timestamp: Date.now(),
    };

    const result = broadcaster.broadcastToPlayer(1, event);
    expect(result).toBe(true);
    expect(mockIo.to).toHaveBeenCalledWith("socket-1");
    expect(mockIo.emit).toHaveBeenCalledWith("gameEvent", event);
  });

  test("should return false when broadcasting to non-existent player", () => {
    const event: BroadcastEvent = {
      type: BroadcastEventType.PhaseChanged,
      data: {},
      timestamp: Date.now(),
    };

    const result = broadcaster.broadcastToPlayer(999, event);
    expect(result).toBe(false);
  });

  test("should broadcast to room", () => {
    const event: BroadcastEvent = {
      type: BroadcastEventType.PhaseChanged,
      data: {},
      timestamp: Date.now(),
    };

    broadcaster.broadcastToRoom("wolf-room", event);
    expect(mockIo.to).toHaveBeenCalledWith("wolf-room");
    expect(mockIo.emit).toHaveBeenCalledWith("gameEvent", event);
  });

  test("should broadcast simple event without view", () => {
    const event: BroadcastEvent = {
      type: BroadcastEventType.PhaseChanged,
      data: {},
      timestamp: Date.now(),
    };

    broadcaster.broadcast(event);
    expect(mockIo.emit).toHaveBeenCalledWith("gameEvent", event);
  });
});
