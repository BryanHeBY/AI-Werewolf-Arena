import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { tricksterTwelveConfig } from "../../../src/runtime/scenarios/trickster_twelve";
import { knownWolfTeammates } from "../../../src/game/mechanisms/roles/wolf_team";
import { getDefaultRoleCatalog } from "../../../src/game/mechanisms";
import { Role, COMPONENT, type RoleComponent } from "../../../src/core";
import {
  beginTricksterNight,
  commitTricksterExchange,
} from "../../../src/game/mechanisms/roles/trickster/night_frame";
test("trickster meets pack only after first personal choice is committed", () => {
  const f = bootstrapGame(structuredClone(tricksterTwelveConfig)),
    catalog = getDefaultRoleCatalog();
  const actor = f.world
    .entityIds()
    .find(
      (id) => f.world.getComponent<RoleComponent>(id, COMPONENT.Role)!.role === Role.Trickster,
    )!;
  const wolves = f.world
    .entityIds()
    .filter((id) => f.world.getComponent<RoleComponent>(id, COMPONENT.Role)!.role === Role.Wolf);
  expect(knownWolfTeammates(f.world, actor, catalog)).toEqual([]);
  for (const wolf of wolves)
    expect(knownWolfTeammates(f.world, wolf, catalog)).not.toContain(actor);
  beginTricksterNight(f.world, 1);
  commitTricksterExchange(f.world, actor, 1, null);
  expect(knownWolfTeammates(f.world, actor, catalog)).toEqual(wolves);
  for (const wolf of wolves) expect(knownWolfTeammates(f.world, wolf, catalog)).toContain(actor);
});
