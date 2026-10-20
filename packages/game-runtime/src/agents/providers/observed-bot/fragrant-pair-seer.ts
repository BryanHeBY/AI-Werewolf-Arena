/**
 * 负责从本次请求的候选 DTO 选择寻香绑定或查验二人组；输入为已告知名单、风格与原随机选择器。
 * 输出为两编号、绑定的明确空选择或原候选缺失错误；不读取引擎身份、关系原体或未告知阵营。
 * 选择名单只是观察依据，不能代替本族请求原体、二人组当前性和实际提交／付款检查。
 */
import type { ObservedToolHandler } from "./context";
/** 只消费本次观察携带的名单；绑定可明确不选，查验缺任一目标则保留原错误。 */
export const bindFragrantPair: ObservedToolHandler = ({ request, pick, style, random }) => {
  const ids = [...(request.context.fragrant_pair_candidates ?? [])];
  if (style === "conservative" || (style === "random" && random.next() < 0.35) || ids.length < 2)
    return { name: "bind_fragrant_pair", args: { target_ids: null } };
  // 依次抽第一人、排除第一人再抽第二人；原空选择和随机流消费不改。
  const first = pick(ids)!,
    second = pick(ids.filter((id) => id !== first))!;
  return { name: "bind_fragrant_pair", args: { target_ids: [first, second] } };
};
export const inspectPair: ObservedToolHandler = ({ request, pick }) => {
  const ids = [...(request.context.pair_check_candidates ?? [])],
    first = pick(ids),
    second = pick(ids.filter((id) => id !== first));
  // 查验不是可弃权的绑定选择；两个抽取完成后才判断缺失，不补选或掩盖错误。
  if (first === undefined || second === undefined) throw Error("observed_pair_candidates_missing");
  return { name: "check_pair", args: { target_ids: [first, second] } };
};
