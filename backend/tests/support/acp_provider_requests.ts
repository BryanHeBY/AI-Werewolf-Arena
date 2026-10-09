import { Phase, type ActionRequest } from "../../src/core/domain/model";
export function speakRequest(actorId = 1): ActionRequest {
  return {
    actorId,
    phase: Phase.Day,
    allowedTools: ["speak"],
    context: {
      day: 1,
      stage: "day_speech",
      turn_constraints: { min_valid_actions: 1, max_valid_actions: 1 },
      visible_events: [{ seq: 1, type: "phase_changed", payload: { day: 1, phase: "day" } }],
    },
  };
}
