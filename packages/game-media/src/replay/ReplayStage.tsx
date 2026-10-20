/**
 * 负责 Remotion 播放器及传输控件装配。输入为展示复盘、显示选项与外部播放状态，输出帧画面和跳转／播放回调。
 * 帧与播放状态的同步归共用 hook，画面投影归 composition；本组件不以席位筛选重建归档事件。
 */
import { text } from "@ai-werewolf-arena/game-text";
import type { ReplayDisplayOptions } from "./replay-display";
import { Player, type PlayerRef } from "@remotion/player";
import { useMemo, type CSSProperties, type RefObject } from "react";
import type { PresentationReplay } from "./replay-presentation";
import { ReplayComposition } from "./ReplayComposition";
import type { VideoPlan } from "../video/plan";

interface ReplayStageProps {
  replay: PresentationReplay;
  display: ReplayDisplayOptions;
  activeIndex: number;
  currentFrame: number;
  durationInFrames: number;
  playing: boolean;
  playbackRate?: number;
  videoPlan?: VideoPlan;
  onPlaybackRateChange?: (rate: number) => void;
  onSeekToFrame: (frame: number) => void;
  onToggleFullscreen: () => void;
  playerRef: RefObject<PlayerRef | null>;
  onJumpTo: (index: number) => void;
  onTogglePlayback: () => void;
  previousEventFrame?: number | null;
  nextEventFrame?: number | null;
}

export function ReplayStage({
  replay,
  activeIndex,
  currentFrame,
  durationInFrames,
  playing,
  playbackRate = 1,
  videoPlan,
  onPlaybackRateChange,
  onSeekToFrame,
  onToggleFullscreen,
  display,
  playerRef,
  onJumpTo,
  onTogglePlayback,
  previousEventFrame,
  nextEventFrame,
}: ReplayStageProps) {
  const eventCount = replay.events.length;
  const hasVideoContent = videoPlan
    ? videoPlan.shots.some(
        (shot) => shot.sourceSeqs.length > 0 || shot.sourceFacts.length > 0 || shot.kind === "hold",
      )
    : eventCount > 0;
  // Remotion 会在 inputProps 引用变化时重建播放配置；无关帧状态更新不应更换这个对象。
  const inputProps = useMemo(
    () => ({ replay, locale: display.locale, timeZone: display.timeZone, plan: videoPlan }),
    [replay, display.locale, display.timeZone, videoPlan],
  );

  return (
    <article className="stage panel">
      <div className="panel-heading">
        <div>
          <p className="section-kicker">{text(display.locale, "replay.kicker.stage")}</p>
          <h2>{text(display.locale, "replay.stage_title")}</h2>
        </div>
        <span className="progress">
          {eventCount === 0 ? "0 / 0" : `${activeIndex + 1} / ${eventCount}`}
        </span>
      </div>
      <div
        className="player-wrap"
        style={
          {
            "--video-aspect-ratio": `${videoPlan?.width ?? 1280} / ${videoPlan?.height ?? 720}`,
          } as CSSProperties
        }
      >
        <Player
          ref={playerRef}
          component={ReplayComposition}
          inputProps={inputProps}
          durationInFrames={durationInFrames}
          compositionWidth={videoPlan?.width ?? 1280}
          compositionHeight={videoPlan?.height ?? 720}
          fps={videoPlan?.fps ?? 30}
          controls={false}
          playbackRate={playbackRate}
          // 本画面没有音轨，初始静音以免音频设备启动阻塞首帧。
          initiallyMuted
          acknowledgeRemotionLicense
        />
      </div>
      <div className="frame-control">
        <label>
          <span>
            {text(display.locale, "replay.frame_position", {
              frame: currentFrame + 1,
              total: durationInFrames,
            })}
          </span>
          <input
            type="range"
            aria-label={text(display.locale, "replay.seek")}
            min={0}
            max={durationInFrames - 1}
            value={currentFrame}
            disabled={!hasVideoContent}
            onChange={(event) => onSeekToFrame(Number(event.target.value))}
          />
        </label>
      </div>
      <nav className="transport" aria-label={text(display.locale, "replay.navigation")}>
        <button
          type="button"
          onClick={() =>
            previousEventFrame === undefined
              ? onJumpTo(activeIndex - 1)
              : previousEventFrame !== null && onSeekToFrame(previousEventFrame)
          }
          disabled={
            previousEventFrame === undefined ? activeIndex <= 0 : previousEventFrame === null
          }
        >
          {text(display.locale, "replay.previous")}
        </button>
        <button
          type="button"
          className="primary"
          onClick={onTogglePlayback}
          disabled={!hasVideoContent}
        >
          {text(display.locale, playing ? "replay.pause" : "replay.play")}
        </button>
        <button
          type="button"
          onClick={() =>
            nextEventFrame === undefined
              ? onJumpTo(activeIndex + 1)
              : nextEventFrame !== null && onSeekToFrame(nextEventFrame)
          }
          disabled={
            nextEventFrame === undefined ? activeIndex >= eventCount - 1 : nextEventFrame === null
          }
        >
          {text(display.locale, "replay.next")}
        </button>
        <button type="button" onClick={onToggleFullscreen}>
          {text(display.locale, "replay.fullscreen")}
        </button>
        {onPlaybackRateChange && (
          <label className="playback-rate">
            {text(display.locale, "replay.playback_rate")}
            <select
              aria-label={text(display.locale, "replay.playback_rate")}
              value={playbackRate}
              onChange={(event) => onPlaybackRateChange(Number(event.target.value))}
            >
              {[0.5, 1, 1.5, 2, 3].map((rate) => (
                <option key={rate} value={rate}>
                  {rate}×
                </option>
              ))}
            </select>
          </label>
        )}
      </nav>
    </article>
  );
}
