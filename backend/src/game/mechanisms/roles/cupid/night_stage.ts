/**
 * 负责丘比特首夜恋人选择的请求、await 复验、关系绑定、成员归属与事实发布。
 * 输入为原夜上下文和经网关验证的配对；输出是同一关系记录及原事件，数据库存／选择写入由本族槽负责。
 * 原角色、容器、生命与双方 Victory 在等待前后复验；未付选择另拒绝捕获角色的执行退休，纯 current 不附旗。
 * 首关系提交后依次消费选择、安装归属再发布；晚退休不撤销已付关系或截断原完成前缀。
 * 目标阵营按原点捕获并复验当前值，pairCamps仍是提交历史；不将关系／Victory当真实阵营。
 * 同步段不是事务：字段、组件或事件失败保留先完成的前缀，不退款或重新使用旧请求，殉情与判胜另有 owner。
 * 请求另有动态交付租约：观察原 envelope／领域失配或到期即共闭，别名自身坏只退自己，期限只缩短。
 * Provider 返回不等于领域提交；全部付款成功才在事实前 complete，退出的通知异常不得盖原正文错误。
 */
import { COMPONENT } from "../../../../domain/components/names";
import { isRoleExecutionRetired } from "../../../../domain/role-execution-authority";
import { RequestLease } from "../../../../domain/request-lease";

import {
  createVictoryComponent,
  type VictoryComponent,
} from "../../../../domain/components/victory";
import type { LoversComponent } from "../../../../domain/components/lovers";
import { Camp, Phase, Role } from "../../../../domain/model";
import { captureNightLife, livingNightLife } from "../../../../domain/night-effects";
import type { NightStageHandler } from "../../stages/night/contracts";
import { getCupidState, commitCupidChoice } from "./state-slot";
import { bindLovers, hasCupidNightCommit } from "./relation";

/** 每个真实请求单独持有本次行动者与日次；领域闭包仍晚查原体，不由 context 重建权限。 */
interface ChoiceRequestScope { actorId: number; day: number; current(): boolean }
const requestLease = RequestLease.window<ChoiceRequestScope>({
  actorId: (scope) => scope.actorId,
  phase: () => Phase.Night,
  day: (scope) => scope.day,
  stage: () => "cupid",
  current: (scope) => scope.current(),
}, 110);

export const CUPID_STAGE: NightStageHandler = {
  id: "cupid",
  priority: 80,
  async execute(ctx) {
    const day = ctx.currentDay();
    if (day !== 1) return;
    if (hasCupidNightCommit(ctx.world, day)) throw new Error("cupid_night_reentry_after_commit");
    for (const actorId of ctx.getAliveByRole(Role.Cupid)) {
      const role = ctx.world.getComponent(actorId, COMPONENT.Role)!,
        state = getCupidState(role),
        life = captureNightLife(ctx.world, actorId),
        victory = ctx.world.getComponent(actorId, COMPONENT.Victory);
      if (!state || !life || !victory || ctx.world.getComponent(actorId, COMPONENT.Camp)?.camp !== Camp.Good) continue;
      const privateState = role.privateState,
        policy = state.policy,
        affiliations = victory.affiliations,
        membership = JSON.stringify(affiliations);
      const current = () =>
        ctx.isCurrent() &&
        ctx.currentDay() === day &&
        ctx.world.getComponent(actorId, COMPONENT.Role) === role &&
        role.role === Role.Cupid &&
        ctx.world.getComponent(actorId, COMPONENT.Camp)?.camp === Camp.Good &&
        role.privateState === privateState &&
        getCupidState(role) === state &&
        state.policy === policy &&
        state.remaining === 1 &&
        state.choice === null &&
        livingNightLife(ctx.world, life) &&
        ctx.world.getComponent(actorId, COMPONENT.Victory) === victory &&
        victory.affiliations === affiliations &&
        JSON.stringify(affiliations) === membership &&
        !hasCupidNightCommit(ctx.world, day);
      // 纯原体当前性保原表达式；新未付准入只消费捕获 Role 的永久拒绝信号。
      const canAct = () => !isRoleExecutionRetired(role);
      if (!current() || !canAct()) continue;
      let completed = false;
      for (let attempt = 0; attempt < 3; attempt++) {
        if (!current() || !canAct()) break;
        const targets = new Map(
          ctx.world.getAliveEntityIds().map((id) => {
            const targetRole = ctx.world.getComponent(id, COMPONENT.Role)!,
              targetVictory = ctx.world.getComponent(id, COMPONENT.Victory)!;
            return [
              id,
              {
                life: captureNightLife(ctx.world, id)!,
                role: targetRole,
                kind: targetRole.role,
                camp: ctx.world.getComponent(id, COMPONENT.Camp)?.camp,
                privateState: targetRole.privateState,
                victory: targetVictory,
                affiliations: targetVictory.affiliations,
                membership: JSON.stringify(targetVictory.affiliations),
              },
            ] as const;
          }),
        );
        if (targets.size < 2) throw new Error("cupid_valid_action_missing");
        // 丘比特原先先构造请求；原 callee／参数和保持 ctx receiver 的 Reflect 调用准备后才拒未付退休。
        const makeRequest = ctx.makeRequest;
        const requestActor = actorId;
        const requestTools: Parameters<typeof makeRequest>[1] = ["choose_lovers"];
        const requestExtras: Parameters<typeof makeRequest>[2] = {
          stage: "cupid",
          requiresAction: true,
          allow_fallback: false,
          action_failure_policy: "error",
          ...(attempt ? { retry_attempt: attempt, retry_max: 2 } : {}),
        };
        const requestArgs = [requestActor, requestTools, requestExtras];
        const invokeRequest = Reflect.apply.bind(Reflect);
        if (!canAct()) break;
        const request: ReturnType<typeof makeRequest> = invokeRequest(makeRequest, ctx, requestArgs);
        const requestScope: ChoiceRequestScope = { actorId, day, current: () => current() && canAct() };
        requestLease.bind(requestScope, request);
        const turn = requestLease.openDelivery(requestScope, request);
        let bodyFailed = false;
        try {
          if (!turn) break;
          if (!current() || !canAct() || !turn.current()) break;
          // provider receiver／callee 保原晚读取；新增 Reflect／bind 的读取也在末旗前，非可调用 callee 留在实际 invoke 点失败。
          const provider = ctx.actionProvider,
            getAction = provider.getAction;
          const actionArgs = [request];
          const invokeAction = Reflect.apply.bind(Reflect);
          if (!canAct() || !turn.current()) break;
          const action: Awaited<ReturnType<typeof getAction>> = await invokeAction(getAction, provider, actionArgs);
          if (!current() || !canAct() || !turn.current()) break;
          if (action?.name !== "choose_lovers") continue;
          const valid = ctx.toolGateway.validateAndSanitize(ctx.world, actorId, action, {
            phase: Phase.Night,
            day,
          });
          if (!current() || !valid.ok || valid.sanitizedCall?.name !== "choose_lovers" || !canAct() || !turn.current()) continue;
          const pairIds: [number, number] = [
            valid.sanitizedCall.args.first_id,
            valid.sanitizedCall.args.second_id,
          ];
          const selected = pairIds.map((id) => targets.get(id));
          if (
            selected.some(
              (target, index) =>
                !target ||
                !livingNightLife(ctx.world, target.life) ||
                ctx.world.getComponent(pairIds[index]!, COMPONENT.Role) !== target.role ||
                target.role.role !== target.kind ||
                ctx.world.getComponent(pairIds[index]!, COMPONENT.Camp)?.camp !== target.camp ||
                target.role.privateState !== target.privateState ||
                (target.camp !== Camp.Good && target.camp !== Camp.Wolf) ||
                ctx.world.getComponent(pairIds[index]!, COMPONENT.Victory) !== target.victory ||
                target.victory.affiliations !== target.affiliations ||
                JSON.stringify(target.affiliations) !== target.membership,
            )
          )
            continue;
          const first = selected[0]!,
            second = selected[1]!,
            mixed = first.camp !== second.camp;
          const record: LoversComponent = Object.freeze({
            actorId,
            day: 1,
            policy,
            pairIds: Object.freeze(pairIds),
            pairCamps: Object.freeze([first.camp, second.camp]) as LoversComponent["pairCamps"],
            groupId: "cupid_lovers",
            mixed,
          });
          const memberIds = new Set(pairIds);
          if (policy === "netease_2017_cupid_follows_lovers_v1") memberIds.add(actorId);
          // 目标／记录 getter 仍先读取；关系 owner 在原 callee／参数求值后、首组件写前检查拒绝尾。
          // 首关系已写后不再消费墓碑：选择付款、归属和事实照原顺序继续，失败保已完成前缀。
          if (!bindLovers(ctx.world, record, [first.life, second.life], () => canAct() && turn.current())) continue;
          commitCupidChoice(state, pairIds);
          for (const id of memberIds)
            ctx.world.addComponent(
              id,
              COMPONENT.Victory,
              createVictoryComponent([
                mixed
                  ? { kind: "relationship", groupId: record.groupId }
                  : { kind: "faction", faction: first.camp! },
              ]),
            );
          // 全部领域付款正常返回才落 true；原事实随后发表，晚抛不能把同一次交付反结算为 false。
          turn.complete();
          ctx.events.push({
            timestamp: Date.now(),
            type: "cupid_lovers_chosen",
            payload: { actorId, day: 1, pairIds: [...pairIds] },
          });
          for (const id of pairIds)
            ctx.events.push({
              timestamp: Date.now(),
              type: "lover_recognized",
              payload: { actorId: id, partnerId: pairIds.find((target) => target !== id)! },
            });
          ctx.events.push({
            timestamp: Date.now(),
            type: "cupid_relation_resolved",
            payload: record,
          });
          completed = true;
          break;
        } catch (error) {
          bodyFailed = true;
          throw error;
        } finally {
          // 取消、无效回复及部分付款均 false-close；原正文错误优先，新通知错误不遮盖它。
          // complete 已先落终态，事实或通知晚抛后 close 不会二次通知，也不回滚已写前缀。
          try { turn?.close(); } catch (error) { if (!bodyFailed) throw error; }
        }
      }
      if (!completed && current() && canAct()) throw new Error("cupid_valid_action_missing");
    }
  },
};
