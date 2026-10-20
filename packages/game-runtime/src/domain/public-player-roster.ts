/**
 * 负责从本局身份组件投影公开名册。输入为 World，输出为按座位排序的脱离身份资料。
 * 显式列举编号、座位与可选昵称，不展开角色、阵营或私有状态，不改变生命与行动权限。
 */
import type { PublicPlayerIdentity } from "@ai-werewolf-arena/game-contract";
import type { World } from "./world";
import { COMPONENT } from "./components/names";
import type { IdentityComponent } from "./entities/player";

/** 同一字段只读取一次；复用这个白名单，避免观察和 checkpoint 各自补默认昵称。 */
export function publicPlayerIdentity(
  id: number,
  identity: IdentityComponent,
): PublicPlayerIdentity {
  const seat = identity.seat;
  const name = identity.name;
  return { id, seat, ...(name !== undefined ? { name } : {}) };
}

export function publicPlayerRoster(world: World): PublicPlayerIdentity[] {
  return world
    .entityIds()
    .flatMap((id) => {
      const identity = world.getComponent(id, COMPONENT.Identity);
      return identity ? [publicPlayerIdentity(id, identity)] : [];
    })
    .sort((left, right) => left.seat - right.seat);
}
