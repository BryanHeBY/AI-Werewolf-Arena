/**
 * Owns test builder support: Literal bounded ACP speak ActionRequest with the original visible-event and turn-constraint fields.
 * Inputs are original configs, raw component objects and caller-supplied fields;
 * outputs are the original explicit fixture values. Unit and scenario tests use
 * unchanged handwritten literals and identity snapshots as the independent oracle.
 * This builder never runs a whole game, transport or production rule verifier.
 */
import { Phase, type ActionRequest } from "../../../../src/core/domain/model";
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
