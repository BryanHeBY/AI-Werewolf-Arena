import { PhaseStack } from "../../src/core/PhaseStackEngine";
import { GamePhase } from "../../src/core/types";

describe("PhaseStackEngine", () => {
  let phaseStack: PhaseStack;

  beforeEach(() => {
    phaseStack = new PhaseStack();
  });

  describe("PhaseStack basic operations", () => {
    test("should initialize with empty stack", () => {
      expect(phaseStack.depth).toBe(0);
      expect(phaseStack.peek()).toBeNull();
    });

    test("should push phases onto stack", () => {
      phaseStack.push(GamePhase.NightStart);
      expect(phaseStack.depth).toBe(1);

      phaseStack.push(GamePhase.WolfAction);
      expect(phaseStack.depth).toBe(2);
    });

    test("should peek at top phase without removing", () => {
      phaseStack.push(GamePhase.NightStart);
      phaseStack.push(GamePhase.WolfAction);

      const top = phaseStack.peek();
      expect(top?.phase).toBe(GamePhase.WolfAction);
      expect(phaseStack.depth).toBe(2); // Depth unchanged after peek
    });

    test("should pop phases from stack", () => {
      phaseStack.push(GamePhase.NightStart);
      phaseStack.push(GamePhase.WolfAction);

      const popped = phaseStack.pop();
      expect(popped?.phase).toBe(GamePhase.WolfAction);
      expect(phaseStack.depth).toBe(1);

      const popped2 = phaseStack.pop();
      expect(popped2?.phase).toBe(GamePhase.NightStart);
      expect(phaseStack.depth).toBe(0);

      const popped3 = phaseStack.pop();
      expect(popped3).toBeNull();
    });

    test("should clear stack", () => {
      phaseStack.push(GamePhase.NightStart);
      phaseStack.push(GamePhase.WolfAction);
      phaseStack.push(GamePhase.SeerAction);

      expect(phaseStack.depth).toBe(3);

      phaseStack.clear();
      expect(phaseStack.depth).toBe(0);
      expect(phaseStack.peek()).toBeNull();
    });
  });

  describe("PhaseStack context handling", () => {
    test("should push phase with context", () => {
      const context = { candidates: [1, 2, 3] };
      phaseStack.push(GamePhase.Sheriff_Speech, context);

      const top = phaseStack.peek();
      expect(top?.phase).toBe(GamePhase.Sheriff_Speech);
      expect(top?.context).toEqual(context);
    });

    test("should pop phase with context", () => {
      const context = { hasTie: true };
      phaseStack.push(GamePhase.PK_Speech, context);

      const popped = phaseStack.pop();
      expect(popped?.phase).toBe(GamePhase.PK_Speech);
      expect(popped?.context).toEqual(context);
    });
  });

  describe("PhaseStack max depth protection", () => {
    test("should prevent stack overflow", () => {
      // Fill stack to max depth
      for (let i = 0; i < 50; i++) {
        phaseStack.push(GamePhase.NightStart);
      }

      expect(phaseStack.depth).toBe(50);

      // Attempt to push beyond max depth should throw
      expect(() => {
        phaseStack.push(GamePhase.WolfAction);
      }).toThrow("PhaseStack exceeded maximum depth (50)");
    });
  });

  describe("PhaseStack special operations", () => {
    test("clearDayPhases should clear phases after Night_Start", () => {
      // Build a complex stack with day phases
      phaseStack.push(GamePhase.NightStart);
      phaseStack.push(GamePhase.WolfAction);
      phaseStack.push(GamePhase.SeerAction);
      phaseStack.push(GamePhase.WitchAction);
      phaseStack.push(GamePhase.DayStart);
      phaseStack.push(GamePhase.PublishNightResult);
      phaseStack.push(GamePhase.SequentialSpeech);

      expect(phaseStack.depth).toBe(7);

      phaseStack.clearDayPhases();

      // Should keep everything up to and including Night_Start
      expect(phaseStack.depth).toBe(1);

      const top = phaseStack.peek();
      expect(top?.phase).toBe(GamePhase.NightStart);
    });

    test("clearDayPhases should clear all if no Night_Start found", () => {
      phaseStack.push(GamePhase.DayStart);
      phaseStack.push(GamePhase.SequentialSpeech);
      phaseStack.push(GamePhase.Vote);

      expect(phaseStack.depth).toBe(3);

      phaseStack.clearDayPhases();

      expect(phaseStack.depth).toBe(0);
      expect(phaseStack.peek()).toBeNull();
    });
  });

  describe("PhaseStack edge cases", () => {
    test("should handle multiple push/pop operations", () => {
      const phases = [
        GamePhase.NightStart,
        GamePhase.WolfAction,
        GamePhase.SeerAction,
        GamePhase.WitchAction,
        GamePhase.DayStart,
      ];

      // Push all phases
      phases.forEach((phase) => phaseStack.push(phase));
      expect(phaseStack.depth).toBe(phases.length);

      // Pop all phases in reverse order
      const poppedPhases = [];
      while (phaseStack.depth > 0) {
        poppedPhases.push(phaseStack.pop()?.phase);
      }

      expect(poppedPhases).toEqual(phases.reverse());
      expect(phaseStack.depth).toBe(0);
    });

    test("should handle context mutation", () => {
      const originalContext = { players: [1, 2] };
      phaseStack.push(GamePhase.Sheriff_Vote, originalContext);

      // Mutating the original context should not affect stack
      originalContext.players.push(3);

      const popped = phaseStack.pop();
      // Stack should have the original context at push time
      expect(popped?.context).toEqual({ players: [1, 2] });
    });
  });
});
