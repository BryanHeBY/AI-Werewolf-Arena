import type { PlayerRef } from "@remotion/player";
import { useCallback, useEffect, useRef, useState } from "react";
import { FRAMES_PER_EVENT } from "./replay-frame";

export function useReplayPlayback(eventCount: number) {
  const playerRef = useRef<PlayerRef>(null);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  const durationInFrames = Math.max(eventCount * FRAMES_PER_EVENT, 1);
  const activeIndex = Math.min(
    Math.floor(currentFrame / FRAMES_PER_EVENT),
    Math.max(eventCount - 1, 0),
  );

  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    const onFrame = ({ detail }: { detail: { frame: number } }) => setCurrentFrame(detail.frame);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    player.addEventListener("frameupdate", onFrame);
    player.addEventListener("play", onPlay);
    player.addEventListener("pause", onPause);
    player.addEventListener("ended", onPause);
    return () => {
      player.removeEventListener("frameupdate", onFrame);
      player.removeEventListener("play", onPlay);
      player.removeEventListener("pause", onPause);
      player.removeEventListener("ended", onPause);
    };
  }, [eventCount]);

  const seekToFrame = useCallback(
    (frame: number) => {
      if (!Number.isFinite(frame)) return;
      const boundedFrame = Math.max(0, Math.min(Math.floor(frame), durationInFrames - 1));
      playerRef.current?.seekTo(boundedFrame);
      setCurrentFrame(boundedFrame);
    },
    [durationInFrames],
  );
  const jumpTo = useCallback(
    (index: number) => seekToFrame(index * FRAMES_PER_EVENT),
    [seekToFrame],
  );
  const togglePlayback = useCallback(() => {
    playerRef.current?.toggle();
  }, []);
  const toggleFullscreen = useCallback(() => {
    const player = playerRef.current;
    if (!player) return;
    if (player.isFullscreen()) player.exitFullscreen();
    else player.requestFullscreen();
  }, []);
  return {
    playerRef,
    activeIndex,
    currentFrame,
    durationInFrames,
    playing,
    jumpTo,
    seekToFrame,
    togglePlayback,
    toggleFullscreen,
  };
}
