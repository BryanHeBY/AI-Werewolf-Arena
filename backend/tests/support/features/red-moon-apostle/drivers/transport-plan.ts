/**
 * 测试 driver：负责执行原受控赤月对局并推导后续传输计划。输入为固定角色和明确回复；输出为实际已执行前缀及传输输入，期望保留在外部字面 oracle，不调用模型。
 */
import { bootstrapGame } from "../../../../../src/app/bootstrap";
import { Camp } from "../../../../../src/domain";
import { Role } from "../../../../../src/domain";
import { PotionType } from "../../../../../src/domain";
import { createRandom } from "../../../../../src/domain";
import { COMPONENT } from "../../../../../src/domain";
import type { RoleComponent } from "../../../../../src/domain";
import type { ActionRequest } from "../../../../../src/domain";
import type { ToolCall } from "../../../../../src/domain";
import { redMoonTwelveConfig } from "../../../../../src/runtime/scenarios/red_moon_twelve";
import { boardDefinitionFromConfig } from "../../../../../src/runtime/config/board_definition";
import { parseBoardDefinition } from "../../../../../src/runtime/config/board_definition";
import { demonNightChoice } from "../../demon-hunter/drivers/actions";
import type { PlannedTurn } from "../../../transport/contracts";
import type { TransportGameScenario } from "../../../transport/contracts";

export async function redMoonScenario(
  mode: "expire" | "knife" | "blast",
  policy: "ends_game" | "forbidden" = "ends_game",
): Promise<
  TransportGameScenario & {
    red: number;
    winner: Camp;
    alive: number[];
    ordered: Array<{ actorId: number; turn: PlannedTurn }>;
  }
> {
  const config = structuredClone(redMoonTwelveConfig);
  config.redMoon!.lastWolfBlastPolicy = policy;
  const seed = "red-moon-transport:" + mode + ":" + policy;
  const game = bootstrapGame(config, { random: createRandom(seed) });
  const roles = game.playerIds.map(
    (id) => game.world.getComponent(id, COMPONENT.Role)!.role,
  );
  const id = (r: Role) => roles.indexOf(r) + 1;
  const red = id(Role.RedMoonApostle),
    witch = id(Role.Witch),
    seer = id(Role.Seer);
  const ordinary = game.playerIds.filter((id) => roles[id - 1] === Role.Wolf),
    villagers = game.playerIds.filter((id) => roles[id - 1] === Role.Villager);
  const turns = new Map<number, PlannedTurn[]>(game.playerIds.map((id) => [id, []]));
  const ordered: Array<{ actorId: number; turn: PlannedTurn }> = [];
  const action = (r: ActionRequest): ToolCall | null => {
    const day = r.context.day;
    if (
      mode === "blast" &&
      r.actorId === red &&
      day === 1 &&
      r.allowedTools.includes("self_destruct")
    )
      return { name: "self_destruct", args: { reason: "Golden blast", confirm: true } };
    if (r.allowedTools.includes("vote"))
      return {
        name: "vote",
        args: {
          target_id:
            mode === "blast"
              ? day === 2
                ? ordinary[0]!
                : ordinary[1]!
              : day === 1
                ? ordinary[1]!
                : day === 2
                  ? mode === "knife"
                    ? villagers[2]!
                    : red
                  : red,
          abstain: false,
        },
      };
    if (r.allowedTools.includes("check_identity"))
      return { name: "check_identity", args: { target_id: villagers[3]! } };
    return demonNightChoice(r, witch, {
      knife:
        day === 1
          ? villagers[0]!
          : day === 2
            ? villagers[1]!
            : mode === "knife"
              ? day === 3
                ? seer
                : villagers[3]!
              : villagers[2]!,
      potion:
        mode !== "blast" && day === 1
          ? { target: ordinary[0]!, type: PotionType.Poison }
          : undefined,
      hunt: mode === "blast" ? (day === 3 ? ordinary[2]! : null) : day === 2 ? ordinary[2]! : null,
    });
  };
  const result = await game.phaseManager.runUntilGameOver(
    {
      async getAction(r) {
        const value = action(r);
        const turn: PlannedTurn = { day: r.context.day, stage: r.context.stage, action: value };
        turns.get(r.actorId)!.push(turn);
        ordered.push({ actorId: r.actorId, turn });
        return value;
      },
    },
    8,
  );
  if (!result.gameOver || result.result?.winner !== (mode === "knife" ? Camp.Wolf : Camp.Good))
    throw new Error("red_moon_transport_plan_not_terminal");
  return {
    board: parseBoardDefinition(
      boardDefinitionFromConfig("red_moon_transport_" + mode + "_" + policy, config),
    ),
    seed,
    roles,
    turns,
    ordered,
    red,
    winner: result.result!.winner as Camp,
    alive: game.world.getAliveEntityIds(),
  };
}
