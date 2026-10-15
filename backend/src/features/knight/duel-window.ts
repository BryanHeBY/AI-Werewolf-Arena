/**
 * 负责骑士白天决斗的完整选择窗口。输入为板子、原 World、请求构造端口、Provider、网关与提交回调；
 * 输出为原选择和是否结束白天，不在本窗口付款、标死或判胜。
 * 捕获演员和目标的存活组件、生命版本及角色／阵营字段，等待后按原顺序复验同一身体和库存。
 * 多骑士并发请求按编号尝试；网关预检两侧均复验，只有有效候选才要求提交回调。
 * 读取、Provider、网关及提交异常原样传播；已写前缀不回滚，缺少回调和明确 rejected 保留原分支。
 */
import type { ReadonlyBoardConfig } from "@ai-werewolf-arena/game-contract";
import { COMPONENT } from "../../domain/components/names";
import { AliveComponent, aliveLifeVersion } from "../../domain/components/alive";
import type { RoleComponent } from "../../domain/components/role";
import {
  Role,
  Phase,
  KnightDuelWindow as DuelWindow,
  type Camp,
  type ActionProvider,
  type KnightDuelSelection,
  type KnightDuelCommit,
} from "../../domain/model";
import type { World } from "../../domain/world";
import { ToolGateway } from "../../engine/actions/tool-gateway";
import type { ActionRequestConstructionPort } from "../../domain/actions";
import { getKnightState } from "./state";

/** 本次窗口保留原组件引用与当时字段值；不是可序列化玩家资料，也不授予资源或死亡写权。 */
interface DuelParticipantSnapshot {
  // 生命版本记录活跃身体的变化；仅将 alive 改回 true 不恢复旧选择。
  life: AliveComponent;
  version: ReturnType<typeof aliveLifeVersion>;
  role: RoleComponent;
  // 角色保原引用，阵营在原值点晚查；同值 Camp 组件替换仍保持这个值快照，不加引用撤权。
  roleId: Role;
  camp: Camp | undefined;
}

/** 决斗收集保留原提交等待点；真实付款、事实和死亡提案仍归回调与后续经理结算。 */
export class KnightDuelWindow {
  constructor(
    private readonly world: World,
    private readonly gateway: ToolGateway,
  ) {}
  async execute(
    config: ReadonlyBoardConfig,
    requests: ActionRequestConstructionPort,
    provider: ActionProvider,
    window: DuelWindow,
    isCurrent: () => boolean,
    commit?: (choice: KnightDuelSelection) => Promise<KnightDuelCommit>,
  ): Promise<{ selection: KnightDuelSelection | null; endsDay: boolean }> {
    // 原空结果在本次调用内共用；先查当前窗口，再按原配置或默认发言后机会筛选。
    const empty = { selection: null, endsDay: false };
    if (
      !isCurrent() ||
      !(config.knight?.enabledWindows ?? [DuelWindow.AfterSpeeches]).includes(window)
    )
      return empty;
    if (
      !this.world.getAliveEntityIds().some((id) => {
        const role = this.world.getComponent(id, COMPONENT.Role);
        return role?.role === Role.Knight && getKnightState(role)?.canDuel === true;
      })
    )
      return empty;
    // 先确认存在可决斗骑士，再完整捕获存活名单；不提前缓存配置、角色或库存。
    const snapshots = new Map<number, DuelParticipantSnapshot>(
      this.world.getAliveEntityIds().map((id) => {
        const life = this.world.getComponent(id, COMPONENT.Alive)!,
          role = this.world.getComponent(id, COMPONENT.Role)!;
        return [
          id,
          {
            life,
            version: aliveLifeVersion(life),
            role,
            roleId: role?.role,
            camp: role == null ? undefined : this.world.getComponent(id, COMPONENT.Camp)?.camp,
          },
        ] as const;
      }),
    );
    // 每个演员在请求前读取同一库存，Promise.all 保持快照名单顺序，不以响应先后提交。
    const picks = await Promise.all(
      [...snapshots].map(async ([actorId, actor]) => {
        const state = actor.role?.role === Role.Knight ? getKnightState(actor.role) : undefined;
        if (state?.canDuel !== true) return null;
        const action = await provider.getAction(
          requests.create({
            phase: Phase.Day,
            actorId,
            allowedTools: ["duel"],
            stage: window,
            requiresAction: false,
            summary: { key: "request.summary.knight_duel" },
            context: { duel_window: window },
          }),
        );
        if (action?.name !== "duel") return null;
        return { actorId, actor, state, action, target: snapshots.get(action.args.target_id) };
      }),
    );
    // 原生命、组件、角色及阵营字段都需匹配；此查询不消费库存，也不修改捕获对象。
    const sameLife = (id: number, snapshot: DuelParticipantSnapshot) =>
      this.world.getComponent(id, COMPONENT.Alive) === snapshot.life &&
      snapshot.life.alive &&
      snapshot.version !== undefined &&
      aliveLifeVersion(snapshot.life) === snapshot.version &&
      this.world.getComponent(id, COMPONENT.Role) === snapshot.role &&
      snapshot.role?.role === snapshot.roleId &&
      (snapshot.role == null ? undefined : this.world.getComponent(id, COMPONENT.Camp)?.camp) ===
        snapshot.camp;
    for (const pick of picks
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .sort((a, b) => a.actorId - b.actorId)) {
      // 按编号排序后的每次尝试，均在网关前后复验阶段、同一库存和目标生命。
      const valid = () =>
        isCurrent() &&
        sameLife(pick.actorId, pick.actor) &&
        getKnightState(pick.actor.role) === pick.state &&
        pick.state.canDuel &&
        pick.target !== undefined &&
        sameLife(pick.action.args.target_id, pick.target);
      if (
        !valid() ||
        !this.gateway.validateAndSanitize(this.world, pick.actorId, pick.action, {
          phase: Phase.Day,
          duelWindow: window,
          allowKnightDuel: true,
        }).ok ||
        !valid()
      )
        continue;
      // 缺回调只在有效候选处报原错误；rejected 继续下一项，提交抛错不回滚已有写入。
      if (!commit) throw new Error("knight_duel_commit_missing");
      const selection = { actorId: pick.actorId, targetId: pick.action.args.target_id },
        outcome = await commit(selection);
      if (outcome === "rejected") continue;
      return { selection, endsDay: outcome === "night" || outcome === "terminal" };
    }
    return empty;
  }
}
