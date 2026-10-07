import { Composition, registerRoot } from "remotion";
import { ReplayComposition } from "./ReplayComposition";
import { FRAMES_PER_EVENT, type ReplayRenderInput } from "./replay-frame";

const empty: ReplayRenderInput = {
  locale: "zh-CN", timeZone: "UTC", replay: {
    schemaVersion: 2, perspective: "god", sessionId: "empty", meta: { board: "", startedAt: "", endedAt: "" },
    result: { winner: null, reason: null }, players: [], events: [],
  },
};
function ReplayRoot() {
  return <Composition id="Replay" component={ReplayComposition} defaultProps={empty} width={1280} height={720} fps={30}
    durationInFrames={1} calculateMetadata={({ props }) => ({ durationInFrames: Math.max(props.replay.events.length * FRAMES_PER_EVENT, 1) })} />;
}
registerRoot(ReplayRoot);
