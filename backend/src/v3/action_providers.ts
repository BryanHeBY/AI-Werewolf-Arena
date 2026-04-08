import { COMPONENT } from "../domain/components/names";
import { RoleComponent } from "../domain/components/role";
import {
  ActionProvider,
  ActionRequest,
  Camp,
  EntityId,
  Phase,
  Role,
  ToolCall,
} from "../domain/model";
import { World } from "../domain/world";

export class NoopActionProvider implements ActionProvider {
  async getAction(_request: ActionRequest): Promise<ToolCall | null> {
    return null;
  }
}

export interface ScriptedEntry {
  match: (request: ActionRequest) => boolean;
  action: ToolCall | null;
}

export class ScriptedActionProvider implements ActionProvider {
  private readonly entries: ScriptedEntry[];

  constructor(entries: ScriptedEntry[]) {
    this.entries = [...entries];
  }

  async getAction(request: ActionRequest): Promise<ToolCall | null> {
    const index = this.entries.findIndex((entry) => entry.match(request));
    if (index === -1) {
      return null;
    }

    const [entry] = this.entries.splice(index, 1);
    return entry.action;
  }
}

export class BaselineBotActionProvider implements ActionProvider {
  constructor(private readonly world: World) {}

  async getAction(request: ActionRequest): Promise<ToolCall | null> {
    const role = this.world.getComponent<RoleComponent>(request.actorId, COMPONENT.Role);
    if (!role) {
      return null;
    }

    if (request.allowedTools.includes("choose_direction")) {
      return {
        name: "choose_direction",
        args: {
          direction: request.actorId % 2 === 0 ? "clockwise" : "counter_clockwise",
        },
      };
    }

    if (request.phase === Phase.Night) {
      if (request.allowedTools.includes("speak_to_wolves") && role.role === Role.Wolf) {
        return {
          name: "speak_to_wolves",
          args: {
            text: "今晚优先刀信息位。",
          },
        };
      }

      if (request.allowedTools.includes("kill_vote") && role.role === Role.Wolf) {
        const target = this.pickAliveByCamp(request.actorId, Camp.Good);
        return target !== null ? { name: "kill_vote", args: { target_id: target } } : null;
      }

      if (request.allowedTools.includes("guard") && role.role === Role.Guard) {
        const target = this.pickAliveNotSelf(request.actorId);
        return target !== null ? { name: "guard", args: { target_id: target } } : null;
      }

      if (request.allowedTools.includes("check_identity") && role.role === Role.Seer) {
        const target = this.pickAliveNotSelf(request.actorId);
        return target !== null ? { name: "check_identity", args: { target_id: target } } : null;
      }
    }

    if (request.phase === Phase.Day && request.allowedTools.includes("speak")) {
      return {
        name: "speak",
        args: {
          text: `我是${request.actorId}号，先听后位发言再判断。`,
        },
      };
    }

    if (request.phase === Phase.Voting && request.allowedTools.includes("vote")) {
      const target = this.pickAliveNotSelf(request.actorId);
      return target !== null ? { name: "vote", args: { target_id: target } } : null;
    }

    if (request.allowedTools.includes("shoot")) {
      const target = this.pickAliveNotSelf(request.actorId);
      return target !== null ? { name: "shoot", args: { target_id: target } } : null;
    }

    return null;
  }

  private pickAliveNotSelf(actorId: EntityId): EntityId | null {
    const target = this.world.getAliveEntityIds().find((id) => id !== actorId);
    return target ?? null;
  }

  private pickAliveByCamp(actorId: EntityId, camp: Camp): EntityId | null {
    const target = this.world.getAliveEntityIds().find((id) => {
      const role = this.world.getComponent<RoleComponent>(id, COMPONENT.Role);
      return id !== actorId && role?.camp === camp;
    });
    return target ?? this.pickAliveNotSelf(actorId);
  }
}
