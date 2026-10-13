/**
 * 负责把权威 World 的玩家观察交给各席位受限策略。输入为原 World、策略表与行动请求；
 * 输出为脱离并冻结观察上的工具选择，不把 World、对手私态或运行授权交给策略。
 * 除 World 和策略表外，仅保存默认角色目录；不构造提示模板、展示注册表或开局配比缓存。
 * 每次请求先查策略，再按原查询时点捕获角色、队友与知识；缺失策略不读取游戏状态。
 * 观察、候选和返回动作均不授予提交权限；资源、生命、阶段与付款仍由引擎复验。
 */
import type { ActionRequest, EntityId, ToolCall } from "@ai-werewolf-arena/game-contract";
import type { ActionProvider } from "../core/domain/actions";
import { COMPONENT } from "../core/domain/components/names";
import type { RoleComponent } from "../core/domain/components/role";
import type { World } from "../core/domain/world";
import type { ObservedPlayerStrategy } from "../game/observation/player-observation";
import { capturePlayerObservation } from "../game/observation/player-observation-projector";
import type { RoleCatalog } from "../game/mechanisms/roles/catalog";
import { getDefaultRoleCatalog } from "../game/mechanisms/roles/role-catalog-assembly";
import { knownWolfTeammates } from "../game/mechanisms/roles/wolf_team";

/** 原体只归应用捕获适配器，受限策略只得到游戏观察 owner 的脱离 DTO。 */
export class ObservedPlayersActionProvider implements ActionProvider {
  private readonly catalog: RoleCatalog;

  constructor(
    private readonly world: World,
    private readonly strategies: ReadonlyMap<number, ObservedPlayerStrategy>,
  ) {
    this.catalog = getDefaultRoleCatalog();
  }

  async getAction(request: ActionRequest): Promise<ToolCall | null> {
    const strategy = this.strategies.get(request.actorId);
    if (!strategy) throw new Error("observed_player_strategy_missing");
    // 回调在原表达式处读取；role／wolfTeammates 方法先查找，再读取请求 actor 参数。
    return strategy.decide(capturePlayerObservation(request, {
      world: () => this.world,
      role: (actorId) => this.role(actorId()),
      wolfTeammates: (actorId) => this.wolfTeammates(actorId()),
      catalog: () => this.catalog,
    }));
  }

  private role(actorId: EntityId): RoleComponent | undefined {
    return this.world.getComponent(actorId, COMPONENT.Role);
  }

  private wolfTeammates(actorId: EntityId): EntityId[] {
    return knownWolfTeammates(this.world, actorId, this.catalog);
  }
}
