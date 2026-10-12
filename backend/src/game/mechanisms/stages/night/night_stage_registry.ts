/**
 * Provides the existing night-stage registry from its ruleset owner to legacy consumers.
 * The ruleset compiler owns closure, collection and order; this named bridge
 * contains no duplicate algorithm or default instance and exits after consumers
 * move to the ruleset public entry. Existing class and singleton identity remain.
 */
export {
  NightStageRegistry,
  getDefaultNightStageRegistry,
} from "../../../../rulesets/night-stage-plan";
