/**
 * 负责检查长期生产模块的命名。输入为公共源码路径；输出为开发阶段／评审词项和 extended 泛名违规。
 * 仅处理 backend/src、frontend/src 与 packages 下各包 src 目录的 JS／TS；常规测试目录和历史文档不进入该范围。
 * 生产目录内的测试后缀不会自动豁免，分类仍按原路径规则；历史命名由固定债务报告，获准迁移须符合原门禁条件。
 * 本检查不改路径、重命名文件或创建例外，也不把没有命名违规当作业务所有权已经正确。
 */
import {
  isProductionPath,
  violation,
  type ArchitectureInput,
  type ArchitectureViolation,
} from "./contracts";

export function checkNaming(input: ArchitectureInput): ArchitectureViolation[] {
  return input.files
    .filter((file) => isProductionPath(file.path) && /\.[cm]?[jt]sx?$/.test(file.path))
    .flatMap((file) => {
      const violations: ArchitectureViolation[] = [];
      // 只按原分隔词项匹配开发标签；不改阶段编号、大小写或匹配边界来清除债务。
      if (/(?:^|[/_-])(?:p\d+[a-z]?|c\d{2}|review)(?:[/_.-]|$)/i.test(file.path))
        violations.push(
          violation(
            "naming.development-prefix",
            file.path,
            1,
            1,
            "Production module retains a development stage or review name.",
          ),
        );
      if (/(?:^|[/_-])extended(?:[/_.-]|$)/i.test(file.path))
        violations.push(
          violation(
            "naming.extended-bag",
            file.path,
            1,
            1,
            "Production state/module uses extended rather than its owned business concept.",
          ),
        );
      return violations;
    });
}
