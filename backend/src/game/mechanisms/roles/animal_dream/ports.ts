/**
 * 提供动物梦境原夜间与放逐单元、权威快照及河豚狼刀死亡提交的公开入口。
 * 输入是实际规则边界的原 World、日期、死因和作用域；输出保留原状态、事实和关闭顺序。
 * 死亡提交之后的河豚效果仍由具体权威所有者验证权限并写入，失败不退还已付出的狐狸选择。
 * 本入口仅具名导出本角色函数，不另设状态、跳过当前性检查或合并猫与河豚的死亡规则。
 */
export { AnimalNightUnit } from "./night-lifecycle";
export {
  abortAnimalGame,
  beginAnimalExileUnit,
  prepareAnimalCatExpiry,
  closeAnimalExileUnit,
  animalPufferReaction,
} from "./authority";
export type { AnimalNightRuntime } from "./night-lifecycle";
export { animalAuthoritySnapshot } from "./authority";

export { isAnimalDreamBoard, commitAnimalPufferKnifeDeath } from "./authority";
