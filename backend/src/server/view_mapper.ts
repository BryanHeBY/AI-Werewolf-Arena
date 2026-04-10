import { AliveComponent } from "../domain/components/alive";
import { BadgeComponent } from "../domain/components/badge";
import { COMPONENT } from "../domain/components/names";
import { RoleComponent } from "../domain/components/role";
import { StatusMarksComponent } from "../domain/components/status_marks";
import { VotingRightComponent } from "../domain/components/voting_right";
import { Camp, Phase, RuntimeSnapshot } from "../domain/model";
import { World } from "../domain/world";
import { getDefaultRoleViewRegistry } from "../mechanisms";

/**
 * 前端阶段枚举（映射自后端 Phase）。
 */
export type FrontendPhase =
  | "Night_Start"
  | "Sequential_Speech"
  | "Vote"
  | "Game_Over";

/**
 * 前端玩家视图模型。
 */
export interface FrontendPlayerView {
  id: number;
  name: string;
  roleType: string;
  faction: "wolf" | "villager";
  isAlive: boolean;
  isSheriff: boolean;
  voteWeight: number;
}

/**
 * 前端公开对局状态模型。
 */
export interface FrontendGameState {
  phase: FrontendPhase;
  round: number;
  players: FrontendPlayerView[];
  deadPlayerIds: number[];
  history: unknown[];
  witchHasAntidote: boolean;
  witchHasPoison: boolean;
  currentSpeechIndex: number;
  winner?: "wolf" | "villager";
  // 观测字段：用于会话状态排障与回放定位。
  alive_count: number;
  pending_marks: Array<{ playerId: number; marks: string[] }>;
  last_action_id: string;
}

/**
 * 视图映射层：
 * 把后端领域状态转换成前端消费模型，避免前端直接依赖内部 ECS 结构。
 */
export function toFrontendPhase(phase: Phase): FrontendPhase {
  if (phase === Phase.Night) {
    return "Night_Start";
  }
  if (phase === Phase.Day) {
    return "Sequential_Speech";
  }
  if (phase === Phase.Voting) {
    return "Vote";
  }
  return "Game_Over";
}

/**
 * 将后端阵营值映射为前端阵营值。
 */
export function toFrontendFaction(camp: Camp | null): "wolf" | "villager" {
  return getDefaultRoleViewRegistry().toFrontendFaction(camp);
}

/**
 * 基于 world 构建前端玩家列表。
 */
export function buildFrontendPlayers(world: World): FrontendPlayerView[] {
  const ids = world.entityIds();
  return ids.map((id) => {
    const role = world.getComponent<RoleComponent>(id, COMPONENT.Role);
    const alive = world.getComponent<AliveComponent>(id, COMPONENT.Alive);
    const identity = world.getComponent<{ name: string }>(id, COMPONENT.Identity);
    const badge = world.getComponent<BadgeComponent>(id, COMPONENT.Badge);
    const voting = world.getComponent<VotingRightComponent>(id, COMPONENT.VotingRight);
    return {
      id,
      name: identity?.name ?? `玩家${id}`,
      roleType: getDefaultRoleViewRegistry().toFrontendRoleType(role?.role),
      faction: getDefaultRoleViewRegistry().toFrontendFaction(role?.camp ?? null),
      isAlive: alive?.alive === true,
      isSheriff: badge?.isSheriff === true && badge.destroyed === false,
      voteWeight: voting?.weight ?? 1,
    };
  });
}

/**
 * 基于运行时快照构建前端公开状态。
 */
export function buildFrontendGameState(
  world: World,
  snapshot: RuntimeSnapshot,
): FrontendGameState {
  const players = buildFrontendPlayers(world);
  const deadPlayerIds = players.filter((p) => !p.isAlive).map((p) => p.id);
  const witchResource = getDefaultRoleViewRegistry().getWitchResourceState(world);

  const pending_marks = world
    .entityIds()
    .map((id) => {
      const marks = world.getComponent<StatusMarksComponent>(id, COMPONENT.StatusMarks);
      return {
        playerId: id,
        marks: marks?.values().map((m) => String(m)) ?? [],
      };
    })
    .filter((item) => item.marks.length > 0);

  const state: FrontendGameState = {
    phase: toFrontendPhase(snapshot.phase),
    round: snapshot.day,
    players,
    deadPlayerIds,
    history: [],
    witchHasAntidote: witchResource.hasAntidote,
    witchHasPoison: witchResource.hasPoison,
    currentSpeechIndex: 0,
    alive_count: players.filter((p) => p.isAlive).length,
    pending_marks,
    // 使用“天数+阶段+待结算印记数量”构造可复现的动作游标。
    last_action_id: `${snapshot.day}-${snapshot.phase}-${pending_marks.length}`,
  };

  if (snapshot.result) {
    // 仅在游戏结束后附加 winner，保持进行中状态的字段语义稳定。
    state.winner = toFrontendFaction(snapshot.result.winner);
  }

  return state;
}
