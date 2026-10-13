/**
 * 提供丘比特的原生状态与玩家知识出口。getter 保留原槽引用，玩家投影保留已有恋人
 * 选择的可见字段；展示不能据此获知恋人秘密阵营。恋人关系、殉情与胜利归属仍由具体
 * 机制决定，本出口不创建第二状态、补交选择、授权请求或渲染文案。
 */

export { getCupidState } from "./state";

export { projectCupidState } from "./state";
