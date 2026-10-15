/**
 * 为后端调用方统一导出对局编排、机制与动作网关的公开定义。
 * 本门面不装配对局或增加机制注册，不参与阶段推进、资源付款与权限判断。
 */
export * from "./engine";
export * from "./mechanisms";
export * from "./gateway";
