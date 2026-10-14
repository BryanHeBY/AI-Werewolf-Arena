/**
 * 负责猎魔人阶段原夜号／需求查询、控制器调用及私密选择事实发布。输入同一阶段上下文，输出原行动事实。
 * 构造依赖只透传同一上下文引用，不提前取类；World 与其它参数仍在原对象构造点读取。
 * 实际开启／复验／付款／关闭仍归本族 controller 和 authority。
 * 需求未命中不导入控制器，执行失败不伪造完成事实或回滚先前提交。
 */
import type { NightStageHandler } from "../../stages/night/contracts";
import { demonHunterNeedsTurn } from "./authority";
/** 只处理已安装且本夜需要选择的猎魔人；原动态导入／await点保持，不在这里注册角色或授予许可。 */
export const DEMON_HUNTER_NIGHT_STAGE: NightStageHandler = {
  id: "demon_hunter_action",
  priority: 650,
  async execute(ctx) {
    const day = ctx.currentDay();
    if (!demonHunterNeedsTurn(ctx.world, day)) return;
    const { executeDemonHunterTurn } = await import("./controller");
    const fact = await executeDemonHunterTurn({
      world: ctx.world,
      gateway: ctx.toolGateway,
      events: ctx.events,
      provider: ctx.actionProvider,
      day,
      construction: ctx,
    });
    ctx.events.push({
      timestamp: Date.now(),
      type: "demon_hunter_chosen",
      payload: fact,
      audience: Object.freeze([fact.actorId]),
    });
  },
};
