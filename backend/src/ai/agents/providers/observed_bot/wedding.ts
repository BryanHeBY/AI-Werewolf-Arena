import type { ObservedToolHandler } from "./context";
export const choose_bridegroom: ObservedToolHandler = ({ others, pick }) => {
  const target = pick(others);
  return target === undefined ? null : { name: "choose_bridegroom", args: { target_id: target } };
};
export const speak_to_partner: ObservedToolHandler = () => ({
  name: "speak_to_partner",
  args: { text: "" },
});
export const choose_wedding_witness: ObservedToolHandler = ({
  request,
  ownState,
  others,
  pick,
}) => {
  const wedding = ownState.wedding;
  if (!wedding || wedding.member === "witness") return null;
  const target =
    request.context.proposedWitnessId ?? pick(others.filter((id) => id !== wedding.partnerId));
  return target === undefined
    ? null
    : { name: "choose_wedding_witness", args: { target_id: target } };
};
export const wedding_kill_vote: ObservedToolHandler = ({ ownState, others, pick }) => {
  const wedding = ownState.wedding;
  if (!wedding?.canKnife) return null;
  const target = pick(
    others.filter((id) => wedding.member === "witness" || id !== wedding.partnerId),
  );
  return {
    name: "wedding_kill_vote",
    args: { target_id: target ?? null, abstain: target === undefined },
  };
};
