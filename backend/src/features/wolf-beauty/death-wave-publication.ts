/**
 * 负责狼美人批量死亡贡献的领取、梦阻断、原提案写入及实际标死后的关系事实发布。
 * 输入为 hook 捕获的原绑定／夜间旗标，以及晚读的原命令和结算查询；输出是追加原因、
 * 公开关联与本族发布回调。绑定和 claimed 回执只保在本闭包，不进入通用 hook 载荷或归档。
 * relation 独自拥有 resolved／applied；先领取再保护，阻断或发布失败保留已付与已提交前缀。
 * 本模块不标死、选择阶段、消费枪或遗言许可；规则见 docs/rules/awa-wolf-beauty-v1.md。
 */
import { DeathCause, type EntityId } from "@ai-werewolf-arena/game-contract";
import type { DeathWaveContribution } from "../../engine/death-wave-contribution";
import type {
  attemptCharmTrigger,
  commitCharmDeath,
  CharmBinding,
  CharmClaimReceipt,
} from "./relation";

interface WolfBeautyDeathCommands {
  readonly attemptCharmTrigger: typeof attemptCharmTrigger;
  readonly commitCharmDeath: typeof commitCharmDeath;
}

/** 一次 hook 的原 proposal 数组；未领取绑定仍由唯一 relation 库存持有，不复制原体。 */
export function createWolfBeautyDeathContribution(
  proposals: readonly { readonly binding: CharmBinding; readonly nightEffect: boolean }[],
  commands: WolfBeautyDeathCommands,
): DeathWaveContribution {
  return {
    prepare(
      runtime,
      proposed,
      proposedSources,
      nightTargets,
      allSources,
      nativeHunterShotTargets,
      seen,
    ) {
      const charmTriggers: CharmDeathWaveTrigger[] = [];
      for (const proposal of proposals) {
        const binding = proposal.binding;
        // 具体关系 owner 在原位置领取和查询保护；延迟 World，permit 失败不新增读取。
        // 先取原命令再裸调用，保留 callee 读取时点与 receiver；之后才求值原参数。
        const attemptCharmTrigger = commands.attemptCharmTrigger;
        const trigger = attemptCharmTrigger(
          binding,
          allSources,
          nativeHunterShotTargets,
          seen,
          () => runtime.world,
          () => proposal.nightEffect && runtime.blocksNightLinkedDeath(() => binding.targetId),
        );
        if (!trigger) continue;
        if (trigger.kind === "blocked") {
          runtime.events.push({
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
      // 完整批量准备之后才读目标，保持原 triggers.map 时点；内部绑定和回执不交给引擎。
      const linkedDeaths = charmTriggers.map(({ binding }) => ({
        targetId: binding.targetId,
        addedCauses: [DeathCause.Charm],
        publicAdditionalDeath: true,
      }));
      return {
        linkedDeaths,
        // 原实际标死之后才核 applied；事件失败不能撤销已 applied 或既有事件。
        publishAfterDeaths() {
          for (const { binding, receipt } of charmTriggers) {
            const commitCharmDeath = commands.commitCharmDeath;
            const applied = commitCharmDeath(runtime.world, receipt);
            if (applied?.kind === "applied")
              runtime.events.push({
                timestamp: Date.now(),
                type: "charm_death",
                payload: { actorId: binding.actorId, targetId: binding.targetId },
              });
          }
        },
      };
    },
  };
}

/** 仅在本族准备／发布闭包内传递，具体权威回执不能替代死亡提交。 */
interface CharmDeathWaveTrigger {
  readonly binding: CharmBinding;
  readonly receipt: CharmClaimReceipt;
}
