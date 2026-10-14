/**
 * 负责定序王子首轮票后的完整重收票政策：板子门控、原选择、严格选项替换、现场名单及复收票。
 * 输入为投票流水线的晚读引用和同一可变 options；输出原开票对象，未重启时同步返回 undefined。
 * 两个 yield 仅交回原 Promise，不增加未触发或末尾等待；选择／必需发言／窗口关闭仍由本族窗口拥有。
 * 严格闭包先复验原身份与生命，再调用原阶段回调；后续 PK 继续消费已替换选项，不复制授权或 actor。
 * 收票、目标生命、票权及开票仍由流水线执行；失败保留已付选择和已发表前缀，不退款、不自动补票。
 */
import type { EntityId, GameEvent, ReadonlyBoardConfig, VoteRecord } from "@ai-werewolf-arena/game-contract";
import { Role } from "@ai-werewolf-arena/game-contract";
import type { ActionProvider, ActionRequestConstructionPort } from "../core/domain/actions";
import type { World } from "../core/domain/world";
import type { ToolGateway } from "../game/gateway/tool_gateway";
import type { VotingPipelineOptions } from "../game/engine/phase_pipeline/voting_pipeline";
import { canVoteExile } from "../game/mechanisms/common/participation";
import {
  assertOrderPrinceOriginalCurrent,
  runOrderPrinceChoice,
} from "../game/mechanisms/roles/order_prince/voting-ports";

/** 原开票结果引用；此知识不是下一票的许可，也不携带流水线内部原生命句柄。 */
export interface OrderPrinceRevoteBallots {
  tally: Record<number, number>;
  publicVotes: VoteRecord[];
}

/**
 * options 的 get/set 指向调用方同一个局部，原选择闭包和后续 PK 因而读取同一替换结果。
 * 两个具体回调在原调用点查流水线方法、以原 receiver 读实参；Votes 只透传原收票集合，不复制生命快照。
 * 原公开 options 类型仅 type import，不新增规则组合到引擎的运行加载边。
 */
export interface OrderPrinceRevoteRuntime<Votes> {
  readonly config: Pick<ReadonlyBoardConfig, "roleSetups">;
  readonly world: World;
  readonly requests: ActionRequestConstructionPort;
  readonly actionProvider: ActionProvider;
  readonly toolGateway: ToolGateway;
  readonly events: GameEvent[];
  options: VotingPipelineOptions;
  collectVotes(voters: EntityId[]): Promise<Votes>;
  recordVotes(votes: Votes): OrderPrinceRevoteBallots;
}

/** 恢复值只对应本次两个原等待点：第一次 boolean，激活后第二次为原 Votes，不驱动其它窗口。 */
export function* recollectOrderPrinceVotes<Votes>(
  runtime: OrderPrinceRevoteRuntime<Votes>,
): Generator<Promise<boolean> | Promise<Votes>, OrderPrinceRevoteBallots | undefined, boolean | Votes> {
  if (runtime.config.roleSetups.some((setup) => setup.role === Role.OrderPrince && setup.count > 0)) {
    const restarted = (yield runOrderPrinceChoice(
      runtime.world,
      runtime.requests,
      runtime.actionProvider,
      runtime.toolGateway,
      runtime.events,
      runtime.options.day,
      () => runtime.options.isCurrent?.() !== false,
    )) as boolean;
    if (restarted) {
      const previousCurrent = runtime.options.isCurrent;
      // 先捕获旧回调，再按原 spread 顺序读取字段并替换调用方选项；名单失败也不撤销严格模式。
      runtime.options = {
        ...runtime.options,
        strictRequired: true,
        orderPrinceRevote: true,
        isCurrent: () => {
          assertOrderPrinceOriginalCurrent(runtime.world);
          if (previousCurrent?.() === false) throw new Error("order_prince_revote_stale");
          return true;
        },
      };
      const freshVoters = runtime.world
        .getAliveEntityIds()
        .filter((id) => canVoteExile(runtime.world, id, runtime.options.day));
      const fresh = (yield runtime.collectVotes(freshVoters)) as Votes;
      if (runtime.options.isCurrent?.() === false) throw new Error("order_prince_revote_stale");
      // 原开票调用结束后才交回结果，流水线在原点解构；不早读结果字段或重新构造公开票据。
      return runtime.recordVotes(fresh);
    }
  }
  return undefined;
}
