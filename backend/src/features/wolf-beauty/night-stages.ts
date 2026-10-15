/**
 * 负责狼美人夜间魅惑的请求、等待后原体复验、选择历史、关系绑定及公开／动物私密通知。
 * 输入为原夜上下文与经网关验证的可空目标；输出保留原历史、绑定与事件，拒绝或失效选择不安装新关系。
 * 动物准入与板子识别通过查询端口按原位置调用，通知通过独立事实端口发表，不能将已知数据当作现场权限。
 * 原状态依次写 targetId、lastActedDay、追加 history，再绑定关系、发表 charm_applied，最后追加动物通知；失败保已写前缀。
 * 目标和演员生命版本在原等待前后核对；未付魅惑另拒绝捕获角色的执行退休，不过滤目标或已付关系。
 * 首选择字段写后继续原绑定／事实前缀；本流程不提前领取死亡牵连，实际来源政策、保护与标死另归原 owner。
 */
import { recordCharmSelection } from "./state";
import { AliveComponent, aliveLifeVersion } from "../../domain/components/alive";
import { COMPONENT } from "../../domain/components/names";
import { isRoleExecutionRetired } from "../../domain/role-execution-authority";
import { Role, Camp, Phase } from "../../domain/model";
import type { RoleComponent } from "../../domain/components/role";
import type { TrustedNightStageHandler as NightStageHandler } from "../../engine/night/trusted-runtime";
import { getWolfBeautyState } from "./state";
import { bindCharm } from "./relation";
import { animalBeautyCharmAllowed, isAnimalDreamBoard } from "../animal-dream/beauty-query-ports";
import { appendAnimalBeautyNotice } from "../animal-dream/beauty-fact-ports";

export const WOLF_BEAUTY_CHARM_STAGE: NightStageHandler = {
  id: "wolf_beauty_charm",
  priority: 450,
  async execute(ctx) {
    const day = ctx.currentDay();
    if (!animalBeautyCharmAllowed(ctx.world, day)) return;
    for (const actorId of ctx.getAliveByRole(Role.WolfBeauty)) {
      if (!ctx.isCurrent()) return;
      const role = ctx.world.getComponent(actorId, COMPONENT.Role)!,
        state = getWolfBeautyState(role),
        actorLife = ctx.world.getComponent(actorId, COMPONENT.Alive)!,
        actorVersion = aliveLifeVersion(actorLife),
        policy = state?.deathLinkPolicy;
      const canAct = () => !isRoleExecutionRetired(role);
      // 原阵营／槽／本夜库存资格先读取，再拒绝新的未付魅惑；名单本身仍是纯角色数据。
      if (
        ctx.world.getComponent(actorId, COMPONENT.Camp)?.camp !== Camp.Wolf ||
        !state ||
        state.lastActedDay === day ||
        !canAct()
      )
        continue;
      const targets = new Map(
        ctx.world
          .getAliveEntityIds()
          .filter((id) => id !== actorId)
          .map((id) => {
            const life = ctx.world.getComponent(id, COMPONENT.Alive)!;
            return [id, { life, version: aliveLifeVersion(life) }] as const;
          }),
      );
      // 原 Provider receiver／callee 先于 builder；目标捕获、callee 或参数准备导致退休时不建新请求。
      const provider = ctx.actionProvider,
        getAction = provider.getAction,
        makeRequest = ctx.makeRequest;
      const requestActor = actorId;
      const requestTools: Parameters<typeof makeRequest>[1] = ["charm"];
      const requestExtras: Parameters<typeof makeRequest>[2] = {
        stage: "wolf_beauty",
        requiresAction: false,
      };
      const requestArgs = [requestActor, requestTools, requestExtras];
      const invokeRequest = Reflect.apply.bind(Reflect);
      if (!canAct()) continue;
      const request: ReturnType<typeof makeRequest> = invokeRequest(makeRequest, ctx, requestArgs);
      const actionArgs = [request];
      const invokeAction = Reflect.apply.bind(Reflect);
      if (!canAct()) continue;
      const action: Awaited<ReturnType<typeof getAction>> = await invokeAction(
        getAction,
        provider,
        actionArgs,
      );
      const current = () =>
        ctx.isCurrent() &&
        animalBeautyCharmAllowed(ctx.world, day) &&
        ctx.world.getComponent(actorId, COMPONENT.Role) === role &&
        role.role === Role.WolfBeauty &&
        ctx.world.getComponent(actorId, COMPONENT.Camp)?.camp === Camp.Wolf &&
        getWolfBeautyState(role) === state &&
        state.deathLinkPolicy === policy &&
        state.lastActedDay !== day &&
        ctx.world.getComponent(actorId, COMPONENT.Alive) === actorLife &&
        actorLife.alive &&
        actorVersion !== undefined &&
        aliveLifeVersion(actorLife) === actorVersion;
      if (!current() || !canAct()) continue;
      if (action !== null && action.name !== "charm") continue;
      let targetId = action === null ? null : action.args.target_id;
      if (action) {
        const result = ctx.toolGateway.validateAndSanitize(ctx.world, actorId, action, {
          phase: Phase.Night,
          day,
        });
        if (!current() || !result.ok || result.sanitizedCall?.name !== "charm" || !canAct())
          continue;
        targetId = result.sanitizedCall.args.target_id;
      }
      if (targetId !== null) {
        const target = targets.get(targetId);
        if (
          !target ||
          ctx.world.getComponent(targetId, COMPONENT.Alive) !== target.life ||
          !target.life.alive ||
          target.version === undefined ||
          aliveLifeVersion(target.life) !== target.version
        )
          continue;
      }
      // 原 nullable 目标／生命 getter 与提交 callee 先准备；只在首选择写前拒绝。
      // 选择已写即进入原完成段，后续 history／绑定／事实失败或晚退休不退款。
      const recordSelection = recordCharmSelection;
      if (!canAct()) continue;
      recordSelection(state, targetId, day);
      bindCharm(ctx.world, actorId, targetId);
      ctx.events.push({
        timestamp: Date.now(),
        type: "charm_applied",
        payload: { actorId, targetId, day },
      });
      if (isAnimalDreamBoard(ctx.world)) appendAnimalBeautyNotice(ctx.world, ctx.events, day);
    }
  },
};

/** 模块定义完成时固定完整原程序引用；后来替换 execute 不能借原 handler 对象取得私有输入。这里不持有运行 World。 */
export const OWNED_NIGHT_STAGE_PROGRAMS = Object.freeze(
  [WOLF_BEAUTY_CHARM_STAGE].map((handler) => Object.freeze([handler, handler.execute] as const)),
);
