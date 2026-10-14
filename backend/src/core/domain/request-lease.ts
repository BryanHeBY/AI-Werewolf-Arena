/**
 * 负责四种已使用的有序请求绑定协议：接纳原请求、查询原作用域、比较期限别名并传播同一记录。
 * 输入为原请求和机制的晚读查询；输出为原 scope 引用或未接纳，绑定仅写本实例的运行 weak table。
 * 四个机制实例互不覆盖，可在同一请求上先后登记；每实例固定一个传播回调，顺序由装配端给出。
 * 原表没有期限数值检查、交付 guard、completion 或永久撤权；字段恢复可重新通过原查询，关闭仍由机制决定。
 * 只读 query 类型不冻结对象或授予权限；本 owner 不直接查询 World、Role、库存或档案，不新增授权判断。
 * 具体机制仍唯一拥有 scope、资源和关闭数据；这里仅保存原引用及请求关联。
 * 先写绑定再登记回调；后续 getter、比较或传播抛错保留已经完成的前缀，不回滚其它实例。
 */
import type { ActionRequest } from "./actions";
import { registerRequestAliasPropagation } from "./request_delivery";

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
interface ItemBinding<Owner, Scope> extends ScopeBinding<Scope> {
  world: Owner;
  actorId: number;
  instanceId: string;
}

// 排除 deadlineAtMs 是旧传播接受面，不代表期限有限、未过期或只会缩短。
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

/**
 * 每实例唯一持有请求登记；类型入口只开放固定协议，实际机制接线不传完整 request callback。
 * 私有构造签名限制 typed 调用，不是运行时权限屏障；接纳算法在本 owner 内完整执行。
 * 下列四个固定协议只组织当前已有读取顺序；不建立 Role 分派、注册表或通用规则框架。
 */
export class RequestLease<Owner, Scope, Binding> {
  private readonly records = new WeakMap<ActionRequest, Binding>();
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
  ) {}

  /** actor→phase→day→stage；查询还先核同一活跃 scope，不补机制的完整当前性判断。 */
  static actorPhaseDayStage<Owner, Scope>(
    queries: RequestLeaseScopeQueries<Owner, Scope>,
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
          lease.records.set(request, { scope, context: request.context });
          registerRequestAliasPropagation(request, lease.order, lease.propagate);
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
          lease.records.set(request, { binding: b, context: request.context });
          registerRequestAliasPropagation(request, lease.order, lease.propagate);
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
          lease.records.set(request, { binding: b, context: request.context });
          registerRequestAliasPropagation(request, lease.order, lease.propagate);
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
    );
  }

  /** 原物品入口只核 token/instance；phase/day/stage 留在查询，不能提前强化接纳或原作者当前性。 */
  static item<Owner, Scope, Author>(
    queries: RequestLeaseItemQueries<Owner, Scope, Author>,
    order: number,
  ): RequestLease<Owner, Scope, ItemBinding<Owner, Scope>> {
    return new RequestLease<Owner, Scope, ItemBinding<Owner, Scope>>(
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
          lease.records.set(request, {
            scope: a,
            world,
            actorId: request.actorId,
            instanceId: queries.instanceId(author),
            context: request.context,
          });
          registerRequestAliasPropagation(request, lease.order, lease.propagate);
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
    );
  }

  /** 各协议在原位置先取 set callee，再构造记录写表和登记；登记异常不撤销本次绑定。 */
  bind(owner: Owner, request: ActionRequest): void {
    this.bindRequest(owner, request, this);
  }

  /** 失配只拒本次查询；字段恢复仍按原机制规则核验，不自行关闭共同作用域。 */
  scope(owner: Owner, request: ActionRequest): Scope | undefined {
    const binding = this.records.get(request);
    return binding && this.matches(owner, request, binding) ? this.bindingScope(binding) : undefined;
  }

  /** 先查已登记来源和原 scope，再枚举 target；失败别名不修改来源，成功继承同一记录。 */
  private inherit(source: ActionRequest, target: ActionRequest): void {
    const binding = this.records.get(source);
    if (!binding || !this.scope(this.bindingOwner(binding), source)) return;
    if (!this.sameFields(source, target)) return;
    this.records.set(target, binding);
    registerRequestAliasPropagation(target, this.order, this.propagate);
  }
}
