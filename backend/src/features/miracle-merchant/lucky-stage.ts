/**
 * 负责把幸运儿已获技能接入既有接收方阶段 owner。输入为原 World／夜数；输出为 lucky 种类的原提交查询、
 * 提交登记与优先级 700 handler。具体库存、资格及行动流程仍归 recipient_ability_stage，不在这里复制或授予技能。
 */
import type { World } from "../../domain/world";
import {
  hasRecipientNightCommit,
  recordRecipientNightCommit,
  recipientAbilityStage,
} from "../night-abilities/recipient-ability-stage";
export const hasLuckyNightCommit = (world: World, day: number) =>
  hasRecipientNightCommit(world, day, "lucky");
export const recordLuckyNightCommit = (world: World, day: number) =>
  recordRecipientNightCommit(world, day, "lucky");
export const LUCKY_ABILITY_STAGE = recipientAbilityStage("lucky", 700);
