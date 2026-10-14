/**
 * 负责普通狼人实际角色的登记入口，以旧公开名称引用共享普通狼贡献的同一个对象。
 * 输入是本族完整贡献装配，输出为 Catalog 与自定义资料调用方使用的 WOLF_ROLE_PROFILE 绑定。
 * 对象身份、可写 metadata／runtime、原展示默认与 handler 都归同一装配；不复制或代理属性，不另建注册表。
 * 本模块不推进阶段、付款、授予租约或执行归档；实际规则卡仍按普通狼人身份登记。
 */
export { ORDINARY_WOLF_CONTRIBUTIONS as WOLF_ROLE_PROFILE } from "./ability-assembly";
