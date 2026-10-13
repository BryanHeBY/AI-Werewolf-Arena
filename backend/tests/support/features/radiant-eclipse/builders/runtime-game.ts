/**
 * 测试 builder：负责按辉光／蚀月公开板子与语言构造原运行 fixture。输入为原配置、角色及受控组件；输出保留原对象和装配顺序，预期仍由独立字面测试提供，不执行模型或替换 oracle。
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
  const role = (id: number) => game.world.getComponent(id, COMPONENT.Role)!;
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
