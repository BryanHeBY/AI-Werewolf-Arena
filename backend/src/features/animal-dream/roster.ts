/**
 * 校验原有限动物梦境板子及阵容 scope。输入为规范板子、World／role 原身份；输出为 typed 阵容快照和当前成员检查。Node 反射前拒绝 hostile 对象，原生命归属不同于序列化座位，副本不授予付款／行动权限。
 */
import { types } from "node:util";
import { isAnimalDreamPreset } from "../../rulesets";
import {
  type CatSkippedVotePolicy,
  type PufferBallotPolicy,
} from "@ai-werewolf-arena/game-contract";
import type { RoleId } from "@ai-werewolf-arena/game-contract";
import type { World } from "../../domain/world";
import { Camp } from "../../domain/identity";
import { COMPONENT } from "../../domain/components/names";
import { snapshotPlainData } from "../../domain/plain-data";
import {
  captureOriginalPlayer,
  originalPlayerSameLife,
  type OriginalPlayerScope,
} from "../../domain/original-player-scope";

const nativeDeck: Readonly<Record<string, number>> = {
  wolf: 3,
  wolf_beauty: 1,
  villager: 4,
  white_cat: 1,
  fox_cub: 1,
  bear: 1,
  pufferfish: 1,
};
export interface AnimalOriginalPlayer {
  readonly scope: OriginalPlayerScope;
  readonly privateState: Record<string, unknown>;
  readonly identity: unknown;
  readonly identityJson: string;
  readonly victory: unknown;
  readonly victoryJson: string;
  readonly audit: { vote: unknown; badge: unknown; marks: unknown };
}
interface Roster {
  readonly players: ReadonlyMap<number, AnimalOriginalPlayer>;
  readonly skippedVotePolicy: CatSkippedVotePolicy;
  readonly ballotPolicy: PufferBallotPolicy;
  revoked: boolean;
}
const rosters = new WeakMap<World, Roster>();
function own(v: unknown, key: string): unknown {
  if (!v || typeof v !== "object" || types.isProxy(v)) return undefined;
  const d = Object.getOwnPropertyDescriptor(v, key);
  return d && "value" in d ? d.value : undefined;
}
function json(v: unknown): string | null {
  try {
    return JSON.stringify(snapshotPlainData(v, new Set(), 0, 65536));
  } catch {
    return null;
  }
}
function victoryMatches(value: unknown, camp: Camp): boolean {
  try {
    const v = snapshotPlainData(value) as { affiliations: Array<{ kind: string; faction: Camp }> };
    return (
      Object.keys(v).length === 1 &&
      Object.hasOwn(v, "affiliations") &&
      Array.isArray(v.affiliations) &&
      v.affiliations.length === 1 &&
      Object.keys(v.affiliations[0]!).length === 2 &&
      v.affiliations[0]!.kind === "faction" &&
      v.affiliations[0]!.faction === camp
    );
  } catch {
    return false;
  }
}
function capture(world: World, id: number): AnimalOriginalPlayer {
  const scope = captureOriginalPlayer(world, id),
    privateState = scope && own(scope.role, "privateState"),
    identity = world.getComponent(id, COMPONENT.Identity),
    victory = world.getComponent(id, COMPONENT.Victory),
    identityJson = json(identity),
    victoryJson = json(victory),
    seat = own(identity, "seat"),
    name = own(identity, "name"),
    sessionId = own(identity, "sessionId");
  if (
    !scope ||
    !Object.hasOwn(nativeDeck, scope.roleId) ||
    scope.campValue !==
      (scope.roleId === "wolf" || scope.roleId === "wolf_beauty" ? Camp.Wolf : Camp.Good) ||
    !privateState ||
    typeof privateState !== "object" ||
    Array.isArray(privateState) ||
    json(privateState) === null ||
    identityJson === null ||
    own(identity, "id") !== id ||
    typeof seat !== "number" ||
    !Number.isSafeInteger(seat) ||
    seat < 1 ||
    seat > 12 ||
    typeof name !== "string" ||
    !name.trim() ||
    typeof sessionId !== "string" ||
    !sessionId.trim() ||
    victoryJson === null ||
    !victoryMatches(victory, scope.campValue)
  )
    throw Error("animal_initial_roster_invalid");
  return Object.freeze({
    scope,
    privateState: privateState as Record<string, unknown>,
    identity,
    identityJson,
    victory,
    victoryJson,
    audit: {
      vote: world.getComponent(id, COMPONENT.VotingRight),
      badge: world.getComponent(id, COMPONENT.Badge),
      marks: world.getComponent(id, COMPONENT.StatusMarks),
    },
  });
}
/** 只保留固定原身份；资源对象及真实 unit／phase lease 归板子 owner。 */
export function installAnimalRoster(world: World, rawConfig: unknown): void {
  if (rosters.has(world)) throw Error("animal_roster_already_installed");
  const config = snapshotPlainData(rawConfig, new Set(), 0, 65536);
  if (!isAnimalDreamPreset(config)) throw Error("animal_dream_preset_invalid");
  const ids = world.entityIds();
  if (ids.length !== 12) throw Error("animal_initial_roster_invalid");
  const players = new Map(ids.map((id) => [id, capture(world, id)]));
  const rows = [...players.values()],
    counts: Record<string, number> = {};
  for (const p of rows) counts[p.scope.roleId] = (counts[p.scope.roleId] ?? 0) + 1;
  const references = rows.flatMap((p) => [
    p.scope.life,
    p.scope.role,
    p.scope.camp,
    p.identity,
    p.victory,
    p.privateState,
  ]);
  if (
    Object.entries(nativeDeck).some(([role, count]) => counts[role] !== count) ||
    new Set(rows.map((p) => own(p.identity, "seat"))).size !== 12 ||
    new Set(rows.map((p) => own(p.identity, "sessionId"))).size !== 12 ||
    new Set(references).size !== 72
  )
    throw Error("animal_initial_roster_invalid");
  rosters.set(world, {
    players,
    skippedVotePolicy: own(own(config, "whiteCat"), "skippedVotePolicy") as CatSkippedVotePolicy,
    ballotPolicy: own(own(config, "pufferfish"), "ballotPolicy") as PufferBallotPolicy,
    revoked: false,
  });
}
function current(world: World, p: AnimalOriginalPlayer, living: boolean): boolean {
  return (
    originalPlayerSameLife(world, p.scope, !living) &&
    own(p.scope.role, "privateState") === p.privateState &&
    json(p.privateState) !== null &&
    world.getComponent(p.scope.id, COMPONENT.Identity) === p.identity &&
    json(p.identity) === p.identityJson &&
    world.getComponent(p.scope.id, COMPONENT.Victory) === p.victory &&
    json(p.victory) === p.victoryJson
  );
}
/** 一旦观察到原阵容违反约束即终止，即使外部代码后来恢复字段。 */
export function animalRosterCurrent(world: World): boolean {
  const roster = rosters.get(world);
  if (!roster || roster.revoked) return false;
  const ids = world.entityIds();
  if (
    ids.length !== roster.players.size ||
    ids.some((id) => !roster.players.has(id)) ||
    [...roster.players.values()].some((p) => !current(world, p, false))
  ) {
    roster.revoked = true;
    return false;
  }
  return true;
}
/** 可信引擎查询，含原 component 引用，不是玩家 DTO。 */
export function animalOriginalPlayer(
  world: World,
  id: number,
  living = true,
): AnimalOriginalPlayer | null {
  if (!animalRosterCurrent(world)) return null;
  const p = rosters.get(world)!.players.get(id);
  return p && current(world, p, living) ? p : null;
}
/** 可返回首次死亡的原体；caller 行动仍需存活 lease。 */
export function animalOriginalRolePlayer(
  world: World,
  roleId: RoleId,
): AnimalOriginalPlayer | null {
  if (!animalRosterCurrent(world)) return null;
  const matches = [...rosters.get(world)!.players.values()].filter(
    (p) => p.scope.roleId === roleId,
  );
  return matches.length === 1 ? matches[0]! : null;
}
/** 撤销后仍可用独立政策 metadata 记录失败 checkpoint。 */
export function animalRosterPolicies(world: World) {
  const roster = rosters.get(world);
  return (
    roster && { skippedVotePolicy: roster.skippedVotePolicy, ballotPolicy: roster.ballotPolicy }
  );
}
/** 失败记录保留安装时原体，不授予行动 lease。 */
export function animalOriginalAuditPlayer(world: World, id: number): AnimalOriginalPlayer | null {
  return rosters.get(world)?.players.get(id) ?? null;
}
export function animalOriginalAuditIds(world: World): number[] | null {
  return rosters.has(world) ? [...rosters.get(world)!.players.keys()] : null;
}
