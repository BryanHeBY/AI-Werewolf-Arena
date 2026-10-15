/**
 * 负责提交普通狼／赤月和白狼王的已选自爆。输入为捕获玩家、已校验选择和当前窗口；输出为原资源、事件与死亡提案。退休仅拒演员执行，目标和已付前缀仍保原规则；不执行真实标死或阶段／胜负封盘。
 */
import { RED_MOON_ROLE } from "../red-moon/ports";
import { commitDemonRedMoonBlast } from "../demon-hunter/death-frame-ports";
import { canRoleSelfDestruct } from "./capability";
import {
  weddingMember,
  weddingSetup,
  ghostBrideReady,
  swallowWeddingBadges,
} from "../ghost-bride/wedding-ports";
import {
  ActionWindow,
  Phase,
  Role,
  DeathCause,
  type SelfDestructSelection,
  type DeathSources,
  type GameEvent,
} from "../../domain/model";
import { COMPONENT } from "../../domain/components/names";
import type { RoleComponent } from "../../domain/components/role";
import { isRoleExecutionRetired } from "../../domain/role-execution-authority";
import type { World } from "../../domain/world";
import { getWhiteWolfKingState, consumeWhiteWolfDetonation } from "../white-wolf-king/ports";
import { getDefaultRoleCatalog } from "../../rulesets/roles/role-catalog-assembly";
import { captureOriginalPlayer, originalPlayerAtCommit } from "../../domain/original-player-scope";
import { Camp } from "@ai-werewolf-arena/game-contract";
import { hasAwakenedGuardFrame } from "../awakened-guard/protection-ports";
import { bindProtectedBlastPublication } from "./protected-publication";

/** 仅提交本自爆能力的资源、事件和事实，返回死亡提案；实际死亡写入由结算器负责。 */
export function commitSelfDestructSelection(
  world: World,
  choice: SelfDestructSelection,
  window: ActionWindow,
  phase: Phase,
  events: GameEvent[],
  protectedPublication?: { readonly day: number; current(): boolean },
): { deaths: number[]; sources: DeathSources } | null {
  if (
    !Object.values(ActionWindow).includes(window) ||
    phase !== (window === ActionWindow.OnPreVote ? Phase.Voting : Phase.Day)
  )
    return null;
  const role = world.getComponent(choice.actorId, COMPONENT.Role);
  if (!role || !world.getComponent(choice.actorId, COMPONENT.Alive)?.alive) return null;
  const protectedSource =
    protectedPublication && hasAwakenedGuardFrame(world)
      ? captureOriginalPlayer(world, choice.actorId)
      : null;
  if (
    protectedPublication &&
    (!protectedSource ||
      protectedSource.role !== role ||
      protectedSource.roleId !== Role.Wolf ||
      protectedSource.campValue !== Camp.Wolf ||
      !Number.isSafeInteger(protectedPublication.day) ||
      protectedPublication.day < 1)
  )
    return null;
  const ownsWedding = weddingSetup(world) !== null;
  if (
    ownsWedding &&
    (!ghostBrideReady(world) ||
      role.role !== Role.Wolf ||
      weddingMember(world, role) ||
      ![ActionWindow.OnPreElection, ActionWindow.OnPreVote].includes(window))
  )
    return null;
  const deaths = [choice.actorId],
    sources: DeathSources = { [choice.actorId]: [DeathCause.SelfDestruct] };
  if (choice.kind === "ordinary") {
    const redMoon = String(role.role) === RED_MOON_ROLE;
    if (
      choice.targetId !== null ||
      (redMoon
        ? ![ActionWindow.OnPreElection, ActionWindow.OnPreVote].includes(window)
        : !canRoleSelfDestruct(
            role,
            getDefaultRoleCatalog(),
            () => world.getComponent(choice.actorId, COMPONENT.Camp),
            world,
          ))
    )
      return null;
    // 原普通能力／赤月窗口资格已经读取；直接赤月旁路也须在实际权威付款前拒退休演员。
    if (isRoleExecutionRetired(role)) return null;
    const moon = redMoon ? commitDemonRedMoonBlast(world, choice.actorId) : null;
    if (redMoon && !moon) return null;
    if (ownsWedding) swallowWeddingBadges(world, events);
    if (protectedSource && protectedPublication) {
      const publish = events.push,
        event: GameEvent = {
          timestamp: Date.now(),
          type: "awakened_self_destruct_declared",
          payload: {
            policy: "awa_awakened_guard_cycle_v1",
            actorId: choice.actorId,
            day: protectedPublication.day,
            window,
          },
        },
        args: [GameEvent] = [event],
        invoke = Reflect.apply.bind(Reflect);
      if (!protectedPublication.current() || !originalPlayerAtCommit(world, protectedSource))
        return null;
      invoke(publish, events, args);
    } else
      events.push({
        timestamp: Date.now(),
        type: "wolf_self_destruct",
        payload: { wolfId: choice.actorId, window },
      });
    if (moon?.sealsNight)
      events.push({
        timestamp: Date.now(),
        type: "red_moon_night_sealed",
        payload: { actorId: choice.actorId, day: moon.day, night: moon.day + 1 },
      });
  } else if (choice.kind === "white_wolf_king") {
    const state = getWhiteWolfKingState(role);
    if (role.role !== Role.WhiteWolfKing || state?.canDetonate !== true) return null;
    if (choice.targetId !== null) {
      if (
        choice.targetId === choice.actorId ||
        !world.getComponent(choice.targetId, COMPONENT.Alive)?.alive
      )
        return null;
      deaths.push(choice.targetId);
      sources[choice.targetId] = [DeathCause.WhiteWolfBlast];
    }
    // 同一库存和原目标预检在先；退休不消费库存，不取消目标身体或回滚任何已付前缀。
    if (isRoleExecutionRetired(role)) return null;
    consumeWhiteWolfDetonation(state);
    events.push({
      timestamp: Date.now(),
      type: "white_wolf_king_self_destruct",
      payload: { actorId: choice.actorId, targetId: choice.targetId, window },
    });
  } else return null;
  const result = { deaths, sources };
  if (protectedSource && protectedPublication)
    bindProtectedBlastPublication(result, protectedSource, protectedPublication.day, window);
  return result;
}
