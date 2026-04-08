import { AliveComponent } from "../domain/components/alive";
import { COMPONENT } from "../domain/components/names";
import { RoleComponent } from "../domain/components/role";
import { Camp, Phase, Role, RuntimeSnapshot } from "../domain/model";
import { World } from "../domain/world";

export type FrontendPhase =
  | "Night_Start"
  | "Sequential_Speech"
  | "Vote"
  | "Game_Over";

export interface FrontendPlayerView {
  id: number;
  name: string;
  roleType: string;
  faction: "wolf" | "villager";
  isAlive: boolean;
}

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

export function toFrontendFaction(camp: Camp | null): "wolf" | "villager" {
  return camp === Camp.Wolf ? "wolf" : "villager";
}

export function buildFrontendPlayers(world: World): FrontendPlayerView[] {
  const ids = world.entityIds();
  return ids.map((id) => {
    const role = world.getComponent<RoleComponent>(id, COMPONENT.Role);
    const alive = world.getComponent<AliveComponent>(id, COMPONENT.Alive);
    const identity = world.getComponent<{ name: string }>(id, COMPONENT.Identity);
    return {
      id,
      name: identity?.name ?? `玩家${id}`,
      roleType: toFrontendRoleType(role?.role),
      faction: role?.camp === Camp.Wolf ? "wolf" : "villager",
      isAlive: alive?.alive === true,
    };
  });
}

export function buildFrontendGameState(
  world: World,
  snapshot: RuntimeSnapshot,
): FrontendGameState {
  const players = buildFrontendPlayers(world);
  const deadPlayerIds = players.filter((p) => !p.isAlive).map((p) => p.id);
  const witch = world
    .entityIds()
    .map((id) => world.getComponent<RoleComponent>(id, COMPONENT.Role))
    .find((role) => role?.role === Role.Witch);

  const state: FrontendGameState = {
    phase: toFrontendPhase(snapshot.phase),
    round: snapshot.day,
    players,
    deadPlayerIds,
    history: [],
    witchHasAntidote: (witch?.witchState?.heal ?? 0) > 0,
    witchHasPoison: (witch?.witchState?.poison ?? 0) > 0,
    currentSpeechIndex: 0,
  };

  if (snapshot.result) {
    // 仅在游戏结束后附加 winner，保持进行中状态的字段语义稳定。
    state.winner = toFrontendFaction(snapshot.result.winner);
  }

  return state;
}

function toFrontendRoleType(role: Role | undefined): string {
  switch (role) {
    case Role.Wolf:
      return "wolf";
    case Role.Seer:
      return "seer";
    case Role.Witch:
      return "witch";
    case Role.Guard:
      return "guard";
    case Role.Hunter:
      return "hunter";
    case Role.Idiot:
      return "idiot";
    case Role.Villager:
    default:
      return "villager";
  }
}
