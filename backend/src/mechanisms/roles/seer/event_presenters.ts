import { AgentEventLineHandler } from "../../broadcast/contracts";
import { ScriptLiveRenderHandler } from "../../script/contracts";
import { RealtimeEventHandler } from "../../session/contracts";
import { RealtimeGameEvent } from "../../../infra/transport/broadcaster";

export const SEER_AGENT_EVENT_LINE_HANDLERS: Record<string, AgentEventLineHandler> = {
  seer_checked: (event, ctx) => {
    const p = event.payload as Record<string, any>;
    if (Number(p.actorId) !== ctx.actorId) {
      return null;
    }
    return `[私有][查验] 你查验${p.targetId}号 => ${p.isWerewolf ? "狼人" : "好人"}`;
  },
};

export const SEER_SCRIPT_LIVE_HANDLERS: Record<string, ScriptLiveRenderHandler> = {
  seer_checked: (event, printPrivateEvents) => {
    if (!printPrivateEvents) {
      return [];
    }
    return [
      {
        kind: "private",
        text: `[live][私有][查验] ${event.payload.actorId}号查验${event.payload.targetId}号 => ${event.payload.isWerewolf ? "狼人" : "好人"}`,
      },
    ];
  },
};

function privateTargetsEvent(
  type: string,
  data: Record<string, unknown>,
  targetPlayerIds: number[],
  timestamp: number,
): RealtimeGameEvent {
  return {
    type,
    timestamp,
    data,
    visibility: {
      scope: "private_targets",
      targetPlayerIds,
    },
  };
}

export const SEER_REALTIME_EVENT_HANDLERS: Record<string, RealtimeEventHandler> = {
  seer_checked: (event) => {
    const actorId = Number(event.payload.actorId);
    return [
      privateTargetsEvent(
        "seer_checked",
        {
          actorId,
          targetId: Number(event.payload.targetId),
          isWerewolf: Boolean(event.payload.isWerewolf),
        },
        [actorId],
        event.timestamp,
      ),
    ];
  },
};

