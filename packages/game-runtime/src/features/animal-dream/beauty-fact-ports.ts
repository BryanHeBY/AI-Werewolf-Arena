/**
 * 公开动物梦境狼美人的原玩家知识查询与通知发表，分别绑定 facts 中的实际函数。
 * 查询返回按已发表事实裁剪的原副本；通知仍由原 owner 核数据、受众并先追加事件，再推进知识日志。
 * 原调用方保留发表时点、World／events／day 的读取与失败前缀；本入口不把知识当运行许可，不消费魅惑或狐狸库存。
 * 只沿原事实模块初始化路径加载，不聚合夜单元、死亡波或请求注册；不另设日志、冻结输入或包装调用。
 */
export { animalBeautyKnowledge, appendAnimalBeautyNotice } from "./facts";
