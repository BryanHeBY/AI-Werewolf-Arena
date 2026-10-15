/**
 * 负责恶夜骑士公开的只读普通狼刀目标贡献，并提供原状态读取、资格校验及反射提交入口。
 * 输入是绑定原 World 的目标序号，或具体原体／查验上下文；输出保留原存活角色允许结果，
 * 包括未安装专用板子时的原政策。查询错误原样传播，绑定不提前读组件或授予生命、反射写权。
 * 名单复验向夜间规则组合及阶段检查点公开原函数，不读写库存或开启行动窗口。
 * 反射命令保留原来源校验与付款时点，余量只交本族槽写入；此公开出口不暴露数据槽写者。
 * 反射终态与失败前缀由状态命令维护，出口不拦截错误或尝试回滚。
 */
import { Role, type EntityId } from "../../domain/identity";
import { COMPONENT } from "../../domain/components/names";
import type { World } from "../../domain/world";
export { isEvilKnightBoard, assertEvilKnightNativeActor, assertEvilKnightRosterCurrent } from "./night-frame";
export { commitEvilKnightReflection } from "./reflection";
/** 运行查询保原 binding／Map 捕获，不公开 Map 或增加库存／生命写权。 */
export { evilKnightNightBinding, captureEvilKnightNightShotProtection } from "./night-bindings";

export interface EvilKnightKnifeTargetQuery {
  allows(targetId: EntityId): boolean;
}

export function bindEvilKnightKnifeTargetQuery(world: World): EvilKnightKnifeTargetQuery {
  return Object.freeze({
    allows: (targetId: EntityId) =>
      world.getComponent(targetId, COMPONENT.Role)?.role !== Role.EvilKnight,
  });
}

export { getEvilKnightState, projectEvilKnightState } from "./state-slot";
