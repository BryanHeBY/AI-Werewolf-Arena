/**
 * 负责一次安装的初始角色／阵营名单；输入为实际 World 实体名单，输出为按玩家编号冻结的历史身份。
 * 在原 camp 字段位置读取已安装的唯一 Camp；缺失组件在该输入点失败，不按角色资料补值。
 * 后续身份转换不重写此历史，读取不回退新角色，也不提供行动许可。
 */
import { COMPONENT } from "./components/names";
import type { RoleComponent } from "./components/role";
import type { Role, Camp } from "./identity";
import type { World } from "./world";
const rosters = new WeakMap<World, ReadonlyMap<number, Readonly<{ role: Role; camp: Camp }>>>();
export function installInitialRoster(world: World): void {
  if (rosters.has(world)) throw new Error("initial_roster_already_installed");
  rosters.set(
    world,
    new Map(
      world.entityIds().map((id) => {
        const role = world.getComponent(id, COMPONENT.Role)!;
        return [id, Object.freeze({ role: role.role, camp: world.getComponent(id, COMPONENT.Camp)!.camp })];
      }),
    ),
  );
}
export function initialPlayerIdentity(
  world: World,
  id: number,
): Readonly<{ role: Role; camp: Camp }> | undefined {
  return rosters.get(world)?.get(id);
}
