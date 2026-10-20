/**
 * 负责媒体浏览器测试的独立宿主地址。输入为固定测试端口，输出复盘和视频应用的 URL。
 * 仅约束测试导航和服务登记；不让生产应用互相导入，也不提供展示事实或断言答案。
 */
export const REPLAY_BROWSER_ORIGIN = "http://127.0.0.1:4173";
export const VIDEO_BROWSER_ORIGIN = "http://127.0.0.1:4174";
