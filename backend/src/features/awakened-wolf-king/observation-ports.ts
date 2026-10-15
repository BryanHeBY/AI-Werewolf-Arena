/**
 * 负责向观察与提示组合导出狼爪自身状态查询；输入原Role，输出严格裁剪的脱离值或null。
 * 只读本人库存，不捕获World、死亡源、请求租约或可写容器，不凭JSON或unitId恢复行动许可。
 * 具体绑定和唯一付款仍由本族状态/窗口持有；此出口不缓存投影或改变调用方读取时点。
 */
export { projectAwakenedClaws } from "./state";
