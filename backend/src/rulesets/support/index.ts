/**
 * Public production support exit consumed by board setup and ruleset assembly.
 * Exports named finite predicates only, preserving the current supported sets.
 * Recording verification owns separate implementations; no oracle, state write,
 * actor snapshot or transport is exposed through this setup-only entry.
 */
export { isAnimalDreamPreset } from "./animal-dream";
export { isDemonHunterPreset } from "./demon-hunter";
export { isEvilKnightPreset } from "./evil-knight";
export { isFragrantPairSeerPreset } from "./fragrant-pair-seer";
export { isGhostBridePreset } from "./ghost-bride";
export { isMagicianPreset } from "./magician";
export { isMistRavenPreset } from "./mist-raven";
export { isNightmarePreset } from "./nightmare";
export { isNobleSecretBodyPreset } from "./noble-secret-body";
export { isOrderPrincePreset } from "./order-prince";
export { isPureWhitePreset } from "./pure-white";
export { isRadiantEclipsePreset } from "./radiant-eclipse";
export { isRedMoonPreset } from "./red-moon";
export { isScholarMentorPreset } from "./scholar-mentor";
export { isTimeConsortPreset } from "./time-consort";
export { isTricksterPreset } from "./trickster";
export { isWolfSorcererPreset } from "./wolf-sorcerer";
