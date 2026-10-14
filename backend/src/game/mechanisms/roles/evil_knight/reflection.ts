/**
 * 负责恶夜骑士原体／免疫捕获与一次反射的完整资格和付款顺序。
 * 输入是受信任 World、原生命绑定及来源当前性回调；输出为原 binding、免疫判断或反击运行效果。
 * World／回调和原状态引用不是玩家 DTO、JSON 或新授权；名单与夜 Map 仍归 frame 和 night-bindings。
 * 原 caster lookup 与来源判断先于付款；已付余量之后的字段读取／效果构造失败不退款，迟到撤权不返还资源。
 */
import { COMPONENT } from "../../../../core/domain/components/names";
import { Camp, Role, type EntityId } from "../../../../core/domain/identity";
import { captureNightLife, livingNightLife, type NightLifeScope, type NightRetaliationAttack } from "../../../../core/domain/night_effects";
import type { World } from "../../../../core/domain/world";
import { EVIL_KNIGHT_STATE_SLOT, getEvilKnightState } from "./state-slot";

/** 在等待其他玩家提交前绑定原体；每次提交仍校验生命、组件、私有容器与政策未被替换。 */
export function captureEvilKnight(world: World, target: NightLifeScope) {
  const role = world.getComponent(target.id, COMPONENT.Role);
  const state = getEvilKnightState(role, () => world.getComponent(target.id, COMPONENT.Camp));
  if (!role || !state || !livingNightLife(world, target)) return null;
  const privateState = role.privateState,
    shotPolicy = state.shotPolicy;
  const isCurrent = () =>
    livingNightLife(world, target) &&
    world.getComponent(target.id, COMPONENT.Role) === role &&
    role.privateState === privateState &&
    getEvilKnightState(role, () => world.getComponent(target.id, COMPONENT.Camp)) === state &&
    state.shotPolicy === shotPolicy;
  return { target, state, isCurrent };
}
export function evilKnightNightShotImmune(world: World, targetId: EntityId): boolean {
  const life = captureNightLife(world, targetId);
  const binding = life && captureEvilKnight(world, life);
  return !!binding && binding.state.shotPolicy === "night_shot_immune" && binding.isCurrent();
}
/** 仅在原生预言家查验或女巫毒药已被接受并付款后调用；反射本身不重复消耗原行动。 */
export function commitEvilKnightReflection(
  world: World,
  binding: ReturnType<typeof captureEvilKnight>,
  caster: NightLifeScope,
  trigger: "seer_check" | "poison",
  casterCurrent: () => boolean,
): NightRetaliationAttack | null {
  const casterRole = world.getComponent(caster.id, COMPONENT.Role);
  const expected = trigger === "seer_check" ? Role.Seer : Role.Witch;
  if (
    !binding ||
    !binding.isCurrent() ||
    binding.state.reflectionRemaining !== 1 ||
    !livingNightLife(world, caster) ||
    !casterCurrent() ||
    casterRole?.role !== expected ||
    world.getComponent(caster.id, COMPONENT.Camp)?.camp !== Camp.Good
  )
    return null;
  const privateState = casterRole.privateState;
  // 原私有容器已捕获后才付款；binding.state 在原写入点晚读，不能缓存或再次执行 schema。
  EVIL_KNIGHT_STATE_SLOT.allowedWrites.consumeReflection(() => binding.state);
  // 余量已经消费，再读原 target 构造效果；此后的异常或当前性失效均不退款。
  return {
    actorId: binding.target.id,
    target: caster,
    isCurrent: () =>
      binding.isCurrent() &&
      binding.state.reflectionRemaining === 0 &&
      livingNightLife(world, caster) &&
      casterCurrent() &&
      world.getComponent(caster.id, COMPONENT.Role) === casterRole &&
      casterRole.role === expected &&
      world.getComponent(caster.id, COMPONENT.Camp)?.camp === Camp.Good &&
      casterRole.privateState === privateState,
  };
}
