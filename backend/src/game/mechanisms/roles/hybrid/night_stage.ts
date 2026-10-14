/**
 * 负责混血儿首夜榜样选择的请求、原体／目标复验及隐藏胜利归属安装。
 * 输入为当前夜上下文和经网关验证的榜样；输出为已选数据、独立归属和原事实，不改变角色或真实阵营。
 * 等待前后仍核原容器、状态、生命和空 Victory；未付准入另拒绝捕获角色的执行退休，纯 current 不附旗。
 * 先构造归属，再在首次数写前拒退休；已消费后按原顺序安装组件和事实，晚退休不退款。
 * 目标阵营按原点捕获并复验真实 Camp 值，安装的是独立Victory归属，不写当前阵营。
 * 同步字段与组件提交失败保留已写前缀；夜提交账本和事件仍在原安装之后，不以玩家知识恢复许可。
 */
import { COMPONENT } from "../../../../core/domain/components/names";
import { isRoleExecutionRetired } from "../../../../core/domain/role-execution-authority";

import {
  createVictoryComponent,
  type VictoryComponent,
} from "../../../../core/domain/components/victory";
import { Camp, Phase, Role } from "../../../../core/domain/model";
import { captureNightLife, livingNightLife } from "../../../../core/domain/night_effects";
import type { World } from "../../../../core/domain/world";
import type { NightStageHandler } from "../../stages/night/contracts";
import { canChooseExemplar, getHybridState, commitHybridChoice } from "./state-slot";

const committed = new WeakMap<World, Set<number>>();
export function hasHybridNightCommit(world: World, day: number): boolean {
  return committed.get(world)?.has(day) ?? false;
}

export const HYBRID_STAGE: NightStageHandler = {
  id: "hybrid",
  priority: 110,
  async execute(ctx) {
    const day = ctx.currentDay();
    if (day !== 1) return;
    for (const actorId of ctx.getAliveByRole(Role.Hybrid)) {
      const role = ctx.world.getComponent(actorId, COMPONENT.Role)!;
      const state = getHybridState(role),
        life = captureNightLife(ctx.world, actorId);
      const victory = ctx.world.getComponent(actorId, COMPONENT.Victory);
      if (!state || !life || !victory || ctx.world.getComponent(actorId, COMPONENT.Camp)?.camp !== Camp.Good) continue;
      const privateState = role.privateState,
        affiliations = victory.affiliations;
      const current = () =>
        ctx.isCurrent() &&
        ctx.currentDay() === day &&
        ctx.world.getComponent(actorId, COMPONENT.Role) === role &&
        role.role === Role.Hybrid &&
        ctx.world.getComponent(actorId, COMPONENT.Camp)?.camp === Camp.Good &&
        role.privateState === privateState &&
        getHybridState(role) === state &&
        livingNightLife(ctx.world, life) &&
        ctx.world.getComponent(actorId, COMPONENT.Victory) === victory &&
        victory.affiliations === affiliations &&
        affiliations.length === 0 &&
        canChooseExemplar(state, day);
      // 纯原体当前性保原表达式；新未付准入只消费捕获 Role 的永久拒绝信号。
      const canAct = () => !isRoleExecutionRetired(role);
      if (!current() || !canAct()) continue;
      let completed = false;
      for (let attempt = 0; attempt < 3; attempt++) {
        if (!current() || !canAct()) break;
        const targets = new Map(
          ctx.world
            .getAliveEntityIds()
            .filter((id) => id !== actorId)
            .map((id) => {
              const targetRole = ctx.world.getComponent(id, COMPONENT.Role)!;
              return [
                id,
                {
                  life: captureNightLife(ctx.world, id)!,
                  role: targetRole,
                  kind: targetRole.role,
                  camp: ctx.world.getComponent(id, COMPONENT.Camp)?.camp,
                  privateState: targetRole.privateState,
                },
              ] as const;
            }),
        );
        if (!targets.size) throw new Error("hybrid_valid_action_missing");
        // 原表达式先读 Provider receiver／callee，再读 builder／参数；不把工厂或 Provider 提前缓存到循环外。
        const provider = ctx.actionProvider,
          getAction = provider.getAction,
          makeRequest = ctx.makeRequest;
        const requestActor = actorId;
        const requestTools: Parameters<typeof makeRequest>[1] = ["choose_exemplar"];
        const requestExtras: Parameters<typeof makeRequest>[2] = {
          stage: "hybrid",
          requiresAction: true,
          allow_fallback: false,
          ...(attempt ? { retry_attempt: attempt, retry_max: 2 } : {}),
        };
        const requestArgs = [requestActor, requestTools, requestExtras];
        const invokeRequest = Reflect.apply.bind(Reflect);
        if (!canAct()) break;
        const request: ReturnType<typeof makeRequest> = invokeRequest(makeRequest, ctx, requestArgs);
        const actionArgs = [request];
        const invokeAction = Reflect.apply.bind(Reflect);
        if (!canAct()) break;
        const action: Awaited<ReturnType<typeof getAction>> = await invokeAction(getAction, provider, actionArgs);
        if (!current() || !canAct()) break;
        if (action?.name !== "choose_exemplar") continue;
        const valid = ctx.toolGateway.validateAndSanitize(ctx.world, actorId, action, {
          phase: Phase.Night,
          day,
        });
        if (!current() || !valid.ok || valid.sanitizedCall?.name !== "choose_exemplar" || !canAct()) continue;
        const targetId = valid.sanitizedCall.args.target_id,
          target = targets.get(targetId);
        if (
          !target ||
          !livingNightLife(ctx.world, target.life) ||
          ctx.world.getComponent(targetId, COMPONENT.Role) !== target.role ||
          target.role.role !== target.kind ||
          ctx.world.getComponent(targetId, COMPONENT.Camp)?.camp !== target.camp ||
          target.role.privateState !== target.privateState ||
          (target.camp !== Camp.Good && target.camp !== Camp.Wolf)
        )
          continue;
        const membership = createVictoryComponent([{ kind: "faction", faction: target.camp! }]);
        // 原目标 getter 和归属构造先完成，再准备原提交 callee；参数均是已求值局部。
        // 拒绝尾只在首次库存写前生效；次数已写后的组件／事实失败保原前缀，不退款。
        const commitChoice = commitHybridChoice;
        if (!canAct()) continue;
        commitChoice(state, day, targetId);
        ctx.world.addComponent(actorId, COMPONENT.Victory, membership);
        const days = committed.get(ctx.world) ?? new Set<number>();
        days.add(day);
        committed.set(ctx.world, days);
        ctx.events.push({
          timestamp: Date.now(),
          type: "hybrid_exemplar_chosen",
          payload: { actorId, day, targetId },
        });
        ctx.events.push({
          timestamp: Date.now(),
          type: "hybrid_affiliation_resolved",
          payload: { actorId, day, targetId, faction: target.camp },
        });
        completed = true;
        break;
      }
      if (!completed && current() && canAct()) throw new Error("hybrid_valid_action_missing");
    }
  },
};
