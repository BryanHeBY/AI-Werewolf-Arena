/** 文件说明：女巫相关事件在不同输出通道中的渲染实现。 */
import { AgentEventLineHandler } from "../../broadcast/contracts";
import { ScriptLiveRenderHandler } from "../../script/contracts";
import { RealtimeEventHandler } from "../../session/contracts";
import { makePrivateTargetsEvent } from "../../session/realtime_event_types";
import { getDefaultTextLocalizationRegistry } from "../../shared/text_localization_registry";

/** 女巫事件 -> 玩家广播行映射。 */
export const WITCH_AGENT_EVENT_LINE_HANDLERS: Record<string, AgentEventLineHandler> = {
  witch_potion_used: (event, ctx) => {
    const p = event.payload as Record<string, any>;
    if (Number(p.actorId) !== ctx.actorId) {
      return null;
    }
    return `[行动][女巫] ${p.actorId}号对${p.targetId}号使用${getDefaultTextLocalizationRegistry().potionType(String(p.potionType ?? ""))}`;
  },
  witch_potion_skipped: (event, ctx) => {
    const p = event.payload as Record<string, any>;
    if (Number(p.actorId) !== ctx.actorId) {
      return null;
    }
    return `[行动][女巫] ${p.actorId}号本夜未用药`;
  },
};

/** 女巫事件 -> 终端 live 渲染映射。 */
export const WITCH_SCRIPT_LIVE_HANDLERS: Record<string, ScriptLiveRenderHandler> = {
  witch_potion_used: (event) => [
    {
      kind: "private",
      text: `[live][行动][女巫] ${event.payload.actorId}号对${event.payload.targetId}号使用${getDefaultTextLocalizationRegistry().potionType(String(event.payload.potionType ?? ""))}`,
    },
  ],
  witch_potion_skipped: (event) => [
    {
      kind: "private",
      text: `[live][行动][女巫] ${event.payload.actorId}号本夜未用药`,
    },
  ],
};

/** 女巫事件 -> 实时推送事件映射。 */
export const WITCH_REALTIME_EVENT_HANDLERS: Record<string, RealtimeEventHandler> = {
  witch_potion_used: (event) => {
    const actorId = Number(event.payload.actorId);
    return [
      makePrivateTargetsEvent({
        category: "player_action",
        type:
          String(event.payload.potionType ?? "") === "poison"
            ? "player.action.poison"
            : "player.action.heal",
        timestamp: event.timestamp,
        actorId,
        targetIds: [Number(event.payload.targetId)],
        data: {
          actorId,
          targetId: Number(event.payload.targetId),
          potionType: String(event.payload.potionType ?? ""),
        },
        targetPlayerIds: [actorId],
      }),
    ];
  },
  witch_potion_skipped: (event) => {
    const actorId = Number(event.payload.actorId);
    return [
      makePrivateTargetsEvent({
        category: "player_action",
        type: "player.action.heal",
        timestamp: event.timestamp,
        actorId,
        targetIds: [],
        data: {
          actorId,
          targetId:
            event.payload.targetId === null || event.payload.targetId === undefined
              ? null
              : Number(event.payload.targetId),
          potionType: "none",
        },
        targetPlayerIds: [actorId],
      }),
    ];
  },
};
