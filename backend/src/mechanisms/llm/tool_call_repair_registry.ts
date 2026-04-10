import { EntityId, PotionType, ToolCall, ToolName } from "../../domain/model";
import { World } from "../../domain/world";

interface RecoverContext {
  actorId: EntityId;
  world: World;
  toSpeakText: (text: string) => string;
}

interface CoerceContext {
  actorId: EntityId;
}

type CoerceHandler = (
  args: Record<string, unknown>,
  ctx: CoerceContext,
) => Record<string, unknown> | null;

type RecoverHandler = (
  text: string,
  ctx: RecoverContext,
) => ToolCall | null;

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function pickAliveNotSelf(world: World, actorId: EntityId): EntityId | null {
  const target = world.getAliveEntityIds().find((id) => id !== actorId);
  return target ?? null;
}

function extractTargetId(text: string, actorId: EntityId): EntityId | null {
  const patterns = [
    /target[_\s-]*id[^0-9]*(\d+)/gi,
    /目标[^0-9]*(\d+)/gi,
    /player[^0-9]*(\d+)/gi,
    /玩家[^0-9]*(\d+)/gi,
  ];
  for (const pattern of patterns) {
    let match: RegExpExecArray | null = null;
    while ((match = pattern.exec(text)) !== null) {
      const candidate = Number(match[1]);
      if (Number.isFinite(candidate) && candidate !== actorId) {
        return candidate;
      }
    }
  }
  return null;
}

function extractPotion(text: string): PotionType {
  const lower = text.toLowerCase();
  if (
    lower.includes(PotionType.Poison) ||
    lower.includes("毒") ||
    lower.includes("poison")
  ) {
    return PotionType.Poison;
  }
  if (
    lower.includes(PotionType.Heal) ||
    lower.includes("救") ||
    lower.includes("heal")
  ) {
    return PotionType.Heal;
  }
  return PotionType.None;
}

const COERCE_HANDLERS: Partial<Record<ToolName, CoerceHandler>> = {
  check_identity: (args) => {
    const target = numberOrNull(args.target_id);
    if (target === null) {
      return null;
    }
    return { target_id: target };
  },
  shoot: (args) => {
    const target = numberOrNull(args.target_id);
    if (target === null) {
      return null;
    }
    return { target_id: target };
  },
  guard: (args) => {
    const abstain = Boolean(args.abstain);
    if (abstain) {
      return { target_id: null, abstain: true };
    }
    const target = numberOrNull(args.target_id);
    if (target === null) {
      return null;
    }
    return { target_id: target, abstain: false };
  },
  vote: (args) => {
    const abstain = Boolean(args.abstain);
    if (abstain) {
      return { target_id: null, abstain: true };
    }
    const target = numberOrNull(args.target_id);
    if (target === null) {
      return null;
    }
    return { target_id: target, abstain: false };
  },
  kill_vote: (args) => {
    const abstain = Boolean(args.abstain);
    if (abstain) {
      return { target_id: null, abstain: true };
    }
    const target = numberOrNull(args.target_id);
    if (target === null) {
      return null;
    }
    return { target_id: target, abstain: false };
  },
  use_potion: (args) => {
    const target = numberOrNull(args.target_id);
    if (target === null) {
      return null;
    }
    if (
      ![PotionType.Heal, PotionType.Poison, PotionType.None].includes(
        args.potion_type as PotionType,
      )
    ) {
      return null;
    }
    return {
      target_id: target,
      potion_type: args.potion_type,
    };
  },
  choose_direction: (args) => {
    const direction = String(args.direction ?? "");
    if (!["clockwise", "counter_clockwise"].includes(direction)) {
      return null;
    }
    return { direction };
  },
  speak_to_wolves: (args) => {
    return {
      text: String(args.text ?? ""),
      end_chat: Boolean(args.end_chat),
    };
  },
  speak: (args) => ({ text: String(args.text ?? "") }),
  self_destruct: (args) => ({ reason: String(args.reason ?? "self_destruct") }),
};

const RECOVER_HANDLERS: Partial<Record<ToolName, RecoverHandler>> = {
  speak_to_wolves: (text, ctx) => {
    const lower = text.toLowerCase();
    const shouldEndChat =
      lower.includes("结束夜聊") ||
      lower.includes("结束群聊") ||
      lower.includes("停止夜聊") ||
      lower.includes("end_chat");
    return {
      name: "speak_to_wolves",
      args: {
        text: ctx.toSpeakText(text),
        end_chat: shouldEndChat,
      },
    };
  },
  speak: (text, ctx) => ({
    name: "speak",
    args: {
      text: ctx.toSpeakText(text),
    },
  }),
  choose_direction: (text) => {
    const lower = text.toLowerCase();
    const direction =
      lower.includes("counter_clockwise") ||
      lower.includes("counterclockwise") ||
      lower.includes("逆时针") ||
      lower.includes("警右")
        ? "counter_clockwise"
        : "clockwise";
    return {
      name: "choose_direction",
      args: { direction },
    };
  },
  self_destruct: () => ({
    name: "self_destruct",
    args: { reason: "recovered_from_reasoning_text" },
  }),
  use_potion: (text, ctx) => {
    const targetId = extractTargetId(text, ctx.actorId);
    const fallbackTarget = pickAliveNotSelf(ctx.world, ctx.actorId);
    return {
      name: "use_potion",
      args: {
        target_id: targetId ?? fallbackTarget ?? ctx.actorId,
        potion_type: extractPotion(text),
      },
    };
  },
  kill_vote: (text, ctx) => {
    const lower = text.toLowerCase();
    const abstain =
      lower.includes("不刀") ||
      lower.includes("弃刀") ||
      lower.includes("不投刀") ||
      lower.includes("abstain");
    if (abstain) {
      return {
        name: "kill_vote",
        args: { target_id: null, abstain: true },
      };
    }
    const targetId = extractTargetId(text, ctx.actorId);
    const resolvedTarget = targetId ?? pickAliveNotSelf(ctx.world, ctx.actorId);
    if (resolvedTarget === null) {
      return {
        name: "kill_vote",
        args: { target_id: null, abstain: true },
      };
    }
    return {
      name: "kill_vote",
      args: { target_id: resolvedTarget, abstain: false },
    };
  },
  guard: (text, ctx) => {
    const lower = text.toLowerCase();
    const abstain =
      lower.includes("空守") ||
      lower.includes("不守") ||
      lower.includes("abstain");
    if (abstain) {
      return {
        name: "guard",
        args: { target_id: null, abstain: true },
      };
    }
    const targetId = extractTargetId(text, ctx.actorId);
    const resolvedTarget = targetId ?? pickAliveNotSelf(ctx.world, ctx.actorId);
    if (resolvedTarget === null) {
      return {
        name: "guard",
        args: { target_id: null, abstain: true },
      };
    }
    return {
      name: "guard",
      args: { target_id: resolvedTarget, abstain: false },
    };
  },
  vote: (text, ctx) => {
    const lower = text.toLowerCase();
    const abstain =
      lower.includes("弃票") ||
      lower.includes("不投票") ||
      lower.includes("abstain");
    if (abstain) {
      return {
        name: "vote",
        args: { target_id: null, abstain: true },
      };
    }
    const targetId = extractTargetId(text, ctx.actorId);
    const resolvedTarget = targetId ?? pickAliveNotSelf(ctx.world, ctx.actorId);
    if (resolvedTarget === null) {
      return {
        name: "vote",
        args: { target_id: null, abstain: true },
      };
    }
    return {
      name: "vote",
      args: { target_id: resolvedTarget, abstain: false },
    };
  },
  check_identity: (text, ctx) => {
    const targetId = extractTargetId(text, ctx.actorId);
    const resolvedTarget = targetId ?? pickAliveNotSelf(ctx.world, ctx.actorId);
    if (resolvedTarget === null) {
      return null;
    }
    return {
      name: "check_identity",
      args: { target_id: resolvedTarget },
    };
  },
  shoot: (text, ctx) => {
    const targetId = extractTargetId(text, ctx.actorId);
    const resolvedTarget = targetId ?? pickAliveNotSelf(ctx.world, ctx.actorId);
    if (resolvedTarget === null) {
      return null;
    }
    return {
      name: "shoot",
      args: { target_id: resolvedTarget },
    };
  },
};

export class ToolCallRepairRegistry {
  coerceArgs(
    tool: ToolName,
    rawArgs: Record<string, unknown>,
    ctx: CoerceContext,
  ): Record<string, unknown> | null {
    const handler = COERCE_HANDLERS[tool];
    if (!handler) {
      return { ...rawArgs };
    }
    return handler(rawArgs, ctx);
  }

  recover(
    tool: ToolName,
    text: string,
    ctx: RecoverContext,
  ): ToolCall | null {
    const handler = RECOVER_HANDLERS[tool];
    if (!handler) {
      return null;
    }
    return handler(text, ctx);
  }
}

let defaultRegistry: ToolCallRepairRegistry | null = null;

export function getDefaultToolCallRepairRegistry(): ToolCallRepairRegistry {
  if (!defaultRegistry) {
    defaultRegistry = new ToolCallRepairRegistry();
  }
  return defaultRegistry;
}
