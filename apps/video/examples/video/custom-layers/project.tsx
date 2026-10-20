/**
 * 负责演示一份可直接运行的单局视频脚本。输入为已有两事件 fixture，输出镜头、图层、停留与自定义组件配置。
 * 这里只描述节目编排，不改变原对局事实；声线文本只保留准备信息，不调用 TTS。
 */
import { defineVideoProject } from "@ai-werewolf-arena/game-media/video-project";
import { Img } from "remotion";
import {
  resolveVideoMediaSource,
  type CustomVideoLayerProps,
  type VideoLayerRegistry,
} from "@ai-werewolf-arena/game-media/video/plan";

function DecisionBadge({ frame, props, plan, mediaBaseUrl }: CustomVideoLayerProps) {
  const marker = plan.media.find((asset) => asset.id === "marker")!;
  return (
    <div
      data-testid="custom-decision-badge"
      style={{
        position: "absolute",
        right: 48,
        top: 120,
        padding: "14px 22px",
        borderRadius: 12,
        color: "#ffedb0",
        background: "#263e55",
        border: "2px solid #ddb963",
        opacity: Math.min(1, (frame + 1) / 12),
        fontSize: 24,
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}
    >
      <Img src={resolveVideoMediaSource(marker.src, mediaBaseUrl)} width={36} height={36} />
      {String(props.text ?? "")}
    </div>
  );
}
export const layers: VideoLayerRegistry = { DecisionBadge };

export default defineVideoProject({
  input: "../../../tests/fixtures/six-player-mvp/sample/locale-unrecorded/god.replay.json",
  script: {
    source: { sessionId: "session_frontend_fixture", fingerprint: "fnv1a64:324fac06cf547954" },
    media: [{ id: "marker", kind: "image", src: "./marker.svg", width: 96, height: 96 }],
    edits: [
      {
        anchor: { seq: 1, type: "phase_changed" },
        durationFrames: 120,
        camera: [
          { frame: 0, target: "table", zoom: 1 },
          { frame: 24, target: { playerIds: [1] }, zoom: 1.7, easing: "hold" },
          { frame: 72, target: { playerIds: [1] }, zoom: 1.7 },
          { frame: 110, target: "table", zoom: 1 },
        ],
        layers: [
          { id: "focus-1", kind: "highlight", playerIds: [1], from: 20, durationFrames: 65 },
        ],
      },
    ],
    holds: [
      {
        id: "decision-review",
        after: { seq: 2, type: "voted_out" },
        durationFrames: 90,
        caption: "这一镜头保留放逐后的真实状态，并叠加单局说明。",
        layers: [
          {
            id: "badge",
            kind: "custom",
            component: "DecisionBadge",
            space: "screen",
            props: { text: "单局自定义说明" },
          },
          {
            id: "arrow",
            kind: "arrow",
            fromTarget: { playerId: 1 },
            toTarget: { playerId: 2 },
            color: "#e4c67d",
          },
        ],
        speech: [{ speaker: "god", text: "这是留给后续配音的解说稿。" }],
      },
    ],
  },
});
