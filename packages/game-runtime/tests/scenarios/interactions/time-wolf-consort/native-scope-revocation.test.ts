/**
 * 交互场景测试：验证时间狼妃原生效果 scope 在进行中撤权后不提交过期回执。输入为原角色／阶段／事件及修改矩阵的实际周期；来源错误、未发布及已付款前缀为明确预期，不把 scope 文件误认作纯 mock 测试。
 */
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import { timeConsortTwelveConfig } from "../../../../src/rulesets/presets/time-wolf-consort-twelve";
import {
  COMPONENT,
  Role,
  PotionType,
  createRandom,
  randomDraws,
  type RoleComponent,
  type ActionRequest,
  type ToolCall,
} from "../../../../src/domain";
import { ObservedBot } from "../../../../src/agents/providers/observed-bot";
import { ObservedPlayersActionProvider } from "../../../../src/app/observed-players-action-provider";
import { getTimeConsortState } from "../../../../src/features/time-wolf-consort/ports";
for (const [role, stage, event] of [
  [Role.Guard, "guard", "guard_applied"],
  [Role.Seer, "seer", "seer_checked"],
  [Role.Witch, "witch", "witch_potion_used"],
] as const)
  for (const mutation of [
    "replace",
    "delete",
    "replace-state",
    "disable",
    "expire",
    "expiry-accessor",
    "activation-accessor",
    "death-accessor",
  ] as const)
    for (const timing of ["during-action", "before-stage"] as const)
      test(
        "Consort rejects asynchronous ability " + mutation + "/" + stage + "/" + timing,
        async () => {
          const config = structuredClone(timeConsortTwelveConfig),
            random = createRandom("consort-scope:" + stage + ":" + mutation);
          const game = bootstrapGame(config, { random });
          const id = (name: Role) =>
            game.playerIds.find(
              (id) => game.world.getComponent(id, COMPONENT.Role)?.role === name,
            )!;
          const actor = id(role),
            consort = id(Role.TimeWolfConsort),
            target = id(Role.Wolf);
          const strategies = new Map(
            game.playerIds.map((i) => [
              i,
              new ObservedBot(randomDraws(random.fork("players").fork("id:" + i)), "active"),
            ]),
          );
          const native = new ObservedPlayersActionProvider(game.world, strategies);
          let mutated = false;
          const provider = {
            async getAction(r: ActionRequest): Promise<ToolCall | null> {
              if (
                (timing === "during-action" && r.actorId === actor && r.context.stage === stage) ||
                (timing === "before-stage" && r.context.stage === "time_consort_lock")
              ) {
                const p = game.world.getComponent(actor, COMPONENT.Role)!;
                const abilities = (p.privateState as { readonly abilities?: unknown })
                    .abilities as Record<string, Record<string, unknown>>,
                  key = Object.keys(abilities)[0]!,
                  old = abilities[key]!;
                expect(old).toBeDefined();
                mutated = true;
                if (mutation === "replace") abilities[key] = { ...old };
                else if (mutation === "delete") delete abilities[key];
                else if (mutation === "replace-state")
                  old.state = { ...(old.state as Record<string, unknown>) };
                else if (mutation === "disable") old.disabled = true;
                else if (mutation === "expire") old.deathExpired = true;
                else if (mutation === "expiry-accessor")
                  Object.defineProperty(old, "expiresAfterDay", {
                    get: () => 0,
                    configurable: true,
                  });
                else if (mutation === "activation-accessor")
                  Object.defineProperty(old, "activation", {
                    get: () => "lucky",
                    configurable: true,
                  });
                else
                  Object.defineProperty(old, "deathExpired", {
                    get: () => true,
                    configurable: true,
                  });
                if (timing === "before-stage")
                  return { name: "lock_time", args: { target_id: target, abstain: false } };
                if (stage === "guard")
                  return { name: "guard", args: { target_id: target, abstain: false } };
                if (stage === "seer")
                  return { name: "check_identity", args: { target_id: target } };
                return {
                  name: "use_potion",
                  args: { target_id: target, potion_type: PotionType.Poison },
                };
              }
              if (r.context.stage === "time_consort_lock")
                return { name: "lock_time", args: { target_id: target, abstain: false } };
              if (r.context.stage === "guard")
                return { name: "guard", args: { target_id: null, abstain: true } };
              if (r.context.stage === "witch")
                return {
                  name: "use_potion",
                  args: { target_id: r.actorId, potion_type: PotionType.None },
                };
              return native.getAction(r);
            },
          };
          await expect(game.phaseManager.runSingleCycle(provider, 30)).rejects.toThrow(
            "time_consort",
          );
          expect(mutated).toBe(true);
          expect(
            game.phaseManager
              .getEvents()
              .some((e) => e.type === event && e.payload.actorId === actor),
          ).toBe(false);
          const state = getTimeConsortState(game.world.getComponent(consort, COMPONENT.Role), () =>
            game.world.getComponent(consort, COMPONENT.Camp),
          )!;
          expect(state.history).toHaveLength(timing === "before-stage" ? 0 : 1);
          expect(state.triggeredDay).toBeNull();
        },
      );

for (const ownerRole of [Role.Villager, Role.TimeWolfConsort] as const)
  for (const mutation of ["getter", "inherited-getter", "undefined-field"] as const)
    test(
      "Consort rejects absent ability-container injection/" + ownerRole + "/" + mutation,
      async () => {
        const config = structuredClone(timeConsortTwelveConfig),
          random = createRandom("consort-container:" + ownerRole + ":" + mutation);
        const game = bootstrapGame(config, { random });
        const id = (name: Role) =>
          game.playerIds.find((id) => game.world.getComponent(id, COMPONENT.Role)?.role === name)!;
        const actor = id(ownerRole),
          guard = id(Role.Guard),
          target = id(Role.Wolf);
        const role = game.world.getComponent(actor, COMPONENT.Role)!;
        expect(Object.hasOwn(role.privateState, "abilities")).toBe(false);
        const donor = structuredClone(
          (
            game.world.getComponent(guard, COMPONENT.Role)!.privateState as {
              readonly abilities?: unknown;
            }
          ).abilities,
        );
        let reads = 0,
          mutated = false;
        const provider = {
          async getAction(request: ActionRequest): Promise<ToolCall | null> {
            if (request.context.stage !== "time_consort_lock") throw new Error("unexpected_stage");
            mutated = true;
            if (mutation === "getter")
              Object.defineProperty(role.privateState, "abilities", {
                configurable: true,
                get: () => {
                  reads++;
                  return donor;
                },
              });
            else if (mutation === "inherited-getter")
              Object.setPrototypeOf(role.privateState, {
                get abilities() {
                  reads++;
                  return donor;
                },
              });
            else
              Object.defineProperty(role.privateState, "abilities", {
                configurable: true,
                value: undefined,
              });
            return { name: "lock_time", args: { target_id: target, abstain: false } };
          },
        };
        await expect(game.phaseManager.runSingleCycle(provider, 30)).rejects.toThrow(
          "time_consort",
        );
        expect(mutated).toBe(true);
        expect(reads).toBe(0);
        expect(
          game.phaseManager
            .getEvents()
            .some(
              (e) =>
                e.type === "guard_applied" ||
                e.type === "seer_checked" ||
                e.type === "witch_potion_used",
            ),
        ).toBe(false);
      },
    );
