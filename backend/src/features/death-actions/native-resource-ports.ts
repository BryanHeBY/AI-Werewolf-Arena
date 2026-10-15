/**
 * 负责公开原生及已学习死亡枪的唯一资源接口。
 * 输入为原角色、库存引用及调用方已有查询端口；输出为原状态、工厂、reader 或武装结果。setter／arm 仍是实际写端口，reader 的裸查询和晚阵营 source 顺序归原 owner；不增加 schema 或第二库存。
 * 本入口只具名重导原单一模块，保留函数、类、对象及类型的原声明绑定；不包装调用或重新注册。
 * 顶层只加载原模块及其原依赖，不聚合其他 owner；调用方仍在原 callee／参数位置读取，原错误和已写前缀照常传播。
 */
export {
  armAwakenedNativeGun,
  armMechanicalNativeGun,
  createAwakenedGunReader,
  createHunterState,
  createLearnedNativeGun,
  createMechanicalGunReader,
  createWolfKingState,
  getHunterState,
  getWolfKingState,
  setHunterState,
  setWolfKingState,
} from "./native-death-gun-resources";
