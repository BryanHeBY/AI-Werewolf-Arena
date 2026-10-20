/**
 * 负责公开猎魔板子的白痴翻牌查询与提交绑定。输入为原 World 和玩家编号；输出为原审计结果或提交布尔值。
 * 两函数直接绑定本族权威：查询不授予免死许可，提交仍复验原生命、库存、票权和审计后依原顺序写入。
 * 本端口不复制状态、捕获第二份库存或吞掉失败；关闭与死亡结算仍由原调用方负责。
 */
export { commitDemonIdiotReveal, demonIdiotRevealed } from "./authority";
