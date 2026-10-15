/**
 * 负责学者／导师管线清理交接及经理终止端口。输入为惰性原 World 与经理实际 World／day；
 * 输出保留原 grant 解析错误及 frame abort 写。开夜仍在优先级 50，配置清理即使未进该阶段也会运行，
 * 只有原晚 transfer 才抑制管线 abort。正常关闭后经理仍读 abort 参数，由 frame.closed 防止污染后夜。
 * 这里不授奖励、不付款、启动阶段或录制 I/O。
 */
import type { World } from "../../../../core/domain/world";
import { closeScholarMentorNight, abortScholarMentorNight } from "./night_frame";

export interface ScholarMentorNightRuntime {
  readonly world: World;
}

export const scholarMentorNightTerminal = Object.freeze({
  closeNormally(world: World, day: number): void {
    closeScholarMentorNight(world, day);
  },
  abort(world: World): void {
    abortScholarMentorNight(world);
  },
});

export class ScholarMentorNightUnit {
  /** 经理接收同一清理实例；终止函数仍使用调用时新求值的 World／day 参数。 */
  readonly closeNormally = scholarMentorNightTerminal.closeNormally;
  readonly abort = scholarMentorNightTerminal.abort;

  private transferred = false;
  constructor(private readonly runtime: ScholarMentorNightRuntime) {}

  transferToManager(configured: boolean): void {
    this.transferred = configured;
  }

  abortIfOwned(): void {
    if (!this.transferred) abortScholarMentorNight(this.runtime.world);
  }
}
