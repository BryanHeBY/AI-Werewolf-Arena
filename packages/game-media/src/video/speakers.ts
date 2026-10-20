/** 负责视频说话者标识校验。输入为作者旁白、上帝或玩家标识及可选名单，输出合法性；不分配音色或授予玩家身份。 */
import type { SpeakerId } from "./types";

export function isVideoSpeaker(value: unknown, playerIds?: readonly number[]): value is SpeakerId {
  if (value === "narrator" || value === "god") return true;
  return (
    typeof value === "string" &&
    /^player:[1-9]\d*$/.test(value) &&
    (playerIds === undefined || playerIds.includes(Number(value.slice(7))))
  );
}
