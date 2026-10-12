/**
 * Failure scenarios verify actual Scholar Mentor second-cycle invalid or missing requests preserve the paid choice prefix without bonus settlement.
 * Input: The original ten failure variants, seeded first cycle and controlled second-cycle native/bonus responses.
 * Output and oracle: Literal absent bonus/night result and remaining/history values stay attached to the failed phase execution; no expected action is repaired or regenerated.
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
import { ObservedPlayersActionProvider } from "../../../../src/ai/agents/providers/observed_players";
import { scholarMentorStateForRole } from "../../../../src/game/mechanisms/roles/scholar_mentor/night_frame";
for (const variant of [
  "missing-wolf-chat",
  "invalid-wolf-chat",
  "missing-wolf-vote",
  "invalid-wolf-vote",
  "missing-choice",
  "invalid-mode",
  "invalid-target",
  "missing-bonus",
  "repeat-bonus",
  "throw-bonus",
] as const)
  test(
    "Scholar Mentor actual failure/" + variant,
    async () => {
      const config = structuredClone(scholarMentorTwelveConfig),
        random = createRandom("sm-failure:" + variant),
        game = bootstrapGame(config, { random });
      const ids = (name: Role) =>
        game.playerIds.filter(
          (id) => game.world.getComponent<RoleComponent>(id, COMPONENT.Role)?.role === name,
        );
      const scholar = ids(Role.DayScholar)[0]!,
        mentor = ids(Role.NightMentor)[0]!,
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
        config,
      );
      let cycle = 1;
      const provider = {
        async getAction(r: ActionRequest): Promise<ToolCall | null> {
          const stage = r.context.stage;
          if (cycle === 2 && stage === "wolf_discussion") {
            if (variant === "missing-wolf-chat") return null;
            if (variant === "invalid-wolf-chat")
              return {
                name: "speak_to_wolves",
                args: { text: 1, end_chat: false },
              } as unknown as ToolCall;
          }
          if (cycle === 2 && stage === "wolf_vote") {
            if (variant === "missing-wolf-vote") return null;
            if (variant === "invalid-wolf-vote")
              return { name: "kill_vote", args: { target_id: 999, abstain: false } };
          }
          if (stage === "scholar_mentor_choice") {
            if (r.actorId === mentor)
              return { name: "modify_skill", args: { mode: null, target_id: null } };
            if (variant === "missing-choice") return null;
            return {
              name: "modify_skill",
              args: {
                mode: variant === "invalid-mode" ? "invented" : "enhance",
                target_id: variant === "invalid-target" ? 999 : seer,
              },
            } as ToolCall;
          }
          if (stage === "scholar_mentor_bonus") {
            if (variant === "missing-bonus") return null;
            if (variant === "throw-bonus") throw new Error("fixture_bonus_transport_failure");
            return {
              name: "bonus_action",
              args: { kind: "check", target_id: wolves[0]!, abstain: false },
            };
          }
          if (stage === "guard") return { name: "guard", args: { target_id: null, abstain: true } };
          if (stage === "wolf_discussion")
            return { name: "speak_to_wolves", args: { text: "End", end_chat: true } };
          if (stage === "wolf_vote")
            return {
              name: "kill_vote",
              args: { target_id: cycle === 1 ? villagers[3]! : villagers[0]!, abstain: false },
            };
          if (stage === "witch")
            return { name: "use_potion", args: { target_id: witch, potion_type: PotionType.None } };
          if (stage === "seer") return { name: "check_identity", args: { target_id: wolves[0]! } };
          if (stage === "sheriff_nomination")
            return { name: "run_for_sheriff", args: { run: false } };
          if (stage === "on_pre_election" || stage === "on_pre_vote") return null;
          if (stage === "voting")
            return {
              name: "vote",
              args: {
                target_id: r.actorId === wolves[2] ? null : wolves[2]!,
                abstain: r.actorId === wolves[2],
              },
            };
          return native.getAction(r);
        },
      };
      await game.phaseManager.runSingleCycle(provider, 30);
      cycle = 2;
      const before = game.phaseManager.getEvents().length;
      await expect(game.phaseManager.runSingleCycle(provider, 30)).rejects.toThrow(
        variant.includes("wolf") ? "scholar_mentor_wolf_" : undefined,
      );
      const events = game.phaseManager.getEvents().slice(before);
      expect(events.some((e) => e.type === "modifier_bonus_resolved")).toBe(false);
      expect(events.some((e) => e.type === "night_resolved")).toBe(false);
      const state = scholarMentorStateForRole(
        game.world.getComponent<RoleComponent>(scholar, COMPONENT.Role),
      )!;
      const choiceInvalid =
        variant === "missing-choice" || variant === "invalid-mode" || variant === "invalid-target";
      expect(state.history).toHaveLength(choiceInvalid ? 0 : 1);
      expect(state.remaining.enhance).toBe(choiceInvalid ? 1 : 0);
    },
    120000,
  );
