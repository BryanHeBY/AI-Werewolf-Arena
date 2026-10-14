/**
 * 向魔术师公开狼术师板子识别与原夜目标映射的直接绑定。输入为原 World、day、号码和映射政策，
 * 输出保原复合映射回执及当前性；原体、夜关系、历史与已用号码仍唯一归 frame／状态槽。
 * 入口只加载原 frame，不提前创建清理终结表、捕获时钟、注册或读取 World，也不提供库存写权。
 * W(raw) 在原调用点先于 M 读取；中间死亡占有者的原接受政策与错误保持，回执不授予新行动许可。
 */
export { isWolfSorcererBoard, resolveWolfSorcererNightTarget } from "./night_frame";
