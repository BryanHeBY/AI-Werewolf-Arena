/**
 * 负责离线 Remotion composition 注册。输入为渲染 props，输出固定画幅／帧率与按展示事件计算的总帧数。
 * 空文档只是默认装配输入；真正归档仍经共用渲染输入校验，不读取工作台交互状态。
 */
import { Composition, registerRoot } from "remotion";
import { ReplayComposition } from "./ReplayComposition";
import { FRAMES_PER_EVENT, createReplayRenderInput } from "./replay-frame";

const empty = createReplayRenderInput({
  schemaVersion: 2,
  perspective: "god",
  sessionId: "empty",
  meta: { board: "", startedAt: "", endedAt: "" },
  result: { winner: null, reason: null },
  players: [],
  events: [],
});

function ReplayRoot() {
  return (
    <Composition
      id="Replay"
      component={ReplayComposition}
      defaultProps={empty}
      width={1280}
      height={720}
      fps={30}
      durationInFrames={1}
      calculateMetadata={({ props }) => ({
        durationInFrames: Math.max(props.replay.events.length * FRAMES_PER_EVENT, 1),
      })}
    />
  );
}
registerRoot(ReplayRoot);
