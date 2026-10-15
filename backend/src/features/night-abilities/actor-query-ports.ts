/**
 * 负责公开本夜能力演员查询的原绑定与类型契约。
 * 输入为原 World 的绑定及后续 actors(kind, day) 查询；输出为原查询对象和类型契约。绑定只捕获原 World 并装配原查询闭包，不在绑定时枚举名单或能力；公开类型和绑定不复制实例、不执行阶段或授予新能力。
 * 本入口只具名重导原单一模块，保留函数、类、对象及类型的原声明绑定；不包装调用或重新注册。
 * 顶层只加载原模块及其原依赖，不聚合其他 owner；调用方仍在原 callee／参数位置读取，原错误和已写前缀照常传播。
 */
export type { NightAbilityActorQuery } from "./night-ability-actors";
export { bindNightAbilityActorQuery } from "./night-ability-actors";
