/**
 * 提供混血儿的原生选择状态与可见玩家知识出口。getter 保留原状态引用，投影保留
 * 原已选择目标的知识边界；目标阵营不自动授予狼聊或狼刀。选择 scope、胜利归属与
 * 生命变化仍由原机制处理，本出口不创建状态、接受动作或渲染文案。
 * 输入为原角色对象；调用时点只允许查询，选择终态和失败前缀仍由原机制维护。
 */

export { projectHybridState } from "./state";

export { getHybridState } from "./state";
