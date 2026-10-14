/**
 * 负责新郎、见证人、伴侣交流及婚约刀的观察选择；输入为自己的婚约视图、已公布存活列表和请求提名。
 * 输出为原动作或 null；成员／可刀字段是观察时点的知识，不是婚约绑定、原生命或当前请求许可。
 * 只做原伴侣排除与提名优先，不查询关系原体、真实阵营或改写婚约；提交及已付效果仍归婚约权威。
 */
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
  // 原空值优先级：已有提名直接用，只有未提名才从已知他人中排除伴侣后抽取。
  const target =
    request.context.proposedWitnessId ?? pick(others.filter((id) => id !== wedding.partnerId));
  return target === undefined
    ? null
    : { name: "choose_wedding_witness", args: { target_id: target } };
};
export const wedding_kill_vote: ObservedToolHandler = ({ ownState, others, pick }) => {
  const wedding = ownState.wedding;
  // 可刀提示只决定是否生成候选；见证人保留原不排除伴侣的分支，不在这里确认婚约当前性。
  if (!wedding?.canKnife) return null;
  const target = pick(
    others.filter((id) => wedding.member === "witness" || id !== wedding.partnerId),
  );
  return {
    name: "wedding_kill_vote",
    args: { target_id: target ?? null, abstain: target === undefined },
  };
};
