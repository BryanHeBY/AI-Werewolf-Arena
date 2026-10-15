/**
 * 负责狼聊后、集体刀票前的传爪请求与严格交付。输入为可信夜上下文，输出已付双方私有事实。
 * 请求原体和期限别名归 RequestLease；真实窗口和库存归 bequest-authority；失败不生成 fallback 或默认空过。
 * 只有真实转移／明确 null 已落定才 complete，finally 关闭不撤销已扣原单位或已安装受传单位。
 */
import {
  AWAKENED_CLAW_POLICY,
  AWAKENED_WOLF_KING_ROLE_ID,
} from "@ai-werewolf-arena/game-contract/facts/awakened-claws";
import type { Role } from "@ai-werewolf-arena/game-contract";
import { Phase } from "@ai-werewolf-arena/game-contract";
import { RequestLease, type RequestLeaseTurn } from "../../domain/request-lease";
import type { TrustedNightStageHandler } from "../../engine/night/trusted-runtime";
import { ownedAwakenedClaws } from "./state";
import {
  openClawBequest,
  clawBequestCandidates,
  assertClawBequestCurrent,
  commitClawBequest,
  closeClawBequest,
} from "./bequest-authority";
interface RequestScope {
  actorId: number;
  day: number;
  current(): boolean;
}
const requests = RequestLease.window<RequestScope>(
  {
    actorId: (s) => s.actorId,
    day: (s) => s.day,
    phase: () => Phase.Night,
    stage: () => "awakened_claw_bequest",
    current: (s) => s.current(),
  },
  162,
  ["claw_bequest_candidates", "action_failure_policy", "allow_fallback", "requiresAction"],
);
export const AWAKENED_CLAW_BEQUEST_STAGE: TrustedNightStageHandler = {
  id: "awakened_claw_bequest",
  priority: 300,
  async execute(ctx) {
    const actors = ctx.getAliveByRole(AWAKENED_WOLF_KING_ROLE_ID as Role);
    if (actors.length === 0) return;
    if (actors.length !== 1) throw new Error("awakened_claw_actor_count_invalid");
    const actorId = actors[0]!,
      day = ctx.currentDay(),
      stock = ownedAwakenedClaws(ctx.world, actorId);
    if (!stock) throw new Error("awakened_claw_stock_missing");
    if (!stock.units.some((unit) => unit.source.kind === "native" && unit.status === "ready"))
      return;
    openClawBequest(ctx.world, actorId, day, ctx.roleCatalog);
    const current = () => {
      assertClawBequestCurrent(ctx.world, actorId, day);
      if (!ctx.isCurrent() || ctx.currentDay() !== day)
        throw new Error("awakened_claw_night_stale");
      return true;
    };
    let delivery: RequestLeaseTurn | undefined,
      failed = false;
    try {
      const request = ctx.makeRequest(actorId, ["bequeath_claw"], {
        stage: "awakened_claw_bequest",
        requiresAction: true,
        action_failure_policy: "error",
        allow_fallback: false,
        claw_bequest_candidates: clawBequestCandidates(ctx.world, actorId, day),
      });
      const scope = { actorId, day, current };
      requests.bind(scope, request);
      delivery = requests.openDelivery(scope, request);
      if (!delivery?.current()) throw new Error("awakened_claw_request_revoked");
      const action = await ctx.actionProvider.getAction(request);
      if (!delivery.current()) throw new Error("awakened_claw_request_revoked");
      current();
      if (action?.name !== "bequeath_claw") throw new Error("awakened_claw_action_missing");
      const validated = ctx.toolGateway.validateAndSanitize(ctx.world, actorId, action, {
        phase: Phase.Night,
        day,
      });
      current();
      if (!validated.ok || validated.sanitizedCall?.name !== "bequeath_claw")
        throw new Error("awakened_claw_action_invalid");
      const targetId = validated.sanitizedCall.args.target_id;
      const receipt = commitClawBequest(ctx.world, actorId, day, targetId, () =>
        delivery!.current(),
      );
      delivery.complete();
      if (receipt && targetId !== null)
        ctx.events.push({
          timestamp: Date.now(),
          type: "awakened_claw_bequeathed",
          payload: { policy: AWAKENED_CLAW_POLICY, day, actorId, targetId, ...receipt },
          audience: Object.freeze([actorId, targetId].sort((a, b) => a - b)),
        });
    } catch (error) {
      failed = true;
      throw error;
    } finally {
      closeClawBequest(ctx.world);
      try {
        delivery?.close();
      } catch (error) {
        if (!failed) throw error;
      }
    }
  },
};
export const OWNED_NIGHT_STAGE_PROGRAMS = Object.freeze([
  [AWAKENED_CLAW_BEQUEST_STAGE, AWAKENED_CLAW_BEQUEST_STAGE.execute] as const,
]);
