/**
 * 负责狼美人追加死亡波的完整牵连准备及实际标死后的关系事实发布。
 * 输入为原 hook proposals、死亡名单／死因、夜间目标和原运行查询；输出为同绑定的领取回执列表，
 * 并在原位置修改提案或发布事实。relation 独自拥有原体、来源资格及 resolved/applied；
 * 领取先于梦阻断，阻断或发布失败保留已消费关系及先前写入，不退款或重触发。
 * 本模块不标死、不消费枪或遗言许可、不处理其它关系，也不推进阶段或判胜。
 * 规则来源：docs/rules/awa-wolf-beauty-v1.md。
 */
import { DeathCause, type DeathSources, type EntityId, type GameEvent } from "@ai-werewolf-arena/game-contract";
import type { World } from "../../../../core/domain/world";
import type { DreamNightEffects } from "../../../../core/domain/dream-night-effects";
import type { attemptCharmTrigger, commitCharmDeath, CharmBinding, CharmClaimReceipt } from "./relation";

/** 惰性读取原运行对象；字段只读不限制 events 的原发布写权，也不是运行授权屏障或归档 DTO。 */
interface WolfBeautyDeathWaveRuntime {
  readonly world: World;
  readonly events: GameEvent[];
  /** 原命令只在每次 callee 位置获取；绑定库存与实际付款仍由 relation 拥有。 */
  readonly attemptCharmTrigger: typeof attemptCharmTrigger;
  readonly commitCharmDeath: typeof commitCharmDeath;
}

/** 只收本族实际 proposal；保护在领取之后才读取，不把知识、窗口或 JSON 当作死亡许可。 */
interface CharmDeathWaveProposals {
  readonly charmLinks?: readonly { readonly binding: CharmBinding; readonly nightEffect: boolean }[];
}

/** 原绑定和 opaque 领取回执的运行关联，实际死亡仍须原 relation 再核原体与生命版本。 */
export interface CharmDeathWaveTrigger {
  readonly binding: CharmBinding;
  readonly receipt: CharmClaimReceipt;
}

export class WolfBeautyDeathWavePublication {
  constructor(private readonly runtime: WolfBeautyDeathWaveRuntime) {}

  /** 完整原领取／阻断／提案步骤；所有容器为原引用，拒绝来源时不读取 World 或保护。 */
  prepare(
    result: CharmDeathWaveProposals,
    proposed: EntityId[],
    proposedSources: DeathSources,
    nightTargets: EntityId[],
    allSources: DeathSources,
    nativeHunterShotTargets: ReadonlySet<EntityId>,
    seen: ReadonlySet<EntityId>,
    nightEffects?: { readonly dreams?: Readonly<Pick<DreamNightEffects, "blocksNightCharm">> },
  ): CharmDeathWaveTrigger[] {
    const charmTriggers: CharmDeathWaveTrigger[] = [];
    for (const proposal of result.charmLinks ?? []) {
      const binding = proposal.binding;
      // 具体关系 owner 在原位置领取和查询保护；延迟 World，permit 失败不新增读取。
      // 先取原命令再裸调用，保留 callee 读取时点与 receiver；之后才求值原参数。
      const attemptCharmTrigger = this.runtime.attemptCharmTrigger;
      const trigger = attemptCharmTrigger(
        binding,
        allSources,
        nativeHunterShotTargets,
        seen,
        () => this.runtime.world,
        () =>
          proposal.nightEffect &&
          nightEffects?.dreams?.blocksNightCharm(this.runtime.world, binding.targetId, seen),
      );
      if (!trigger) continue;
      if (trigger.kind === "blocked") {
        this.runtime.events.push({
          timestamp: Date.now(),
          type: "charm_blocked",
          payload: {
            actorId: binding.actorId,
            targetId: binding.targetId,
            reason: "night_protection",
          },
        });
        continue;
      }
      charmTriggers.push({ binding, receipt: trigger });
      if (!proposed.includes(binding.targetId)) proposed.push(binding.targetId);
      proposedSources[binding.targetId] = [
        ...new Set([...(proposedSources[binding.targetId] ?? []), DeathCause.Charm]),
      ];
      if (proposal.nightEffect) nightTargets.push(binding.targetId);
    }
    return charmTriggers;
  }

  /** 由结算器在原实际 mark 之后调用；只有 applied 才发布，发布抛错不撤销 applied 或既有事件。 */
  publish(charmTriggers: readonly CharmDeathWaveTrigger[]): void {
    for (const { binding, receipt } of charmTriggers) {
      const commitCharmDeath = this.runtime.commitCharmDeath;
      const applied = commitCharmDeath(this.runtime.world, receipt);
      if (applied?.kind === "applied")
        this.runtime.events.push({
          timestamp: Date.now(),
          type: "charm_death",
          payload: { actorId: binding.actorId, targetId: binding.targetId },
        });
    }
  }
}
