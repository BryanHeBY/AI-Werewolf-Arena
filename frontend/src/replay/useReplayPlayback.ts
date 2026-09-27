import type { PlayerRef } from "@remotion/player";
import { useCallback, useEffect, useRef, useState } from "react";
import { FRAMES_PER_EVENT } from "./ReplayComposition";

export function useReplayPlayback(eventCount: number) {
  const playerRef = useRef<PlayerRef>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const player = playerRef.current;
    if (!player || eventCount === 0) return;

    const onFrame = ({ detail }: { detail: { frame: number } }) => {
      const nextIndex = Math.min(Math.floor(detail.frame / FRAMES_PER_EVENT), eventCount - 1);
      setActiveIndex((current) => current === nextIndex ? current : nextIndex);
    };

    player.addEventListener("frameupdate", onFrame);
    return () => player.removeEventListener("frameupdate", onFrame);
  }, [eventCount]);

  const jumpTo = useCallback((index: number) => {
    if (eventCount === 0) {
      setActiveIndex(0);
      return;
    }
    const boundedIndex = Math.max(0, Math.min(index, eventCount - 1));
    playerRef.current?.seekTo(boundedIndex * FRAMES_PER_EVENT);
    setActiveIndex(boundedIndex);
  }, [eventCount]);

  const togglePlayback = useCallback(() => {
    playerRef.current?.toggle();
  }, []);
  return { playerRef, activeIndex, jumpTo, togglePlayback };

}
