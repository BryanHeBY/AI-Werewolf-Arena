/**
 * Sheriff scenario verifies actual first-day election feeds, candidates, voting and public result under the original describe prefix.
 * Input: Original twelve-player world and controlled complete DayPipeline responses.
 * Output and oracle: Exact vote actors, visible feeds and elected holder retain the original causal boundary; no expected result is regenerated.
 */
import { bootstrapGame } from "../../../src/app/bootstrap";
import { ActionProvider, ActionRequest, ToolCall, Phase } from "../../../src/domain/model";
import { DayPipeline } from "../../../src/game/engine/phase_pipeline/day_pipeline";
import { ToolGateway } from "../../../src/game/gateway/tool_gateway";
import { createDefaultRoleRegistry } from "../../../src/game/mechanisms";
import { twelvePlayerStandardConfig } from "../../../src/runtime/scenarios/twelve_player_standard";

describe("sheriff pipeline", () => {

  test("day pipeline elects sheriff on day 1", async () => {
    const { world } = bootstrapGame(twelvePlayerStandardConfig);
    const events: any[] = [
      { timestamp: Date.now(), type: "phase_changed", payload: { phase: Phase.Day, day: 1 } },
    ];
    const pipeline = new DayPipeline({
      world,
      roleRegistry: createDefaultRoleRegistry(),
      toolGateway: new ToolGateway(),
      events,
    });
    const voteStageFeeds: Array<Array<{ type: string }>> = [];
    const sheriffVoteActors: number[] = [];

    const actionProvider: ActionProvider = {
      async getAction(request: ActionRequest): Promise<ToolCall | null> {
        if (request.allowedTools.includes("run_for_sheriff")) {
          return {
            name: "run_for_sheriff",
            args: { run: request.actorId === 2 || request.actorId === 3 },
          };
        }
        if (request.allowedTools.includes("vote_for_sheriff")) {
          const feed = Array.isArray(request.context.visible_events)
            ? (request.context.visible_events as Array<{ type: string }>)
            : [];
          sheriffVoteActors.push(request.actorId);
          voteStageFeeds.push(feed);
          return { name: "vote_for_sheriff", args: { target_id: 2, abstain: false } };
        }
        if (request.allowedTools.includes("choose_direction")) {
          return { name: "choose_direction", args: { direction: "clockwise" } };
        }
        if (request.allowedTools.includes("self_destruct")) {
          return null;
        }
        if (request.allowedTools.includes("speak")) {
          return { name: "speak", args: { text: "ok" } };
        }
        return null;
      },
    };

    const result = await pipeline.execute(twelvePlayerStandardConfig, actionProvider, {
      day: 1,
    });
    expect(result.interrupted).toBe(false);
    const elected = events.find((event) => event.type === "sheriff_elected");
    expect(elected).toBeDefined();
    expect(Number(elected.payload.winnerId)).toBe(2);
    expect(voteStageFeeds.length).toBeGreaterThan(0);
    expect(sheriffVoteActors).not.toContain(2);
    expect(sheriffVoteActors).not.toContain(3);
    for (const feed of voteStageFeeds) {
      expect(feed.some((event) => event.type === "sheriff_vote_cast")).toBe(false);
    }
  });
});
