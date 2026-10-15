/**
 * 负责保留配置／开局检查使用的原具名兼容出口。输入为公共 rulesets 模块契约；
 * 输出为同一 boardPresetViolation 绑定。有限板子支持和首错顺序只由规则集拥有，
 * 此文件不复制检查算法或实例；再导出的模块加载仍按原依赖发生，不授予运行权限。
 */
export { boardPresetViolation } from "../../../rulesets";
