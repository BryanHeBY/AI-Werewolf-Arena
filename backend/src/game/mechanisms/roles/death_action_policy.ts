import { z } from "zod";
import {
  DEATH_ACTION_POLICIES,
  WOLF_KING_DEATH_ACTION_POLICIES,
  type BoardConfig,
  type DeathActionPolicy,
} from "../../../core/domain/board";
import { text, type Locale } from "@ai-werewolf-arena/game-text";
import type { RoleProfile } from "./contracts";
export const DEFAULT_DEATH_ACTION_POLICY: DeathActionPolicy = "awa_qualified_sources_v1";
export function deathActionConfiguration(
  key: "hunter" | "wolfKing",
): NonNullable<RoleProfile["configuration"]> {
  const schema = z.strictObject({
    deathActionPolicy: z
      .enum(key === "wolfKing" ? WOLF_KING_DEATH_ACTION_POLICIES : DEATH_ACTION_POLICIES)
      .default(DEFAULT_DEATH_ACTION_POLICY),
  });
  return {
    schema,
    defaults: schema.parse({}),
    apply: (config, value) => ({ ...config, [key]: schema.parse(value) }),
    serialize: (config: BoardConfig) => schema.parse(config[key] ?? {}),
  };
}
export function renderDeathActionPolicy(
  policy: DeathActionPolicy | undefined,
  locale: Locale,
): string {
  return text(
    locale,
    policy === "awa_day_deaths_v1"
      ? "role.death_action.day_deaths"
      : policy === "awa_knife_or_exile_v1"
        ? "role.death_action.knife_exile"
        : "role.death_action.qualified",
  );
}
