/**
 * 负责丘比特首夜恋人选择的请求、await 复验、关系绑定、成员归属与事实发布。
 * 输入为原夜上下文和经网关验证的配对；输出是同一关系记录及原事件，数据库存／选择写入由本族槽负责。
 * 原角色、容器、生命与双方 Victory 在等待前后复验；最终同步段依次绑定关系、消费选择、安装归属再发布。
 * 同步段不是事务：字段、组件或事件失败保留先完成的前缀，不退款或重新使用旧请求，殉情与判胜另有 owner。
 */
import { COMPONENT } from "../../../../core/domain/components/names";

import {
  createVictoryComponent,
  type VictoryComponent,
} from "../../../../core/domain/components/victory";
import type { LoversComponent } from "../../../../core/domain/components/lovers";
import { Camp, Phase, Role } from "../../../../core/domain/model";
import { captureNightLife, livingNightLife } from "../../../../core/domain/night_effects";
import type { NightStageHandler } from "../../stages/night/contracts";
import { getCupidState, commitCupidChoice } from "./state-slot";
import { bindLovers, hasCupidNightCommit } from "./relation";

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
      if (!state || !life || !victory || role.camp !== Camp.Good) continue;
      const privateState = role.privateState,
        policy = state.policy,
        affiliations = victory.affiliations,
        membership = JSON.stringify(affiliations);
      const current = () =>
        ctx.isCurrent() &&
        ctx.currentDay() === day &&
        ctx.world.getComponent(actorId, COMPONENT.Role) === role &&
        role.role === Role.Cupid &&
        role.camp === Camp.Good &&
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
      if (!current()) continue;
      let completed = false;
      for (let attempt = 0; attempt < 3; attempt++) {
        if (!current()) break;
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
                camp: targetRole.camp,
                privateState: targetRole.privateState,
                victory: targetVictory,
                affiliations: targetVictory.affiliations,
                membership: JSON.stringify(targetVictory.affiliations),
              },
            ] as const;
          }),
        );
        if (targets.size < 2) throw new Error("cupid_valid_action_missing");
        const request = ctx.makeRequest(actorId, ["choose_lovers"], {
          stage: "cupid",
          requiresAction: true,
          allow_fallback: false,
          action_failure_policy: "error",
          ...(attempt ? { retry_attempt: attempt, retry_max: 2 } : {}),
        });
        if (!current()) break;
        const action = await ctx.actionProvider.getAction(request);
        if (!current()) break;
        if (action?.name !== "choose_lovers") continue;
        const valid = ctx.toolGateway.validateAndSanitize(ctx.world, actorId, action, {
          phase: Phase.Night,
          day,
        });
        if (!current() || !valid.ok || valid.sanitizedCall?.name !== "choose_lovers") continue;
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
              target.role.camp !== target.camp ||
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
        // 最后授权后不再 await；关系先绑定，选择随后付款，再逐成员安装归属。失败不撤回已完成的前缀。
        bindLovers(ctx.world, record, [first.life, second.life]);
        commitCupidChoice(state, pairIds);
        for (const id of memberIds)
          ctx.world.addComponent(
            id,
            COMPONENT.Victory,
            createVictoryComponent([
              mixed
                ? { kind: "relationship", groupId: record.groupId }
                : { kind: "faction", faction: first.camp },
            ]),
          );
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
      }
      if (!completed && current()) throw new Error("cupid_valid_action_missing");
    }
  },
};
