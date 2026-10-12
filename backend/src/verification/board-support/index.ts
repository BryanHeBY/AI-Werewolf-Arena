/**
 * Responsibility: expose the archive verifier's frozen finite board checks.
 * Input: named support predicates owned in this directory; output: the public
 * verification-only API used by record validators. It never imports production
 * rulesets or text, normalizes config, pays resources or authorizes game actions.
 * Data/schema validity alone is not a supported-board verdict. Individual checks
 * preserve the archived compatibility policies and internal call order.
 */
export { isAnimalDreamPreset } from "./animal-dream-preset";
export { isDemonHunterPreset } from "./demon-hunter-preset";
export { isEvilKnightPreset } from "./evil-knight-preset";
export { isFragrantPairSeerPreset } from "./fragrant-pair-seer-preset";
export { isGhostBridePreset } from "./ghost-bride-preset";
export { isMagicianPreset } from "./magician-preset";
export { isMistRavenPreset } from "./mist-raven-preset";
export { isNightmarePreset } from "./nightmare-preset";
export { isNobleSecretBodyPreset } from "./noble-secret-body-preset";
export { isOrderPrincePreset } from "./order-prince-preset";
export { isPureWhitePreset } from "./pure-white-preset";
export { isRadiantEclipsePreset } from "./radiant-eclipse-preset";
export { isRedMoonPreset } from "./red-moon-preset";
export { isScholarMentorPreset } from "./scholar-mentor-preset";
export { isTimeConsortPreset } from "./time-consort-preset";
export { isTricksterPreset } from "./trickster-preset";
export { isWolfSorcererPreset } from "./wolf-sorcerer-preset";
