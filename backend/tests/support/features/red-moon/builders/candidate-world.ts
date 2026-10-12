/**
 * Owns test builder support: Explicit Red Moon candidate World, components, catalog and initial roster for bounded mechanism tests.
 * Inputs are original configs, raw component objects and caller-supplied fields;
 * outputs are the original explicit fixture values. Unit and scenario tests use
 * unchanged handwritten literals and identity snapshots as the independent oracle.
 * This builder never runs a whole game, transport or production rule verifier.
 */
import { World } from "../../../../../src/core/domain/world";
import { Role } from "../../../../../src/core/domain/identity";
import { COMPONENT } from "../../../../../src/core/domain/components/names";
import { createRoleComponent } from "../../../../../src/core/domain/components/role";
import { createAliveComponent } from "../../../../../src/core/domain/components/alive";
import { createBadgeComponent } from "../../../../../src/core/domain/components/badge";
import { createCampComponent } from "../../../../../src/core/domain/components/camp";
import { createStatusMarksComponent } from "../../../../../src/core/domain/components/status_marks";
import { createVotingRightComponent } from "../../../../../src/core/domain/components/voting_right";
import { createVictoryComponent } from "../../../../../src/core/domain/components/victory";
import { createIdentityComponent } from "../../../../../src/core/domain/entities/player";
import { installInitialRoster } from "../../../../../src/core/domain/initial_roster";
import { getDefaultRoleCatalog, RoleCatalog } from "../../../../../src/game/mechanisms/roles/catalog";
import { RED_MOON_ROLE_PROFILE } from "../../../../../src/game/mechanisms/roles/red_moon_apostle/profile";
import { installDemonHunter } from "../../../../../src/game/mechanisms/roles/demon_hunter/authority";
import { redMoonTwelveConfig } from "../../../../../src/runtime/scenarios/red_moon_twelve";
import type { LastWolfBlastPolicy } from "../../../../../src/game/mechanisms/roles/red_moon_apostle/state";
export function redMoonCandidateWorld(policy: LastWolfBlastPolicy = "ends_game") {
  const world = new World();
  const config = structuredClone(redMoonTwelveConfig);
  config.redMoon!.lastWolfBlastPolicy = policy;
  const catalog = new RoleCatalog([
    ...getDefaultRoleCatalog()
      .all()
      .filter((p) => String(p.role) !== "red_moon_apostle"),
    RED_MOON_ROLE_PROFILE,
  ]);
  const roles = config.roleSetups.flatMap((row) => Array<Role>(row.count).fill(row.role));
  const ids = roles.map((kind, i) => {
    const id = world.createEntity();
    const role = createRoleComponent(kind, catalog.getCamp(kind), world.locale);
    catalog.applyRuntime(role, { boardConfig: config, locale: world.locale, world });
    world.addComponent(id, COMPONENT.Identity, createIdentityComponent(id, i + 1, "player-" + id));
    world.addComponent(id, COMPONENT.Role, role);
    world.addComponent(id, COMPONENT.Camp, createCampComponent(role.camp, world.locale));
    world.addComponent(
      id,
      COMPONENT.Victory,
      createVictoryComponent([{ kind: "faction", faction: role.camp }]),
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
