/**
 * 负责播放器事件与工作台播放状态的同步。输入为展示事件数，输出 Player ref、当前帧及跳转／播放／全屏命令。
 * 本 hook 只保存交互状态，画面仍按帧纯计算；effect 清理移除本次捕获播放器上的同一组监听。
 */
import type { PlayerRef } from "@remotion/player";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FRAMES_PER_EVENT } from "./replay-frame";

export interface ReplayPlaybackTimeline {
  starts: readonly number[];
  durationInFrames: number;
}

/** 可变镜头长度的事件定位；起点属于新事件，停留帧仍归此前事件。 */
export function replayPlaybackIndex(frame: number, starts: readonly number[]): number {
  let left = 0,
    right = starts.length;
  while (left < right) {
    const middle = Math.floor((left + right) / 2);
    if (starts[middle]! <= frame) left = middle + 1;
    else right = middle;
  }
  return Math.max(0, left - 1);
}

export function useReplayPlayback(eventCount: number, timeline?: ReplayPlaybackTimeline) {
  const playerRef = useRef<PlayerRef>(null);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  // 即使没有事件也保留一帧；活动下标只映射当前显示帧，不保存第二份事件进度。
  const fallbackStarts = useMemo(
    () => Array.from({ length: eventCount }, (_, index) => index * FRAMES_PER_EVENT),
    [eventCount],
  );
  const starts = timeline?.starts ?? fallbackStarts;
  const durationInFrames = Math.max(timeline?.durationInFrames ?? eventCount * FRAMES_PER_EVENT, 1);
  const activeIndex = Math.min(
    replayPlaybackIndex(currentFrame, starts),
    Math.max(eventCount - 1, 0),
  );

  useEffect(() => {
    // 清理闭包捕获实际绑定的实例，避免以后 ref 变化时移除到另一播放器。
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
      // 仅接受有限数并夹入当前片长；先调用实际 seek，正常返回后才同步本地滑块状态。
      const boundedFrame = Math.max(0, Math.min(Math.floor(frame), durationInFrames - 1));
      playerRef.current?.seekTo(boundedFrame);
      setCurrentFrame(boundedFrame);
    },
    [durationInFrames],
  );
  const jumpTo = useCallback(
    (index: number) => {
      if (!Number.isFinite(index)) return;
      const boundedIndex = Math.max(0, Math.min(Math.floor(index), starts.length - 1));
      seekToFrame(starts[boundedIndex] ?? 0);
    },
    [seekToFrame, starts],
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
