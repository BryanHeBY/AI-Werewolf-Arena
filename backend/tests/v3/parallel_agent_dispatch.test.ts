import { bootstrapGame } from "../../src/app/bootstrap";
import {
  ActionProvider,
  ActionRequest,
  Phase,
  ToolCall,
} from "../../src/domain/model";
import { EventRegistry } from "../../src/engine/event_registry";
import { DayPipeline } from "../../src/engine/phase_pipeline/day_pipeline";
import { VotingPipeline } from "../../src/engine/phase_pipeline/voting_pipeline";
import { ToolGateway } from "../../src/gateway/tool_gateway";
import { twelvePlayerStandardConfig } from "../../src/scenarios/twelve_player_standard";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("parallel agent dispatch", () => {
  test("voting requests are dispatched in parallel", async () => {
    const config = {
      ...twelvePlayerStandardConfig,
      hooks: {
        ...twelvePlayerStandardConfig.hooks,
        onPreVote: false,
      },
    };
    const context = bootstrapGame(config);
    const events: any[] = [];
    const votingPipeline = new VotingPipeline(
      context.world,
      new ToolGateway(),
      new EventRegistry(),
      events,
    );

    let activeVotes = 0;
    let maxConcurrentVotes = 0;
    const provider: ActionProvider = {
      async getAction(request: ActionRequest): Promise<ToolCall | null> {
        if (request.phase !== Phase.Voting || !request.allowedTools.includes("vote")) {
          return null;
        }
        activeVotes += 1;
        maxConcurrentVotes = Math.max(maxConcurrentVotes, activeVotes);
        await sleep(30);
        activeVotes -= 1;
        const target = request.actorId === 1 ? 2 : 1;
        return { name: "vote", args: { target_id: target, abstain: false } };
      },
    };

    const result = await votingPipeline.execute(config, provider);
    expect(result.interrupted).toBe(false);
    expect(maxConcurrentVotes).toBeGreaterThan(1);
  });

  test("wolf self-destruct window requests are dispatched in parallel", async () => {
    const config = {
      ...twelvePlayerStandardConfig,
      hooks: {
        ...twelvePlayerStandardConfig.hooks,
        onDaybreak: true,
        onPreElection: false,
        onPerSpeechGap: false,
      },
    };
    const context = bootstrapGame(config);
    const events: any[] = [];
    const dayPipeline = new DayPipeline(context.world, new ToolGateway(), events);

    let activeSelfDestruct = 0;
    let maxConcurrentSelfDestruct = 0;
    const provider: ActionProvider = {
      async getAction(request: ActionRequest): Promise<ToolCall | null> {
        if (request.allowedTools.includes("choose_direction")) {
          return { name: "choose_direction", args: { direction: "clockwise" } };
        }
        if (request.allowedTools.includes("self_destruct")) {
          activeSelfDestruct += 1;
          maxConcurrentSelfDestruct = Math.max(
            maxConcurrentSelfDestruct,
            activeSelfDestruct,
          );
          await sleep(30);
          activeSelfDestruct -= 1;
          return null;
        }
        if (request.allowedTools.includes("speak")) {
          return { name: "speak", args: { text: `发言_${request.actorId}` } };
        }
        return null;
      },
    };

    const result = await dayPipeline.execute(config, provider);
    expect(result.interrupted).toBe(false);
    expect(maxConcurrentSelfDestruct).toBeGreaterThan(1);
  });
});
