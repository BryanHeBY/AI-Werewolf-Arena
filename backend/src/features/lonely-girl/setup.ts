/**
 * 负责孤独少女首夜心仪对象选择及原失败／取消路径。
 * 输入为只读板子、原参与者、provider 和惰性构造依赖；输出为心仪对象提交成功或准备中断。
 * 先核准备状态再打开原窗口，await 两侧复验参与者；阵营归属、库存及 finally 关闭归原生命周期。
 * 已失败或关闭的选择不重写游戏参数，不重新开启准备，也不授予过期请求许可。
 */
import type { ReadonlyBoardConfig } from "@ai-werewolf-arena/game-contract";
import { Phase, type World, type GameEvent, type ActionProvider } from "../../domain";
import type { RequestLeaseTurn } from "../../domain/request-lease";
import type { ActionRequestFactoryConstructorPort } from "../../domain/actions";
import type { ToolGateway } from "../../engine/actions/tool-gateway";
import { LONELY_GIRL_POLICY, readLonelyGirlTool } from "./state-slot";
import {
  lonelyGirlBinding,
  lonelyGirlReady,
  hasActiveLonelyGirl,
  openLonelyGirlChoice,
  validLonelyGirlChoice,
  commitLonelyGirlChoice,
  closeLonelyGirlChoice,
  openLonelyGirlRequestDelivery,
} from "./lifecycle";
export class LonelyGirlSetupWindow {
  constructor(
    private readonly world: World,
    private readonly gateway: ToolGateway,
    private readonly events: GameEvent[],
    /** 只保存惰性构造依赖；不预建请求，原准备和权限检查仍先执行。 */
    private readonly construction: { readonly requestFactory: ActionRequestFactoryConstructorPort },
  ) {}
  async execute(
    config: ReadonlyBoardConfig,
    provider: ActionProvider,
    day: number,
    isCurrent: () => boolean,
  ): Promise<boolean> {
    if (hasActiveLonelyGirl(this.world)) throw new Error("lonely_girl_setup_reentry");
    if (lonelyGirlReady(this.world)) return true;
    const b = lonelyGirlBinding(this.world);
    if (!b || b.status !== "pending" || config !== b.config || day !== 1)
      throw new Error("lonely_girl_setup_unavailable");
    let status: "failed" | "cancelled" = "failed";
    let delivery: RequestLeaseTurn | undefined, failed = false;
    try {
      if (!openLonelyGirlChoice(b, isCurrent)) {
        status = "cancelled";
        return false;
      }
      // 原选择窗口已开后才取构造器，并用本次 World／事件／day 创建实例；失败仍按原 finally 关闭。
      const request = new this.construction.requestFactory(this.world, this.events, day).create({
        phase: Phase.Night,
        actorId: b.actorId,
        allowedTools: ["choose_admired_player"],
        stage: "lonely_girl",
        requiresAction: true,
        summary: { key: "turn.lonely_girl.required" },
        context: { allow_fallback: false, action_failure_policy: "error" },
      });
      // create 完成后打开原 turn；域状态先按原时点复验，后读请求／预算许可。
      delivery = openLonelyGirlRequestDelivery(this.world, request);
      if (!validLonelyGirlChoice(b) || delivery?.current() !== true) {
        status = "cancelled";
        return false;
      }
      const raw = await provider.getAction(request);
      if (!validLonelyGirlChoice(b) || delivery?.current() !== true) {
        status = "cancelled";
        return false;
      }
      const call = readLonelyGirlTool(raw);
      if (!call) throw new Error("lonely_girl_required_choice_missing");
      const result = this.gateway.validateAndSanitize(this.world, b.actorId, call, {
        phase: Phase.Night,
        day,
        lonelyGirlScope: b,
      });
      if (!validLonelyGirlChoice(b) || delivery?.current() !== true) {
        status = "cancelled";
        return false;
      }
      if (!result.ok) throw new Error("lonely_girl_choice_invalid");
      const camp = commitLonelyGirlChoice(b, call.args.target_id);
      if (!camp) throw new Error("lonely_girl_choice_invalid");
      // 完整领域 commit 已返回成功；通知或事实晚抛仍 true，不重新核已付款的 pending 状态。
      delivery.complete();
      this.events.push({
        timestamp: Date.now(),
        type: "lonely_girl_admired_chosen",
        payload: {
          policy: LONELY_GIRL_POLICY,
          actorId: b.actorId,
          day: 1,
          targetId: call.args.target_id,
          camp,
        },
      });
      return true;
    } catch (error) {
      failed = true;
      throw error;
    } finally {
      try {
        closeLonelyGirlChoice(b, status);
      } catch (error) {
        failed = true;
        throw error;
      } finally {
        // 原 body／cleanup 错误优先；无旧错时新增 false 通知错误正常传播。
        if (failed) { try { delivery?.close(); } catch { /* 保已在传播的错误。 */ } }
        else delivery?.close();
      }
    }
  }
}
