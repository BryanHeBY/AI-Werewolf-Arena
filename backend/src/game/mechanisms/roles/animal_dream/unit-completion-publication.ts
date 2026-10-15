/**
 * 负责动物放逐／跳过单元的原关闭、关闭后快照和完成事实同步发布；输入是原运行查询及原单位token。
 * 输出追加原 animal_unit_completed 事实；authority 唯一拥有关闭、原体和计数政策，facts 唯一拥有事实校验及知识日志。
 * 先读 World 再读 token，关闭后再取快照，发表时才读 World／events／day；不预缓存原调用方字段。
 * 完成跳过单位不必推进实际放逐计数，仍按原政策决定；快照／发表失败不回滚关闭、重开单位或补发事实。
 * 本模块不标死、推进阶段、重新检查经理当前性或授予新许可，token仍由原权威检验，不能从JSON重建。
 */
import type { GameEvent } from "../../../../domain/events";
import type { World } from "../../../../domain/world";
import { animalAuthoritySnapshot, closeAnimalExileUnit } from "./authority";
import { appendAnimalFact } from "./facts";

/** 原 World／数组保持同引用；方法只描述各字段的读取时点，不冻结数据或替代实际单元能力。 */
export interface AnimalUnitCompletionRuntime {
  world(): World;
  events(): GameEvent[];
  day(): number;
}

/** token也延迟读取，保 votingResult.animalUnit getter 在close World实参之后；只同步执行原三语句。 */
export function completeAndPublishAnimalExileUnit(
  runtime: AnimalUnitCompletionRuntime,
  token: () => object,
): void {
  closeAnimalExileUnit(runtime.world(), token());
  const u = animalAuthoritySnapshot(runtime.world())!.unit!;
  appendAnimalFact(runtime.world(), runtime.events(), "animal_unit_completed", {
    policy: "awa_animal_dream_v1",
    day: runtime.day(),
    unit: u.number,
    kind: u.kind,
  });
}
