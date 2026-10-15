/**
 * 负责动物梦境每次夜间执行的获取、开夜事实与终止关闭。输入为惰性委托的原 World／events、
 * 实际夜数和当前性回调；先开 authority，再标记 acquired，最后发布开夜事实。
 * 只有已获取且未正常关闭的单元才尝试 abort；发布失败保留原 authority 前缀，不退款狐狸选择、
 * 推进阶段或改变猫／河豚死亡及实际放逐单元。
 */
import type { World } from "../../../../domain/world";
import type { GameEvent } from "@ai-werewolf-arena/game-contract";
import { beginAnimalNight, closeAnimalNight } from "./authority";
import { appendAnimalFact } from "./facts";

export interface AnimalNightRuntime {
  readonly world: World;
  readonly events: GameEvent[];
}
export class AnimalNightUnit {
  private acquired = false;
  private closed = false;
  constructor(
    private readonly runtime: AnimalNightRuntime,
    private readonly day: number,
  ) {}
  open(isCurrent: () => boolean): void {
    const ctx = this.runtime,
      day = this.day;
    beginAnimalNight(ctx.world, day, isCurrent);
    this.acquired = true;
    appendAnimalFact(ctx.world, ctx.events, "animal_night_opened", {
      policy: "awa_animal_dream_v1",
      day,
    });
  }
  closeNormally(): void {
    closeAnimalNight(this.runtime.world, this.day, "normal");
    this.closed = true;
  }
  abortIfOwned(): void {
    if (this.acquired && !this.closed) closeAnimalNight(this.runtime.world, this.day, "aborted");
  }
}
