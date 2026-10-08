import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { buildReplayFrame, FRAMES_PER_EVENT, type ReplayRenderInput } from "./replay-frame";
export { FRAMES_PER_EVENT } from "./replay-frame";

export function ReplayComposition(input: ReplayRenderInput) {
  const frame = useCurrentFrame();
  return <ReplayFrame input={input} frame={frame} />;
}

/** The exact frame view used by the Player and offline composition. */
export function ReplayFrame({ input, frame }: { input: ReplayRenderInput; frame: number }) {
  const view = buildReplayFrame(input, frame);
  const fade = interpolate(frame % FRAMES_PER_EVENT, [0, 10, 72, 90], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return <AbsoluteFill style={{ background: "radial-gradient(circle at 50% 45%, #263d58 0, #101b2a 42%, #060a11 100%)", color: "#f6f0df", fontFamily: "Inter, ui-sans-serif, system-ui", overflow: "hidden" }}>
    <div style={{ position: "absolute", inset: 32, border: "1px solid rgba(224,188,111,.25)", borderRadius: 28 }} />
    <div style={{ position: "absolute", top: 58, left: 72, color: "#e4c67d", fontSize: 19, fontWeight: 700, letterSpacing: 4 }}>AI WEREWOLF ARENA</div>
    <div data-testid="composition-phase" style={{ position: "absolute", top: 56, right: 72, color: "#a9b8cb", fontSize: 20 }}>{view.dayPhase}</div>
    <div style={{ position: "absolute", left: "50%", top: "38%", width: 430, height: 250, transform: "translate(-50%, -50%)", borderRadius: "50%", border: "1px solid rgba(228,198,125,.5)", background: "radial-gradient(ellipse, #24384b, #101923 70%)", boxShadow: "0 0 70px rgba(228,198,125,.1)" }} />
    {view.players.map((player, index) => {
      const angle = (Math.PI * 2 * index / view.players.length) - Math.PI / 2;
      const left = 50 + Math.cos(angle) * 38;
      const top = 38 + Math.sin(angle) * 21;
      return <div key={player.playerId} data-composition-player={player.playerId} data-testid={player.isWinner ? "composition-winner" : undefined} style={{ position: "absolute", left: `${left}%`, top: `${top}%`, transform: "translate(-50%, -50%)", width: 114, textAlign: "center", opacity: player.alive ? 1 : player.isWinner ? .75 : .35 }}>
        <div style={{ width: 48, height: 48, margin: "0 auto 7px", display: "grid", placeItems: "center", borderRadius: "50%", border: `2px solid ${player.camp === "wolf" ? "#df7771" : "#75bbd7"}`, background: "#0d1620", fontSize: 22, fontWeight: 800 }}>{player.playerId}</div>
        {player.name && <div style={{ fontSize: 14, overflowWrap: "anywhere" }}>{player.name}</div>}
        <div style={{ fontSize: 15, fontWeight: 700 }}>{player.roleLabel}{player.sheriffLabel ? ` · ${player.sheriffLabel}` : ""}</div>
        {player.isWinner && <div style={{ color: "#e4c67d", fontSize: 14 }}>{view.winnerLabel}</div>}
      </div>;
    })}
    <div data-testid="composition-caption" style={{ position: "absolute", left: 92, right: 92, bottom: 62, padding: "20px 24px", borderRadius: 16, background: "rgba(6,10,17,.82)", border: "1px solid rgba(231,216,179,.14)", opacity: fade }}>
      <div style={{ color: "#e4c67d", fontSize: 14, letterSpacing: 2, marginBottom: 8 }}>{view.stage} · {view.time}</div>
      <div data-testid="composition-event" data-event-seq={view.eventSeq ?? ""} style={{ fontSize: 27, lineHeight: 1.35, fontWeight: 650 }}>{view.label}</div>
      {view.victory && <div data-testid="composition-victory" style={{ marginTop: 8, color: "#e4c67d", fontSize: 18 }}>{view.victory}</div>}
    </div>
  </AbsoluteFill>;
}
