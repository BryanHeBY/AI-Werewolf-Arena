/**
 * 负责贵族／夜仆夜间取得与经理交接，输入为延迟 World／事件、日期、current 与必要记录；
 * 输出保留原通知、取得先于发布及相同 receiver。真实夜间身份随同一 owner 交付并消费夜末到期。
 * 交接后 pipeline 不再正常开夜或终止；经理保原正常／abort 政策与 bodyResolved 检查。
 * World／day 在原调用点取值，不缓存替身世界；身份不进入请求、MCP、checkpoint 或 Tape。
 * 规则依据：docs/rules/awa-noble-secret-body-twelve-v1.md。
 */
import { types } from "node:util";
import type { NightUnit } from "../../domain/night-unit";
import type { World } from "../../domain/world";
import type { GameEvent } from "@ai-werewolf-arena/game-contract";
import {
  beginNobleBodyNight,
  abortNobleBodyNight,
  closeNobleBodyNight,
  checkpointNobleBodyAuthority,
  expireServantAtNightEnd,
} from "./authority";
import { appendNobleBodyNotices } from "./facts";

export type NobleOpeningFact = {
  readonly policy: "awa_noble_secret_body_v1";
  readonly actorId: number;
  readonly day: number;
  readonly notifiedActorIds: number[];
};
export interface NobleNightRuntime {
  readonly world: World;
  readonly events: GameEvent[];
  recordOpening(payload: NobleOpeningFact): void;
}
export interface NobleNightAbortReceiver {
  abort(world: World, day: number): void;
}
export interface NobleNightReceiver extends NobleNightAbortReceiver {
  closeNormally(world: World, day: number): void;
}
const ownedResults = new WeakSet<object>();
const ownedReceivers = new WeakSet<object>();
const NOBLE_NIGHT_RECEIVER = Symbol("noble_night_receiver");

/** 取得前的中断接收方不读取 World／day／config，不生成成功开夜身份。 */
export function createNobleNightAbortReceiver(): NobleNightAbortReceiver {
  return Object.freeze({
    abort(world: World, day: number) {
      abortNobleBodyNight(world, day);
    },
  });
}

function createNobleNightReceiver(unit: () => NightUnit | undefined): NobleNightReceiver {
  const receiver = Object.freeze({
    closeNormally(world: World, day: number) {
      closeNobleBodyNight(world, day, "normal");
    },
    abort(world: World, day: number) {
      abortNobleBodyNight(world, day);
    },
    expire(world: () => World, day: () => number) {
      return expireServantAtNightEnd(world(), day(), unit());
    },
  });
  ownedReceivers.add(receiver);
  return receiver;
}

/** 只给后端结果关联运行时接收方；原可枚举字段、JSON 与展开复制保持。 */
export function attachNobleNightReceiver<T extends object>(
  result: T,
  receiver: NobleNightAbortReceiver,
): T {
  Object.defineProperty(result, NOBLE_NIGHT_RECEIVER, { value: receiver });
  ownedResults.add(result);
  return result;
}

export function nobleNightReceiver(result: { interrupted: false }): NobleNightReceiver;
export function nobleNightReceiver(result: object): NobleNightAbortReceiver;
export function nobleNightReceiver(result: object): NobleNightAbortReceiver {
  const receiver = Object.getOwnPropertyDescriptor(result, NOBLE_NIGHT_RECEIVER)?.value as
    NobleNightAbortReceiver | undefined;
  if (!receiver) throw new Error("noble_night_receiver_missing");
  return receiver;
}

/**
 * 夜末到期真正消费同一夜间接收方的身份。只读本owner创建的结果／receiver；
 * 外部旧对象与旧receiver继续原两参数到期路径，不新增Symbol或方法getter读取。
 */
export function expireNobleNight(result: object, world: () => World, day: () => number) {
  if (!ownedResults.has(result) || types.isProxy(result)) return expireServantAtNightEnd(world(), day());
  const receiver = (result as { readonly [NOBLE_NIGHT_RECEIVER]: NobleNightReceiver })[NOBLE_NIGHT_RECEIVER];
  if (!ownedReceivers.has(receiver)) return expireServantAtNightEnd(world(), day());
  return (receiver as NobleNightReceiver & { expire(world: () => World, day: () => number): ReturnType<typeof expireServantAtNightEnd> }).expire(world, day);
}

export class NobleNightUnit {
  private acquired = false;
  private transferred = false;
  readonly receiver = createNobleNightReceiver(() => this.nightUnit);
  constructor(
    private readonly runtime: NobleNightRuntime,
    private readonly day: number,
    private readonly nightUnit?: NightUnit,
  ) {}
  open(isCurrent: () => boolean): void {
    if (this.transferred) throw new Error("noble_night_pipeline_ownership_transferred");
    const ctx = this.runtime,
      day = this.day;
    const notices = beginNobleBodyNight(ctx.world, day, isCurrent, this.nightUnit);
    this.acquired = true;
    appendNobleBodyNotices(ctx.events, notices);
    const payload = {
      policy: "awa_noble_secret_body_v1" as const,
      actorId: checkpointNobleBodyAuthority(ctx.world, true).nobleId,
      day,
      notifiedActorIds: notices.map((n) => n.actorId),
    };
    ctx.events.push({
      timestamp: Date.now(),
      type: "noble_body_night_opened",
      payload,
      audience: Object.freeze([]),
    });
    ctx.recordOpening(payload);
  }
  transferToManager(): void {
    this.transferred = true;
  }
  abortIfOwned(): void {
    if (this.acquired && !this.transferred) abortNobleBodyNight(this.runtime.world, this.day);
  }
}
