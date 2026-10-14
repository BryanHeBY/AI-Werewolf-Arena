/**
 * 负责播放器事件与工作台播放状态的同步。输入为展示事件数，输出 Player ref、当前帧及跳转／播放／全屏命令。
 * 本 hook 只保存交互状态，画面仍按帧纯计算；effect 清理移除本次捕获播放器上的同一组监听。
 */
import type { PlayerRef } from "@remotion/player";
import { useCallback, useEffect, useRef, useState } from "react";
import { FRAMES_PER_EVENT } from "./replay-frame";

export function useReplayPlayback(eventCount: number) {
  const playerRef = useRef<PlayerRef>(null);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  // 即使没有事件也保留一帧；活动下标只映射当前显示帧，不保存第二份事件进度。
  const durationInFrames = Math.max(eventCount * FRAMES_PER_EVENT, 1);
  const activeIndex = Math.min(
    Math.floor(currentFrame / FRAMES_PER_EVENT),
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
