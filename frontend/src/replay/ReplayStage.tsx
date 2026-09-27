import { Player, type PlayerRef } from "@remotion/player";
import type { RefObject } from "react";
import type { ReplayDocument } from "@ai-werewolf-arena/replay-contract";
import { FRAMES_PER_EVENT, ReplayComposition } from "./ReplayComposition";

interface ReplayStageProps {
  replay: ReplayDocument;
  activeIndex: number;
  playerRef: RefObject<PlayerRef | null>;
  onJumpTo: (index: number) => void;
  onTogglePlayback: () => void;
}

export function ReplayStage({
  replay,
  activeIndex,
  playerRef,
  onJumpTo,
  onTogglePlayback,
}: ReplayStageProps) {
  const eventCount = replay.events.length;

  return (
    <article className="stage panel">
      <div className="panel-heading">
        <div>
          <p className="section-kicker">REPLAY</p>
          <h2>对局舞台</h2>
        </div>
        <span className="progress">
          {eventCount === 0 ? "0 / 0" : `${activeIndex + 1} / ${eventCount}`}
        </span>
      </div>
      <div className="player-wrap">
        <Player
          ref={playerRef}
          component={ReplayComposition}
          inputProps={{ replay }}
          durationInFrames={Math.max(eventCount * FRAMES_PER_EVENT, 1)}
          compositionWidth={1280}
          compositionHeight={720}
          fps={30}
          controls
          acknowledgeRemotionLicense
        />
      </div>
      <nav className="transport" aria-label="复盘跳转">
        <button
          type="button"
          onClick={() => onJumpTo(activeIndex - 1)}
          disabled={activeIndex === 0}
        >
          上一事件
        </button>
        <button type="button" className="primary" onClick={onTogglePlayback}>
          播放 / 暂停
        </button>
        <button
          type="button"
          onClick={() => onJumpTo(activeIndex + 1)}
          disabled={activeIndex >= eventCount - 1}
        >
          下一事件
        </button>
      </nav>
    </article>
  );
}
