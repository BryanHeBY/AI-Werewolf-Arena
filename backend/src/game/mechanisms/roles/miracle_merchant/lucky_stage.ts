import type { World } from "../../../../core/domain/world";
import { hasRecipientNightCommit, recordRecipientNightCommit, recipientAbilityStage } from "../recipient_ability_stage";
export const hasLuckyNightCommit = (world: World, day: number) => hasRecipientNightCommit(world, day, "lucky");
export const recordLuckyNightCommit = (world: World, day: number) => recordRecipientNightCommit(world, day, "lucky");
export const LUCKY_ABILITY_STAGE = recipientAbilityStage("lucky", 700);
