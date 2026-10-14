/**
 * 负责公开身份查验的原装配贡献，输入为消费方在原位置采用的配置工厂、工具／规则和阶段绑定；
 * 输出仍为同一函数／对象引用，不包装回调、重建表或自动注册。四族 profile 与原夜计划在各自原时点装配。
 * 石像鬼 priority=180、通灵师／魔镜 priority=600 的实际执行与 provider await 仍归原阶段 owner。
 * 目标和规则读取当前能力／政策，不以角色标签或公开贡献作为原生／受赠实例资格、库存写权或租约。
 * 本入口不查询 World、付款、追加历史或关闭；普通状态读入口保持独立，文案另走纯政策公开入口。
 */
export { inspectionConfiguration } from "./policies";
export {
  ROLE_INSPECTION_TOOL,
  validateRoleInspection,
  roleInspectionTargets,
} from "./rules";
export {
  ROLE_INSPECTION_STAGE,
  PSYCHIC_INSPECTION_STAGE,
  MIRROR_INSPECTION_STAGE,
} from "./night_stages";
