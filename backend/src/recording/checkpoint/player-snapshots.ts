/**
 * 负责 checkpoint 玩家记录的有序编码。输入为同一 World、完整／失败模式和最初动物审计快照；
 * 输出保留恶魔原体优先；私有状态由数据 owner 在原字段位置编码，其余完整字段和顺序仍归本装配。
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
} from "../../domain";
import type { RecordedCheckpoint } from "../reproduction";
import type { prepareAnimalCheckpoint } from "./authority-snapshots";
import { auditData } from "./animal-audit";
import { encodeCheckpointPrivateState } from "./private-state-codec";
import { aliveLifeDescriptor } from "../../domain/components/alive";
import {
  animalOriginalAuditPlayer,
  animalOriginalAuditIds,
} from "../../game/mechanisms/roles/animal_dream/roster";
import { demonHunterCheckpointPlayers } from "../../game/mechanisms/roles/demon_hunter/authority";
import { weddingAuditPlayer } from "../../game/mechanisms/roles/ghost_bride/authority";
import {
  projectLonelyGirlVictory,
  projectLonelyGirlAuditPlayer,
} from "../../game/mechanisms/roles/lonely_girl/lifecycle";
import { projectWallNote } from "../../game/mechanisms/events/wall_notes/authority";

/** 同一调用按原权威优先级编码；数据可供归档核验，不能替代运行时原体或库存许可。 */
export function capturePlayerContributions(
  world: World,
  complete: boolean,
  animal: ReturnType<typeof prepareAnimalCheckpoint>,
): RecordedCheckpoint["players"] {
  return (
    // 恶魔板的完整原参与者快照优先返回；非 null 时不读取后面的席位名单或其它贡献。
    demonHunterCheckpointPlayers(world, complete) ??
    (animalOriginalAuditIds(world) ?? world.entityIds()).map((id) => {
      // 动物失败审计保留最初授权身体；身份／票权／警徽从捕获数据解码，普通路径才读取当前组件。
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
      // 婚约审计优先于孤女审计；记录覆盖与历史Camp保原优先级，普通fallback才晚读实际Camp。
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
        camp: original?.scope.campValue ?? audit?.camp ?? world.getComponent(id, COMPONENT.Camp)!.camp,
        alive: original
          ? aliveLifeDescriptor(original.scope.life)!.get!.call(original.scope.life)
          : (audit?.alive ?? world.getComponent(id, COMPONENT.Alive)!.alive),
        // 原特殊审计优先级与整容器克隆归数据 owner；这里只在原字段位置传入已求出的引用。
        privateState: encodeCheckpointPrivateState(world, id, complete, animal, original, role, audit),
        ...(wallNote ? { wallNote } : {}),
        // 可选组件先判断、再现场读取并克隆；getter／克隆失败仍从原表达式传播，不补空记录。
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
        // 原动物、婚约及孤女胜利记录先于普通组件克隆；失败审计和当前成功记录不可互换来源。
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
