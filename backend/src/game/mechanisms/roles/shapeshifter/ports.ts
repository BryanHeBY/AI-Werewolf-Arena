/**
 * 提供变形者已获玩家知识与原选择请求 scope 的出口。展示投影不暴露可选底牌之外的
 * 身份；动作接收在原参数位置读取同一 scope，不能从公布结果推断新许可。原 setup
 * 仍负责选择、换牌和关闭，本出口不缓存当前性、复制状态或执行文案格式化。
 */

export { projectShapeshifterState } from "./state";

export { shapeshifterRequestScope } from "./setup";
