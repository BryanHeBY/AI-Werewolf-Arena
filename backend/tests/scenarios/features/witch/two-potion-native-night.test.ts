/**
 * 女巫政策场景测试：验证显式 opt-in 双药在整夜行动之后结算。输入为原药瓶次序表、固定角色与受控完整 NightPipeline；精确致死来源和已付库存保留原断言，不重生预期或 fixture。
 */
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import {
  COMPONENT,
  Phase,
  Role,
  PotionType,
  DeathCause,
  StatusMark,
  type BoardConfig,
  type ActionRequest,
  type GameEvent,
  type RoleComponent,
  type ToolCall,
  type StatusMarksComponent,
} from "../../../../src/core";
import { GameActionRequestFactory } from "../../../../src/game/engine/action_request_factory";
import { WITCH_NIGHT_STAGES } from "../../../../src/game/mechanisms/roles/witch/night_stages";
import { findNightAbility } from "../../../../src/game/mechanisms/roles/abilities";
import {
  boardDefinitionFromConfig,
  parseBoardDefinition,
} from "../../../../src/runtime/config/board_definition";
import { sixPlayerMvpConfig } from "../../../../src/runtime/scenarios/six_player_mvp";
import { NightPipeline } from "../../../../src/game/engine/phase_pipeline/night_pipeline";
import { DamageResolutionSystem } from "../../../../src/core/domain/systems/damage_resolution_system";
import { ToolGateway } from "../../../../src/game/gateway/tool_gateway";
import { nightStageContext } from "../../../support/builders/night-stage-context";

const potionOrders: Array<Array<PotionType.Heal | PotionType.Poison>> = [
  [PotionType.Heal, PotionType.Poison],
  [PotionType.Poison, PotionType.Heal],
];

const roles = [Role.Wolf, Role.Witch, Role.Seer, Role.Villager, Role.Villager, Role.Villager];

const potion = (
  potion_type: PotionType,
  target_id = 3,
): Extract<ToolCall, { name: "use_potion" }> => ({
  name: "use_potion",
  args: { potion_type, target_id },
});

function setup(
  knifeVisibility: NonNullable<BoardConfig["witch"]>["knifeVisibility"] = "awa_with_heal_v1",
  potionPolicy: NonNullable<BoardConfig["witch"]>["potionPolicy"] = "awa_one_native_v1",
  locale: "zh-CN" | "en" = "en",
) {
  const config = parseBoardDefinition(
    boardDefinitionFromConfig("witch_policy", {
      ...sixPlayerMvpConfig,
      roleSetups: [...new Set(roles)].map((role) => ({
        role,
        count: roles.filter((x) => x === role).length,
      })),
      witch: { knifeVisibility, potionPolicy },
    }),
  ).config;
  const game = bootstrapGame(config, { fixedRoles: roles, locale });
  const ability = findNightAbility(
    game.world.getComponent(2, COMPONENT.Role),
    "potion",
  )!;
  game.world
    .getComponent(3, COMPONENT.StatusMarks)!
    .add(StatusMark.WolfKillMark);
  const events: GameEvent[] = [];
  const requests: ActionRequest[] = [];
  const act = async (
    actions: (ToolCall | null)[],
    mutate?: (request: ActionRequest, n: number) => void,
  ) => {
    const factory = new GameActionRequestFactory(game.world, events, 1);
    let index = 0;
    await WITCH_NIGHT_STAGES[1].execute(
      nightStageContext({
        world: game.world,
        events,
        state: {
          wolfChatOrder: [],
          endedWolves: new Set(),
          wolfVotes: {},
          wolfTarget: 3,
          seerChecks: [],
        },
        makeRequest: (actorId, allowedTools, extra) =>
          factory.create({
            actorId,
            allowedTools,
            phase: Phase.Night,
            stage: extra.stage,
            context: extra,
            requiresAction: true,
            summary: "Offline witch policy",
          }),
        actionProvider: {
          async getAction(request) {
            requests.push(request);
            const n = index++;
            mutate?.(request, n);
            return actions[n] ?? null;
          },
        },
      }),
    );
  };
  return { ...game, config, ability, events, requests, act };
}

for (const order of potionOrders)
  test(`native potion experiment/${order.join("→")}: full offline night settles both bottles after all actions`, async () => {
    const game = setup("awa_with_heal_v1", "awa_both_native_experimental_v1");
    let turn = 0;
    const result = await new NightPipeline({
      world: game.world,
      events: game.events,
      toolGateway: new ToolGateway(),
      damageResolutionSystem: new DamageResolutionSystem(),
    }).execute(
      game.config,
      {
        async getAction(request) {
          if (request.allowedTools.includes("speak_to_wolves"))
            return { name: "speak_to_wolves", args: { text: "end", end_chat: true } };
          if (request.allowedTools.includes("kill_vote"))
            return { name: "kill_vote", args: { target_id: 3, abstain: false } };
          if (request.allowedTools.includes("use_potion")) {
            const kind = order[turn++];
            return potion(kind, kind === PotionType.Heal ? 3 : 4);
          }
          return null;
        },
      },
      1,
    );
    if (result.interrupted) throw new Error("unexpected_interrupt");
    expect(turn).toBe(2);
    expect(result.damage.deaths).toEqual([4]);
    expect(result.damage.deathSources).toEqual({ 4: [DeathCause.Poison] });
    expect(game.ability.state.heal).toBe(0);
    expect(game.ability.state.poison).toBe(0);
    expect(
      game.events
        .filter((event) => event.type === "witch_potion_used")
        .map((event) => event.payload.potionType),
    ).toEqual(order);
  });
