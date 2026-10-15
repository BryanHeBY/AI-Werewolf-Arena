/**
 * 负责诡术师在三族共享魔术师移交条件下的夜间清理。输入为延迟 World 和同一只读移交查询；
 * 输出保留流水线配置分支内的中止，以及经理在白天放逐前的正常完成。本单位不另存移交／取得标志。
 * priority=100 的开夜仍归阶段；正常完成只由 frame 标记 finished，保留后续放逐映射，
 * 中止是否关闭由 frame 的原 finished 条件决定。重复终结调用不抑制参数读取或原生错误，不承诺幂等。
 * 清理写入仅委托原 frame；共享视图不是行动授权，本单位不增加外层周期清理、消费号码或结算放逐。
 */
import type { World } from "../../../../domain/world";
import type { MagicianNightCleanupOwnership } from "../magician/ports";
import { finishTricksterNight, abortTricksterNight } from "./night_frame";

/** 保存原运行对象而非预读 World；是否读取仍取决于当次共享移交查询结果。 */
export interface TricksterNightRuntime {
  readonly world: World;
}

/** 保原 finish／abort 入口和当次参数；方法表冻结不替代 frame 对夜窗口与 finished 的判断。 */
export const tricksterNightTerminal = Object.freeze({
  finishNormally(world: World, day: number): void {
    finishTricksterNight(world, day);
  },
  abort(world: World): void {
    abortTricksterNight(world);
  },
});

export class TricksterNightUnit {
  /** 经理接收同一单位；保存原终结函数值，正常完成／中止的 World／day 不在构造时缓存。 */
  readonly finishNormally = tricksterNightTerminal.finishNormally;
  readonly abort = tricksterNightTerminal.abort;

  // 两对象按原引用保存；不在构造执行查询，也不给诡术师另建移交布尔状态。
  constructor(
    private readonly runtime: TricksterNightRuntime,
    private readonly ownership: MagicianNightCleanupOwnership,
  ) {}

  /** 先调用共享 isTransferred，false 才查中止函数并读取 World；查询／中止失败均原样传播。 */
  abortIfOwned(): void {
    if (!this.ownership.isTransferred()) abortTricksterNight(this.runtime.world);
  }
}
