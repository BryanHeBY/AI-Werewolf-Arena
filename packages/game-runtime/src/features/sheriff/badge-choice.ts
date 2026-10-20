/**
 * 负责死亡警长的警徽选择请求与回复复核。输入为原警徽、死者生命、阶段／日期、当前性回调及玩家／工具入口；
 * 输出为原转移或销毁结果，警徽写入仍由警徽所有者提交。请求选择和预检不提前改变警徽。
 * 死亡许可只覆盖本次选择；持有者与许可仍当前时，已选目标生命失效按原规则改为销毁。
 * Provider 只返回候选；请求交付复用 F02 租约，组件与特殊 frame 全提交后才 true，事实晚错保留付款。
 * 玩家异常不被伪装成一次有效选择；显式构造依赖仅在原 new 点读取，失败不补交警徽且仍关闭本次许可。
 */
import { aliveLifeVersion, type AliveComponent } from "../../domain/components/alive";
import type { BadgeComponent } from "../../domain/components/badge";
import type { RoleComponent } from "../../domain/components/role";
import { COMPONENT } from "../../domain/components/names";
import { captureNightLife, livingNightLife } from "../../domain/night-effects";
import type { ActionProvider, EntityId, GameEvent, Phase } from "../../domain/model";
import type { World } from "../../domain/world";
import { RequestLease, type RequestLeaseTurn } from "../../domain/request-lease";
import type { ActionRequestFactoryConstructorPort } from "../../domain/actions";
import type { ToolGateway } from "../../engine/actions/tool-gateway";
import {
  badgeSuccessorEligible,
  commitSheriffBadgeChoice,
  transferOrDestroySheriffBadge,
} from "./badge";

/** 捕获本请求的阶段／日次；current 只委托原 authorized，World 仍唯一拥有死亡许可。 */
interface BadgeChoiceRequestScope {
  actorId: EntityId;
  phase: Phase;
  day: number;
  current(): boolean;
}

// 只 pin 工厂创建时的来源值及候选数组原引用，不重新枚举候选或把数组 JSON 当作许可。
const badgeRequests = RequestLease.window<BadgeChoiceRequestScope>(
  {
    actorId: (scope) => scope.actorId,
    phase: (scope) => scope.phase,
    day: (scope) => scope.day,
    stage: () => "sheriff_badge_choice",
    current: (scope) => scope.current(),
  },
  150,
  ["trigger", "death_action_id", "badge_candidates", "allow_fallback"],
);

/** 持徽死者只在引擎打开、绑定原生命版本的临时许可内选择；这不是复活后的新生命权限。 */
export async function resolveSheriffBadge(
  world: World,
  fromId: EntityId,
  reason: string,
  events: GameEvent[],
  gateway: ToolGateway,
  provider: ActionProvider,
  phase: Phase,
  day: number,
  isCurrent: () => boolean,
  construction: { readonly requestFactory: ActionRequestFactoryConstructorPort },
): Promise<void> {
  if (!isCurrent()) return;
  const badge = world.getComponent(fromId, COMPONENT.Badge);
  if (!badge?.isSheriff || badge.destroyed) return;
  if (badge.handoffPolicy !== "awa_holder_choice_v1") {
    transferOrDestroySheriffBadge(world, fromId, reason, events);
    return;
  }
  const life = world.getComponent(fromId, COMPONENT.Alive);
  const role = world.getComponent(fromId, COMPONENT.Role);
  const version = life && aliveLifeVersion(life);
  const weight = badge.voteWeight;
  // 警徽原体、政策／权重、角色与死亡生命必须仍相同；业务阶段当前性由传入回调核对。
  const current = () =>
    isCurrent() &&
    world.getComponent(fromId, COMPONENT.Badge) === badge &&
    badge.isSheriff &&
    !badge.destroyed &&
    badge.handoffPolicy === "awa_holder_choice_v1" &&
    badge.voteWeight === weight &&
    world.getComponent(fromId, COMPONENT.Role) === role &&
    world.getComponent(fromId, COMPONENT.Alive) === life &&
    life?.alive === false &&
    aliveLifeVersion(life) === version;
  if (!life || !role || !current()) return;
  const candidates = world
    .getAliveEntityIds()
    .filter((id) => badgeSuccessorEligible(world, fromId, id));
  if (!candidates.length) {
    commitSheriffBadgeChoice(world, fromId, reason, events, null);
    return;
  }
  // 固定本次候选的原生命，不能让等待期间复活的同编号替代原接收人。
  const scopes = new Map(candidates.map((id) => [id, captureNightLife(world, id)]));
  const permit = world.openDeathAction(fromId, "choose_badge_successor", phase, day, current);
  const authorized = () =>
    current() && world.hasDeathAction(fromId, "choose_badge_successor", phase, day, permit.id);
  let delivery: RequestLeaseTurn | undefined;
  let failed = false;
  try {
    if (!authorized()) return;
    // 许可已开启且原 authorized 通过后，才读取构造器并在原点 new；构造失败仍由 finally 关闭许可。
    const request = new construction.requestFactory(world, events, day).create({
      phase,
      actorId: fromId,
      allowedTools: ["choose_badge_successor"],
      stage: "sheriff_badge_choice",
      requiresAction: true,
      summary: { key: "request.summary.badge_choice" },
      context: {
        allow_fallback: false,
        trigger: "badge_handoff",
        death_action_id: permit.id,
        badge_candidates: candidates,
      },
    });
    if (!authorized()) return;
    const requestScope: BadgeChoiceRequestScope = {
      actorId: fromId,
      phase,
      day,
      current: authorized,
    };
    badgeRequests.bind(requestScope, request);
    delivery = badgeRequests.openDelivery(requestScope, request);
    if (!delivery) return;
    // 原 provider callee 先读，新增 Reflect 准备也在末守卫前；不提前验证 callable 或改变原 receiver。
    const getAction = provider.getAction;
    const actionArguments: [typeof request] = [request];
    const invokeAction = Reflect.apply.bind(Reflect);
    if (!delivery.current()) return;
    const action = await invokeAction(getAction, provider, actionArguments);
    if (!authorized()) return;
    if (!delivery.current()) return;
    let target: EntityId | null = null;
    if (action?.name === "choose_badge_successor") {
      const checked = gateway.validateAndSanitize(world, fromId, action, {
        phase,
        day,
        deathActionId: permit.id,
        badgeCandidates: candidates,
      });
      if (!authorized()) return;
      if (!delivery.current()) return;
      if (checked.ok && checked.sanitizedCall) target = checked.sanitizedCall.args.target_id;
    }
    // 缺失／无效选择或已失效目标保留原 null 销毁政策；玩家入口抛错则直接进入 finally，不补提交。
    if (target !== null) {
      const scope = scopes.get(target);
      if (
        !scope ||
        !livingNightLife(world, scope) ||
        !badgeSuccessorEligible(world, fromId, target)
      )
        target = null;
    }
    if (authorized()) {
      // 原 callee／五参数先求值，再追加空 catalog 与当前 turn 的完成口；全部新增可执行准备在末交付守卫之前。
      const commit = commitSheriffBadgeChoice;
      const commitArguments: Parameters<typeof commitSheriffBadgeChoice> = [
        world,
        fromId,
        reason,
        events,
        target,
        undefined,
        () => delivery!.complete(),
        () => delivery!.current(),
      ];
      const invokeCommit = Reflect.apply.bind(Reflect);
      if (!delivery.current()) return;
      // committer 内部原预检 getter 之后再核未付交付；首写后不再查 current，全部组件／frame 完成才回调。
      invokeCommit(commit, undefined, commitArguments);
    }
  } catch (error) {
    failed = true;
    throw error;
  } finally {
    try {
      permit.close();
    } catch (error) {
      failed = true;
      throw error;
    } finally {
      // 原 permit.close 仍覆盖正文错误；新增 false 通知不能盖任何旧错，boolean 同样支持 throw undefined。
      if (failed) {
        try {
          delivery?.close();
        } catch {
          /* 保留正文或许可关闭错误。 */
        }
      } else {
        delivery?.close();
      }
    }
  }
}
