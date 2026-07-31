import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import type { ReplayDocument } from "@ai-werewolf-arena/replay-contract";
import { eventLabel } from "./offline-replay";
import { buildReplaySnapshot, phaseName, roleName } from "./replay-projection";

export const FRAMES_PER_EVENT = 90;

export function ReplayComposition({ replay }: { replay: ReplayDocument }) {
  const frame = useCurrentFrame();
  const eventIndex = Math.min(Math.floor(frame / FRAMES_PER_EVENT), replay.events.length - 1);
  const snapshot = buildReplaySnapshot(replay, eventIndex);
  const event = snapshot.event;
  const fade = interpolate(frame % FRAMES_PER_EVENT, [0, 10, 72, 90], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return <AbsoluteFill style={{ background: "radial-gradient(circle at 50% 45%, #263d58 0, #101b2a 42%, #060a11 100%)", color: "#f6f0df", fontFamily: "Inter, ui-sans-serif, system-ui", overflow: "hidden" }}>
    <div style={{ position: "absolute", inset: 32, border: "1px solid rgba(224,188,111,.25)", borderRadius: 28 }} />
    <div style={{ position: "absolute", top: 58, left: 72, color: "#e4c67d", fontSize: 19, fontWeight: 700, letterSpacing: 4 }}>AI WEREWOLF ARENA</div>
    <div style={{ position: "absolute", top: 56, right: 72, color: "#a9b8cb", fontSize: 20 }}>第 {snapshot.day} 天 · {phaseName(snapshot.phase)}</div>
    <div style={{ position: "absolute", left: "50%", top: "45%", width: 430, height: 250, transform: "translate(-50%, -50%)", borderRadius: "50%", border: "1px solid rgba(228,198,125,.5)", background: "radial-gradient(ellipse, #24384b, #101923 70%)", boxShadow: "0 0 70px rgba(228,198,125,.1)" }} />
    {snapshot.players.map((player, index) => {
      const angle = (Math.PI * 2 * index / snapshot.players.length) - Math.PI / 2;
      const left = 50 + Math.cos(angle) * 38;
      const top = 45 + Math.sin(angle) * 32;
      return <div key={player.playerId} style={{ position: "absolute", left: `${left}%`, top: `${top}%`, transform: "translate(-50%, -50%)", width: 114, textAlign: "center", opacity: player.alive ? 1 : .35 }}>
        <div style={{ width: 48, height: 48, margin: "0 auto 7px", display: "grid", placeItems: "center", borderRadius: "50%", border: `2px solid ${player.camp === "wolf" ? "#df7771" : "#75bbd7"}`, background: "#0d1620", fontSize: 22, fontWeight: 800 }}>{player.playerId}</div>
        <div style={{ fontSize: 15, fontWeight: 700 }}>{roleName(player.role)}{player.isSheriff ? " · 警长" : ""}</div>
      </div>;
    })}
    <div style={{ position: "absolute", left: 92, right: 92, bottom: 62, padding: "20px 24px", borderRadius: 16, background: "rgba(6,10,17,.82)", border: "1px solid rgba(231,216,179,.14)", opacity: fade }}>
      <div style={{ color: "#e4c67d", fontSize: 14, letterSpacing: 2, marginBottom: 8 }}>{event?.stage ?? event?.type ?? "对局开始"}</div>
      <div style={{ fontSize: 27, lineHeight: 1.35, fontWeight: 650 }}>{event ? eventLabel(event) : "暂无事件"}</div>
    </div>
  </AbsoluteFill>;
}
