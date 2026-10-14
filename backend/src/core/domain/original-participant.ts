/**
 * 负责共用参与者的原生命、Role 与私有容器引用捕获和晚复验。输入为原 World／玩家 ID，
 * 输出保留原可写快照及当前性布尔值；不写 World、资源、阶段或领域许可。
 * 只复用原生命版本规则，Role 字段按原普通属性读取；getter／Proxy 可执行并按原时点抛错。
 * 不读取 Camp 组件、不校验枚举／JSON／完整槽、不建立 brand 或冻结快照；严格原体契约另有所有者。
 */
import { COMPONENT } from "./components/names";
import type { RoleComponent } from "./components/role";
import type { World } from "./world";
import { captureNightLife, livingNightLife, type NightLifeScope } from "./night_effects";

/** 保原可写顶层字段与组件引用；camp 是捕获的 Role.camp 值，不是 Camp 组件或独立行动权限。 */
export interface OriginalParticipant {
  life: NightLifeScope;
  role: RoleComponent;
  roleId: RoleComponent["role"];
  camp: RoleComponent["camp"];
  state: RoleComponent["privateState"];
}
/** 原生命先捕获，再查询 Role；仅两者存在才按 role→camp→privateState 读取，不复制或提前取字段。 */
export function captureOriginalParticipant(world: World, id: number): OriginalParticipant | null {
  const life = captureNightLife(world, id),
    role = world.getComponent(id, COMPONENT.Role);
  return life && role
    ? { life, role, roleId: role.role, camp: role.camp, state: role.privateState }
    : null;
}
/** 生命／版本先短路，再核同 Role 引用及原三个字段；不新增 descriptor、Camp 引用或状态内容检查。 */
export function sameOriginalParticipant(world: World, snapshot: OriginalParticipant): boolean {
  return (
    livingNightLife(world, snapshot.life) &&
    world.getComponent(snapshot.life.id, COMPONENT.Role) === snapshot.role &&
    snapshot.role.role === snapshot.roleId &&
    snapshot.role.camp === snapshot.camp &&
    snapshot.role.privateState === snapshot.state
  );
}
