import { EntityId, ToolCall, ToolName } from "../../domain/model";
import { World } from "../../domain/world";

export interface RecoverContext {
  actorId: EntityId;
  world: World;
  toSpeakText: (text: string) => string;
}

export interface CoerceContext {
  actorId: EntityId;
}

export type CoerceHandler = (
  args: Record<string, unknown>,
  ctx: CoerceContext,
) => Record<string, unknown> | null;

export type RecoverHandler = (
  text: string,
  ctx: RecoverContext,
) => ToolCall | null;

export interface ToolRepairPack {
  coerce: Partial<Record<ToolName, CoerceHandler>>;
  recover: Partial<Record<ToolName, RecoverHandler>>;
}
