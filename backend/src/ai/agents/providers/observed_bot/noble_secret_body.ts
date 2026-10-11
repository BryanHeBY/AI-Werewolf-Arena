import type { ObservedToolHandler } from "./context";

/** Legal options come only from this player's engine-issued candidate DTO. */
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
