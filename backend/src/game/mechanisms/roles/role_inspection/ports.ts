/**
 * 提供身份查验能力的公开状态入口，供原生角色 profile、纯白之女、目标提示和玩家观察消费。
 * 输入是安装时或当前状态读取之前的角色组件；输出为原深只读 getter、具体有序写命令和类型，
 * 保留原生能力优先选择及存储对象身份。初始化 set 入口仅安装原生库存；普通读与展示不写库存，不授权查验、不执行阶段或编码归档；
 * 权限过期以及失败、关闭窗口仍由租约所有者负责，状态实现只属于身份查验完整状态槽本身；schema 只保留原政策校验，不扩展拒绝形状。
 * 新增政策与原报告投影仅消费只读输入，不通过展示路径领取查验权限或付款。
 */
export {
  getRoleInspectionState,
  setRoleInspectionState,
  recordAbilityRoleInspection,
  roleInspectionPolicy,
} from "./state-slot";

export { inspectionPolicy } from "./policies";

export { ROLE_INSPECTION_STATE_SLOT } from "./state-slot";
