/**
 * 负责死亡警长的警徽选择请求与回复复核。输入为原警徽、死者生命、阶段／日期、当前性回调及玩家／工具入口；
 * 输出为原转移或销毁结果，警徽写入仍由警徽所有者提交。请求选择和预检不提前改变警徽。
 * 死亡许可只覆盖本次选择；持有者与许可仍当前时，已选目标生命失效按原规则改为销毁。
 * 玩家异常不被伪装成一次有效选择。
 */
import { aliveLifeVersion, type AliveComponent } from "../../../core/domain/components/alive";
import type { BadgeComponent } from "../../../core/domain/components/badge";
import type { RoleComponent } from "../../../core/domain/components/role";
import { COMPONENT } from "../../../core/domain/components/names";
import { captureNightLife, livingNightLife } from "../../../core/domain/night_effects";
import type { ActionProvider, EntityId, GameEvent, Phase } from "../../../core/domain/model";
import type { World } from "../../../core/domain/world";
import { GameActionRequestFactory } from "../../engine/action_request_factory";
import type { ToolGateway } from "../../gateway/tool_gateway";
import {
  badgeSuccessorEligible,
  commitSheriffBadgeChoice,
  transferOrDestroySheriffBadge,
} from "./badge";

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
  try {
    if (!authorized()) return;
    const request = new GameActionRequestFactory(world, events, day).create({
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
    const action = await provider.getAction(request);
    if (!authorized()) return;
    let target: EntityId | null = null;
    if (action?.name === "choose_badge_successor") {
      const checked = gateway.validateAndSanitize(world, fromId, action, {
        phase,
        day,
        deathActionId: permit.id,
        badgeCandidates: candidates,
      });
      if (!authorized()) return;
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
    if (authorized()) commitSheriffBadgeChoice(world, fromId, reason, events, target);
  } finally {
    permit.close();
  }
}
