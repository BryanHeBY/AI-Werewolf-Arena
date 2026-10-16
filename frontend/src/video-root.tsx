/**
 * 负责将通用视频计划和打包时注册的自定义图层接入 Remotion。输入为纯数据 props，输出唯一 composition。
 * 宽高、帧率和片长均读取同一计划；组件注册留在 bundle，不随 JSON 传输，不读取项目文件。
 */
import { Composition } from "remotion";
import { compileVideoPlan, VideoComposition } from "./video";
import type { ComponentProps } from "react";

type Registry = ComponentProps<typeof VideoComposition>["layerRegistry"];
const empty = compileVideoPlan({
  schemaVersion: 2,
  perspective: "god",
  sessionId: "empty",
  meta: { board: "", startedAt: "", endedAt: "" },
  result: { winner: null, reason: null },
  players: [],
  events: [],
});

export function createVideoRoot(layerRegistry?: Registry) {
  const Component = ({ plan }: { plan: typeof empty }) => (
    <VideoComposition plan={plan} layerRegistry={layerRegistry} mediaBaseUrl="./public/" />
  );
  const Root = () => (
    <Composition
      id="Replay"
      component={Component}
      defaultProps={{ plan: empty }}
      width={empty.width}
      height={empty.height}
      fps={empty.fps}
      durationInFrames={empty.durationFrames}
      calculateMetadata={({ props }) => ({
        width: props.plan.width,
        height: props.plan.height,
        fps: props.plan.fps,
        durationInFrames: props.plan.durationFrames,
      })}
    />
  );
  return Root;
}
