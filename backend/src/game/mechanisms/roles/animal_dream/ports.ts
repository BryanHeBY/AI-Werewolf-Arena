/**
 * 提供动物梦境原夜间与放逐单元、完整死亡波贡献、权威快照及河豚狼刀死亡提交的公开入口。
 * 输入是实际规则边界的原 World、日期、死因和作用域；输出保留原状态、事实和关闭顺序。
 * 死亡提交之后的河豚效果仍由具体权威所有者验证权限并写入，失败不退还已付出的狐狸选择。
 * 白猫过滤与到期准备保留事实、原因修改和失败前缀的原顺序。
 * 本入口仅具名公开本角色的函数与具体机制，不另设状态、跳过当前性检查或合并猫与河豚的死亡规则。
 * 展示与预检新增查询仍返回原玩家知识或请求 scope 绑定，不把知识转换为提交权限。
 * 黎明组合在熊事件发表之后按原起点推进知识，再发表狼美人通知；本入口不增加调用或恢复失败前项。
 * 放逐／跳过单元在原关闭点才发布完成事实；后续快照或发表失败保已关闭状态，不重新开启单位。
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

/** 贡献在原准备／实际标死边界消费；装配与事实归同一 owner，失败保留已发表和已提交前缀。 */
export { AnimalDeathWavePreparation } from "./death-wave";
export type { AnimalDeathWaveRuntime } from "./death-wave";

export { animalBeautyKnowledge } from "./facts";

export { animalBearKnowledge, noteAnimalBearPublication, appendAnimalBeautyNotice } from "./facts";

export { animalRequestScope } from "./requests";

export { completeAndPublishAnimalExileUnit } from "./unit-completion-publication";
export type { AnimalUnitCompletionRuntime } from "./unit-completion-publication";
