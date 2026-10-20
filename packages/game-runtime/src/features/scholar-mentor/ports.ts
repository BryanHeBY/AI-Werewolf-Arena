/**
 * 负责公开白昼学者／寂夜导师原只读资格、状态视图、原生目标记录与具体清理移交端口。
 * 输入为原 Role 数据或 World／actor／day／种类；输出保原数据引用、已结算修饰断言及错误，不缓存快照。
 * 不变量：状态读取／脱离复制不是库存、modify_skill 许可或来源证明；初始化／槽提交不经本公开读入口。
 * 原生目标记录仍在原已付事实时点；资格查询没有 commit。生命周期仅在原晚点移交清理，manager 传当次参数。
 * frame 拥有原体／生命、加成完成、abort 与 roster 失败；本入口不额外付款、开夜或写第二份记录。
 */
import type { EntityId } from "../../domain/model";
import type { World } from "../../domain/world";
import { scholarMentorBlocks } from "./night-frame";
export { readModifierState, scholarMentorStateForRole } from "./state-slot";
export { ScholarMentorNightUnit, scholarMentorNightTerminal } from "./night-lifecycle";
export type { ScholarMentorNightRuntime } from "./night-lifecycle";
export { isScholarMentorBoard, assertScholarMentorRosterCurrent } from "./night-frame";
export { recordScholarMentorNativeTarget } from "./night-frame";
export { scholarMentorBlocks } from "./night-frame";
export { scholarMentorKnifeEligible } from "./night-frame";

/** 完整已付加成效果复验的同绑定入口；不开放记录数组或库存写入，不替代付款／关闭。 */
export { assertScholarMentorBonusEffects } from "./bonus-effect-validation";

export interface ScholarMentorNightEligibility {
  blocks(actorId: EntityId, day: number, kind: "guard" | "check"): boolean;
}

export function bindScholarMentorNightEligibility(world: World): ScholarMentorNightEligibility {
  return Object.freeze({
    blocks: (actorId: EntityId, day: number, kind: "guard" | "check") =>
      scholarMentorBlocks(world, day, actorId, kind),
  });
}
