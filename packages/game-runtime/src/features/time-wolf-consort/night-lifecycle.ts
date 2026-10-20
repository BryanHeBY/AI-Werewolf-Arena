/**
 * 负责蚀时狼妃管线清理交接与经理终止端口。输入为惰性原 World 及经理实际 World／day；
 * 输出保留 frame 正常关闭错误与不重验状态的 abort 写。开夜仍在优先级 50，配置清理不依赖 acquired 位，
 * 只有原晚 transfer 抑制管线 abort；正常关闭后仍计算经理 abort 参数。
 * 选择库存和反射回执仍归 frame，这里不启动阶段、重定向效果、退款或推进阶段。
 */
import type { World } from "../../domain/world";
import { closeTimeConsortNight, abortTimeConsortNight } from "./night-frame";

export interface TimeConsortNightRuntime {
  readonly world: World;
}

export const timeConsortNightTerminal = Object.freeze({
  closeNormally(world: World, day: number): void {
    closeTimeConsortNight(world, day);
  },
  abort(world: World): void {
    abortTimeConsortNight(world);
  },
});

export class TimeConsortNightUnit {
  /** 经理接收同一清理实例；终止函数仍使用调用时新求值的 World／day 参数。 */
  readonly closeNormally = timeConsortNightTerminal.closeNormally;
  readonly abort = timeConsortNightTerminal.abort;

  private transferred = false;
  constructor(private readonly runtime: TimeConsortNightRuntime) {}

  transferToManager(configured: boolean): void {
    this.transferred = configured;
  }

  abortIfOwned(): void {
    if (!this.transferred) abortTimeConsortNight(this.runtime.world);
  }
}
