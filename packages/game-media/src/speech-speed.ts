/** 负责换算腾讯云语速参数。输入为Speed或倍速，输出官方分段线性换算值；不预测某次合成的实际时长。 */
const stops = [
  [-2, 0.6],
  [-1, 0.8],
  [0, 1],
  [1, 1.2],
  [2, 1.5],
  [6, 2.5],
] as const;
function convert(value: number, source: 0 | 1): number {
  if (!Number.isFinite(value) || value < stops[0][source] || value > stops.at(-1)![source])
    throw new Error("tts_speed_invalid");
  for (let index = 1; index < stops.length; index++) {
    const left = stops[index - 1]!,
      right = stops[index]!;
    if (value <= right[source])
      return (
        Math.round(
          (left[1 - source]! +
            ((value - left[source]) / (right[source] - left[source])) *
              (right[1 - source]! - left[1 - source]!)) *
            100,
        ) / 100
      );
  }
  throw new Error("tts_speed_invalid");
}
export const tencentSpeedRatio = (speed: number) => convert(speed, 0);
export const tencentSpeedParameter = (ratio: number) => convert(ratio, 1);
