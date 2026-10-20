/**
 * 负责全天保护板自爆声明与真实死亡发布的原结果绑定。输入真实自爆提案／原体与DR提交凭证，
 * 输出仅该原结果的原lifeMap和一次实际结算事实；不改Alive、判盾、授权自爆或推进白天。
 * 声明仅揭示狼身份，真实commit后才公布出局；空凭证表示未实际死亡，不让旧预告提前改变AI/Web。
 * WeakMap只保运行原引用，JSON不能恢复发布身份；发表失败保真提交前缀、不重复生成正常结果。
 */
import {
  type ActionWindow,
  type GameEvent,
  type DeathSources,
  DeathCause,
} from "@ai-werewolf-arena/game-contract";
import type { OriginalPlayerScope } from "../../domain/original-player-scope";
import type { DeathCommitReceipt, DeathOriginalLife } from "../../engine/death-wave";
interface Blast {
  readonly deaths: number[];
  readonly sources: DeathSources;
}
interface Publication {
  readonly actor: OriginalPlayerScope;
  readonly day: number;
  readonly window: ActionWindow;
  published: boolean;
}
const publications = new WeakMap<object, Publication>();
export function bindProtectedBlastPublication(
  blast: Blast,
  actor: OriginalPlayerScope,
  day: number,
  window: ActionWindow,
): void {
  if (publications.has(blast)) throw new Error("protected_self_destruct_already_bound");
  publications.set(blast, { actor, day, window, published: false });
}
interface Existing {
  readonly originalLives?: ReadonlyMap<number, DeathOriginalLife>;
  onInitialWaveCommitted?: (
    ids: readonly number[],
    sources: DeathSources | undefined,
    receipt: DeathCommitReceipt,
  ) => GameEvent;
}
/** 未绑定的旧结果原位返回空增量，零World/自定义字段读取；只有具名新调用合并既有黎明发布。 */
export function protectedBlastDeathPublication(
  blast: object | undefined,
  events: () => GameEvent[],
  existing?: Existing,
): Existing {
  const p = blast && publications.get(blast);
  if (!p) return existing ?? {};
  const originalLives = new Map(existing?.originalLives ?? []);
  originalLives.set(p.actor.id, { life: p.actor.life, version: p.actor.version });
  const previous = existing?.onInitialWaveCommitted;
  return {
    originalLives,
    onInitialWaveCommitted(ids, sources, receipt) {
      if (p.published) throw new Error("protected_self_destruct_already_published");
      // 先消费实际提交发布身份；previous、时钟或sink同步重入也不能重复发表真实结果。
      p.published = true;
      const before = previous?.(ids, sources, receipt);
      const entry = receipt.committed(p.actor.id),
        deaths =
          entry?.firstSettlement &&
          entry.settled.component === p.actor.life &&
          entry.settled.version === p.actor.version + 1 &&
          receipt.wave.sources[p.actor.id]?.includes(DeathCause.SelfDestruct)
            ? [p.actor.id]
            : [];
      const event: GameEvent = {
        timestamp: Date.now(),
        type: "awakened_self_destruct_resolved",
        payload: {
          policy: "awa_awakened_guard_cycle_v1",
          actorId: p.actor.id,
          day: p.day,
          window: p.window,
          deaths,
        },
      };
      events().push(event);
      receipt.recordPublication(event, deaths);
      return before ?? event;
    },
  };
}
