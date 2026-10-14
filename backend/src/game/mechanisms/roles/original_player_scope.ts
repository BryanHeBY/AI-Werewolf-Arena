/**
 * 负责捕获玩家原角色、阵营与工厂生命／版本引用。输入为 World 和玩家 ID，输出为原生命及仍当前的查询谓词。
 * 阵营只由真实 Camp 组件提供，保原 own-data／枚举与组件引用撤权；不退回角色镜像。
 * 运行范围不成为协议数据，也不替换已捕获组件；原体身份与当前性仍在实际查询时复核。
 */
import { types } from "node:util";
import type { World } from "../../../core/domain/world";
import type { RoleComponent } from "../../../core/domain/components/role";
import type { CampComponent } from "../../../core/domain/components/camp";
import {
  aliveLifeDescriptor,
  aliveLifeVersion,
  type AliveComponent,
} from "../../../core/domain/components/alive";
import { COMPONENT } from "../../../core/domain/components/names";
import { isRoleId, type RoleId } from "@ai-werewolf-arena/game-contract";
import { Camp } from "../../../core/domain/identity";
export interface OriginalPlayerScope {
  readonly id: number;
  readonly life: AliveComponent;
  readonly version: number;
  readonly role: RoleComponent;
  readonly roleId: RoleId;
  readonly camp: CampComponent;
  readonly campValue: Camp;
}
const captured = new WeakMap<OriginalPlayerScope, World>();
function own(v: object, key: string): unknown {
  if (types.isProxy(v)) return undefined;
  const d = Object.getOwnPropertyDescriptor(v, key);
  return d && "value" in d ? d.value : undefined;
}
function safeAlive(v: AliveComponent | undefined): v is AliveComponent {
  if (!v || types.isProxy(v) || aliveLifeVersion(v) === undefined) return false;
  const original = aliveLifeDescriptor(v),
    actual = Object.getOwnPropertyDescriptor(v, "alive");
  return !!original && !!actual && actual.get === original.get && actual.set === original.set;
}
export function captureOriginalPlayer(world: World, id: number): OriginalPlayerScope | null {
  const life = world.getComponent(id, COMPONENT.Alive),
    role = world.getComponent(id, COMPONENT.Role),
    camp = world.getComponent(id, COMPONENT.Camp);
  if (!Number.isSafeInteger(id) || id < 1 || !safeAlive(life) || !life.alive || !role || !camp)
    return null;
  const roleId = own(role, "role"),
    campValue = own(camp, "camp");
  if (
    !isRoleId(roleId) ||
    !Object.values(Camp).includes(campValue as Camp)
  )
    return null;
  const scope = Object.freeze({
    id,
    life,
    version: aliveLifeVersion(life)!,
    role,
    roleId,
    camp,
    campValue: campValue as Camp,
  });
  captured.set(scope, world);
  return scope;
}
/** 已付效果可保留第一次原生命死亡，不可借组件替换或复活重新匹配。 */
export function originalPlayerSameLife(
  world: World,
  s: OriginalPlayerScope,
  allowFirstDeath = false,
): boolean {
  return (
    captured.get(s) === world &&
    world.getComponent(s.id, COMPONENT.Alive) === s.life &&
    safeAlive(s.life) &&
    (s.life.alive
      ? aliveLifeVersion(s.life) === s.version
      : allowFirstDeath && aliveLifeVersion(s.life) === s.version + 1) &&
    world.getComponent(s.id, COMPONENT.Role) === s.role &&
    world.getComponent(s.id, COMPONENT.Camp) === s.camp &&
    own(s.role, "role") === s.roleId &&
    own(s.camp, "camp") === s.campValue
  );
}
export function originalPlayerCurrent(world: World, s: OriginalPlayerScope): boolean {
  return originalPlayerSameLife(world, s);
}
