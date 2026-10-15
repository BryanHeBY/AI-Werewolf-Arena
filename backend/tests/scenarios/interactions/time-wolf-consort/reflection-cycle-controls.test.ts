/**
 * 交互场景测试：验证时间狼妃两种反射 scope 的救人、狼刀、跳过与重复控制。输入为原六种变体和有种子原生周期；回执、库存、反射效果及非法重复错误为字面预期，政策、RNG 和控制表保持原值。
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
for (const scope of ["whole_night", "first_effect"] as const)
  for (const variant of ["heal", "knife", "pass", "self", "repeat", "repeat-lock"] as const)
    test("Consort actual effect controls/" + scope + "/" + variant, async () => {
      const config = structuredClone(timeConsortTwelveConfig);
      config.timeConsort!.reflectionScope = scope;
      const random = createRandom("consort-controls:" + scope + ":" + variant),
        game = bootstrapGame(config, { random });
      const ids = (name: Role) =>
        game.playerIds.filter(
          (id) => game.world.getComponent(id, COMPONENT.Role)?.role === name,
        );
      const consort = ids(Role.TimeWolfConsort)[0]!,
        guard = ids(Role.Guard)[0]!,
        witch = ids(Role.Witch)[0]!,
        seer = ids(Role.Seer)[0]!,
        wolves = ids(Role.Wolf),
        villagers = ids(Role.Villager);
      const locked =
          variant === "self"
            ? guard
            : variant === "repeat" || variant === "repeat-lock"
              ? wolves[0]!
              : villagers[0]!,
        killed =
          variant === "self"
            ? guard
            : variant === "repeat" || variant === "repeat-lock"
              ? villagers[0]!
              : locked;
      const strategies = new Map(
        game.playerIds.map((i) => [
          i,
          new ObservedBot(randomDraws(random.fork("players").fork("id:" + i)), "active"),
        ]),
      );
      const native = new ObservedPlayersActionProvider(game.world, strategies);
      const provider = {
        async getAction(r: ActionRequest): Promise<ToolCall | null> {
          const stage = r.context.stage;
          if (stage === "time_consort_lock")
            return {
              name: "lock_time",
              args: { target_id: variant === "pass" ? null : locked, abstain: variant === "pass" },
            };
          if (stage === "guard")
            return {
              name: "guard",
              args: {
                target_id: variant === "self" || variant === "repeat" ? locked : null,
                abstain: variant !== "self" && variant !== "repeat",
              },
            };
          if (stage === "wolf_discussion")
            return { name: "speak_to_wolves", args: { text: "End", end_chat: true } };
          if (stage === "wolf_vote")
            return { name: "kill_vote", args: { target_id: killed, abstain: false } };
          if (stage === "witch")
            return {
              name: "use_potion",
              args: {
                target_id: variant === "heal" ? locked : witch,
                potion_type: variant === "heal" ? PotionType.Heal : PotionType.None,
              },
            };
          if (stage === "seer")
            return { name: "check_identity", args: { target_id: villagers[1]! } };
          if (stage === "order_prince_choice")
            return { name: "reset_exile_vote", args: { activate: false } };
          if (stage === "sheriff_nomination")
            return { name: "run_for_sheriff", args: { run: false } };
          if (stage === "on_pre_election" || stage === "on_pre_vote") return null;
          if (stage === "voting")
            return {
              name: "vote",
              args: {
                target_id: r.actorId === wolves[1] ? null : wolves[1]!,
                abstain: r.actorId === wolves[1],
              },
            };
          return native.getAction(r);
        },
      };
      await game.phaseManager.runSingleCycle(provider, 30);
      const state = getTimeConsortState(
        game.world.getComponent(consort, COMPONENT.Role), () => game.world.getComponent(consort, COMPONENT.Camp)
      )!;
      const reflected = game.phaseManager
        .getEvents()
        .filter((e) => e.type === "time_consort_reflected");
      expect(reflected).toHaveLength(variant === "self" || variant === "repeat" ? 1 : 0);
      expect(state.triggeredDay).toBe(variant === "self" || variant === "repeat" ? 1 : null);
      const dead = game.phaseManager.getEvents().find((e) => e.type === "night_resolved")!.payload
        .deaths as number[];
      expect(dead.includes(killed)).toBe(variant !== "heal" && variant !== "self");
      expect(state.history[0]!.targetId).toBe(variant === "pass" ? null : locked);
      expect(game.world.getComponent(seer, COMPONENT.Role)).toBeDefined();
      if (variant === "repeat-lock") {
        await expect(game.phaseManager.runSingleCycle(provider, 30)).rejects.toThrow(
          "time_consort_lock_action_invalid",
        );
        expect(state.history).toHaveLength(1);
        expect(state.triggeredDay).toBeNull();
      }
      if (variant === "repeat") {
        await expect(game.phaseManager.runSingleCycle(provider, 30)).rejects.toThrow(
          "time_consort_guard_action_invalid",
        );
        expect(
          game.phaseManager.getEvents().filter((e) => e.type === "guard_applied"),
        ).toHaveLength(1);
        expect(state.history).toHaveLength(1);
      }
    });
