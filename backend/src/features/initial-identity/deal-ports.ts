/**
 * 提供盗贼／千面人共用实体牌库存和准备生命周期的轻公开绑定。输入保留原 World、牌组、玩家与 slot；
 * 输出为同一库存引用、选择投影、准备状态或原关闭能力，所有算法与唯一库存仍归 deal 所有者。
 * 本入口不加载首夜窗口／Catalog，不创建另一份状态，也不以数据类型、投影或查询授予换牌权限。
 * kind 隔离与必选策略由本族调用方／原选择所有者处理；函数在原表达式时点查询，原失败与已写前缀不补偿。
 */
export type {
  InitialIdentityCard,
  InitialIdentitySlot,
  InitialIdentitySetupStatus,
  InitialIdentityDeal,
} from "./deal";

/** 原实体牌和手牌引用只由同一 owner 安装／检查；导出不会重发、复制库存或绕过选择时的复验。 */
export {
  INITIAL_IDENTITY_POLICIES,
  initialIdentityKind,
  installInitialIdentityDeal,
  initialIdentityStock,
  initialIdentityDeal,
  initialIdentityCandidateCounts,
  initialIdentitySetupStatus,
  hasActiveInitialIdentitySetup,
  initialIdentitySetupReady,
  pendingInitialIdentityDealValid,
  openInitialIdentitySetup,
  closeInitialIdentitySetup,
  selectInitialIdentityCard,
  projectInitialIdentitySetup,
  hasActiveInitialIdentityNight,
  hasInitialIdentityNightCommit,
  openInitialIdentityNight,
} from "./deal";
