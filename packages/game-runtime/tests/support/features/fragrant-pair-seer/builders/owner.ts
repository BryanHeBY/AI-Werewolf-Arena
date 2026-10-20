/**
 * 负责馥郁 authority 测试的固定组件 roster 和原生 Pair 资源构造。
 * 输入为原安装／夜 callback；输出是同一 World、事件、选择 helper 和受控生命变更。
 * 字面角色／状态是 fixture 设置而非生产规则 oracle；Pair 别名、容器写入 LHS 时点保持。
 * 实例安装入口迁共享 owner，但不运行 profile、流水线、传输或模型。
 */
import {
  createAliveComponent,
  createCampComponent,
} from "../../../../../src/agents/observation/component-presentation";
import { World } from "../../../../../src/domain/world";
import { Role, Camp } from "../../../../../src/domain/identity";
import { COMPONENT } from "../../../../../src/domain/components/names";
import { type AliveComponent } from "../../../../../src/domain/components/alive";
import { type RoleComponent } from "../../../../../src/domain/components/role";
import { createRoleComponent } from "../../../../../src/agents/observation/role-presentation";

import { createIdentityComponent } from "../../../../../src/domain/entities/player";
import { createVictoryComponent } from "../../../../../src/domain/components/victory";
import type { GameEvent } from "../../../../../src/domain/events";
import { freshFragrantState } from "../../../../../src/features/fragrant-pair-seer/fragrant-state-slot";
import { freshPairSeerState } from "../../../../../src/features/fragrant-pair-seer/state";
import { installNativeAbility } from "../../../../../src/features/night-abilities/ability-changes";
import {
  installFragrantPairAuthority,
  beginFragrantNight,
  openFragrantBindChoice,
  openPairCheckChoice,
} from "../../../../../src/features/fragrant-pair-seer/authority";
/** 构造固定角色 roster 与原生双验资源供 authority 单元测试使用；不初始化 profile、判断板子支持或运行流水线、传输和复现。 */
export function fragrantPairOwnerFixture(
  beforeInstall?: (role: RoleComponent, world: World) => void,
  nightHook?: () => boolean,
) {
  const world = new World(),
    events: GameEvent[] = [];
  const roles = [
    Role.FragrantPhantom,
    Role.Wolf,
    Role.Wolf,
    Role.Wolf,
    Role.AwakenedSeer,
    Role.Witch,
    Role.Hunter,
    Role.Guard,
    Role.Villager,
    Role.Villager,
    Role.Villager,
    Role.Villager,
  ];
  for (const [index, roleId] of roles.entries()) {
    const id = world.createEntity(),
      camp = index < 4 ? Camp.Wolf : Camp.Good,
      role = createRoleComponent(roleId);
    if (id === 1) (role.privateState as Record<string, unknown>).fragrant = freshFragrantState();
    if (id === 5)
      (role.privateState as Record<string, unknown>).pairSeer = installNativeAbility(
        role,
        "pair_check",
        freshPairSeerState(),
      );
    world.addComponent(id, COMPONENT.Role, role);
    world.addComponent(id, COMPONENT.Camp, createCampComponent(camp));
    world.addComponent(id, COMPONENT.Alive, createAliveComponent());
    world.addComponent(id, COMPONENT.Identity, createIdentityComponent(id, id, `p${id}`));
    world.addComponent(
      id,
      COMPONENT.Victory,
      createVictoryComponent([{ kind: "faction", faction: camp }]),
    );
  }
  // roster 已按字面顺序写入后才调用测试钩子，再安装 authority；抛错不回滚此前组件写入。
  // 额外 World 输入让负例修改真正 Camp；不把退出支持的 Role.camp 留成无效测试桥。
  beforeInstall?.(world.getComponent(5, COMPONENT.Role)!, world);
  installFragrantPairAuthority(world, events, 1, 5);
  let current = true,
    draws = 0;
  const random = {
      next: () => {
        draws++;
        return 0.5;
      },
    },
    isCurrent = () => current && (nightHook?.() ?? true);
  const open = (day = 1) => beginFragrantNight(world, day, random, isCurrent);
  const kill = (...ids: number[]) => {
    for (const id of ids) world.getComponent(id, COMPONENT.Alive)!.alive = false;
  };
  const role = (id: number) => world.getComponent(id, COMPONENT.Role)!;
  // helper 驱动真实选择提交，不从生产结果推导期望；测试须另写独立字面断言。
  const choices = (pair: number[] | null = [9, 10]) => {
    openFragrantBindChoice(world, 1).commit(pair);
    openPairCheckChoice(world, 1).commit([5, 6]);
  };
  return {
    world,
    events,
    open,
    kill,
    role,
    choices,
    random,
    isCurrent,
    stale: () => {
      current = false;
    },
    fresh: () => {
      current = true;
    },
    draws: () => draws,
  };
}
