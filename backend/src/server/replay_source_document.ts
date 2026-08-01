/** Compatibility boundary for API and legacy export callers. */
export {
  createReplayDocument as createReplaySourceDocument,
} from "../observability/replay_document";
export type {
  ReplayDocument as ReplaySourceDocument,
} from "../observability/replay_document";
