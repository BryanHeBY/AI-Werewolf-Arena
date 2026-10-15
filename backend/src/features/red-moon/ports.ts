/**
 * 提供赤月使徒的具名数据端口。输入为原角色或已捕获的审计字符串／候选数据，
 * 输出保留原状态引用、原浅副本及 JSON；写命令只提交本族三字段，不重读角色或存储副本。
 * 具体原体、末狼、夜窗口、请求权限及完整私有容器审计仍由原权威负责；编码函数不授予行动许可。
 * 调用仍在原初始化、转换及观察时点；三字段写入顺序不变。
 * 后项写入或后续发布失败保持已付前缀，不恢复自爆／放逐窗口。本入口不推进阶段或渲染文案。
 */
export {
  RED_MOON_ROLE,
  getRedMoonState,
  projectRedMoonState,
  readRedMoonShadow,
  copyRedMoonPayload,
  encodeRedMoonShadow,
  writeRedMoonTransition,
} from "./state-slot";
