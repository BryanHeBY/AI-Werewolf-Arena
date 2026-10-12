/**
 * Checks long-lived production module names against the refactor vocabulary.
 * Inputs are detached public paths; output lists phase/review prefixes and vague
 * extended state names. Historical names remain explicit debt until an approved
 * path migration clears them. Tests and historical documentation keep their own
 * scenario identifiers and are not classified as production modules here.
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
