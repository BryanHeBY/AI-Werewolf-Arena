/**
 * Named compatibility exit for configuration and bootstrap board checks.
 * Input: the public ruleset module contract used by existing callers.
 * Outputs the public ruleset rejection dispatcher; finite support and stable
 * first-error order have a single production owner. This facade never executes
 * rules, imports feature state or grants authority. Remaining consumers exit C44.
 */
export { boardPresetViolation } from "../../../rulesets";
