/**
 * 负责夜间有限机制组合的已提交重入准入；输入为原检查点现场读取的 World 和日次。
 * 输出为准入通过或原首个机制错误，十一项判断／十二个直接谓词调用点保持原固定顺序。
 * 提交证据仍归各机制，本模块不缓存 World、日次或演员，不写库存、重新开窗或撤销原已付效果。
 * 逐项查完才读取下一项，黑市交易与黑市受赠者保持原短路；失败不执行后续判断或新增清理策略。
 */
import type { World } from "../domain/world";
import { hasFoxInspectionNightCommit } from "../features/cursed-fox/inspection-effect";
import { hasDreamNightCommit } from "../features/dreamer/night-frame";
import { hasRoleInspectionNightCommit } from "../features/role-inspection/night-scope";
import { hasMechanicalNightCommit } from "../features/mechanical-wolf/night-scope";
import { hasBlackMarketNightCommit } from "../features/black-market-merchant/night-stage";
import { hasRecipientNightCommit } from "../features/night-abilities/recipient-ability-stage";
import { hasLuckyNightCommit } from "../features/miracle-merchant/lucky-stage";
import { hasMerchantNightCommit } from "../features/miracle-merchant/night-stage";
import { hasCupidNightCommit } from "../features/cupid/relation";
import { hasHybridNightCommit } from "../features/hybrid/night-stage";
import { hasAwakenedNightCommit } from "../features/awakened-hidden-wolf/night-scope";
import { hasDeathAbilityActivationCommit } from "../features/death-actions/death-ability-activation";

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
