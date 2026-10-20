/**
 * 负责在排序去重后的原事件揭晓帧中寻找传输目标。输入为源事件帧、播放帧与已揭晓事件参考帧，输出前后可达位置。
 * 消费者为网页播放控件；聚合明细共用一个揭晓帧时只经过该位置一次，不改变原 seq、镜头或提交事实。
 */
export function replayFrameNeighbours(
  frames: readonly number[],
  currentFrame: number,
  previousReference: number,
): { previous: number | null; next: number | null } {
  const lowerBound = (target: number, inclusive: boolean) => {
    let low = 0,
      high = frames.length;
    while (low < high) {
      const middle = Math.floor((low + high) / 2);
      if (frames[middle]! < target || (inclusive && frames[middle] === target)) low = middle + 1;
      else high = middle;
    }
    return low;
  };
  return {
    previous: frames[lowerBound(previousReference, false) - 1] ?? null,
    next: frames[lowerBound(currentFrame, true)] ?? null,
  };
}
