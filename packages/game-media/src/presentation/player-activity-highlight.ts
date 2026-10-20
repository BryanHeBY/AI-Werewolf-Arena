/**
 * 负责网页席位与视频HUD共用的活动色层级。输入为已投影活动范围、当前主体标记和主题色，输出描边与衬底语义。
 * 不读取台词或真实身份，不决定名单；警上范围使用金色衬底，当前主体更强，退水不冒充当前行动。
 */
import type { ReplayRosterActivity } from "../replay/replay-roster-activity";
import type { ThemeFrame } from "../themes";

export function playerActivityHighlight(
  activity: ReplayRosterActivity | undefined,
  current: boolean,
  colors: ThemeFrame["activity"],
  activeColor: string,
) {
  const withdrawn = activity?.status === "withdrawn";
  const strong = current && !withdrawn;
  const color =
    activity?.kind === "wolf-discussion"
      ? strong
        ? colors.wolfSpeaker
        : colors.wolf
      : activity?.status === "candidate"
        ? strong
          ? colors.candidateSpeaker
          : colors.candidate
        : withdrawn
          ? colors.withdrawn
          : current
            ? activeColor
            : undefined;
  // 上警不能只剩细框；身份文字仍保留各自角色色，活动底衬与整卡边框独立表达范围。
  const fillOpacity = strong ? 0.23 : activity?.status === "candidate" ? 0.18 : 0;
  return { color, strong, withdrawn, fillOpacity };
}
