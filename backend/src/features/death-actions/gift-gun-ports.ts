/**
 * 负责公开赠枪原工具预检、授予与死亡生命周期的共同接口。
 * 输入为原校验上下文或原 World、玩家和枪实例参数；输出为原拒绝、授予实例或生命周期结果。授予和 first／finish 具有原写入，不以此将已付 pending 改成未付资格。
 * 本入口只具名重导原单一模块，保留函数、类、对象及类型的原声明绑定；不包装调用或重新注册。
 * 顶层只加载原模块及其原依赖，不聚合其他 owner；调用方仍在原 callee／参数位置读取，原错误和已写前缀照常传播。
 */
export { finishDeathGuns, firstDeathGuns, grantDeathGun, validateGiftGun } from "./death-abilities";
