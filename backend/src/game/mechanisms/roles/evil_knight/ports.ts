/**
 * 负责恶灵骑士公开的只读普通狼刀目标贡献，并提供原状态读取、资格校验及反射提交入口。
 * 输入是绑定原 World 的目标序号，或具体原体／查验上下文；输出保留原存活角色允许结果，
 * 包括未安装专用板子时的原政策。查询错误原样传播，绑定不提前读组件或授予生命、反射写权。
 * 名单复验向夜间规则组合及阶段检查点公开原函数，不读写库存或开启行动窗口。
 * 资格与反射命令仍保留原来源校验、付款时点和 frame 写入；狼刀目标查询本身只读。
 * 反射终态与失败前缀由状态命令维护，出口不拦截错误或尝试回滚。
 */
import { Role, type EntityId } from "../../../../core/domain/identity";
import { COMPONENT } from "../../../../core/domain/components/names";
import type { World } from "../../../../core/domain/world";
export { isEvilKnightBoard, assertEvilKnightNativeActor, assertEvilKnightRosterCurrent } from "./night_frame";
export { commitEvilKnightReflection } from "./state";

export interface EvilKnightKnifeTargetQuery {
  allows(targetId: EntityId): boolean;
}

export function bindEvilKnightKnifeTargetQuery(world: World): EvilKnightKnifeTargetQuery {
  return Object.freeze({
    allows: (targetId: EntityId) =>
      world.getComponent(targetId, COMPONENT.Role)?.role !== Role.EvilKnight,
  });
}

export { getEvilKnightState } from "./state";
