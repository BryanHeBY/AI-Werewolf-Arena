/**
 * 负责受限观察机器人的传爪选择，只消费本轮公开给本人的候选、风格与本人随机流。
 * 输出明确目标或 null；不访问 World、真阵营、他人私态或付款权限。
 */
import type { ObservedToolHandler } from "./context";
export const bequeathClaw: ObservedToolHandler = ({ request, pick, style, random }) => {
  const candidates = request.context.claw_bequest_candidates;
  if (!candidates) throw new Error("awakened_claw_observation_missing");
  const pass = style === "conservative" || (style === "random" && random.next() < 0.35);
  return {
    name: "bequeath_claw",
    args: { target_id: pass ? null : (pick([...candidates]) ?? null) },
  };
};
