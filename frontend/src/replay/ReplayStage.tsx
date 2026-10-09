import { text } from "@ai-werewolf-arena/game-text";
import type { ReplayDisplayOptions } from "./replay-display";
import { Player, type PlayerRef } from "@remotion/player";
import { useMemo, type RefObject } from "react";
import type { PresentationReplay } from "./replay-presentation";
import { FRAMES_PER_EVENT, ReplayComposition } from "./ReplayComposition";

interface ReplayStageProps {
  replay: PresentationReplay;
  display: ReplayDisplayOptions;
  activeIndex: number;
  currentFrame: number;
  durationInFrames: number;
  playing: boolean;
  onSeekToFrame: (frame: number) => void;
  onToggleFullscreen: () => void;
  playerRef: RefObject<PlayerRef | null>;
  onJumpTo: (index: number) => void;
  onTogglePlayback: () => void;
}

export function ReplayStage({
  replay,
  activeIndex,
  currentFrame,
  durationInFrames,
  playing,
  onSeekToFrame,
  onToggleFullscreen,
  display,
  playerRef,
  onJumpTo,
  onTogglePlayback,
}: ReplayStageProps) {
  const eventCount = replay.events.length;
  // Remotion rebuilds playback configuration when inputProps identity changes.
  const inputProps = useMemo(
    () => ({ replay, locale: display.locale, timeZone: display.timeZone }),
    [replay, display.locale, display.timeZone],
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
      <div className="player-wrap">
        <Player
          ref={playerRef}
          component={ReplayComposition}
          inputProps={inputProps}
          durationInFrames={Math.max(eventCount * FRAMES_PER_EVENT, 1)}
          compositionWidth={1280}
          compositionHeight={720}
          fps={30}
          controls={false}
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
            disabled={eventCount === 0}
            onChange={(event) => onSeekToFrame(Number(event.target.value))}
          />
        </label>
      </div>
      <nav className="transport" aria-label={text(display.locale, "replay.navigation")}>
        <button
          type="button"
          onClick={() => onJumpTo(activeIndex - 1)}
          disabled={activeIndex === 0}
        >
          {text(display.locale, "replay.previous")}
        </button>
        <button
          type="button"
          className="primary"
          onClick={onTogglePlayback}
          disabled={eventCount === 0}
        >
          {text(display.locale, playing ? "replay.pause" : "replay.play")}
        </button>
        <button
          type="button"
          onClick={() => onJumpTo(activeIndex + 1)}
          disabled={activeIndex >= eventCount - 1}
        >
          {text(display.locale, "replay.next")}
        </button>
        <button type="button" onClick={onToggleFullscreen}>
          {text(display.locale, "replay.fullscreen")}
        </button>
      </nav>
    </article>
  );
}
