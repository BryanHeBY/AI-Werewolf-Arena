/**
 * 负责四种有序请求绑定协议及其有限运行租约。输入为原请求、机制晚查询和期限别名；
 * 输出为同一 scope 引用和一次完成通知，只写本实例的请求／租约元数据，不写 World、生命或库存。
 * 四实例保独立表及稳定传播回调；同请求可多绑定，但真实窗口只打开对应一个交付 turn。
 * 原 envelope 或领域当前性观察失配永久关闭共同许可；别名自己的字段失配只退役该别名。
 * 合法期限别名共享最早绝对预算，观察到期后时钟回退也不复活。字段 pin 只保顶层原值引用，
 * 不深复制／冻结提示或 feed，不把相同 JSON、readonly 或请求字段当成领域许可。
 * Provider 返回不是付款；窗口完整付款后才 complete，状态先落再通知，晚异常不能二次结算。
 */
import type { ActionRequest } from "./actions";
import { bindRequestDeliveryGuard, registerRequestAliasPropagation, settleRequestDelivery } from "./request_delivery";

/** 仅晚读原 scope 字段／活跃表；不接受整个请求回调，字段接纳与读取次序在本 owner 中实现。 */
export interface RequestLeaseScopeQueries<Owner, Scope> {
  active(owner: Owner): Scope | undefined;
  owner(scope: Scope): Owner;
  actorId(scope: Scope): number;
  phase(): ActionRequest["phase"];
  stage(scope: Scope): ActionRequest["context"]["stage"];
}

/** current 仍调用原机制规则；不能据请求字段相同代替原体、生命和库存复验。 */
export interface RequestLeaseCurrentQueries<Owner, Scope> extends RequestLeaseScopeQueries<Owner, Scope> {
  current(scope: Scope): boolean;
}

/** 墙入口先查原作者；原 token／实例值在条件和记录构造位置各自读取，不缓存授权或复制作者。 */
export interface RequestLeaseItemQueries<Owner, Scope, Author> {
  active(owner: Owner): Scope | undefined;
  authors(scope: Scope): Pick<ReadonlyMap<number, Author>, "get">;
  token(scope: Scope): string;
  instanceId(author: Author): string;
  phase(): ActionRequest["phase"];
  stage(): ActionRequest["context"]["stage"];
  current(owner: Owner, scope: Scope, author: Author): boolean;
}

/** context 保原引用，记录不是请求 DTO；合法别名共享同一记录，不做深只读或序列化。 */
interface ScopeBinding<Scope> {
  scope: Scope;
  context: ActionRequest["context"];
}
interface CurrentBinding<Scope> {
  binding: Scope;
  context: ActionRequest["context"];
}
/** 捕获墙的原 owner／作者编号与实例值；后续查询仍晚查活跃墙，不能由编号自行生成许可。 */
interface ItemBinding<Owner, Scope, Author> extends ScopeBinding<Scope> {
  author: Author;
  world: Owner;
  actorId: number;
  instanceId: string;
}

// 字段比较仍排除 deadlineAtMs；其有限未来／只能缩短的政策在比较成功后单独处理。
function sameIndexedFields(source: ActionRequest, target: ActionRequest): boolean {
  const keys = Object.keys(source).filter((k) => k !== "deadlineAtMs"),
    other = Object.keys(target).filter((k) => k !== "deadlineAtMs");
  return !(
    keys.length !== other.length ||
    keys.some((k) => !other.includes(k) || (source as any)[k] !== (target as any)[k])
  );
}
function everyIndexedField(source: ActionRequest, target: ActionRequest): boolean {
  const keys = Object.keys(source).filter((k) => k !== "deadlineAtMs"),
    other = Object.keys(target).filter((k) => k !== "deadlineAtMs");
  return (
    keys.length === other.length &&
    keys.every((k) => other.includes(k) && (source as any)[k] === (target as any)[k])
  );
}
function everyReflectedField(source: ActionRequest, target: ActionRequest): boolean {
  const keys = Object.keys(source).filter((k) => k !== "deadlineAtMs"),
    other = Object.keys(target).filter((k) => k !== "deadlineAtMs");
  return (
    keys.length === other.length &&
    keys.every((k) => other.includes(k) && Reflect.get(source, k) === Reflect.get(target, k))
  );
}

/** 窗口私有的运行完成端口；不持 World/付款回调，不可由 JSON 或请求字段重建。 */
export interface RequestLeaseTurn {
  current(): boolean;
  complete(): void;
  close(): void;
}
/** pin 只核顶层枚举字段及原值引用；嵌套数据/合法 getter/Proxy 不套新 schema 或深只读政策。 */
interface FieldPin { keys: string[]; values: unknown[] }
interface LeaseTurn<Owner, Binding> {
  owner: Owner;
  original: ActionRequest;
  binding: Binding;
  pin?: FieldPin;
  originalDeadline?: unknown;
  deadline: number | null;
  closed: boolean;
  settled: boolean;
  opened: boolean;
  completion: object;
  aliases: Set<ActionRequest>;
  handle?: RequestLeaseTurn;
}
interface LeaseEntry<Owner, Binding> {
  turn: LeaseTurn<Owner, Binding>;
  retired: boolean;
  deadline: unknown;
}
function pinFields(request: ActionRequest): FieldPin {
  const keys = Object.keys(request).filter((key) => key !== "deadlineAtMs");
  return { keys, values: keys.map((key) => Reflect.get(request, key)) };
}
function samePinnedFields(request: ActionRequest, pin: FieldPin): boolean {
  const keys = Object.keys(request).filter((key) => key !== "deadlineAtMs");
  return keys.length === pin.keys.length && keys.every((key) => {
    const index = pin.keys.indexOf(key);
    return index !== -1 && Object.is(Reflect.get(request, key), pin.values[index]);
  });
}

/**
 * 每实例唯一持有请求登记；类型入口只开放固定协议，实际机制接线不传完整 request callback。
 * 私有构造签名限制 typed 调用，不是运行时权限屏障；接纳算法在本 owner 内完整执行。
 * 四个协议正文保原字段短路，外围另执行 F02 租约政策；不建立 Role 分派、注册表或通用规则框架。
 */
export class RequestLease<Owner, Scope, Binding> {
  private readonly records = new WeakMap<ActionRequest, LeaseEntry<Owner, Binding>>();
  private readonly propagate = (source: ActionRequest, target: ActionRequest): void => {
    this.inherit(source, target);
  };

  private constructor(
    private readonly order: number,
    private readonly bindRequest: (owner: Owner, request: ActionRequest, lease: RequestLease<Owner, Scope, Binding>) => void,
    private readonly matches: (owner: Owner, request: ActionRequest, binding: Binding) => boolean,
    private readonly bindingOwner: (binding: Binding) => Owner,
    private readonly bindingScope: (binding: Binding) => Scope,
    private readonly sameFields: (source: ActionRequest, target: ActionRequest) => boolean,
    private readonly domainCurrent: (owner: Owner, binding: Binding) => boolean,
  ) {}

  /** actor→phase→day→stage；查询还先核同一活跃 scope，末位晚核机制当前性。 */
  static actorPhaseDayStage<Owner, Scope>(
    queries: RequestLeaseCurrentQueries<Owner, Scope>,
    order: number,
  ): RequestLease<Owner, Scope, ScopeBinding<Scope>> {
    return new RequestLease<Owner, Scope, ScopeBinding<Scope>>(
      order,
      (owner, request, lease) => {
        const scope = queries.active(owner);
        if (
          scope &&
          request.actorId === queries.actorId(scope) &&
          request.phase === queries.phase() &&
          request.context.day === 1 &&
          request.context.stage === queries.stage(scope)
        ) {
          lease.records.set(request, lease.entry(owner, request, { scope, context: request.context }));
          registerRequestAliasPropagation(request, lease.order, lease.propagate);
          lease.capture(request);
        }
      },
      (owner, request, binding) =>
        queries.owner(binding.scope) === owner &&
        queries.active(owner) === binding.scope &&
        request.actorId === queries.actorId(binding.scope) &&
        request.context === binding.context &&
        request.phase === queries.phase() &&
        request.context.day === 1 &&
        request.context.stage === queries.stage(binding.scope),
      (binding) => queries.owner(binding.scope),
      (binding) => binding.scope,
      sameIndexedFields,
      (_owner, binding) => queries.current(binding.scope),
    );
  }

  /** stage→phase→day→actor→current；查询保原 context→stage→day→phase→current 顺序和 Reflect.get 比较。 */
  static stagePhaseDayActor<Owner, Scope>(
    queries: RequestLeaseCurrentQueries<Owner, Scope>,
    order: number,
  ): RequestLease<Owner, Scope, CurrentBinding<Scope>> {
    return new RequestLease<Owner, Scope, CurrentBinding<Scope>>(
      order,
      (owner, request, lease) => {
        const b = queries.active(owner);
        if (
          b &&
          request.context.stage === queries.stage(b) &&
          request.phase === queries.phase() &&
          request.context.day === 1 &&
          request.actorId === queries.actorId(b) &&
          queries.current(b)
        ) {
          lease.records.set(request, lease.entry(owner, request, { binding: b, context: request.context }));
          registerRequestAliasPropagation(request, lease.order, lease.propagate);
          lease.capture(request);
        }
      },
      (owner, request, a) =>
        queries.owner(a.binding) === owner &&
        request.actorId === queries.actorId(a.binding) &&
        request.context === a.context &&
        request.context.stage === queries.stage(a.binding) &&
        request.context.day === 1 &&
        request.phase === queries.phase() &&
        queries.current(a.binding),
      (binding) => queries.owner(binding.binding),
      (binding) => binding.binding,
      everyReflectedField,
      () => true, // 原 matches 已在末位调用本族 current，不重复那一次。
    );
  }

  /** actor→phase→stage→day→current；查询的 phase 必须先于 context 身份，不重排成上一种协议。 */
  static actorPhaseStageDay<Owner, Scope>(
    queries: RequestLeaseCurrentQueries<Owner, Scope>,
    order: number,
  ): RequestLease<Owner, Scope, CurrentBinding<Scope>> {
    return new RequestLease<Owner, Scope, CurrentBinding<Scope>>(
      order,
      (owner, request, lease) => {
        const b = queries.active(owner);
        if (
          b &&
          request.actorId === queries.actorId(b) &&
          request.phase === queries.phase() &&
          request.context.stage === queries.stage(b) &&
          request.context.day === 1 &&
          queries.current(b)
        ) {
          lease.records.set(request, lease.entry(owner, request, { binding: b, context: request.context }));
          registerRequestAliasPropagation(request, lease.order, lease.propagate);
          lease.capture(request);
        }
      },
      (owner, request, a) =>
        queries.owner(a.binding) === owner &&
        request.actorId === queries.actorId(a.binding) &&
        request.phase === queries.phase() &&
        request.context === a.context &&
        request.context.stage === queries.stage(a.binding) &&
        request.context.day === 1 &&
        queries.current(a.binding),
      (binding) => queries.owner(binding.binding),
      (binding) => binding.binding,
      everyIndexedField,
      () => true,
    );
  }

  /** 原物品入口只核 token/instance；phase/day/stage 留在查询，原作者当前性在查询成功后才晚核。 */
  static item<Owner, Scope, Author>(
    queries: RequestLeaseItemQueries<Owner, Scope, Author>,
    order: number,
  ): RequestLease<Owner, Scope, ItemBinding<Owner, Scope, Author>> {
    return new RequestLease<Owner, Scope, ItemBinding<Owner, Scope, Author>>(
      order,
      (world, request, lease) => {
        const a = queries.active(world),
          author = a == null ? undefined : queries.authors(a).get(request.actorId);
        if (
          a &&
          author &&
          request.context.wall_id === queries.token(a) &&
          request.context.item_instance_id === queries.instanceId(author)
        ) {
          lease.records.set(request, lease.entry(world, request, {
            scope: a,
            world,
            actorId: request.actorId,
            instanceId: queries.instanceId(author),
            context: request.context,
            author,
          }));
          registerRequestAliasPropagation(request, lease.order, lease.propagate);
          lease.capture(request);
        }
      },
      (world, request, binding) =>
        queries.active(world) === binding.scope &&
        request.actorId === binding.actorId &&
        request.context === binding.context &&
        request.context.wall_id === queries.token(binding.scope) &&
        request.context.item_instance_id === binding.instanceId &&
        request.phase === queries.phase() &&
        request.context.day === 1 &&
        request.context.stage === queries.stage(),
      (binding) => binding.world,
      (binding) => binding.scope,
      sameIndexedFields,
      (owner, binding) => queries.current(owner, binding.scope, binding.author),
    );
  }

  /** 条件与 set callee 保原位置；同对象已登记后不得重新 bind 来复活旧 turn。 */
  bind(owner: Owner, request: ActionRequest): void {
    if (this.records.has(request)) return;
    this.bindRequest(owner, request, this);
  }

  /** 只分配运行记录；原 binding/context 已在参数原位置读出。pin 在 set 与传播登记之后才读取。 */
  private entry(owner: Owner, original: ActionRequest, binding: Binding): LeaseEntry<Owner, Binding> {
    return { turn: { owner, original, binding, closed: true, settled: false, opened: false,
      completion: {}, aliases: new Set(), deadline: null }, retired: false, deadline: undefined };
  }

  private capture(request: ActionRequest): void {
    const entry = this.records.get(request)!, turn = entry.turn;
    // 捕获期间先保持关闭：新增 keys/getter 抛错保原已写记录／传播前缀，恢复字段也不重开。
    turn.pin = pinFields(request);
    entry.deadline = request.deadlineAtMs;
    turn.originalDeadline = entry.deadline;
    if (entry.deadline === undefined) turn.closed = false;
    else if (typeof entry.deadline === "number" && Number.isFinite(entry.deadline) && entry.deadline > Date.now()) {
      turn.deadline = entry.deadline;
      turn.closed = false;
    }
  }

  /** 外来 World／未登记请求先拒；alias 自身失配先隔离，不读取或毒化 original。 */
  scope(owner: Owner, request: ActionRequest): Scope | undefined {
    const entry = this.records.get(request);
    if (!entry || entry.turn.owner !== owner || entry.turn.closed || entry.retired) return;
    const turn = entry.turn;
    if (request !== turn.original) {
      try {
        if (!samePinnedFields(request, turn.pin!) || !Object.is(request.deadlineAtMs, entry.deadline)) {
          entry.retired = true;
          return;
        }
      } catch (error) {
        entry.retired = true;
        throw error;
      }
    }
    try {
      // 四协议仍按各原 ordered matches 查询 original；共同 context.stage 变坏会关共同 turn。
      if (!this.matches(owner, turn.original, turn.binding) ||
          !samePinnedFields(turn.original, turn.pin!) ||
          !Object.is(turn.original.deadlineAtMs, turn.originalDeadline) ||
          !this.domainCurrent(owner, turn.binding) ||
          (turn.deadline !== null && turn.deadline <= Date.now())) {
        turn.closed = true;
        return;
      }
      return this.bindingScope(turn.binding);
    } catch (error) {
      turn.closed = true;
      throw error;
    }
  }

  /**
   * 真正窗口在 create 后打开交付：四绑定实例不争写 guard。前后登记的 alias 同 guard／completion，
   * 这些引用只留本 owner 的运行集合，不挂 context。每个 Wall request 的 turn 独立于整个墙。
   */
  openDelivery(owner: Owner, request: ActionRequest): RequestLeaseTurn | undefined {
    if (!this.scope(owner, request)) return;
    const turn = this.records.get(request)!.turn;
    if (!turn.handle) turn.handle = {
      current: () => this.scope(owner, request) !== undefined,
      complete: () => this.finish(turn, true),
      close: () => this.finish(turn, false),
    };
    if (!turn.opened) {
      bindRequestDeliveryGuard(turn.original, () => this.scope(owner, turn.original) !== undefined, turn.completion);
      turn.opened = true;
      for (const alias of turn.aliases) this.bindDelivery(turn, alias);
    }
    return turn.handle;
  }

  private bindDelivery(turn: LeaseTurn<Owner, Binding>, request: ActionRequest): void {
    bindRequestDeliveryGuard(request, () => this.scope(turn.owner, request) !== undefined, turn.completion);
  }

  /** 付款结果只由真实窗口给出；不重查已被付款改变的 pending scope。先落终态再发一次通知。 */
  private finish(turn: LeaseTurn<Owner, Binding>, accepted: boolean): void {
    if (turn.settled) return;
    turn.closed = true;
    turn.settled = true;
    turn.aliases.clear();
    settleRequestDelivery(turn.completion, accepted);
  }

  /** 先核来源，再原 ordered fields，最后有限未来期限；坏目标／其 getter 异常不修改来源预算。 */
  private inherit(source: ActionRequest, target: ActionRequest): void {
    const sourceEntry = this.records.get(source);
    if (!sourceEntry || !this.scope(sourceEntry.turn.owner, source) || this.records.has(target)) return;
    if (!this.sameFields(source, target)) return;
    const turn = sourceEntry.turn;
    // 原 === 比较通过后仍须核 F02 pin（含 +0/-0 及晚 getter 原值）；非法目标不得先写记录／缩预算。
    if (!samePinnedFields(target, turn.pin!)) return;
    const deadline = target.deadlineAtMs;
    if (typeof deadline !== "number" || !Number.isFinite(deadline) || deadline <= Date.now() ||
        (turn.deadline !== null && deadline > turn.deadline)) return;
    this.records.set(target, { turn, retired: false, deadline });
    turn.deadline = deadline;
    turn.aliases.add(target);
    registerRequestAliasPropagation(target, this.order, this.propagate);
    if (turn.opened) this.bindDelivery(turn, target);
  }
}
