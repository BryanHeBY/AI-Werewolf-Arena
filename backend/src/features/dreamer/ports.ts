/**
 * 输入为初始化角色与状态、能力标识或已捕获的槽数据；初始化时安装，夜间接受选择后按原顺序写入。
 * 摄梦状态族的公开契约：初始化可安装 owned JSON 副本，读取保留原库存引用，普通夜行动
 * 只通过明确命令写 target/day/history。连续目标、生命、次数、付款与阶段关闭仍归原 caller。
 * schema 不新增形状拒绝，政策 codec 仅保留既有 scope 身份，不授予新能力或租约。
 */
export { DREAMER_STATE_SLOT, getDreamerState, setDreamerState } from "./state-slot";
