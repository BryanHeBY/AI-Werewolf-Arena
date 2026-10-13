/**
 * 负责归档机制 verifier 的完整固定装配。输入为 envelope／schema 已验证的 reproduction 数据；
 * 输出为原拒绝或全部审计通过，16步调用和第一失败保持原顺序，不提前捕获可替换函数数组。
 * 贵族独立推导出的 audit 在原位置传给恶魔；其原 RedMoon／nativeStocks 子链仍由恶魔 verifier 消费。
 * 本入口不导入 World、生产结算或 checkpoint 写方，不授予行动权限，不改变归档／规则版本准入。
 * 独立 schema／ID／安全读器只确认结构，历史成功、失败前缀与规则推导仍属于各实际 verifier。
 */
import type { ReproductionRecord } from "../../recording/reproduction";
import { validateInitialIdentityRecord } from "./initial-identity";
import { validateWildChildRecord } from "./wild-child";
import { validateLonelyGirlRecord } from "./lonely-girl";
import { validateGhostBrideRecord } from "../../recording/ghost_bride_record";
import { validateAnimalDreamRecord } from "../../recording/animal_dream_record";
import { validateFragrantPairRecord } from "../../recording/fragrant_pair_seer_record";
import { validateNobleSecretBodyRecord } from "../../recording/noble_secret_body_record";
import { validateDemonHunterRecord } from "../../recording/demon_hunter_record";
import { validateScholarMentorRecord } from "../../recording/scholar_mentor_record";
import { validateMistRavenRecord } from "../../recording/mist_raven_record";
import { validateRadiantEclipseRecord } from "../../recording/radiant_eclipse_record";
import { validateTimeConsortRecord } from "../../recording/time_consort_record";
import { validateWolfSorcererRecord } from "../../recording/wolf_sorcerer_record";
import { validateTricksterRecord } from "../../recording/trickster_record";
import { validateMagicianRecord } from "../../recording/magician_record";
import { validateOrderPrinceRecord } from "../../recording/order_prince_record";

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
}
