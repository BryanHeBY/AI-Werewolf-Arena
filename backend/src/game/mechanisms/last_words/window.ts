/**
 * 负责完整遗言行动窗口：输入原死亡名单、来源／政策、执行阶段及当前性回调，输出已清洗的遗言事件。
 * 运行依赖保留 World、事件数组、状态、网关和原遗言机制引用，在原表达式处晚读；构造器端口必填且每次收集独立 new。
 * 政策与授予事实仍归 LastWordsMechanism，原生命许可由 World 唯一持有；本窗口不标死、推进阶段、判胜或消费枪／警徽。
 * 请求和回复只是数据；独立交付租约 pin 原信封／来源字段、隔离坏别名并共享最早期限，不能替代 World 许可。
 * 等待、网关及发表前均晚核租约，真正发表成功后才通知 true；开放后的退出仍关闭许可，原关闭错误优先。
 */
import type { ActionRequestFactoryConstructorPort } from "../../../domain/actions";
import type { LastWordsPolicy } from "../../../domain/board";
import type {
  ActionProvider,
  EntityId,
  GameEvent,
  Phase,
  RuntimeSnapshot,
  DeathSources,
} from "../../../domain/model";
import type { World } from "../../../domain/world";
import { RequestLease, type RequestLeaseTurn } from "../../../domain/request-lease";
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

/** 每个真实请求独立持有捕获日次和晚域查询，不透明对象不进入提示，也不能由 death_action_id 重建。 */
interface LastWordsRequestScope {
  actorId: EntityId;
  phase: Phase;
  day: number;
  current(): boolean;
}

// 复用唯一请求租约 owner；三个来源字段只 pin 创建时值／引用，不校验深层 JSON 或创建第二死亡许可。
const lastWordsRequests = RequestLease.window<LastWordsRequestScope>({
  actorId: (scope) => scope.actorId,
  phase: (scope) => scope.phase,
  day: (scope) => scope.day,
  stage: () => "last_words",
  current: (scope) => scope.current(),
}, 130, ["trigger", "death_phase", "death_action_id"]);

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
      let delivery: RequestLeaseTurn | undefined;
      let failed = false;
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
        const requestScope: LastWordsRequestScope = {
          actorId: deadId,
          phase,
          day,
          // 新交付政策在 create 后也完整查阶段／日次／终局；查询仍按原 scope→状态→真实 permit 顺序。
          current: () =>
            scopeCurrent() &&
            this.runtime.state.phase === phase &&
            this.runtime.state.day === day &&
            !this.runtime.state.gameOver &&
            this.runtime.world.hasDeathAction(deadId, "speak", phase, day, permit.id),
        };
        lastWordsRequests.bind(requestScope, request);
        delivery = lastWordsRequests.openDelivery(requestScope, request);
        if (!delivery) return;
        // 先保原 provider callee／receiver，再准备新增调用口；最后守卫后只调用已准备函数，不能晚读 .apply。
        const getAction = actionProvider.getAction;
        const actionArguments: [typeof request] = [request];
        const invokeAction = Reflect.apply.bind(Reflect);
        if (!delivery.current()) return;
        const action = await invokeAction(getAction, actionProvider, actionArguments);
        if (!delivery.current()) return;
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
        if (!delivery.current()) return;
        // 保留 push callee→时间戳→日次→清洗后文字的读取序；新增调用准备也在末守卫前，发表失败不回滚前缀。
        const events = this.runtime.events;
        const publish = events.push;
        const publication: GameEvent = {
          timestamp: Date.now(),
          type: "last_words_spoken",
          payload: {
            playerId: deadId,
            phase,
            day: this.runtime.state.day,
            text: validated.sanitizedCall.args.text,
          },
        };
        const publicationArguments: [GameEvent] = [publication];
        const invokePublication = Reflect.apply.bind(Reflect);
        if (!delivery.current()) return;
        invokePublication(publish, events, publicationArguments);
        // 只以实际 push 正常返回确认完成；先终结租约再通知，true 回调晚错不撤事件或二次 false。
        delivery.complete();
      } catch (error) {
        failed = true;
        throw error;
      } finally {
        try {
          permit.close();
        } catch (error) {
          failed = true;
          throw error;
        } finally {
          // 原 close 仍覆盖正文错误；新增 false 通知只在没有旧错时传播，boolean 同样保 throw undefined。
          if (failed) {
            try { delivery?.close(); } catch { /* 保留正在传播的正文／许可关闭错误。 */ }
          } else {
            delivery?.close();
          }
        }
      }
    }
  }
}
