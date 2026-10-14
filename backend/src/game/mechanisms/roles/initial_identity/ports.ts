/**
 * 提供盗贼／千面人原准备状态、活跃窗口与当夜提交证据的公开查询绑定。
 * 输入保留原 World／日期，输出为原准备结果、重入证据或关闭能力；不复制状态或授予行动。
 * 同步准入按调用点晚查询；实际开夜仍先检查准备状态，close 沿原 finally 顺序消费。
 * 查询不扩大读写权限；设置、资源和知识仍由 deal 生命周期拥有，本入口不重开已关闭的设置或行动窗口。
 */
export {
  hasActiveInitialIdentitySetup,
  hasActiveInitialIdentityNight,
  hasInitialIdentityNightCommit,
  initialIdentityKind,
  initialIdentitySetupReady,
  openInitialIdentityNight,
} from "./deal";
