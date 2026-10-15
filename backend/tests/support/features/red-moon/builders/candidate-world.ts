/**
 * 构造蚀日者有界机制测试的显式 World、组件、Catalog 与初始座位。输入为原配置、组件及调用方字段，输出为原 fixture；手写断言和身份快照由测试持有，不运行完整对局、传输或生产规则验证器。
 */
import {
  createAliveComponent,
  createBadgeComponent,
  createCampComponent,
  createStatusMarksComponent,
  createVotingRightComponent,
} from "../../../../../src/agents/observation/component-presentation";
import type { LastWolfBlastPolicy } from "@ai-werewolf-arena/game-contract";
import { World } from "../../../../../src/domain/world";
import { Role } from "../../../../../src/domain/identity";
import { COMPONENT } from "../../../../../src/domain/components/names";
import { createRoleComponent } from "../../../../../src/agents/observation/role-presentation";

import { createVictoryComponent } from "../../../../../src/domain/components/victory";
import { createIdentityComponent } from "../../../../../src/domain/entities/player";
import { installInitialRoster } from "../../../../../src/domain/initial-roster";
import { RoleCatalog } from "../../../../../src/rulesets/roles/catalog";
import {
  getDefaultRoleCatalog,
  getDefaultRoleContributions,
  createRoleCatalog,
} from "../../../../../src/rulesets/roles/role-catalog-assembly";
import { RED_MOON_ROLE_PROFILE } from "../../../../../src/features/red-moon/profile";
import { installDemonHunter } from "../../../../../src/features/demon-hunter/authority";
import { redMoonTwelveConfig } from "../../../../../src/rulesets/presets/red-moon-twelve";

export function redMoonCandidateWorld(policy: LastWolfBlastPolicy = "ends_game") {
  const world = new World();
  const config = structuredClone(redMoonTwelveConfig);
  config.redMoon!.lastWolfBlastPolicy = policy;
  const catalog = createRoleCatalog({
    contributions: [
      ...getDefaultRoleContributions().filter(
        (p) => String(p.metadata.role) !== "red_moon_apostle",
      ),
      RED_MOON_ROLE_PROFILE,
    ],
  });
  const roles = config.roleSetups.flatMap((row) => Array<Role>(row.count).fill(row.role));
  const ids = roles.map((kind, i) => {
    const id = world.createEntity();
    const initialCamp = createCampComponent(catalog.getCamp(kind), world.locale);
    const role = createRoleComponent(kind, world.locale);
    const currentCamp = () => world.getComponent(id, COMPONENT.Camp);
    catalog.applyRuntime(role, { boardConfig: config, locale: world.locale, world, initialCamp, currentCamp });
    world.addComponent(id, COMPONENT.Identity, createIdentityComponent(id, i + 1, "player-" + id));
    world.addComponent(id, COMPONENT.Role, role);
    world.addComponent(id, COMPONENT.Camp, initialCamp);
    world.addComponent(
      id,
      COMPONENT.Victory,
      createVictoryComponent([{ kind: "faction", faction: initialCamp.camp }]),
    );
    world.addComponent(id, COMPONENT.Alive, createAliveComponent(true, world.locale));
    world.addComponent(id, COMPONENT.StatusMarks, createStatusMarksComponent(world.locale));
    world.addComponent(
      id,
      COMPONENT.VotingRight,
      createVotingRightComponent(1, true, world.locale),
    );
    world.addComponent(id, COMPONENT.Badge, createBadgeComponent(false, false, world.locale));
    return id;
  });
  installInitialRoster(world);
  installDemonHunter(world, config);
  return { world, config, ids, catalog };
}
