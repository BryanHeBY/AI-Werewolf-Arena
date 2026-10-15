/** 负责典狱长首个原十二人固定闭包；输入纯配置，输出是否支持的布尔值，拒绝额外高级机制及未知规则混搭，不授运行许可。 */
import { copyEventData } from "@ai-werewolf-arena/game-contract";
export function isWardenPreset(input: unknown): boolean {
  try {
    const c = copyEventData(input) as Record<string, unknown>,
      r = c.roleSetups as Array<{ role: string; count: number }>;
    const roles = { wolf: 3, villager: 4, seer: 1, witch: 1, hunter: 1, dreamer: 1, warden: 1 };
    const allowed = new Set([
      "boardSize",
      "enableSheriff",
      "initialSheriffSeat",
      "winConditions",
      "winCondition",
      "hooks",
      "selfDestruct",
      "sheriff",
      "witch",
      "seer",
      "hunter",
      "dreamer",
      "tieBreaker",
      "voting",
      "disclosure",
      "lastWords",
      "roleSetups",
      "warden",
    ]);
    const w = c.warden as Record<string, unknown> | undefined;
    return (
      c.boardSize === 12 &&
      Object.keys(c).every((k) => allowed.has(k)) &&
      Array.isArray(r) &&
      r.length === 7 &&
      new Set(r.map((x) => x.role)).size === 7 &&
      r.every(
        (x) => Object.hasOwn(roles, x.role) && roles[x.role as keyof typeof roles] === x.count,
      ) &&
      JSON.stringify(c.winConditions ?? [c.winCondition]) === '["slaughter_side"]' &&
      (c.winCondition === undefined || c.winCondition === "slaughter_side") &&
      (c.voting as { exilePolicy?: string })?.exilePolicy === "awa_one_pk_v1" &&
      w?.policy === "awa_melbourne_warden_v1" &&
      w.forcePolicy === "awa_warden_partner_native_v1"
    );
  } catch {
    return false;
  }
}
