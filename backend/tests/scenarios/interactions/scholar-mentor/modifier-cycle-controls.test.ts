/**
 * 交互场景测试：验证学者／导师修饰周期的原生／额外资格、付款和知识。输入为原种子控制变体、两种修饰及确定首／次周期回复；选择／历史、额外请求和结果为明确预期，控制表及 RNG 输入不变。
 */
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import { scholarMentorTwelveConfig } from "../../../../src/runtime/scenarios/scholar_mentor_twelve";
import {
  COMPONENT,
  Role,
  PotionType,
  createRandom,
  randomDraws,
  type RoleComponent,
  type ActionRequest,
  type ToolCall,
} from "../../../../src/core";
import { ObservedBot } from "../../../../src/ai/agents/providers/observed_bot";
import { ObservedPlayersActionProvider } from "../../../../src/app/observed-players-action-provider";
import { scholarMentorStateForRole } from "../../../../src/game/mechanisms/roles/scholar_mentor/ports";
const variants = [
  "same-good",
  "different-wolves",
  "weaken-wolf",
  "weaken-witch-heal",
  "enhance-guard",
  "enhance-seer",
  "enhance-spent-poison",
  "enhance-knife",
] as const;
for (const locale of ["zh-CN", "en"] as const)
  for (const variant of variants)
    test(
      "Scholar Mentor actual controls/" + locale + "/" + variant,
      async () => {
        const config = structuredClone(scholarMentorTwelveConfig),
          random = createRandom("sm-controls:" + locale + ":" + variant),
          game = bootstrapGame(config, { locale, random });
        const ids = (name: Role) =>
          game.playerIds.filter(
            (id) => game.world.getComponent(id, COMPONENT.Role)?.role === name,
          );
        const scholar = ids(Role.DayScholar)[0]!,
          mentor = ids(Role.NightMentor)[0]!,
          guard = ids(Role.Guard)[0]!,
          seer = ids(Role.Seer)[0]!,
          witch = ids(Role.Witch)[0]!,
          wolves = ids(Role.Wolf),
          villagers = ids(Role.Villager);
        const native = new ObservedPlayersActionProvider(
          game.world,
          new Map(
            game.playerIds.map((id) => [
              id,
              new ObservedBot(randomDraws(random.fork("players").fork("id:" + id)), "active"),
            ]),
          ),
        );
        let cycle = 1;
        const requests: ActionRequest[] = [];
        const target =
          variant === "same-good" || variant === "enhance-seer"
            ? seer
            : variant === "weaken-witch-heal" || variant === "enhance-spent-poison"
              ? witch
              : variant === "enhance-guard"
                ? guard
                : wolves[0]!;
        const provider = {
          async getAction(r: ActionRequest): Promise<ToolCall | null> {
            const stage = r.context.stage;
            if (cycle === 2) requests.push(r);
            if (stage === "scholar_mentor_choice") {
              const selected =
                r.actorId === scholar || variant === "same-good" || variant === "different-wolves";
              return {
                name: "modify_skill",
                args: {
                  mode: selected ? (variant.startsWith("weaken") ? "weaken" : "enhance") : null,
                  target_id: selected
                    ? r.actorId === mentor && variant === "different-wolves"
                      ? wolves[1]!
                      : target
                    : null,
                },
              };
            }
            if (stage === "scholar_mentor_bonus") {
              const kind = r.context.modifier_bonus_kind!;
              return {
                name: "bonus_action",
                args: {
                  kind,
                  target_id:
                    kind === "poison"
                      ? wolves[0]!
                      : kind === "kill"
                        ? villagers[1]!
                        : villagers[0]!,
                  abstain: false,
                },
              };
            }
            if (stage === "guard")
              return {
                name: "guard",
                args: { target_id: cycle === 1 ? null : villagers[1]!, abstain: cycle === 1 },
              };
            if (stage === "wolf_discussion")
              return { name: "speak_to_wolves", args: { text: "End", end_chat: true } };
            if (stage === "wolf_vote")
              return {
                name: "kill_vote",
                args: { target_id: cycle === 1 ? villagers[3]! : villagers[0]!, abstain: false },
              };
            if (stage === "witch")
              return {
                name: "use_potion",
                args: {
                  target_id:
                    cycle === 1 && variant === "enhance-spent-poison"
                      ? villagers[2]!
                      : cycle === 2 && variant === "weaken-witch-heal"
                        ? villagers[0]!
                        : witch,
                  potion_type:
                    cycle === 1 && variant === "enhance-spent-poison"
                      ? PotionType.Poison
                      : cycle === 2 && variant === "weaken-witch-heal"
                        ? PotionType.Heal
                        : PotionType.None,
                },
              };
            if (stage === "seer")
              return { name: "check_identity", args: { target_id: wolves[0]! } };
            if (stage === "sheriff_nomination")
              return { name: "run_for_sheriff", args: { run: false } };
            if (stage === "on_pre_election" || stage === "on_pre_vote") return null;
            if (stage === "voting") {
              const exiled = cycle === 1 ? wolves[2]! : wolves[1]!;
              return {
                name: "vote",
                args: {
                  target_id: r.actorId === exiled ? null : exiled,
                  abstain: r.actorId === exiled,
                },
              };
            }
            return native.getAction(r);
          },
        };
        await game.phaseManager.runSingleCycle(provider, 30);
        expect(game.world.getAliveEntityIds()).toContain(scholar);
        expect(game.world.getAliveEntityIds()).toContain(mentor);
        const before = game.phaseManager.getEvents().length;
        cycle = 2;
        await game.phaseManager.runSingleCycle(provider, 30);
        const events = game.phaseManager.getEvents().slice(before),
          night = events.find((e) => e.type === "night_resolved")!;
        expect(night).toBeDefined();
        const dead = night.payload.deaths as number[];
        const bonus = events.filter((e) => e.type === "modifier_bonus_resolved"),
          conflict = events.filter((e) => e.type === "modifier_conflict_resolved");
        const charge = scholarMentorStateForRole(
          game.world.getComponent(scholar, COMPONENT.Role),
        )!;
        expect(charge.history).toHaveLength(1);
        expect(charge.history[0]!.day).toBe(2);
        expect(charge.history[0]!.targetId).toBe(target);
        expect(charge.remaining[variant.startsWith("weaken") ? "weaken" : "enhance"]).toBe(0);
        if (variant === "same-good") {
          expect(dead).toContain(seer);
          expect(requests.filter((r) => r.context.stage === "seer")).toHaveLength(1);
          expect(conflict).toHaveLength(1);
          expect(bonus).toHaveLength(0);
        } else if (variant === "different-wolves") {
          expect(dead).toContain(mentor);
          expect(dead).not.toContain(wolves[0]!);
          expect(conflict).toHaveLength(1);
          expect(bonus).toHaveLength(0);
        } else if (variant === "weaken-wolf") {
          expect(dead).not.toContain(villagers[0]!);
          expect(requests.filter((r) => r.context.stage === "wolf_vote")).toHaveLength(0);
        } else if (variant === "weaken-witch-heal") {
          expect(dead).not.toContain(villagers[0]!);
          const wr = requests.find((r) => r.context.stage === "witch")!;
          expect(wr.context.modifier_poison_blocked).toBe(true);
        } else {
          expect(bonus).toHaveLength(1);
          expect(bonus[0]!.payload.actorId).toBe(target);
          if (variant === "enhance-guard") expect(dead).not.toContain(villagers[0]!);
          if (variant === "enhance-seer") {
            expect(bonus[0]!.payload.isWerewolf).toBe(false);
            expect(requests.filter((r) => r.context.stage === "seer")).toHaveLength(1);
          }
          if (variant === "enhance-spent-poison") expect(dead).toContain(wolves[0]!);
          if (variant === "enhance-knife") {
            expect(dead).toContain(villagers[0]!);
            expect(dead).not.toContain(villagers[1]!);
            const wr = requests.find((r) => r.context.stage === "witch")!;
            expect(wr.context.wolf_targets).toEqual(
              expect.arrayContaining([villagers[0]!, villagers[1]!]),
            );
          }
        }
        for (const e of events.filter(
          (e) => e.type === "modifier_choice_committed" || e.type === "modifier_bonus_resolved",
        ))
          expect(e.audience).toEqual([e.payload.actorId as number]);
        for (const e of conflict) expect(e.audience).toEqual([]);
      },
      120000,
    );
