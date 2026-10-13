/**
 * 负责 checkpoint 玩家记录的有序编码。输入为同一 World、完整／失败模式和最初动物审计快照；
 * 输出保留恶魔原体优先、动物原审计、婚约／孤女覆盖与普通 structuredClone 的原完整字段和顺序。
 * 原体 descriptor、JSON、重复组件读取和 fallback 克隆各在原表达式处执行；不修改 live 状态。
 * 壁上便签、恋人、处罚、胜利、投票、警徽和印记贡献只编码，不推导新规则或授予行动权限。
 */
import {
  COMPONENT,
  type BadgeComponent,
  type IdentityComponent,
  type RoleComponent,
  type StatusMarksComponent,
  type VotingRightComponent,
  type VictoryComponent,
  type World,
} from "../../core";
import type { RecordedCheckpoint } from "../reproduction";
import type { prepareAnimalCheckpoint } from "./authority-snapshots";
import { auditData } from "./animal-audit";
import { snapshotPlainData } from "../../core/domain/plain_data";
import { aliveLifeDescriptor } from "../../core/domain/components/alive";
import {
  animalOriginalAuditPlayer,
  animalOriginalAuditIds,
} from "../../game/mechanisms/roles/animal_dream/roster";
import { fragrantCheckpointPrivateState } from "../../game/mechanisms/roles/fragrant_pair_seer/authority";
import { demonHunterCheckpointPlayers } from "../../game/mechanisms/roles/demon_hunter/authority";
import { weddingAuditPlayer } from "../../game/mechanisms/roles/ghost_bride/authority";
import {
  projectLonelyGirl,
  projectLonelyGirlVictory,
  projectLonelyGirlAuditPlayer,
} from "../../game/mechanisms/roles/lonely_girl/lifecycle";
import { projectWallNote } from "../../game/mechanisms/events/wall_notes/authority";

export function capturePlayerContributions(
  world: World,
  complete: boolean,
  animal: ReturnType<typeof prepareAnimalCheckpoint>,
): RecordedCheckpoint["players"] {
  return (
    demonHunterCheckpointPlayers(world, complete) ??
    (animalOriginalAuditIds(world) ?? world.entityIds()).map((id) => {
      const original = animal ? animalOriginalAuditPlayer(world, id) : null;
      const identity = original
        ? (JSON.parse(original.identityJson) as IdentityComponent)
        : world.getComponent(id, COMPONENT.Identity)!;
      const role = original?.scope.role ?? world.getComponent(id, COMPONENT.Role)!;
      const badge = original
        ? (auditData(original.audit.badge, [
            "isSheriff",
            "destroyed",
            "voteWeight",
            "handoffPolicy",
          ]) as BadgeComponent)
        : world.getComponent(id, COMPONENT.Badge)!;
      const vote = original
        ? (auditData(original.audit.vote, ["weight", "canVote"]) as VotingRightComponent)
        : world.getComponent(id, COMPONENT.VotingRight)!;
      const weddingAudit = weddingAuditPlayer(world, id, !complete);
      const audit = weddingAudit ?? projectLonelyGirlAuditPlayer(world, id);
      const wall = projectWallNote(world, id);
      const wallNote = wall
        ? {
            instanceId: wall.instanceId,
            source: { ...wall.source },
            remaining: wall.remaining,
            expired: wall.expired,
          }
        : undefined;
      return {
        id,
        seat: identity.seat,
        name: identity.name,
        role: (original?.scope.roleId as RoleComponent["role"]) ?? audit?.role ?? role.role,
        camp: original?.scope.campValue ?? audit?.camp ?? role.camp,
        alive: original
          ? aliveLifeDescriptor(original.scope.life)!.get!.call(original.scope.life)
          : (audit?.alive ?? world.getComponent(id, COMPONENT.Alive)!.alive),
        privateState:
          (animal && original
            ? id === animal.foxId
              ? { foxCub: animal.fox }
              : id === animal.catId
                ? { whiteCat: animal.cat }
                : id === animal.pufferId
                  ? { pufferfish: animal.puffer }
                  : (snapshotPlainData(original.privateState) as Record<string, unknown>)
            : null) ??
          fragrantCheckpointPrivateState(world, id, complete) ??
          audit?.privateState ??
          (projectLonelyGirl(world, role)
            ? { lonelyGirl: projectLonelyGirl(world, role) }
            : (structuredClone(role.privateState) as Record<string, unknown>)),
        ...(wallNote ? { wallNote } : {}),
        ...(world.getComponent(id, COMPONENT.DebatePenalty)
          ? {
              debatePenalty: structuredClone(world.getComponent(id, COMPONENT.DebatePenalty)!),
            }
          : {}),
        ...(world.getComponent(id, COMPONENT.Lovers)
          ? {
              lovers: structuredClone(world.getComponent(id, COMPONENT.Lovers)!),
            }
          : {}),
        victory:
          (original ? (JSON.parse(original.victoryJson) as VictoryComponent) : null) ??
          (weddingAudit ? { affiliations: weddingAudit.victory } : null) ??
          projectLonelyGirlVictory(world, id) ??
          structuredClone(world.getComponent(id, COMPONENT.Victory)!),
        vote: { weight: vote.weight, canVote: vote.canVote },
        badge: {
          isSheriff: badge.isSheriff,
          destroyed: badge.destroyed,
          voteWeight: badge.voteWeight,
          ...(badge.handoffPolicy ? { handoffPolicy: badge.handoffPolicy } : {}),
        },
        marks: (
          (original?.audit.marks as StatusMarksComponent | undefined) ??
          world.getComponent(id, COMPONENT.StatusMarks)!
        ).values(),
      };
    })
  );
}
