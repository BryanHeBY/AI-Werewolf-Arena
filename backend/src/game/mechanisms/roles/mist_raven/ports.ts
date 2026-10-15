/**
 * 负责公开炼金魔女／狼鸦之爪的雾圈查询及具体夜间生命周期端口。输入为绑定的原 World／实际 day、events；
 * 输出为当前雾圈 ID、阵容断言、开夜清理单元和终止端口。绑定不查 frame、生命、时钟或随机源。
 * readonly 查询结果不授状态写或提交权；生命周期仍保原发布、晚交接和 abort 时点，阵容与关闭错误归 frame。
 */
import type { EntityId } from "../../../../domain/identity";
import type { World } from "../../../../domain/world";
import { isMistRavenBoard, mistKnifeTargets } from "./night_frame";
export { MistNightUnit, mistNightTerminal } from "./night-lifecycle";
export type { MistNightRuntime } from "./night-lifecycle";
export { isMistRavenBoard, mistKnifeTargets, assertMistRosterCurrent } from "./night_frame";

/** null表示未配置或当前无雾圈；ID列表是查询输出，不是修改frame／刀票的入口。 */
export interface MistKnifeTargetQuery {
  targets(): readonly EntityId[] | null;
}

export function bindMistKnifeTargetQuery(world: World): MistKnifeTargetQuery {
  return Object.freeze({
    targets: () => (isMistRavenBoard(world) ? mistKnifeTargets(world) : null),
  });
}
