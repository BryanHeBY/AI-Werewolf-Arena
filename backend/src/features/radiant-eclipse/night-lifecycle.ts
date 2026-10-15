/**
 * 负责流光伯爵／蚀日侍女管线的夜间获取与原终止调用。输入为惰性原 World／events 和捕获的实际夜数；
 * 输出为原开夜／关闭效果：先 begin 成功再 acquired，正常 close 保关闭写先于事实。
 * 正常关闭不跳过已获取单元的 finally abort 或参数读取，
 * 重复终止由原 frame.closed 决定；这里不查询施法者、推进阶段、退款或录制 I/O。
 */
import type { World } from "../../domain/world";
import type { GameEvent } from "@ai-werewolf-arena/game-contract";
import { beginRadiantNight, closeRadiantNight } from "./night-frame";

export interface RadiantNightRuntime {
  readonly world: World;
  readonly events: GameEvent[];
}

export class RadiantNightUnit {
  private acquired = false;
  constructor(
    private readonly runtime: RadiantNightRuntime,
    private readonly day: number,
  ) {}

  open(): void {
    beginRadiantNight(this.runtime.world, this.day);
    this.acquired = true;
  }

  closeNormally(): void {
    closeRadiantNight(this.runtime.world, this.day, "committed", this.runtime.events);
  }

  /** 即使正常关闭已返回仍执行本次参数读取；frame自身closed guard才决定是否再次写。 */
  abortIfAcquired(): void {
    if (this.acquired)
      closeRadiantNight(this.runtime.world, this.day, "aborted", this.runtime.events);
  }
}
