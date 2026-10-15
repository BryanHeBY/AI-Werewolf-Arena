/**
 * 负责夜之贵族／秘密之身 checkpoint 的严格档案格式。输入为未知归档数据；输出为原 Zod
 * schema 和 RecordedNobleBodyState 类型，保存真实资源、玩家知识、通知与每夜提交前缀。
 * 本模块是记录与核验共同消费的数据契约；不执行生产状态转换，不提供预期结果 oracle。
 * 独立账本推导归属与因果值，档案字段不能恢复生命原体、护身资源或请求授权。
 */
import { z } from "zod";
/** 原正整数上界及 nullable 选择保持；格式不在这里推导创建日、到期日或当前资格。 */
const positive = z
    .number()
    .int()
    .positive()
    .max(Number.MAX_SAFE_INTEGER - 2),
  day = positive;
const choice = z.strictObject({ day, targetId: positive.nullable() });
const contract = z.strictObject({
  id: z.string(),
  targetId: positive,
  createdNight: day,
  expiresNight: day,
  status: z.discriminatedUnion("kind", [
    z.strictObject({ kind: z.literal("pending") }),
    z.strictObject({ kind: z.enum(["cleared", "expired", "target_dead"]), day }),
  ]),
});
const wolfPolicy = z.enum(["standard", "no_blast_no_self_knife"]),
  repeatPolicy = z.enum(["awa_nonconsecutive_nights_v1", "awa_repeat_v1"]);
const cause = z.enum([
  "wolf_kill",
  "poison",
  "demon_hunt",
  "demon_hunt_backlash",
  "servant_expiry",
]);
const noble = z.strictObject({
  policy: z.literal("awa_noble_secret_body_v1"),
  wolfActionPolicy: wolfPolicy,
  lastChoice: choice.nullable(),
  contracts: z.array(contract),
});
const body = z.strictObject({
  policy: z.literal("awa_noble_secret_body_v1"),
  protectionRepeatPolicy: repeatPolicy,
  lastChoice: choice.nullable(),
  // 真实身体区分完整、夜间耗身与放逐揭示；已告知状态在下方独立保存，避免即时补发知识。
  body: z.discriminatedUnion("kind", [
    z.strictObject({ kind: z.literal("intact") }),
    z.strictObject({ kind: z.literal("night_spent"), day, targetId: positive, cause }),
    z.strictObject({ kind: z.literal("exile_revealed"), day }),
  ]),
});
const nobleKnown = z.strictObject({
  wolfActionPolicy: wolfPolicy,
  lastNotifiedNight: z.number().int().nonnegative(),
  lastChoice: choice.nullable(),
  contracts: z.array(contract),
});
const bodyKnown = z.strictObject({
  protectionRepeatPolicy: repeatPolicy,
  lastNotifiedNight: z.number().int().nonnegative(),
  lastChoice: choice.nullable(),
  resource: z.enum(["intact", "spent", "exile_revealed"]),
  publicRevealDay: day.nullable(),
});
export const nobleBodyCheckpointSchema = z.strictObject({
  nobleId: positive,
  bodyId: positive,
  noble,
  body,
  knowledge: z.strictObject({ noble: nobleKnown, body: bodyKnown }),
  // 通知保留当时的 actor／day／known 数据；不是查询当前真实库存生成的新通知。
  notices: z.array(
    z.discriminatedUnion("kind", [
      z.strictObject({ kind: z.literal("night_noble"), actorId: positive, day, known: nobleKnown }),
      z.strictObject({ kind: z.literal("secret_body"), actorId: positive, day, known: bodyKnown }),
    ]),
  ),
  // 必需发言的打开与完成分别归档，失败可保留 revealOpened=true、revealCompleted=false。
  nights: z.array(
    z.strictObject({
      day,
      status: z.enum(["open", "normal", "aborted"]),
      bodyChosen: z.boolean(),
      nobleChosen: z.boolean(),
      expiryProcessed: z.boolean(),
      bodyResolved: z.boolean(),
      revealOpened: z.boolean(),
      revealCompleted: z.boolean(),
    }),
  ),
});
export type RecordedNobleBodyState = z.infer<typeof nobleBodyCheckpointSchema>;
