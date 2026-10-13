/**
 * 提供孤独少女原准备状态、实际夜间生命周期、玩家知识及请求预检的公开绑定。
 * 输入保留原 World／日期与请求，输出为同一准备结果、关闭能力或原已告知投影。
 * 实际夜间入口仍先检查准备状态再开启，返回 close 沿原 finally 顺序调用；终态和当前性归生命周期。
 * 该出口不重开已关闭的准备／行动窗口，不新增状态、复制、校验或规则；资源与知识仍归原所有者。
 */
export { hasActiveLonelyGirl, lonelyGirlReady, openLonelyGirlNight } from "./lifecycle";

export { projectLonelyGirl } from "./lifecycle";

export { lonelyGirlRequestScope } from "./lifecycle";

export { readLonelyGirlTool } from "./state";
