/**
 * 负责公开普通夜能力唯一库存的查询、复制、安装与已付 metadata 命令。
 * 输入为原角色、能力实例、日期或已经准备的 payload；输出为原同引用视图或库存命令结果。commitPreparedNativeAbility 是受信已准备数据的实际安装接口，不新增 payload 验证；record／expire／retire 的写入和已付前缀不当作纯读或新行动许可。
 * 本入口只具名重导原单一模块，保留函数、类、对象及类型的原声明绑定；不包装调用或重新注册。
 * 顶层只加载原模块及其原依赖，不聚合其他 owner；调用方仍在原 callee／参数位置读取，原错误和已写前缀照常传播。
 */
export type {
  NightAbility,
  NightAbilityReadView,
} from "./abilities";
export {
  abilityStatus,
  activeNightAbility,
  allNightAbilities,
  commitPreparedNativeAbility,
  copyAbilityData,
  expireLuckyAbilitiesOnDeath,
  findNightAbility,
  initializeNightAbilityInventory,
  recordNightAbilityUse,
  retireBorrowedNightAbility,
  retiredNightAbilityIds,
  setNightAbilityStartDay,
} from "./abilities";
