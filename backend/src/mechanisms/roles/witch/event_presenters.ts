/** 文件说明：女巫相关事件在不同输出通道中的渲染实现。 */
import { AgentEventLineHandler } from "../../broadcast/contracts";
import { ScriptLiveRenderHandler } from "../../script/contracts";
import { RealtimeEventHandler } from "../../session/contracts";
import { RealtimeGameEvent } from "../../../infra/transport/broadcaster";

/** 女巫事件 -> 玩家广播行映射。 */
export const WITCH_AGENT_EVENT_LINE_HANDLERS: Record<string, AgentEventLineHandler> = {
  witch_potion_used: (event, ctx) => {
    const p = event.payload as Record<string, any>;
    if (Number(p.actorId) !== ctx.actorId) {
      return null;
    }
    return `[私有][女巫] 你对${p.targetId}号使用了${p.potionType}`;
  },
  witch_potion_skipped: (event, ctx) => {
    const p = event.payload as Record<string, any>;
    if (Number(p.actorId) !== ctx.actorId) {
      return null;
    }
    return `[私有][女巫] 你本夜未用药`;
  },
};

/** 女巫事件 -> 终端 live 渲染映射。 */
export const WITCH_SCRIPT_LIVE_HANDLERS: Record<string, ScriptLiveRenderHandler> = {
  witch_potion_used: (event) => [
    {
      kind: "private",
      text: `[live][行动][女巫] ${event.payload.actorId}号对${event.payload.targetId}号使用${event.payload.potionType}`,
    },
  ],
  witch_potion_skipped: (event) => [
    {
      kind: "private",
      text: `[live][行动][女巫] ${event.payload.actorId}号本夜未用药`,
    },
  ],
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

/** 女巫事件 -> 实时推送事件映射。 */
export const WITCH_REALTIME_EVENT_HANDLERS: Record<string, RealtimeEventHandler> = {
  witch_potion_used: (event) => {
    const actorId = Number(event.payload.actorId);
    return [
      privateTargetsEvent(
        "witch_potion_used",
        {
          actorId,
          targetId: Number(event.payload.targetId),
          potionType: String(event.payload.potionType ?? ""),
        },
        [actorId],
        event.timestamp,
      ),
    ];
  },
  witch_potion_skipped: (event) => {
    const actorId = Number(event.payload.actorId);
    return [
      privateTargetsEvent(
        "witch_potion_skipped",
        {
          actorId,
          targetId:
            event.payload.targetId === null || event.payload.targetId === undefined
              ? null
              : Number(event.payload.targetId),
          potionType: "none",
        },
        [actorId],
        event.timestamp,
      ),
    ];
  },
};
