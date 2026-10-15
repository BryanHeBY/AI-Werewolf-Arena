/**
 * 负责向既有调用方保留夜阶段注册表的具名出口。输入为规则集 owner 的模块契约；
 * 输出为同一 NightStageRegistry 类与默认 getter 绑定。闭包、收集、排序及默认实例只由规则集持有，
 * 此文件不复制算法／单例，保原模块加载与实例身份；兼容出口不授予阶段执行权限。
 */
export {
  NightStageRegistry,
  getDefaultNightStageRegistry,
} from "../../../../rulesets/night-stage-plan";
