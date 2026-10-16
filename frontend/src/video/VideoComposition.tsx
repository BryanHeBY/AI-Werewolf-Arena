/**
 * 负责工作台预览与离线导出共用的视频画面和已备音频播放。输入为编译计划、帧与组件注册表，输出圆桌、图层、安全区字幕和音轨。
 * 纯 VideoFrame 可直接按帧测试；本层只读编排结果，不读取运行时游戏状态、不调用 TTS 或生成媒体。
 */
import { AbsoluteFill, Audio, Sequence, useCurrentFrame } from "remotion";
import { useMemo, type CSSProperties } from "react";
import { normalizeResolvedTheme, resolveTheme } from "../themes";
import { audioCueVolume, buildVideoFrame, resolveVideoMediaSource } from "./frame";
import type { VideoLayerRegistry, VideoPlan } from "./types";
import { VideoLayers } from "./VideoLayers";
import { BroadcastVideoFrame } from "./BroadcastVideoFrame";
import type { VideoThemeSlotRegistry } from "./theme-renderers";
import { VideoFonts } from "./VideoFonts";

export interface VideoCompositionProps {
  plan: VideoPlan;
  layerRegistry?: VideoLayerRegistry;
  mediaBaseUrl?: string;
  themeSlots?: VideoThemeSlotRegistry;
}
export function VideoComposition(props: VideoCompositionProps) {
  const frame = useCurrentFrame();
  return (
    <>
      <VideoFonts
        key={JSON.stringify(props.plan.fonts ?? [])}
        fonts={props.plan.fonts}
        mediaBaseUrl={props.mediaBaseUrl}
      />
      <VideoFrame {...props} frame={frame} />
      <VideoAudio plan={props.plan} mediaBaseUrl={props.mediaBaseUrl} />
    </>
  );
}
export function VideoAudio({ plan, mediaBaseUrl }: { plan: VideoPlan; mediaBaseUrl?: string }) {
  return plan.audio.map((cue) => {
    const asset = plan.media.find((item) => item.id === cue.assetId)!;
    return (
      <Sequence key={cue.id} from={cue.from} durationInFrames={cue.durationFrames} layout="none">
        <Audio
          src={resolveVideoMediaSource(asset.src, mediaBaseUrl)}
          trimBefore={cue.offsetFrames}
          volume={(frame) => audioCueVolume(cue, frame)}
        />
      </Sequence>
    );
  });
}
export function VideoFrame(props: VideoCompositionProps & { frame: number }) {
  // 旧已准备计划可缺新主题 token；按计划身份补齐一次，逐帧不重新编译或修改事实／脚本。
  const plan = useMemo(
    () => ({ ...props.plan, theme: normalizeResolvedTheme(props.plan.theme ?? resolveTheme()) }),
    [props.plan],
  );
  return plan.layout === "broadcast-v1" ? (
    <BroadcastVideoFrame {...props} plan={plan} />
  ) : (
    <LegacyVideoFrame {...props} plan={plan} />
  );
}
function LegacyVideoFrame({
  plan,
  frame,
  layerRegistry,
  mediaBaseUrl,
}: VideoCompositionProps & { frame: number }) {
  const view = buildVideoFrame(plan, frame);
  const event = view.currentView;
  const scale = Math.min(plan.width / 1280, plan.height / 720);
  const dense = event.players.length >= 10;
  const textStyle: CSSProperties = { overflowWrap: "anywhere", overflow: "hidden" };
  return (
    <AbsoluteFill
      data-video-shot={view.shot.id}
      style={{
        background: "radial-gradient(circle at 50% 40%, #263d58 0, #101b2a 48%, #060a11 100%)",
        color: "#f6f0df",
        fontFamily: "Inter, ui-sans-serif, system-ui",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 28 * scale,
          border: "1px solid rgba(224,188,111,.25)",
          borderRadius: 28 * scale,
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 48 * scale,
          left: 60 * scale,
          color: "#e4c67d",
          fontSize: 19 * scale,
          fontWeight: 700,
          letterSpacing: 4 * scale,
        }}
      >
        AI WEREWOLF ARENA
      </div>
      <div
        data-testid="composition-phase"
        style={{
          position: "absolute",
          top: 48 * scale,
          right: 60 * scale,
          color: "#b5c4d8",
          fontSize: 20 * scale,
        }}
      >
        {event.dayPhase}
      </div>
      <div
        data-video-world
        style={{
          position: "absolute",
          inset: 0,
          transform: view.transform,
          transformOrigin: "0 0",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: view.layout.table.x,
            top: view.layout.table.y,
            width: view.layout.table.width,
            height: view.layout.table.height,
            transform: "translate(-50%, -50%)",
            borderRadius: "50%",
            border: "1px solid rgba(228,198,125,.5)",
            background: "radial-gradient(ellipse, #24384b, #101923 70%)",
            boxShadow: "0 0 70px rgba(228,198,125,.1)",
          }}
        />
        {event.players.map((player) => {
          const seat = view.layout.seats.find((item) => item.playerId === player.playerId)!;
          return (
            <div
              key={player.playerId}
              data-composition-player={player.playerId}
              data-player-alive={player.alive ? "true" : "false"}
              data-testid={player.isWinner ? "composition-winner" : undefined}
              style={{
                position: "absolute",
                left: seat.x,
                top: seat.y,
                transform: "translate(-50%, -50%)",
                width: seat.width,
                height: seat.height,
                textAlign: dense ? "left" : "center",
                display: dense ? "flex" : "block",
                alignItems: "center",
                gap: 7 * scale,
                opacity: player.alive ? 1 : player.isWinner ? 0.75 : 0.35,
              }}
            >
              <div
                style={{
                  width: 44 * scale,
                  height: 44 * scale,
                  flexShrink: 0,
                  margin: dense ? 0 : `0 auto ${5 * scale}px`,
                  display: "grid",
                  placeItems: "center",
                  borderRadius: "50%",
                  border: `2px solid ${player.camp === "wolf" ? "#df7771" : "#75bbd7"}`,
                  background: "#0d1620",
                  fontSize: 22 * scale,
                  fontWeight: 800,
                }}
              >
                {player.playerId}
              </div>
              <div
                style={{
                  minWidth: 0,
                  maxHeight: dense ? 72 * scale : undefined,
                  overflow: "hidden",
                }}
              >
                {player.name && (
                  <div
                    style={{
                      ...textStyle,
                      fontSize: 13 * scale,
                      lineHeight: 1.2,
                      maxHeight: 31 * scale,
                    }}
                  >
                    {player.name}
                  </div>
                )}
                <div
                  style={{
                    ...textStyle,
                    fontSize: 14 * scale,
                    fontWeight: 700,
                    lineHeight: 1.2,
                    maxHeight: 34 * scale,
                  }}
                >
                  {player.roleLabel}
                  {player.sheriffLabel ? ` · ${player.sheriffLabel}` : ""}
                </div>
                {player.isWinner && (
                  <div style={{ color: "#e4c67d", fontSize: 13 * scale }}>{event.winnerLabel}</div>
                )}
              </div>
            </div>
          );
        })}
        <VideoLayers
          plan={plan}
          view={view}
          space="world"
          layerRegistry={layerRegistry}
          mediaBaseUrl={mediaBaseUrl}
        />
      </div>
      <VideoLayers
        plan={plan}
        view={view}
        space="screen"
        layerRegistry={layerRegistry}
        mediaBaseUrl={mediaBaseUrl}
      />
      <div
        data-testid="composition-caption"
        data-caption-page={view.captionPageIndex}
        style={{
          position: "absolute",
          left: view.layout.caption.x,
          top: view.layout.caption.y,
          width: view.layout.caption.width,
          height: view.layout.caption.height,
          boxSizing: "border-box",
          padding: `${13 * scale}px ${20 * scale}px`,
          borderRadius: 16 * scale,
          background: "rgba(6,10,17,.94)",
          border: "1px solid rgba(231,216,179,.2)",
          opacity: 1,
          overflow: "hidden",
          zIndex: 1000,
        }}
      >
        <div
          style={{
            color: "#e4c67d",
            fontSize: 13 * scale,
            lineHeight: 1.2,
            marginBottom: 7 * scale,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {event.stage} · {event.time}
        </div>
        <div
          data-testid="composition-event"
          data-event-seq={event.eventSeq ?? ""}
          style={{
            fontSize: 24 * scale,
            lineHeight: 1.28,
            fontWeight: 650,
            whiteSpace: "pre-wrap",
            overflowWrap: "anywhere",
            maxHeight: 94 * scale,
            overflow: "hidden",
          }}
        >
          {view.caption}
        </div>
        <div
          style={{
            position: "absolute",
            bottom: 8 * scale,
            right: 16 * scale,
            color: "#a9b8cb",
            fontSize: 11 * scale,
          }}
        >
          {view.shot.captionPages.length > 1
            ? `${view.captionPageIndex + 1} / ${view.shot.captionPages.length}`
            : ""}
        </div>
      </div>
      {event.victory && (
        <div
          data-testid="composition-victory"
          style={{
            position: "absolute",
            left: plan.width * 0.08,
            top: plan.height * 0.65,
            fontSize: 15 * scale,
            color: "#e4c67d",
            maxWidth: plan.width * 0.84,
            overflow: "hidden",
            whiteSpace: "nowrap",
            textOverflow: "ellipsis",
          }}
        >
          {event.victory}
        </div>
      )}
    </AbsoluteFill>
  );
}
