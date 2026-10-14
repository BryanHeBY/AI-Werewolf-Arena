/**
 * 负责完整遗言行动窗口：输入原死亡名单、来源／政策、执行阶段及当前性回调，输出已清洗的遗言事件。
 * 运行依赖保留 World、事件数组、状态、网关和原遗言机制引用，在原表达式处晚读；构造器端口必填且每次收集独立 new。
 * 政策与授予事实仍归 LastWordsMechanism，原生命许可由 World 唯一持有；本窗口不标死、推进阶段、判胜或消费枪／警徽。
 * 请求和回复只是数据，等待与校验后仍复验许可。开放成功后的退出都关闭许可，关闭异常保留原 finally 错误优先级。
 */
import type { ActionRequestFactoryConstructorPort } from "../../../core/domain/actions";
import type { LastWordsPolicy } from "../../../core/domain/board";
import type {
  ActionProvider,
  EntityId,
  GameEvent,
  Phase,
  RuntimeSnapshot,
  DeathSources,
} from "../../../core/domain/model";
import type { World } from "../../../core/domain/world";
import type { ToolGateway } from "../../gateway/tool_gateway";
import type { LastWordsGrantContext, LastWordsMechanism } from "./last_words_mechanism";

/** 只声明原运行依赖的读口；readonly 不冻结原对象、拍摄状态快照或授予死亡行动。 */
export interface LastWordsWindowRuntime {
  readonly requestFactory: ActionRequestFactoryConstructorPort;
  readonly world: World;
  readonly events: GameEvent[];
  readonly state: RuntimeSnapshot;
  readonly toolGateway: ToolGateway;
  readonly lastWordsMechanism: LastWordsMechanism;
}

/** 持有同一运行依赖对象；构造本窗口不查询其字段，真正的工厂构造保留在收集入口。 */
export class LastWordsWindow {
  constructor(private readonly runtime: LastWordsWindowRuntime) {}

  /** 授予事实不替代发言窗口；每位死者等待回复后复核阶段、日期、终局与原生命许可，再写发言。 */
  async collect(
    deadIds: EntityId[],
    phase: Phase,
    deathPhase: Phase,
    sources: DeathSources,
    actionProvider: ActionProvider,
    deathPhases: Readonly<Record<EntityId, Phase>>,
    scopeCurrent: () => boolean = () => true,
    policy: LastWordsPolicy = "awa_initial_wave_v1",
    wordsContext?: LastWordsGrantContext,
  ): Promise<void> {
    // 构造器先查询，再按原顺序取 World／事件／第一次日期；构造完成后另读本次收集日期。
    const requests = new this.runtime.requestFactory(this.runtime.world, this.runtime.events, this.runtime.state.day);
    const day = this.runtime.state.day;
    for (const deadId of deadIds) {
      // 来源阶段与政策先于当前性和许可；不以授予事件或请求字段代替 World 的原生命绑定。
      const actualDeathPhase = deathPhases[deadId] ?? deathPhase;
      if (
        !this.runtime.lastWordsMechanism.shouldGrantLastWords(
          actualDeathPhase,
          day,
          sources[deadId] ?? [],
          policy,
          wordsContext,
        )
      )
        continue;
      if (
        !scopeCurrent() ||
        this.runtime.state.phase !== phase ||
        this.runtime.state.day !== day ||
        this.runtime.state.gameOver
      )
        return;
      // 开放抛错仍发生在 try 外；开放成功后，所有 return／continue 与原异常都经过 finally。
      const permit = this.runtime.world.openDeathAction(deadId, "speak", phase, day, scopeCurrent);
      try {
        const request = requests.create({
          phase,
          actorId: deadId,
          allowedTools: ["speak"],
          stage: "last_words",
          requiresAction: true,
          summary: { key: "request.summary.last_words" },
          context: {
            trigger: "last_words",
            death_phase: actualDeathPhase,
            death_action_id: permit.id,
          },
        });
        if (!scopeCurrent() || !this.runtime.world.hasDeathAction(deadId, "speak", phase, day, permit.id))
          return;
        // 等待前后分别复验；回复不会重开已经撤销的生命许可。
        const action = await actionProvider.getAction(request);
        if (
          !scopeCurrent() ||
          this.runtime.state.phase !== phase ||
          this.runtime.state.day !== day ||
          this.runtime.state.gameOver ||
          !this.runtime.world.hasDeathAction(deadId, "speak", phase, day, permit.id)
        )
          return;
        if (action?.name !== "speak") {
          continue;
        }
        const validated = this.runtime.toolGateway.validateAndSanitize(this.runtime.world, deadId, action, {
          phase,
          day: this.runtime.state.day,
          deathActionId: permit.id,
        });
        if (!validated.ok || !validated.sanitizedCall) {
          continue;
        }
        if (
          !scopeCurrent() ||
          this.runtime.state.phase !== phase ||
          this.runtime.state.day !== day ||
          this.runtime.state.gameOver ||
          !this.runtime.world.hasDeathAction(deadId, "speak", phase, day, permit.id)
        )
          return;
        // 保留 push callee→时间戳→日次→清洗后文字的原读取点，发表失败不回滚已完成前缀。
        this.runtime.events.push({
          timestamp: Date.now(),
          type: "last_words_spoken",
          payload: {
            playerId: deadId,
            phase,
            day: this.runtime.state.day,
            text: validated.sanitizedCall.args.text,
          },
        });
      } finally {
        // 不捕获关闭错误；close 抛错仍按原 finally 语义覆盖正在传播的正文错误。
        permit.close();
      }
    }
  }
}
