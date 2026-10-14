/**
 * 负责寻香／双生 checkpoint 的严格档案形状。输入为未知归档数据；输出为原 Zod schema
 * 及 RecordedFragrantState 类型，保存真实关系、已告知知识与各夜提交前缀。
 * 本模块拥有格式声明，记录写方与独立核验共同消费；结构接受不证明账本因果正确。
 * 纯数据不携带运行组件、关系原体或行动许可，不能重建已关闭的窗口。
 */
import { z } from "zod";
import {
  FRAGRANT_PAIR_POLICY,
  readFragrantKnownState,
} from "@ai-werewolf-arena/game-contract/facts/fragrant-pair-seer";
/** 正整数边界与有序二人组保持原约束；同一格式也用于关系、选择和已知状态中的名单。 */
const id = z
    .number()
    .int()
    .positive()
    .max(Number.MAX_SAFE_INTEGER - 2),
  pair = z.tuple([id, id]).refine(([a, b]) => a < b),
  choice = z.strictObject({ day: id, pairIds: pair.nullable() });
const binding = z.strictObject({
  id: z.string(),
  createdNight: id,
  expiresNight: id,
  pairIds: pair,
  status: z.discriminatedUnion("kind", [
    z.strictObject({ kind: z.literal("pending") }),
    z.strictObject({ kind: z.enum(["expired", "triggered"]), day: id }),
  ]),
});
export const fragrantCheckpointSchema = z.strictObject({
  phantomId: id,
  seerId: id,
  fragrant: z.strictObject({
    policy: z.literal(FRAGRANT_PAIR_POLICY),
    knownWolfId: id.nullable(),
    knowledgeNight: z.literal(1).nullable(),
    lastChoice: choice.nullable(),
    bindings: z.array(binding),
    trigger: z
      .strictObject({ bindingId: z.string(), day: id, rootId: id, addedTargetId: id.nullable() })
      .nullable(),
  }),
  pairSeer: z.strictObject({
    policy: z.literal(FRAGRANT_PAIR_POLICY),
    history: z.array(z.strictObject({ day: id, targetIds: pair, containsWerewolf: z.boolean() })),
  }),
  // 已知状态独立保存；原共享数据 reader 继续核其内部关系，不把真实状态补写给玩家。
  known: z
    .strictObject({
      knownWolfId: id.nullable(),
      lastOpenedNight: z.number().int().nonnegative(),
      lastChoice: choice.nullable(),
      activeBinding: z
        .strictObject({ createdNight: id, expiresNight: id, pairIds: pair })
        .nullable(),
      used: z.boolean(),
      knifeNotices: z.array(z.strictObject({ day: id, eligible: z.boolean() })),
    })
    .refine((v) => readFragrantKnownState(v) !== null),
  // 记录打开／正常关闭／中止及两项提交标志；独立账本另核这些前缀与动作、事件的对应。
  nights: z.array(
    z.strictObject({
      day: id,
      status: z.enum(["open", "normal", "aborted"]),
      knife: z.boolean(),
      bindCommitted: z.boolean(),
      pairCommitted: z.boolean(),
    }),
  ),
});
export type RecordedFragrantState = z.infer<typeof fragrantCheckpointSchema>;
