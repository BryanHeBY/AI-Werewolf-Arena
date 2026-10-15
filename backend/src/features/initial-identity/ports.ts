/**
 * 提供盗贼／千面人原准备、夜重入、首夜选择窗口及请求 scope 查询的公共绑定。
 * 输入保留原 World、参与者、日次、阶段和请求；输出为原准备结果、同一 scope、选择视图或关闭能力。
 * 具体所有者核 kind、当前参与者和库存写权；公开查询、构造依赖及数据类型不授予选择或重新发牌权限。
 * 类仍在原装配时点读取，窗口保持原复验、付款、身份安装和 finally 关闭顺序；失败不撤回已提交前缀。
 * 库存读取另用轻 deal-ports，避免从状态查询加载本入口的重型设置与事实发布组合。
 */
export {
  hasActiveInitialIdentitySetup,
  hasActiveInitialIdentityNight,
  hasInitialIdentityNightCommit,
  initialIdentityKind,
  initialIdentitySetupReady,
  openInitialIdentityNight,
} from "./deal";

/** 同一窗口／三项选择查询在原调用点读取；scope 包含运行引用，不是玩家 DTO 或新的许可。 */
export {
  InitialIdentitySetupWindow,
  authorizedInitialIdentityScope,
  initialIdentityRequestScope,
  initialIdentityRequestChoices,
} from "./setup";
export type { InitialIdentityScope } from "./setup";

/** 开局整副牌组事实由具体owner完整构造；公共角色名单不含手牌映射或设置许可。 */
export { publishInitialIdentityDeal } from "./initial-deal-publication";
