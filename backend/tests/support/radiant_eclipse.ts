import { PotionType } from "../../src/core";
import { readFile } from "node:fs/promises";
import { parseBoardDefinition } from "../../src/runtime/config/board_definition";
import { bootstrapGame } from "../../src/app/bootstrap";
import {
  Role,
  COMPONENT,
  createRandom,
  type RoleComponent,
  type ActionRequest,
  type ToolCall,
  type GameEvent,
} from "../../src/core";
import { NightPipeline } from "../../src/game/engine/phase_pipeline/night_pipeline";
import { ToolGateway } from "../../src/game/gateway/tool_gateway";
import { DamageResolutionSystem } from "../../src/core/domain/systems/damage_resolution_system";
import { allNightAbilities, findNightAbility } from "../../src/game/mechanisms/roles/abilities";
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
      new URL("../../../configs.example/boards/awa_radiant_eclipse_12_v1.json", import.meta.url),
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
export interface RadiantChoices {
  swallow?: number | null;
  shelter?: number | null;
  dream?: number;
  knife?: number | null;
  potion?: { target_id: number; potion_type: "heal" | "poison" | "none" };
}
export function radiantProvider(
  requests: ActionRequest[],
  choices: RadiantChoices = {},
  override?: (
    r: ActionRequest,
  ) => ToolCall | null | undefined | Promise<ToolCall | null | undefined>,
) {
  return {
    async getAction(r: ActionRequest): Promise<ToolCall | null> {
      requests.push(structuredClone(r));
      const value = await override?.(r);
      if (value !== undefined) return value;
      switch (r.context.stage) {
        case "eclipse_swallow":
          return { name: "swallow_skill", args: { target_id: choices.swallow ?? null } };
        case "radiant_shelter":
          return { name: "cast_shelter", args: { target_id: choices.shelter ?? null } };
        case "dreamer":
          return { name: "dream", args: { target_id: choices.dream ?? 9 } };
        case "wolf_discussion":
          return { name: "speak_to_wolves", args: { text: "End", end_chat: true } };
        case "wolf_vote":
          return {
            name: "kill_vote",
            args: { target_id: choices.knife ?? null, abstain: choices.knife == null },
          };
        case "witch":
          return {
            name: "use_potion",
            args: {
              target_id: choices.potion?.target_id ?? r.actorId,
              potion_type:
                choices.potion?.potion_type === "heal"
                  ? PotionType.Heal
                  : choices.potion?.potion_type === "poison"
                    ? PotionType.Poison
                    : PotionType.None,
            },
          };
        case "seer":
          return { name: "check_identity", args: { target_id: 10 } };
        case "sheriff_nomination":
          return { name: "run_for_sheriff", args: { run: false } };
        case "voting":
          return { name: "vote", args: { target_id: null, abstain: true } };
      }
      if (r.allowedTools.includes("self_destruct"))
        return { name: "self_destruct", args: { confirm: false, reason: "Synthetic pass" } };
      if (r.allowedTools.includes("speak")) return { name: "speak", args: { text: "Synthetic" } };
      throw new Error(`unexpected_radiant_request:${r.context.stage}`);
    },
  };
}
