/**
 * 公开动物梦境对狼美人的三项原查询：板子识别、当夜魅惑准入与牵连阻断。
 * 输入为原 World 与明确日次，输出保留 authority 的原短路／当前性结果；三项职责不合成新的许可 Boolean。
 * 本入口直接绑定唯一 authority 函数，不新增事实加载、时钟捕获或请求注册；原 authority 初始化依赖保持，查询不付款、发表知识或创建作用域。
 * 调用方仍在原 callee／实参位置读取 World 和 day，目标原体、历史、死亡来源及领取回执由各原 owner 复验。
 */
export { isAnimalDreamBoard, animalBeautyCharmAllowed, animalBeautyLinkBlocked } from "./authority";
