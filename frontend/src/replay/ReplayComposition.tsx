import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import type { ReplayDocument } from "@ai-werewolf-arena/replay-contract";
import { eventLabel } from "./offline-replay";

export const FRAMES_PER_EVENT = 90;

export function ReplayComposition({ replay }: { replay: ReplayDocument }) {
  const frame = useCurrentFrame();
  const eventIndex = Math.min(Math.floor(frame / FRAMES_PER_EVENT), replay.events.length - 1);
  const event = replay.events[Math.max(0, eventIndex)];
  const fade = interpolate(frame % FRAMES_PER_EVENT, [0, 10, 72, 90], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ background: "linear-gradient(135deg, #07101f, #152c50)", color: "#eff6ff", padding: 72 }}>
      <div style={{ color: "#7dd3fc", fontSize: 28, letterSpacing: 3 }}>AI WEREWOLF ARENA · REPLAY</div>
      <div style={{ display: "flex", alignItems: "end", flex: 1, opacity: fade }}>
        <div>
          <div style={{ color: "#9fb3cc", fontSize: 30 }}>第 {event?.day ?? 0} 天 · {event?.phase ?? "准备中"}</div>
          <div style={{ fontSize: 64, fontWeight: 800, lineHeight: 1.15, marginTop: 18, maxWidth: 1040 }}>{event ? eventLabel(event) : "暂无事件"}</div>
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", color: "#b8c7da", fontSize: 24 }}>
        <span>{replay.meta.board}</span><span>{eventIndex + 1} / {replay.events.length}</span>
      </div>
    </AbsoluteFill>
  );
}
