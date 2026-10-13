/**
 * 单元测试验证女巫原生狼刀披露、双药政策、外来库存隔离与终结后的第二次行动关闭。
 * 输入保留原狼刀／库存／顺序／撤销／语言矩阵，只调用有界原生阶段 helper；手写请求、
 * 药瓶／使用计数和配置提示／DTO 边界是预期，不运行完整 NightPipeline 或 recorder。
 */
import { captureNativeRolePresentation } from "../../../../src/game/observation/native-role-presentation-capture";
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import {
  COMPONENT,
  Phase,
  Role,
  PotionType,
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
import { WITCH_ROLE_PROFILE } from "../../../../src/game/mechanisms/roles/witch/profile";
import {
  abilityStatus,
  findNightAbility,
  projectNightAbility,
} from "../../../../src/game/mechanisms/roles/abilities";
import { getDefaultConfigRenderRegistry } from "../../../../src/game/mechanisms/prompt/config_render_registry";
import {
  boardDefinitionFromConfig,
  parseBoardDefinition,
} from "../../../../src/runtime/config/board_definition";
import { sixPlayerMvpConfig } from "../../../../src/runtime/scenarios/six_player_mvp";
import { nightStageContext } from "../../../engine/night_stage_fixture";

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
    game.world.getComponent<RoleComponent>(2, COMPONENT.Role),
    "potion",
  )!;
  game.world
    .getComponent<StatusMarksComponent>(3, COMPONENT.StatusMarks)!
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
          dreamLinks: [],
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

for (const knife of ["awa_with_heal_v1", "awa_always_v1"] as const)
  for (const stock of [0, 1])
    test(`${knife}/heal=${stock}: actual request discloses only the configured knife information`, async () => {
      const game = setup(knife);
      (game.ability.state as { heal: number }).heal = stock;
      await game.act([potion(PotionType.None, 2)]);
      expect(Object.hasOwn(game.requests[0].context, "wolf_target")).toBe(
        knife === "awa_always_v1" || (knife === "awa_with_heal_v1" && stock > 0),
      );
      expect(game.config.witch?.knifeVisibility).toBe(knife);
      expect(
        parseBoardDefinition(boardDefinitionFromConfig("witch_policy", game.config)).config,
      ).toEqual(game.config);
      const projected = projectNightAbility(game.ability, 1);
      if (projected.kind !== "potion") throw new Error("expected_potion");
      expect(projected.state).not.toHaveProperty("potionTurnClosedDay");
      if (knife !== "awa_with_heal_v1") expect(projected.state.knifeVisibility).toBe(knife);
    });

for (const policy of ["awa_one_native_v1", "awa_both_native_experimental_v1"] as const)
  for (const order of potionOrders)
    test(`${policy}/${order.join("→")}: only the native opt-in opens exactly one second turn`, async () => {
      const game = setup("awa_with_heal_v1", policy);
      await game.act(order.map((kind) => potion(kind, kind === PotionType.Heal ? 3 : 4)));
      expect(game.requests).toHaveLength(policy === "awa_both_native_experimental_v1" ? 2 : 1);
      expect(game.events.filter((event) => event.type === "witch_potion_used")).toHaveLength(
        policy === "awa_both_native_experimental_v1" ? 2 : 1,
      );
      expect(game.ability.uses).toBe(policy === "awa_both_native_experimental_v1" ? 2 : 1);
      if (policy === "awa_both_native_experimental_v1") {
        expect(game.ability.state.heal).toBe(0);
        expect(game.ability.state.poison).toBe(0);
        expect(Object.hasOwn(game.requests[1].context, "wolf_target")).toBe(
          order[0] === PotionType.Poison,
        );
      }
      expect(abilityStatus(game.ability, 1)).toBe("used_this_night");
      await game.act([potion(PotionType.Heal)]);
      expect(game.requests).toHaveLength(policy === "awa_both_native_experimental_v1" ? 2 : 1);
    });

for (const first of [null, potion(PotionType.None, 2), potion(PotionType.Heal, 999)])
  test(`both policy: initial ${first?.args.potion_type ?? "no_action"}/${first?.args.target_id ?? ""} is terminal with no resource consumption`, async () => {
    const game = setup("awa_always_v1", "awa_both_native_experimental_v1");
    await game.act([first, potion(PotionType.Poison, 4)]);
    expect(game.requests).toHaveLength(1);
    expect(game.ability.state.heal).toBe(1);
    expect(game.ability.state.poison).toBe(1);
    expect(game.ability.uses).toBe(0);
    await game.act([potion(PotionType.Poison, 4)]);
    expect(game.requests).toHaveLength(1);
  });

test("passing the second native turn closes it without consuming the other bottle", async () => {
  const game = setup("awa_always_v1", "awa_both_native_experimental_v1");
  await game.act([potion(PotionType.Heal), potion(PotionType.None, 2)]);
  expect(game.ability.state.poison).toBe(1);
  expect(game.ability.uses).toBe(1);
  expect(abilityStatus(game.ability, 1)).toBe("used_this_night");
  await game.act([potion(PotionType.Poison, 4)]);
  expect(game.requests).toHaveLength(2);
});

for (const kind of ["copy", "transfer", "gift"] as const)
  test(`${kind}: native two-potion and always-disclose policies cannot widen a foreign resource`, async () => {
    const game = setup("awa_always_v1", "awa_both_native_experimental_v1");
    (
      game.ability as {
        source: import("@ai-werewolf-arena/game-contract").AbilitySource;
      }
    ).source =
      kind === "gift" ? { kind, actorId: 1 } : { kind, actorId: 1, abilityId: "foreign-potion" };
    (game.ability.state as { heal: number }).heal = 0;
    await game.act([potion(PotionType.Poison, 4), potion(PotionType.Heal)]);
    expect(game.requests).toHaveLength(1);
    expect(game.requests[0].context).not.toHaveProperty("wolf_target");
    expect(game.ability.uses).toBe(1);
  });

for (const revoked of ["disabled", "source", "day"] as const)
  test(`second turn ${revoked} revocation does not apply or consume`, async () => {
    const game = setup("awa_always_v1", "awa_both_native_experimental_v1");
    await game.act([potion(PotionType.Heal), potion(PotionType.Poison, 4)], (_request, n) => {
      if (n !== 1) return;
      if (revoked === "disabled") (game.ability as { disabled: boolean }).disabled = true;
      if (revoked === "source")
        (
          game.ability as {
            source: import("@ai-werewolf-arena/game-contract").AbilitySource;
          }
        ).source = { kind: "gift", actorId: 1 };
      if (revoked === "day") (game.ability as { startsOnDay: number }).startsOnDay = 2;
    });
    expect(game.requests).toHaveLength(2);
    expect(game.ability.state.poison).toBe(1);
    expect(game.ability.uses).toBe(1);
    expect(game.events.filter((event) => event.type === "witch_potion_used")).toHaveLength(1);
    expect(game.ability.state.potionTurnClosedDay).toBeUndefined();
  });

for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}: role and board disclose both native policy boundaries`, () => {
    const game = setup("awa_always_v1", "awa_both_native_experimental_v1", locale);
    const role = game.world.getComponent<RoleComponent>(2, COMPONENT.Role)!;
    for (const prompt of [
      captureNativeRolePresentation(WITCH_ROLE_PROFILE.nativePresentation!.id, role, locale),
      getDefaultConfigRenderRegistry().renderBoardConfigPrompt(game.config, locale),
    ]) {
      expect(prompt).toContain(locale === "en" ? "even after heal is spent" : "解药耗尽");
      expect(prompt).toContain(locale === "en" ? "copied and gifted" : "复制/赠予");
    }
  });
