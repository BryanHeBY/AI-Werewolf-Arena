/**
 * Owns Radiant/Eclipse test fixture construction from its public board and locale.
 * Inputs are the tracked configs.example board JSON and selected locale; outputs
 * are the original fixed-role World, pipeline, request/event buffers and read handles.
 * Public readFile/JSON/board parsing and deterministic input construction remain.
 * This builder does not run a night, settle deaths or produce expected outcomes;
 * test drivers and handwritten oracles retain those separate responsibilities.
 */
import { Role } from "../../../../../src/core";
import { readFile } from "node:fs/promises";
import { parseBoardDefinition } from "../../../../../src/runtime/config/board_definition";
import { bootstrapGame } from "../../../../../src/app/bootstrap";
import { COMPONENT } from "../../../../../src/core";
import { createRandom } from "../../../../../src/core";
import type { RoleComponent } from "../../../../../src/core";
import type { ActionRequest } from "../../../../../src/core";
import type { GameEvent } from "../../../../../src/core";
import { NightPipeline } from "../../../../../src/game/engine/phase_pipeline/night_pipeline";
import { ToolGateway } from "../../../../../src/game/gateway/tool_gateway";
import { DamageResolutionSystem } from "../../../../../src/core/domain/systems/damage_resolution_system";
import { allNightAbilities } from "../../../../../src/game/mechanisms/roles/abilities";

export const radiantRoles = [
  Role.EclipseMaid,
  Role.RadiantCount,
  Role.Seer,
  Role.Witch,
  Role.Dreamer,
  Role.Villager,
  Role.Villager,
  Role.Villager,
  Role.Villager,
  Role.Wolf,
  Role.Wolf,
  Role.Wolf,
] as const;

export async function radiantFixture(locale: "zh-CN" | "en" = "zh-CN") {
  const raw = JSON.parse(
    await readFile(
      new URL("../../../../../../configs.example/boards/awa_radiant_eclipse_12_v1.json", import.meta.url),
      "utf8",
    ),
  );
  const board = parseBoardDefinition(raw),
    game = bootstrapGame(board.config, {
      locale,
      fixedRoles: radiantRoles,
      random: createRandom("radiant-eclipse-manual"),
    });
  const events: GameEvent[] = [],
    requests: ActionRequest[] = [];
  const role = (id: number) => game.world.getComponent<RoleComponent>(id, COMPONENT.Role)!;
  const native = (id: number) =>
    allNightAbilities(role(id)).find((a) => a.source.kind === "native")!;
  const pipeline = new NightPipeline({
    world: game.world,
    toolGateway: new ToolGateway(),
    damageResolutionSystem: new DamageResolutionSystem(),
    events,
    random: createRandom("radiant-pipeline"),
  });
  return {
    ...game,
    board,
    raw,
    events,
    requests,
    role,
    native,
    pipeline,
    borrowed: () => allNightAbilities(role(1)).find((a) => a.id === "copy:eclipse:night:2"),
  };
}
