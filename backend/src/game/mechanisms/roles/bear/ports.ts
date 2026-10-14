/**
 * 提供熊状态与夜前采样／黎明发布 frame 的实际公开绑定。输入为原角色、安装数据或 World／日期／政策；
 * 输出保留原状态引用和同一 frame，不另做采样、校验、复制、冻结或存储。
 * 初始化写权与请求权限仍归原调用方；frame 在原时点校验生命、原体和发布租约，关闭／失败保原前缀。
 * 本入口只具名导出真实状态函数和 class，公开 frame 不是行动许可或 JSON 数据。
 */
export { getBearState, setBearState } from "./state";
export { BearNightFrame } from "./night_frame";
