import { AgentEventLineHandler } from "../../broadcast/contracts";
import { ScriptLiveRenderHandler } from "../../script/contracts";
import { RealtimeEventHandler } from "../../session/contracts";
import { RealtimeGameEvent } from "../../../infra/transport/broadcaster";

export const GUARD_AGENT_EVENT_LINE_HANDLERS: Record<string, AgentEventLineHandler> = {
  guard_applied: (event, ctx) => {
    const p = event.payload as Record<string, any>;
    if (Number(p.actorId) !== ctx.actorId) {
      return null;
    }
    if (p.abstain === true || p.targetId === null || p.targetId === undefined) {
      return `[私有][守卫] 你本轮选择空守`;
    }
    return `[私有][守卫] 你守护了${p.targetId}号`;
  },
};

export const GUARD_SCRIPT_LIVE_HANDLERS: Record<string, ScriptLiveRenderHandler> = {
  guard_applied: (event) => {
    if (event.payload.abstain === true || event.payload.targetId === null) {
      return [{ kind: "action", text: `[live][行动][守卫] ${event.payload.actorId}号空守` }];
    }
    return [
      {
        kind: "action",
        text: `[live][行动][守卫] ${event.payload.actorId}号守护${event.payload.targetId}号`,
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

export const GUARD_REALTIME_EVENT_HANDLERS: Record<string, RealtimeEventHandler> = {
  guard_applied: (event) => {
    const actorId = Number(event.payload.actorId);
    const abstain = Boolean(event.payload.abstain);
    return [
      privateTargetsEvent(
        "guard_applied",
        {
          actorId,
          targetId:
            event.payload.targetId === null || event.payload.targetId === undefined
              ? null
              : Number(event.payload.targetId),
          abstain,
        },
        [actorId],
        event.timestamp,
      ),
    ];
  },
};

