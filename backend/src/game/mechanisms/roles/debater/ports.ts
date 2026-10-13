/**
 * 提供杠精原生状态、玩家知识和已接受辩论事实的出口。展示仍在原读取点逐次查询库存
 * 与辩论提交事实，不把剩余次数或文案当许可；辩论窗口、付款、翻牌和投票分母仍归原
 * 所有者。本出口保留原函数绑定，不重验当前性、缓存结果或执行结算。
 */

export { projectDebaterState } from "./state";

export { getDebaterState } from "./state";

export { hasDebateCommit } from "./authority";
