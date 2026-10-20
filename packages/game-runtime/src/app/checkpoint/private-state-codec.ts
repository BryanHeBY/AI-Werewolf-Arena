/**
 * 负责 checkpoint 私有状态数据的完整来源选择。输入是装配已求出的 World、玩家 ID、完整模式、
 * 动物审计、最初身体、角色与婚约／孤女审计引用；输出保留原特殊审计优先级及普通整容器克隆。
 * 本 owner 只编码，不写 live 状态、收窄 getter／扩展字段接受面或授予原体、库存与行动权限。
 * 普通 structuredClone 的接受宽度与稍后的归档 JSON 校验分开；失败仍在原查询／克隆点传播。
 */
import type { World } from "../../domain/world";
import type { RoleComponent } from "../../domain/components/role";
import type { prepareAnimalCheckpoint } from "./authority-snapshots";
import type { animalOriginalAuditPlayer } from "../../features/animal-dream/roster";
import type { weddingAuditPlayer } from "../../features/ghost-bride/authority";
import { snapshotPlainData } from "../../domain/plain-data";
import { fragrantCheckpointPrivateState } from "../../features/fragrant-pair-seer/authority";
import {
  projectLonelyGirl,
  type projectLonelyGirlAuditPlayer,
} from "../../features/lonely-girl/lifecycle";

/** 只传既有引用，不提前读取 role.privateState 或审计字段；调用时点仍是玩家记录的 privateState 字段。 */
export function encodeCheckpointPrivateState(
  world: World,
  id: number,
  complete: boolean,
  animal: ReturnType<typeof prepareAnimalCheckpoint>,
  original: ReturnType<typeof animalOriginalAuditPlayer>,
  role: RoleComponent,
  audit: ReturnType<typeof weddingAuditPlayer> | ReturnType<typeof projectLonelyGirlAuditPlayer>,
): Record<string, unknown> {
  // 动物原审计→寻香权威→已选审计按原 nullish 短路；前一来源命中即短路，不读取后续私有字段。
  // 孤女存在判断和值处仍分别查询；普通分支先查 structuredClone callee，再读完整 privateState。
  return (
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
      : (structuredClone(role.privateState) as Record<string, unknown>))
  );
}
