/**
 * 负责白天自爆的有限规则组合：婚礼禁用、红月资格、普通自爆与白狼王库存共同约束选择。
 * 输入为原 World、角色工具表、请求构造端口、Provider、网关及窗口回调；输出为首个未被拒绝的选择或 null。
 * 并发请求保原 Promise.all 顺序；等待后按原体／生命版本／库存与目标复验，再按玩家编号尝试提交。
 * 捕获的存活组件和资源引用仅服务本次窗口；阶段 current、库存付款、死亡与最终判胜各归原 owner。安装失败的退休只拒演员，目标和纯数据仍保原查询。
 * commit 返回 false 只跳过该选择；读取、Provider 或提交失败沿原异常传播，不补提交或回滚已写前缀。
 */
import type { ReadonlyBoardConfig } from "@ai-werewolf-arena/game-contract";
import { RED_MOON_ROLE } from "../game/mechanisms/roles/red_moon_apostle/ports";
import { demonRedMoonCanBlast } from "../game/mechanisms/roles/demon_hunter/ports";
import { canRoleSelfDestruct } from "../game/mechanisms/roles/self_destruct_capability";
import { getDefaultRoleCatalog } from "../game/mechanisms/roles/role-catalog-assembly";
import {
  weddingMember,
  weddingSetup,
  ghostBrideReady,
} from "../game/mechanisms/roles/ghost_bride/ports";
import { AliveComponent, aliveLifeVersion } from "../core/domain/components/alive";
import { COMPONENT } from "../core/domain/components/names";
import { RoleComponent } from "../core/domain/components/role";
import { isRoleExecutionRetired } from "../core/domain/role-execution-authority";
import {
  ActionProvider,
  ActionWindow,
  Phase,
  type SelfDestructSelection,
} from "../core/domain/model";
import { RoleRegistry } from "../core/domain/registries/role_registry";
import { World } from "../core/domain/world";
import { ToolGateway } from "../game/gateway/tool_gateway";
import type { ActionRequestConstructionPort } from "../core/domain/actions";
import { getWhiteWolfKingState } from "../game/mechanisms/roles/white_wolf_king/ports";

/** 并发收集选项，按编号升序复验并尝试提交；回调明确返回 false 时跳过该选项，返回首个未被拒绝的选择。 */
export class SelfDestructWindow {
  constructor(
    private readonly world: World,
    private readonly roleRegistry: RoleRegistry,
    private readonly toolGateway: ToolGateway,
  ) {}

  async execute(
    requests: ActionRequestConstructionPort,
    provider: ActionProvider,
    window: ActionWindow,
    phase: Phase,
    isCurrent: () => boolean = () => true,
    commit?: (choice: SelfDestructSelection) => Promise<void | boolean>,
  ): Promise<SelfDestructSelection | null> {
    if (!isCurrent()) return null;
    // 先捕获所有原存活身体和生命版本；后续目标死后复活或换组件不能复用旧选择。
    const targets = new Map(
      this.world.getAliveEntityIds().map((id) => {
        const alive = this.world.getComponent(id, COMPONENT.Alive)!;
        return [id, { alive, version: aliveLifeVersion(alive) }] as const;
      }),
    );
    // 各玩家请求并发，结果排列仍由原存活名单决定；不以最早响应决定谁自爆。
    const picks = await Promise.all(
      this.world.getAliveEntityIds().map(async (actorId) => {
        const role = this.world.getComponent(actorId, COMPONENT.Role);
        if (!role) return null;
        if (
          weddingSetup(this.world) &&
          (!ghostBrideReady(this.world) || weddingMember(this.world, role))
        )
          return null;
        const tools = this.roleRegistry.getAllowedTools(role.role);
        const tool = tools.includes("self_destruct_with_target")
          ? "self_destruct_with_target"
          : tools.includes("self_destruct")
            ? "self_destruct"
            : null;
        if (!tool) return null;
        if (
          tool === "self_destruct" &&
          (String(role.role) === RED_MOON_ROLE
            ? !demonRedMoonCanBlast(this.world, actorId)
            : !canRoleSelfDestruct(role, getDefaultRoleCatalog(), () => this.world.getComponent(actorId, COMPONENT.Camp)))
        )
          return null;
        // 白狼王复验同一库存对象；这里不消费，实际消耗仍归提交函数。
        const resource =
          tool === "self_destruct_with_target" ? getWhiteWolfKingState(role) : undefined;
        if (tool === "self_destruct_with_target" && resource?.canDetonate !== true) return null;
        // 原特殊资格和库存读取先行，保其首错误；已退休演员不再建立新请求。
        if (isRoleExecutionRetired(role)) return null;
        const life = targets.get(actorId)!;
        const request = requests.create({
          phase,
          actionWindow: window,
          actorId,
          allowedTools: [tool],
          stage: window,
          requiresAction: false,
          summary: {
            key:
              phase === Phase.Voting
                ? "request.summary.self_destruct_pre_vote"
                : "request.summary.self_destruct",
          },
          context: {},
        });
        const action = await provider.getAction(request);
        if (
          action?.name !== tool ||
          (action.name !== "self_destruct" && action.name !== "self_destruct_with_target")
        )
          return null;
        const choice: SelfDestructSelection =
          action.name === "self_destruct"
            ? { kind: "ordinary", actorId, targetId: null }
            : { kind: "white_wolf_king", actorId, targetId: action.args.target_id };
        return { choice, action, role, resource, life };
      }),
    );
    if (!isCurrent()) return null;
    // 提交前重复检查原玩家、目标、生命版本及特殊规则；字段恢复不抹去生命版本变化。
    const stillCurrent = (pick: NonNullable<(typeof picks)[number]>) => {
      const { actorId, targetId } = pick.choice;
      if (
        !isCurrent() ||
        (weddingSetup(this.world) &&
          (!ghostBrideReady(this.world) || weddingMember(this.world, pick.role))) ||
        this.world.getComponent(actorId, COMPONENT.Role) !== pick.role ||
        this.world.getComponent(actorId, COMPONENT.Alive) !== pick.life.alive ||
        !pick.life.alive.alive ||
        pick.life.version === undefined ||
        aliveLifeVersion(pick.life.alive) !== pick.life.version
      )
        return false;
      if (String(pick.role.role) === RED_MOON_ROLE && !demonRedMoonCanBlast(this.world, actorId))
        return false;
      if (
        pick.choice.kind === "white_wolf_king" &&
        (getWhiteWolfKingState(pick.role) !== pick.resource || pick.resource?.canDetonate !== true)
      )
        return false;
      if (targetId !== null) {
        const target = targets.get(targetId);
        if (
          !target ||
          this.world.getComponent(targetId, COMPONENT.Alive) !== target.alive ||
          !target.alive.alive ||
          target.version === undefined ||
          aliveLifeVersion(target.alive) !== target.version
        )
          return false;
      }
      // 等待后先完成原特殊权威、库存与目标复验；字段恢复不复活这个失败演员。
      return !isRoleExecutionRetired(pick.role);
    };
    // 网关预检前后均复验；预检成功只产生候选，不意味着库存付款或死亡已生效。
    const valid = picks.filter(
      (pick): pick is NonNullable<typeof pick> =>
        pick !== null &&
        stillCurrent(pick) &&
        this.toolGateway.validateAndSanitize(this.world, pick.choice.actorId, pick.action, {
          phase,
          actionWindow: window,
          allowSelfDestruct: true,
        }).ok &&
        stillCurrent(pick),
    );
    // 按玩家编号串行调用可选提交；false 跳过，异常停止并保留此前提交的前缀。
    for (const pick of valid.sort((a, b) => a.choice.actorId - b.choice.actorId)) {
      if (!isCurrent()) return null;
      if (!stillCurrent(pick)) continue;
      if ((await commit?.(pick.choice)) === false) continue;
      return pick.choice;
    }
    return null;
  }
}

/** 显式空窗口列表禁用全部机会；只有未配置列表才回退到原投票前默认窗口。 */
export function isSelfDestructWindowEnabled(
  config: ReadonlyBoardConfig,
  window: ActionWindow,
): boolean {
  return config.selfDestruct?.enabledWindows === undefined
    ? window === ActionWindow.OnPreVote
    : config.selfDestruct.enabledWindows.includes(window);
}
