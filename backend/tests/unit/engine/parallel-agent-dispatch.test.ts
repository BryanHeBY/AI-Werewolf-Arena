/**
 * Unit tests: Parallel action dispatch uses held in-memory provider replies; literal
 * concurrency and event-order assertions check that voter and self-destruct request timing
 * does not reorder committed facts. Inputs and expected outcomes remain the original
 * literal or immutable-fixture oracle; these module assertions invoke no model or
 * complete-game driver.
 */
import { bootstrapGame } from "../../../src/app/bootstrap";
import {
  ActionWindow,
  ActionProvider,
  ActionRequest,
  Phase,
  ToolCall,
} from "../../../src/domain/model";
import { EventRegistry } from "../../../src/engine/events/event-registry";
import { DayPipeline } from "../../../src/engine/phases/day-pipeline";
import { VotingPipeline } from "../../../src/engine/phases/voting-pipeline";
import { ToolGateway } from "../../../src/engine/actions/tool-gateway";
import { createDefaultRoleRegistry } from "../../../src/rulesets/mechanism-api";
import { twelvePlayerStandardConfig } from "../../../src/rulesets/presets/twelve-player-standard";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("parallel agent dispatch", () => {
  test("voting requests run in parallel while cast events retain voter order", async () => {
    const config = {
      ...twelvePlayerStandardConfig,
      hooks: {
        ...twelvePlayerStandardConfig.hooks,
        onPreVote: false,
      },
    };
    const context = bootstrapGame(config);
    const events: any[] = [];
    const votingPipeline = new VotingPipeline({
      world: context.world,
      roleRegistry: createDefaultRoleRegistry(),
      toolGateway: new ToolGateway(),
      eventRegistry: new EventRegistry(),
      events,
    });
    const voterIds = context.world.getAliveEntityIds();

    let activeVotes = 0;
    let maxConcurrentVotes = 0;
    const provider: ActionProvider = {
      async getAction(request: ActionRequest): Promise<ToolCall | null> {
        if (request.phase !== Phase.Voting || !request.allowedTools.includes("vote")) {
          return null;
        }
        activeVotes += 1;
        maxConcurrentVotes = Math.max(maxConcurrentVotes, activeVotes);
        await sleep(request.actorId === 1 ? 45 : 5);
        activeVotes -= 1;
        const target = request.actorId === 1 ? 2 : 1;
        return { name: "vote", args: { target_id: target, abstain: false } };
      },
    };

    const result = await votingPipeline.execute(config, provider, { day: 1 });
    expect(result.interrupted).toBe(false);
    expect(maxConcurrentVotes).toBeGreaterThan(1);
    expect(
      events.filter((event) => event.type === "vote_cast").map((event) => event.payload.actorId),
    ).toEqual(voterIds);
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
      selfDestruct: {
        enabledWindows: [ActionWindow.OnDaybreak],
      },
    };
    const context = bootstrapGame(config);
    const events: any[] = [];
    const dayPipeline = new DayPipeline({
      world: context.world,
      roleRegistry: createDefaultRoleRegistry(),
      toolGateway: new ToolGateway(),
      events,
    });

    let activeSelfDestruct = 0;
    let maxConcurrentSelfDestruct = 0;
    const provider: ActionProvider = {
      async getAction(request: ActionRequest): Promise<ToolCall | null> {
        if (request.allowedTools.includes("choose_direction")) {
          return { name: "choose_direction", args: { direction: "clockwise" } };
        }
        if (request.allowedTools.includes("self_destruct")) {
          activeSelfDestruct += 1;
          maxConcurrentSelfDestruct = Math.max(maxConcurrentSelfDestruct, activeSelfDestruct);
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

    const result = await dayPipeline.execute(config, provider, { day: 1 });
    expect(result.interrupted).toBe(false);
    expect(maxConcurrentSelfDestruct).toBeGreaterThan(1);
  });
});
