/**
 * 提供身份查验能力的公开状态入口，供原生角色 profile、纯白之女、目标提示和玩家观察消费。
 * 输入是安装时或当前状态读取之前的角色组件；输出为原深只读 getter、具体有序写命令和类型，
 * 保留原生能力优先选择及存储对象身份。本入口不授权查验、不授予库存、不执行阶段或编码归档；
 * 权限过期以及失败、关闭窗口仍由租约所有者负责，状态实现只属于身份查验能力本身。
 */
export {
  getRoleInspectionState,
  setRoleInspectionState,
  recordAbilityRoleInspection,
} from "./state";
