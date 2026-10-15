/**
 * 负责夜间有限机制组合的已提交重入准入；输入为原检查点现场读取的 World 和日次。
 * 输出为准入通过或原首个机制错误，十一项判断／十二个直接谓词调用点保持原固定顺序。
 * 提交证据仍归各机制，本模块不缓存 World、日次或演员，不写库存、重新开窗或撤销原已付效果。
 * 逐项查完才读取下一项，黑市交易与黑市受赠者保持原短路；失败不执行后续判断或新增清理策略。
 */
import type { World } from "../domain/world";
import { hasFoxInspectionNightCommit } from "../game/mechanisms/roles/cursed_fox/inspection_effect";
import { hasDreamNightCommit } from "../game/mechanisms/roles/dreamer/night_frame";
import { hasRoleInspectionNightCommit } from "../game/mechanisms/roles/role_inspection/night_scope";
import { hasMechanicalNightCommit } from "../game/mechanisms/roles/mechanical_wolf/night_scope";
import { hasBlackMarketNightCommit } from "../game/mechanisms/roles/black_market_merchant/night_stage";
import { hasRecipientNightCommit } from "../game/mechanisms/roles/recipient_ability_stage";
import { hasLuckyNightCommit } from "../game/mechanisms/roles/miracle_merchant/lucky_stage";
import { hasMerchantNightCommit } from "../game/mechanisms/roles/miracle_merchant/night_stage";
import { hasCupidNightCommit } from "../game/mechanisms/roles/cupid/relation";
import { hasHybridNightCommit } from "../game/mechanisms/roles/hybrid/night_stage";
import { hasAwakenedNightCommit } from "../game/mechanisms/roles/awakened_hidden_wolf/night_scope";
import { hasDeathAbilityActivationCommit } from "../game/mechanisms/roles/death_ability_activation";

/** 每个参数只在原谓词调用点读取；组合不提前收齐证据或替换机制自己的状态判断。 */
export interface NightCommitAdmissionRuntime {
  world(): World;
  day(): number;
}

/** 同步准入位于原开夜握手之后、起始记录和阶段推进之前；命中原当夜提交证据就拒绝重入，不撤销已付效果。 */
export function assertNightCommitAdmission(runtime: NightCommitAdmissionRuntime): void {
  if (hasFoxInspectionNightCommit(runtime.world(), runtime.day()))
    throw new Error("fox_inspection_night_reentry_after_commit");
  if (hasDreamNightCommit(runtime.world(), runtime.day()))
    throw new Error("dream_night_reentry_after_commit");
  if (hasRoleInspectionNightCommit(runtime.world(), runtime.day()))
    throw new Error("role_inspection_night_reentry_after_commit");
  if (hasMechanicalNightCommit(runtime.world(), runtime.day()))
    throw new Error("mechanical_night_reentry_after_commit");

  // 原黑市交易先判，已提交时不查询受赠者；两类提交归同一拒绝原因，不吞并幸运儿政策。
  if (
    hasBlackMarketNightCommit(runtime.world(), runtime.day()) ||
    hasRecipientNightCommit(runtime.world(), runtime.day(), "black_market")
  )
    throw new Error("black_market_night_reentry_after_commit");
  if (hasLuckyNightCommit(runtime.world(), runtime.day()))
    throw new Error("lucky_night_reentry_after_commit");
  if (hasMerchantNightCommit(runtime.world(), runtime.day()))
    throw new Error("merchant_night_reentry_after_commit");
  if (hasCupidNightCommit(runtime.world(), runtime.day()))
    throw new Error("cupid_night_reentry_after_commit");
  if (hasHybridNightCommit(runtime.world(), runtime.day()))
    throw new Error("hybrid_night_reentry_after_commit");
  if (hasAwakenedNightCommit(runtime.world(), runtime.day()))
    throw new Error("awakened_night_reentry_after_commit");
  if (hasDeathAbilityActivationCommit(runtime.world(), runtime.day()))
    throw new Error("death_ability_night_reentry_after_commit");
}
