/**
 * 提供盗贼玩家知识、原选择请求 scope 与选择字段 reader 的出口。展示只投影原获准
 * 可选牌，动作接收仍在原参数位置读同一 scope 与选择数据；读取不接受动作或授予
 * 新许可。原 setup 保持换牌、别名及关闭顺序，本出口不缓存当前性或渲染文案。
 */

export { projectThiefState } from "./state";

export { thiefRequestScope } from "./setup";

export { readThiefChoice } from "./state";
