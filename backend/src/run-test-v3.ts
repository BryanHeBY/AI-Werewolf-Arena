import {
  ActionProvider,
  ActionRequest,
  Camp,
  Phase,
  Role,
  ToolCall,
} from "./domain/model";
import { COMPONENT } from "./domain/components/names";
import { RoleComponent } from "./domain/components/role";
import { bootstrapGame } from "./app/bootstrap";
import { sixPlayerMvpConfig } from "./scenarios/six_player_mvp";

class HeuristicActionProvider implements ActionProvider {
  constructor(private readonly context: ReturnType<typeof bootstrapGame>) {}

  async getAction(request: ActionRequest): Promise<ToolCall | null> {
    const { world } = this.context;
    const role = world.getComponent<RoleComponent>(request.actorId, COMPONENT.Role);

    if (!role) {
      return null;
    }

    if (request.phase === Phase.Night) {
      if (request.allowedTools.includes("kill_vote") && role.role === Role.Wolf) {
        const target = world.getAliveEntityIds().find((id) => {
          const targetRole = world.getComponent<RoleComponent>(id, COMPONENT.Role);
          return id !== request.actorId && targetRole?.camp !== Camp.Wolf;
        });
        return target ? { name: "kill_vote", args: { target_id: target } } : null;
      }

      if (request.allowedTools.includes("guard") && role.role === Role.Guard) {
        const target = world.getAliveEntityIds().find((id) => id !== request.actorId);
        return target ? { name: "guard", args: { target_id: target } } : null;
      }

      if (
        request.allowedTools.includes("check_identity") &&
        role.role === Role.Seer
      ) {
        const target = world.getAliveEntityIds().find((id) => id !== request.actorId);
        return target ? { name: "check_identity", args: { target_id: target } } : null;
      }
    }

    if (request.phase === Phase.Day && request.allowedTools.includes("speak")) {
      return {
        name: "speak",
        args: {
          text: `我是${request.actorId}号，继续观察。`,
        },
      };
    }

    if (request.phase === Phase.Voting && request.allowedTools.includes("vote")) {
      const alive = world.getAliveEntityIds();
      const voteTarget = alive.find((id) => id !== request.actorId);
      return voteTarget ? { name: "vote", args: { target_id: voteTarget } } : null;
    }

    return null;
  }
}

async function main(): Promise<void> {
  const context = bootstrapGame(sixPlayerMvpConfig);
  const actionProvider = new HeuristicActionProvider(context);

  const snapshot = await context.phaseManager.runUntilGameOver(actionProvider, 8);
  const events = context.phaseManager.getEvents();

  console.log("V3 snapshot:", snapshot);
  console.log("V3 events:", events.length);
  console.log(JSON.stringify(events.slice(-8), null, 2));
}

main().catch((error) => {
  console.error("run-test-v3 failed", error);
  throw error;
});
