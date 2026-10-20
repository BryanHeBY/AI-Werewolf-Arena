/**
 * 负责向狼刀规则组合公开雾鸦原板身份、现场雾圈和原生命查询的同一函数绑定。
 * 输入为原 World／夜号／目标，输出为原函数绑定及其查询结果；读取顺序由调用方保留，失效与关闭仍由原夜 frame 处理。
 * 板身份查询仅核原登记；雾圈与原生命查询在原时点复验，不创建库存、支付、许可或 JSON 数据。
 * 此公开端口不包装函数、不提前读取目标，也不把读取结果当作提交写权。
 */
export { isMistRavenBoard, mistKnifeTargets, originalMistTarget } from "./night-frame";
