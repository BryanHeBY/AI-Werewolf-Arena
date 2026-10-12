/**
 * Provides the named compatibility exit for existing animal-dream fact consumers.
 * Inputs are public contract reader/type ports; outputs retain the original
 * exports without duplicate parsing. This facade never renders text, validates
 * finite board support or grants domain authority; Node ingress stays separate.
 */
export {
  ANIMAL_DREAM_EVENT_TYPES,
  readAnimalDreamFact,
  animalDreamFactAudience,
} from "@ai-werewolf-arena/game-contract/facts/animal-dream";
export type {
  AnimalBeautyKnowledge,
  AnimalDreamPayloadMap,
  AnimalDreamEventType,
  AnimalDreamFact,
} from "@ai-werewolf-arena/game-contract/facts/animal-dream";
