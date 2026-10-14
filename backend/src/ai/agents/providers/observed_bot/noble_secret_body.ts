/**
 * 负责夜仆与秘密之身的观察选择；输入为本次请求名单、已知队友、自己的编号和策略风格。
 * 输出为具名动作及可空目标；队友仅是本玩家知识，用于竞争型偏好，不据此判定对手真实阵营。
 * 只读本次已告知候选，不访问关系或库存原体；夜仆／护身当前性与实际效果仍由机制提交检查。
 */
import type { ObservedToolHandler } from "./context";

/** 竞争型仅从请求名单排除已知队友；未知实际阵营不补判，筛选也不产生行动许可。 */
export const chooseServant: ObservedToolHandler = ({
  request,
  teammateIds,
  pick,
  style,
  random,
}) => {
  const candidates = [...(request.context.servant_candidates ?? [])],
    eligible =
      style === "competitive" ? candidates.filter((id) => !teammateIds.includes(id)) : candidates;
  return {
    name: "choose_servant",
    args: {
      target_id:
        style === "conservative" || (style === "random" && random.next() < 0.35)
          ? null
          : (pick(eligible) ?? null),
    },
  };
};

export const protectSecretBody: ObservedToolHandler = ({ request, actor, pick, style, random }) => {
  // 竞争型仅在本次名单已包含自己时优先护自己，否则按原选择器抽取；不扩大候选名单。
  const candidates = [...(request.context.secret_body_candidates ?? [])];
  return {
    name: "protect_secret_body",
    args: {
      target_id:
        style === "conservative" || (style === "random" && random.next() < 0.35)
          ? null
          : style === "competitive" && candidates.includes(actor)
            ? actor
            : (pick(candidates) ?? null),
    },
  };
};
