/**
 * 负责炼金魔女／狼鸦之爪管线的开夜事实与清理责任交接。输入为惰性原 World／events 和实际夜数；
 * 输出保留 begin→通知事实及伤害捕获回执。捕获伤害不转移清理，只有原晚 transfer 点才交权。
 * 部分开夜失败仍按配置尝试 abort；经理正常关闭后仍读参数并发起重复 abort，由 frame 决定关闭规则。
 * 已付选择、蛇窗和资源仍归 frame／施法 authority，这里不退款、结算死亡或推进阶段。
 */
import type { GameEvent } from "@ai-werewolf-arena/game-contract";
import type { World } from "../../../../core/domain/world";
import { beginMistNight, handOffMistNight, closeMistNight, abortMistNight } from "./night_frame";

export interface MistNightRuntime {
  readonly world: World;
  readonly events: GameEvent[];
}

export const mistNightTerminal = Object.freeze({
  closeNormally(world: World, day: number): void {
    closeMistNight(world, day);
  },
  abort(world: World): void {
    abortMistNight(world);
  },
});

export class MistNightUnit {
  /** 经理接收同一清理实例；终止函数仍使用调用时新求值的 World／day 参数。 */
  readonly closeNormally = mistNightTerminal.closeNormally;
  readonly abort = mistNightTerminal.abort;

  private transferred = false;
  constructor(
    private readonly runtime: MistNightRuntime,
    private readonly day: number,
  ) {}

  open(): void {
    const unsealed = beginMistNight(this.runtime.world, this.day);
    if (unsealed)
      this.runtime.events.push({
        timestamp: Date.now(),
        type: "raven_unsealed",
        payload: { ...unsealed, day: this.day, awakened: true },
        audience: Object.freeze([unsealed.actorId]),
      });
  }

  /** 调用方在原狼刀目标实参求值之前提供 World；捕获伤害本身不转移清理责任。 */
  captureDamage(world: World, day: number, wolfTarget: number | null) {
    return handOffMistNight(world, day, wolfTarget);
  }

  /** 只在真实晚交接点记录经理是否接管；captureDamage 的成功不提前改这个标志。 */
  transferToManager(ownsMist: boolean): void {
    this.transferred = ownsMist;
  }

  abortIfOwned(): void {
    if (!this.transferred) abortMistNight(this.runtime.world);
  }
}
