/**
 * 负责玩家 checkpoint 的完整外部数据格式与公共记录类型。输入是调用方原正整数／JSON
 * schema 引用和待审核的归档数据；输出保留组合字段、optional 组件与原两项 refine。
 * privateState 仍是 generic JSON 记录，不按当前角色筛槽或套用各族 live schema；合法档案
 * 不能恢复原体、库存或行动许可。普通状态捕获先按原 clone 规则执行，JSON 拒绝仍在随后
 * Tape parse 的原时点；16 个机制 verifier 在格式准入之后按原顺序独立核对因果。
 */
import { z } from "zod";
import {
  CUPID_POLICIES,
  SHERIFF_BADGE_POLICIES,
  Camp,
  Role,
} from "@ai-werewolf-arena/game-contract";
import type { VictoryAffiliation } from "@ai-werewolf-arena/game-contract";
import { readVictoryAffiliations } from "@ai-werewolf-arena/replay-contract";

export interface RecordedPlayerState {
  id: number;
  seat: number;
  name?: string;
  role: Role;
  camp: Camp;
  alive: boolean;
  privateState: Record<string, unknown>;
  wallNote?: import("../../../domain/components/wall-note").WallNoteComponent;
  debatePenalty?: import("../../../domain/components/debate-penalty").DebatePenaltyComponent;
  lovers?: import("../../../domain/components/lovers").LoversComponent;
  vote: { weight: number; canVote: boolean };
  badge: {
    isSheriff: boolean;
    destroyed: boolean;
    voteWeight: number;
    handoffPolicy?: import("../../../domain/board").SheriffBadgePolicy;
  };
  marks: string[];
  victory: { affiliations: VictoryAffiliation[] };
}
/**
 * 使用原 positive／jsonObject 对象形成玩家格式，不复制通用 validator 或提前解析 live 状态。
 * affiliations 的原 reader 失败只形成原 issue；顶层 Tape parser 仍决定拒绝及后续 verifier。
 */
export function createRecordedPlayerSchema(
  positive: z.ZodNumber,
  jsonObject: z.ZodRecord<z.ZodString, z.ZodJSONSchema>,
) {
  const affiliationsSchema = z.unknown().transform((value, ctx): VictoryAffiliation[] => {
    try {
      return readVictoryAffiliations(value);
    } catch {
      ctx.addIssue({ code: "custom", message: "reproduction_affiliations_invalid" });
      return z.NEVER;
    }
  });
  return (
    z
      .strictObject({
        id: positive,
        seat: positive,
        name: z.string().optional(),
        role: z.enum(Role),
        camp: z.enum(Camp),
        alive: z.boolean(),
        // 完整私态保留正常 JSON 扩展和独立能力 metadata；没有当前 Role 白名单。
        privateState: jsonObject,
        // 三个组件各自可缺席；缺席不在这里创建库存、处罚或恋人关系。
        wallNote: z
          .strictObject({
            instanceId: z.string().regex(/^wall:1:[1-9][0-9]*$/),
            source: z.strictObject({
              kind: z.literal("wall_event"),
              eventId: z.literal("awa_wall_notes_v1"),
              day: z.literal(1),
            }),
            remaining: z.union([z.literal(0), z.literal(1)]),
            expired: z.boolean(),
          })
          .optional(),
        debatePenalty: z
          .strictObject({
            day: positive,
            sourceId: positive,
            lifeVersion: z.number().int().nonnegative(),
          })
          .optional(),
        lovers: z
          .strictObject({
            actorId: positive,
            day: z.literal(1),
            policy: z.enum(CUPID_POLICIES),
            pairIds: z.tuple([positive, positive]),
            pairCamps: z.tuple([z.enum([Camp.Good, Camp.Wolf]), z.enum([Camp.Good, Camp.Wolf])]),
            groupId: z.literal("cupid_lovers"),
            mixed: z.boolean(),
          })
          // 仅核归档配对和 mixed 的一致性，真实关系／生命仍由独立 verifier 审核。
          .refine(
            (record) =>
              record.pairIds[0] !== record.pairIds[1] &&
              record.mixed === (record.pairCamps[0] !== record.pairCamps[1]),
            "reproduction_lovers_invalid",
          )
          .optional(),
        victory: z.strictObject({ affiliations: affiliationsSchema }),
        vote: z.strictObject({ weight: z.number().finite().nonnegative(), canVote: z.boolean() }),
        badge: z.strictObject({
          isSheriff: z.boolean(),
          destroyed: z.boolean(),
          voteWeight: z.number().finite().positive(),
          handoffPolicy: z.enum(SHERIFF_BADGE_POLICIES).optional(),
        }),
        marks: z.array(z.string()),
      })
      // 墙实例所属编号在完整字段审核后复验；保留原错误与 optional 短路。
      .refine(
        (player) => !player.wallNote || player.wallNote.instanceId === `wall:1:${player.id}`,
        "reproduction_wall_owner_invalid",
      )
  );
}
