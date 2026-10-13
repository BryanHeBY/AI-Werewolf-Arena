/**
 * 单元测试：验证构造夜间请求期间 scope／policy 改变会在请求泄出前拒绝。输入为原作用域变化；provider 调用次数和库存的字面断言为预期，不修复非法输入。
 */
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { COMPONENT, Phase, Role, type RoleComponent, type GameEvent } from "../../../src/core";
import { sixPlayerMvpConfig } from "../../../src/runtime/scenarios/six_player_mvp";
import { findNightAbility } from "../../../src/game/mechanisms/roles/abilities";
import { SEER_NIGHT_STAGES } from "../../../src/game/mechanisms/roles/seer/night_stages";
import { GUARD_NIGHT_STAGES } from "../../../src/game/mechanisms/roles/guard/night_stages";
import { DREAMER_NIGHT_STAGE } from "../../../src/game/mechanisms/roles/dreamer/night_stages";
import { WITCH_NIGHT_STAGES } from "../../../src/game/mechanisms/roles/witch/night_stages";
import { GameActionRequestFactory } from "../../../src/game/engine/action_request_factory";
import { nightStageContext } from "../../support/builders/night-stage-context";

const cases = [
  { role: Role.Seer, kind: "seer_check", stage: SEER_NIGHT_STAGES[0]! },
  { role: Role.Guard, kind: "guard", stage: GUARD_NIGHT_STAGES[0]! },
  { role: Role.Dreamer, kind: "dream", stage: DREAMER_NIGHT_STAGE },
  {
    role: Role.Witch,
    kind: "potion",
    stage: WITCH_NIGHT_STAGES.find((stage) => stage.id === "witch_action")!,
  },
] as const;
for (const item of cases)
  for (const mutation of ["disabled", "source", "day"] as const)
    test(`${item.role}/${mutation}: request construction cannot pass a revoked scope to a provider`, async () => {
      const roles = [
        item.role,
        Role.Wolf,
        Role.Villager,
        Role.Villager,
        Role.Villager,
        Role.Villager,
      ];
      const board = {
        ...sixPlayerMvpConfig,
        roleSetups: [...new Set(roles)].map((role) => ({
          role,
          count: roles.filter((value) => value === role).length,
        })),
      };
      const game = bootstrapGame(board, { fixedRoles: roles });
      const ability = findNightAbility(
        game.world.getComponent(1, COMPONENT.Role)!,
        item.kind,
      )!;
      const state = structuredClone(ability.state),
        events: GameEvent[] = [];
      let day = 1,
        requests = 0,
        calls = 0;
      const factory = new GameActionRequestFactory(game.world, events, day);
      const ctx = nightStageContext({
        world: game.world,
        events,
        currentDay: () => day,
        actionProvider: {
          async getAction() {
            calls++;
            return null;
          },
        },
        makeRequest: (actorId, allowedTools, extra) => {
          requests++;
          const request = factory.create({
            actorId,
            allowedTools,
            phase: Phase.Night,
            stage: extra.stage,
            context: extra,
            requiresAction: false,
            summary: "Offline preflight regression",
          });
          if (mutation === "disabled") (ability as { disabled: boolean }).disabled = true;
          if (mutation === "source")
            (
              ability as {
                source: import("@ai-werewolf-arena/game-contract").AbilitySource;
              }
            ).source = { kind: "gift", actorId: 2 };
          if (mutation === "day") day = 2;
          return request;
        },
      });
      await item.stage.execute(ctx);
      expect(requests).toBe(1);
      expect(calls).toBe(0);
      expect(ability.state).toEqual(state);
      expect(ability.uses).toBe(0);
      expect(ability.lastUsedDay).toBeNull();
      expect(events).toEqual([]);
    });

for (const item of cases.filter((item) => item.kind !== "dream"))
  test(`${item.role}/policy: a policy change during request construction revokes provider access`, async () => {
    const roles = [
      item.role,
      Role.Wolf,
      Role.Villager,
      Role.Villager,
      Role.Villager,
      Role.Villager,
    ];
    const game = bootstrapGame(
      {
        ...sixPlayerMvpConfig,
        roleSetups: [...new Set(roles)].map((role) => ({
          role,
          count: roles.filter((x) => x === role).length,
        })),
      },
      { fixedRoles: roles },
    );
    const ability = findNightAbility(
      game.world.getComponent(1, COMPONENT.Role),
      item.kind,
    )!;
    const events: GameEvent[] = [];
    let calls = 0;
    const factory = new GameActionRequestFactory(game.world, events, 1);
    await item.stage.execute(
      nightStageContext({
        world: game.world,
        events,
        makeRequest: (actorId, allowedTools, extra) => {
          const request = factory.create({
            actorId,
            allowedTools,
            phase: Phase.Night,
            stage: extra.stage,
            context: extra,
            requiresAction: true,
            summary: "Policy revoke",
          });
          if (ability.kind === "seer_check")
            (
              ability.state as { targetPolicy: "awa_alive_v1" | "awa_fresh_others_v1" | undefined }
            ).targetPolicy = "awa_fresh_others_v1";
          if (ability.kind === "guard")
            (
              ability.state as {
                repeatPolicy: "awa_last_action_v1" | "netease_consecutive_nights_v1" | undefined;
              }
            ).repeatPolicy = "netease_consecutive_nights_v1";
          if (ability.kind === "potion")
            (
              ability.state as { knifeVisibility: "awa_with_heal_v1" | "awa_always_v1" | undefined }
            ).knifeVisibility = "awa_always_v1";
          return request;
        },
        actionProvider: {
          async getAction() {
            calls++;
            return null;
          },
        },
      }),
    );
    expect(calls).toBe(0);
    expect(ability.uses).toBe(0);
    expect(ability.lastUsedDay).toBeNull();
    expect(events).toEqual([]);
  });
