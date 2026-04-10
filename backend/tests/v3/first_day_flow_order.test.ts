import { bootstrapGame } from "../../src/app/bootstrap";
import { COMPONENT } from "../../src/domain/components/names";
import { RoleComponent } from "../../src/domain/components/role";
import { ActionProvider, ActionRequest, Phase, PotionType, ToolCall } from "../../src/domain/model";
import { twelvePlayerStandardConfig } from "../../src/scenarios/twelve_player_standard";

class DeterministicFlowProvider implements ActionProvider {
  constructor(
    private readonly world: ReturnType<typeof bootstrapGame>["world"],
    private readonly sheriffCandidateId: number,
  ) {}

  async getAction(request: ActionRequest): Promise<ToolCall | null> {
    if (request.allowedTools.includes("kill_vote")) {
      const target = this.world.getAliveEntityIds().find((id) => {
        if (id === this.sheriffCandidateId) {
          return false;
        }
        const role = this.world.getComponent<RoleComponent>(id, COMPONENT.Role);
        return role?.camp !== "wolf";
      });
      return target
        ? { name: "kill_vote", args: { target_id: target, abstain: false } }
        : { name: "kill_vote", args: { target_id: null, abstain: true } };
    }
    if (request.allowedTools.includes("guard")) {
      return { name: "guard", args: { target_id: null, abstain: true } };
    }
    if (request.allowedTools.includes("use_potion")) {
      return {
        name: "use_potion",
        args: { target_id: request.actorId, potion_type: PotionType.None },
      };
    }
    if (request.allowedTools.includes("check_identity")) {
      const target = this.world
        .getAliveEntityIds()
        .find((id) => id !== request.actorId);
      return { name: "check_identity", args: { target_id: target ?? request.actorId } };
    }
    if (request.allowedTools.includes("run_for_sheriff")) {
      if (request.context?.phase === "sheriff_withdraw") {
        return { name: "run_for_sheriff", args: { run: true } };
      }
      return {
        name: "run_for_sheriff",
        args: { run: request.actorId === this.sheriffCandidateId },
      };
    }
    if (request.allowedTools.includes("vote_for_sheriff")) {
      return {
        name: "vote_for_sheriff",
        args: { target_id: this.sheriffCandidateId, abstain: false },
      };
    }
    if (request.allowedTools.includes("choose_direction")) {
      return { name: "choose_direction", args: { direction: "clockwise" } };
    }
    if (request.allowedTools.includes("vote")) {
      const target = this.world
        .getAliveEntityIds()
        .find((id) => id !== request.actorId);
      return { name: "vote", args: { target_id: target ?? request.actorId, abstain: false } };
    }
    if (request.allowedTools.includes("speak")) {
      if (request.context?.trigger === "last_words") {
        return { name: "speak", args: { text: `遗言_${request.actorId}` } };
      }
      return { name: "speak", args: { text: `发言_${request.actorId}` } };
    }
    return null;
  }
}

describe("first day flow order", () => {
  test("day1 should elect sheriff before announcing previous night deaths", async () => {
    const context = bootstrapGame(twelvePlayerStandardConfig);
    const sheriffCandidateId = 1;
    const provider = new DeterministicFlowProvider(context.world, sheriffCandidateId);

    await context.phaseManager.runSingleCycle(provider, 10);

    const events = context.phaseManager.getEvents();
    const firstDayPhaseIndex = events.findIndex(
      (event) =>
        event.type === "phase_changed" &&
        event.payload.phase === Phase.Day &&
        Number(event.payload.day) === 1,
    );
    const sheriffElectedIndex = events.findIndex((event) => event.type === "sheriff_elected");
    const nightResolvedIndex = events.findIndex((event) => event.type === "night_resolved");
    const lastWordsGrantedIndex = events.findIndex((event) => event.type === "last_words_granted");
    const sheriffDirectionIndex = events.findIndex(
      (event) => event.type === "sheriff_direction_chosen",
    );

    expect(firstDayPhaseIndex).toBeGreaterThanOrEqual(0);
    expect(sheriffElectedIndex).toBeGreaterThanOrEqual(0);
    expect(nightResolvedIndex).toBeGreaterThanOrEqual(0);
    expect(lastWordsGrantedIndex).toBeGreaterThanOrEqual(0);
    expect(sheriffDirectionIndex).toBeGreaterThanOrEqual(0);

    expect(firstDayPhaseIndex).toBeLessThan(sheriffElectedIndex);
    expect(sheriffElectedIndex).toBeLessThan(nightResolvedIndex);
    expect(nightResolvedIndex).toBeLessThan(lastWordsGrantedIndex);
    expect(lastWordsGrantedIndex).toBeLessThan(sheriffDirectionIndex);
  });
});
