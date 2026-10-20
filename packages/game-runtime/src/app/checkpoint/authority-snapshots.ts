/**
 * 负责三种强权威 checkpoint 贡献与对应原结构契约。输入为真实 World、完整／失败模式和已记录游标；
 * 输出按动物、双生、贵族、录制计数的原顺序形成数据，保留重复权威查询与 schema.parse 的失败前缀。
 * 动物最初审计快照在 setup 查询前取得；本模块不重新推导规则、不改变资源或独立 verifier。
 */
import type { World } from "../../domain/world";
import type { RecordedCheckpoint } from "../../recording/reproduction/format";
import { animalCheckpointSchema } from "../../recording/reproduction/checkpoint/animal-format";
import { fragrantCheckpointSchema } from "../../recording/reproduction/checkpoint/fragrant-pair-format";
import { nobleBodyCheckpointSchema } from "../../recording/reproduction/checkpoint/noble-body-format";
import { animalAuthoritySnapshot, isAnimalDreamBoard } from "../../features/animal-dream/authority";
import {
  fragrantAuthoritySnapshot,
  isFragrantPairBoard,
} from "../../features/fragrant-pair-seer/authority";
import {
  checkpointNobleBodyAuthority,
  isNobleBodyBoard,
} from "../../features/noble-secret-body/authority";
import { getSessionRecorder } from "../../recording/session/context";

export function prepareAnimalCheckpoint(world: World, complete: boolean) {
  const animal = isAnimalDreamBoard(world) ? animalAuthoritySnapshot(world, complete) : null;
  if (isAnimalDreamBoard(world) && !animal) throw Error("animal_checkpoint_unavailable");
  return animal;
}

export function captureAuthorityContributions(
  world: World,
  complete: boolean,
  cursors?: { settlementCount: number; decisionCount: number },
): Pick<
  RecordedCheckpoint,
  | "animalDream"
  | "fragrantPair"
  | "nobleBody"
  | "operationCount"
  | "settlementCount"
  | "decisionCount"
> {
  return {
    ...(isAnimalDreamBoard(world)
      ? { animalDream: animalCheckpointSchema.parse(animalAuthoritySnapshot(world, complete)) }
      : {}),
    ...(isFragrantPairBoard(world)
      ? { fragrantPair: fragrantCheckpointSchema.parse(fragrantAuthoritySnapshot(world, complete)) }
      : {}),
    ...(isNobleBodyBoard(world)
      ? {
          nobleBody: nobleBodyCheckpointSchema.parse(checkpointNobleBodyAuthority(world, complete)),
        }
      : {}),
    ...(isAnimalDreamBoard(world) || isNobleBodyBoard(world) || isFragrantPairBoard(world)
      ? {
          operationCount: getSessionRecorder()?.reproductionOperationCount ?? 0,
          settlementCount:
            cursors?.settlementCount ?? getSessionRecorder()?.reproductionSettlementCount ?? 0,
          decisionCount:
            cursors?.decisionCount ?? getSessionRecorder()?.reproductionDecisionCount ?? 0,
        }
      : {}),
  };
}
