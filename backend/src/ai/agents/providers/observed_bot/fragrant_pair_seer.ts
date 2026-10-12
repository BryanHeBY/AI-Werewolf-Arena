import type { ObservedToolHandler } from "./context";
/** Strategies see only their issued candidate DTO; they never inspect engine identities. */
export const bindFragrantPair: ObservedToolHandler = ({ request, pick, style, random }) => {
  const ids = [...(request.context.fragrant_pair_candidates ?? [])];
  if (style === "conservative" || (style === "random" && random.next() < 0.35) || ids.length < 2)
    return { name: "bind_fragrant_pair", args: { target_ids: null } };
  const first = pick(ids)!,
    second = pick(ids.filter((id) => id !== first))!;
  return { name: "bind_fragrant_pair", args: { target_ids: [first, second] } };
};
export const inspectPair: ObservedToolHandler = ({ request, pick }) => {
  const ids = [...(request.context.pair_check_candidates ?? [])],
    first = pick(ids),
    second = pick(ids.filter((id) => id !== first));
  if (first === undefined || second === undefined) throw Error("observed_pair_candidates_missing");
  return { name: "check_pair", args: { target_ids: [first, second] } };
};
