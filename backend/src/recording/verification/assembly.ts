/**
 * 负责归档机制 verifier 的完整固定装配。输入为 envelope／schema 已验证的 reproduction 数据；
 * 输出为原拒绝或全部审计通过，既有16步及其第一失败保持原顺序，不提前捕获可替换函数数组。
 * 贵族独立推导出的 audit 在原位置传给恶魔；其原 RedMoon／nativeStocks 子链仍由恶魔 verifier 消费。
 * 原18步之后追加普通死亡后果历史审核；schema 2 结构不变，新增严格语义拒绝不进入公开 replay／player reader。
 * 本入口不导入 World、生产结算或 checkpoint 写方，不授予行动权限；精确构建相容仍由执行器核对。
 * 独立 schema／ID／安全读器只确认结构，历史成功、失败前缀与规则推导仍属于各实际 verifier。
 */
import type { ReproductionRecord } from "../reproduction/format";
import { validateInitialIdentityRecord } from "./initial-identity/validate";
import { validateWildChildRecord } from "./wild-child/validate";
import { validateLonelyGirlRecord } from "./lonely-girl/validate";
import { validateGhostBrideRecord } from "./ghost-bride/validate";
import { validateAnimalDreamRecord } from "./animal-dream/validate";
import { validateFragrantPairRecord } from "./fragrant-pair-seer/validate";
import { validateNobleSecretBodyRecord } from "./noble-secret-body/validate";
import { validateDemonHunterRecord } from "./demon-hunter/validate";
import { validateScholarMentorRecord } from "./scholar-mentor/validate";
import { validateMistRavenRecord } from "./mist-raven/validate";
import { validateRadiantEclipseRecord } from "./radiant-eclipse/validate";
import { validateTimeConsortRecord } from "./time-wolf-consort/validate";
import { validateWolfSorcererRecord } from "./wolf-sorcerer/validate";
import { validateTricksterRecord } from "./trickster/validate";
import { validateMagicianRecord } from "./magician/validate";
import { validateOrderPrinceRecord } from "./order-prince/validate";
import { validateCupidRecord } from "./cupid/validate";
import { validateHybridRecord } from "./hybrid/validate";
import { validateAwakenedWitchRecord } from "./awakened-witch/validate";
import { validateAwakenedDayRolesRecord } from "./awakened-day-roles/validate";
import { validateAwakenedDarkStarsRecord } from "./awakened-dark-stars/validate";
import { validateAwakenedClawRecord } from "./awakened-wolf-king/validate";
import { validateSilenceElderRecord } from "./silence-elder/validate";
import { validateWardenRecord } from "./warden/validate";
import { validateCrowRecord } from "./crow/validate";
import { validateDeathHistoryRecord } from "./death-history/validate";

export function verifyReproductionMechanisms(result: ReproductionRecord): void {
  validateInitialIdentityRecord(result);
  validateWildChildRecord(result);
  validateLonelyGirlRecord(result);
  validateGhostBrideRecord(result);
  validateAnimalDreamRecord(result);
  validateFragrantPairRecord(result);
  // 传递的是由归档重建的审计数据，不是运行时 owner、原体或死亡提交回执。
  const noble = validateNobleSecretBodyRecord(result);
  validateDemonHunterRecord(result, noble);
  validateScholarMentorRecord(result);
  validateMistRavenRecord(result);
  validateRadiantEclipseRecord(result);
  validateTimeConsortRecord(result);
  validateWolfSorcererRecord(result);
  validateTricksterRecord(result);
  validateMagicianRecord(result);
  validateOrderPrinceRecord(result);
  // 只在原16步之后追加；旧严格 malformed 档可能在后续 sourceHash 兼容检查前被新语义拒绝。
  validateCupidRecord(result);
  validateHybridRecord(result);
  // 只据确定来源、事实和完整／失败 CP 核普通后果；未知特殊段不补作运行许可。
  validateDeathHistoryRecord(result);
  validateCrowRecord(result);
  validateSilenceElderRecord(result);
  validateAwakenedClawRecord(result);
  validateAwakenedWitchRecord(result);
  validateWardenRecord(result);
  validateAwakenedDayRolesRecord(result);
  validateAwakenedDarkStarsRecord(result);
}
