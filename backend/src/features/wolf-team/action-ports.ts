/**
 * 负责公开狼聊参与人、狼刀持有人与狼队事件受众接口。
 * 输入为原 World、Catalog 和原事件参数；输出为原名单或事件。知识、聊天、刀权仍分别推导，当前 Camp 或历史成员身份不自动授执行许可；各角色阻断查询仍由原权限 owner 按原序调用。
 * 本入口只具名重导原单一模块，保留函数、类、对象及类型的原声明绑定；不包装调用或重新注册。
 * 顶层只加载原模块及其原依赖，不聚合其他 owner；调用方仍在原 callee／参数位置读取，原错误和已写前缀照常传播。
 */
export { wolfChatParticipants, wolfKnifeHolders, wolfTeamEvent } from "./permissions";
