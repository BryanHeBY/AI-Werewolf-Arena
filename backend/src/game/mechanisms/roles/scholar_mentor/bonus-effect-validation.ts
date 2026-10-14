/**
 * 负责白昼学者／寂夜导师已记录加成效果的完整复验，供本族加成阶段及夜间规则检查点共用。
 * 输入为原阶段上下文和同一状态身份关联的运行记录；输出为通过或原首个失效错误，不付款或发布事实。
 * 先复验名单，再读记录；每条先取 target、执行 effectCurrent，之后按原短路核原生命／版本与 marks 引用。
 * 记录存在不代表效果仍有效；读取和回调失败原样传播，已付资源及记录不由这里关闭、删除或退款。
 * 原 receipt／生命／印记是运行句柄，数据副本不能替代；本模块不推进阶段或重新打开请求窗口。
 */
import { COMPONENT } from "../../../../core/domain/components/names";
import { aliveLifeVersion } from "../../../../core/domain/components/alive";
import type { NightStageContext } from "../../stages/night/contracts";
import { assertScholarMentorRosterCurrent } from "./night_frame";
import { readScholarMentorBonusEffectRecords } from "./bonus-effect-records";

/** 只检查原已付效果的运行有效性；不调用 receipt.commit，也不把撤权后的同形目标重新捕获为新来源。 */
export function assertScholarMentorBonusEffects(ctx: NightStageContext): void {
  assertScholarMentorRosterCurrent(ctx.world);
  for (const effect of readScholarMentorBonusEffectRecords(ctx.state)) {
    const target = effect.receipt.target;
    if (
      !effect.receipt.effectCurrent() ||
      (target &&
        (ctx.world.getComponent(target.id, COMPONENT.Alive) !== target.life ||
          aliveLifeVersion(target.life) !== target.version)) ||
      (effect.marks &&
        target &&
        ctx.world.getComponent(target.id, COMPONENT.StatusMarks) !== effect.marks)
    )
      throw new Error("scholar_mentor_bonus_effect_stale");
  }
}
