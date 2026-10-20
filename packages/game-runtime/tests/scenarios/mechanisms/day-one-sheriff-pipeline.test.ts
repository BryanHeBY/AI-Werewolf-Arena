/**
 * 警长场景验证真实首日竞选输入、候选、投票及公开结果，保留原 describe 前缀。
 * 输入为原十二人 World 及受控完整 DayPipeline 回复。
 * 输出与预期为精确投票行动者、可见信息及当选持徽者，保留原因果边界，不重新生成预期结果。
 */
import { bootstrapGame } from "../../../src/app/bootstrap";
import { ActionProvider, ActionRequest, ToolCall, Phase } from "../../../src/domain/model";
import { DayPipeline } from "../../../src/engine/phases/day-pipeline";
import { ToolGateway } from "../../../src/engine/actions/tool-gateway";
import { createDefaultRoleRegistry } from "../../../src/rulesets/mechanism-api";
import { twelvePlayerStandardConfig } from "../../../src/rulesets/presets/twelve-player-standard";

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
