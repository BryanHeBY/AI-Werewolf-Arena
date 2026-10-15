/**
 * 负责狼术师在原魔术师共享交接门控下的清理。输入为惰性原 World 与同一只读清理 ownership；
 * 输出保留配置失败 abort 及经理正常／中止调用，不另建 acquired／handedOff 位。
 * 优先级 100 开夜、复合映射回执和已付号码历史仍归原 owner；正常关闭后经理参数照读，
 * 重复关闭错误由 frame 决定，此单元不捕获施法者或计算目标。
 */
import type { World } from "../../../../core/domain/world";
import type { MagicianNightCleanupOwnership } from "../magician/ports";
import { closeWolfSorcererNight, abortWolfSorcererNight } from "./night_frame";

export interface WolfSorcererNightRuntime {
  readonly world: World;
}

export const wolfSorcererNightTerminal = Object.freeze({
  closeNormally(world: World, day: number): void {
    closeWolfSorcererNight(world, day);
  },
  abort(world: World): void {
    abortWolfSorcererNight(world);
  },
});

export class WolfSorcererNightUnit {
  /** 经理接收同一清理实例；终止函数仍使用调用时新求值的 World／day 参数。 */
  readonly closeNormally = wolfSorcererNightTerminal.closeNormally;
  readonly abort = wolfSorcererNightTerminal.abort;

  constructor(
    private readonly runtime: WolfSorcererNightRuntime,
    private readonly ownership: MagicianNightCleanupOwnership,
  ) {}

  abortIfOwned(): void {
    if (!this.ownership.isTransferred()) abortWolfSorcererNight(this.runtime.world);
  }
}
