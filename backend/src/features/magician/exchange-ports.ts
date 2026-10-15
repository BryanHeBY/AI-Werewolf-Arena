/**
 * 向诡术师公开魔术师当前同配对取消命令，直接绑定原 frame 的实际写者。
 * 输入为原 World、day 和二人配对，输出保原匹配结果；只在原当前已提交夜中清除 pair 映射。
 * 取消不退历史或已用号码；原体／夜／匹配校验和抛错仍由 frame 执行，不提供新的生命周期或许可。
 * 本入口只沿原 frame 加载，不提前创建清理终结表、捕获时钟、注册或读取 World。
 */
export { cancelMagicianExchangeIfMatching } from "./night-frame";
