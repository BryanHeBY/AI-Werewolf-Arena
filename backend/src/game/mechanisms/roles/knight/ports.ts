/**
 * 提供骑士决斗窗口与原生库存读取的具名公开入口。输入保留原 World、配置、角色、请求端口及回调，
 * 输出为原窗口、同库存的只读视图或脱离的玩家数据；不复制资源或把类型当成运行权限屏障。
 * 窗口在原白天检查时点执行，等待之后与提交之前复验身体、生命版本和库存；具体提交拥有消耗，经理拥有死亡与阶段推进。
 * 读取、请求或提交失败保留原异常及已写前缀；公开入口不新增租约、镜像或自动清理。
 * 提交命令直接绑定本族实现，消耗先于公共事实和死亡提案；真实标死与日裁决仍归经理。
 */
export { getKnightState, projectKnightState } from "./state";
export { KnightDuelWindow } from "./duel-window";

export { commitKnightDuel } from "./commit";
