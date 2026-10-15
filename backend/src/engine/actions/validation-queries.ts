/**
 * 负责验证扩展的实际窄查询对象，以及可信内建规则的原程序绑定。
 * 输入为可信宿主或原候选，输出为窄值查询或原规则结果；自定义 ToolRule 不收到 World、Catalog 或请求 scope。
 * 内建定义表只存静态函数与 scope 所属身份；每次调用才绑定原 host，不缓存局、许可或资源。
 * 私有绑定不是新的授权：每个原领域程序仍用同一 World 与原 opaque scope 复验。
 */
import {
  type Camp,
  type Role,
  type EntityId,
  type ToolCall,
  type RuleViolation,
} from "@ai-werewolf-arena/game-contract";
import { COMPONENT } from "../../domain/components/names";
import type { RoleComponent } from "../../domain/components/role";
import type { World } from "../../domain/world";
import type { RoleCatalog } from "../../rulesets/roles/catalog";
import type { ToolRule, ToolRuleMap, ValidationRuleContext } from "./validation-contracts";

/** 实际对象只具有这些值查询；不返回 World、组件 Map、可写句柄或可关闭的死亡许可。 */
export interface ValidationQueries {
  readonly isAlive: (id: EntityId) => boolean;
  readonly aliveIds: () => readonly EntityId[];
  readonly currentCampValue: (id: EntityId) => Camp | undefined;
  readonly hasRole: (id: EntityId) => boolean;
  readonly roleValue: (id: EntityId) => Role | undefined;
}
/** 只在可信接收／验证 host 内传递，不作为可替换 ToolRule 的输入。 */
export interface ValidationScopeInput {
  readonly owner: object;
  readonly scope: object | undefined;
}
export interface ValidationHostContext extends ValidationRuleContext {
  readonly role: RoleComponent;
  readonly world: World;
  readonly roleCatalog: RoleCatalog;
  readonly scope?: object;
  readonly requestScopes?: readonly ValidationScopeInput[];
}
export type OwnedToolRule = (ctx: ValidationHostContext) => RuleViolation | string | null;
export type ValidationHostInput = Omit<ValidationHostContext, "queries">;
export type OwnedToolRuleMap = Partial<Record<ToolCall["name"], OwnedToolRule>>;
const definitions = new WeakMap<
  ToolRule,
  { readonly run: OwnedToolRule; readonly scopeOwner?: object }
>();
/** 仅可信本族定义使用；公共 RoleRuntimeContribution 不接收或调用 World binder。 */
export function ownedToolRule(run: OwnedToolRule, scopeOwner?: object): ToolRule {
  if (definitions.has(run as ToolRule)) return run as ToolRule;
  // 不包一层执行函数：原 callback 引用、可写表和内部晚转发保持原样。仅可信 registry 识别这个定义。
  const rule = run as ToolRule;
  definitions.set(rule, { run, scopeOwner });
  return rule;
}
/** 原对象字面／spread先完成；继承的真实定义保持原函数引用和自己的 scope 所属身份。 */
export function ownedToolRules(rules: OwnedToolRuleMap, scopeOwner?: object): ToolRuleMap {
  return Object.fromEntries(
    Object.entries(rules).map(([name, rule]) => [
      name,
      rule === undefined ? undefined : ownedToolRule(rule as OwnedToolRule, scopeOwner),
    ]),
  );
}
export function createValidationQueries(world: World): ValidationQueries {
  return {
    isAlive: (id: EntityId) => world.getComponent(id, COMPONENT.Alive)?.alive === true,
    aliveIds: () => world.getAliveEntityIds(),
    currentCampValue: (id: EntityId) => world.getComponent(id, COMPONENT.Camp)?.camp,
    hasRole: (id: EntityId) => world.getComponent(id, COMPONENT.Role) !== undefined,
    roleValue: (id: EntityId) => world.getComponent(id, COMPONENT.Role)?.role,
  };
}
/** 内建规则只由可信 registry 以原 host执行；任意 caller 的回调不能作为 opaque scope 获权。 */
export function invokeValidationRule(
  rule: ToolRule,
  host: ValidationHostInput,
  receiver?: unknown,
): RuleViolation | string | null {
  const definition = definitions.get(rule);
  if (definition) {
    const run = definition.run;
    const scope =
      definition.scopeOwner && host.requestScopes
        ? host.requestScopes.find((entry) => entry.owner === definition.scopeOwner)?.scope
        : host.scope;
    const context = host.requestScopes
      ? { ...host, scope, queries: createValidationQueries(host.world) }
      : (host as ValidationHostContext);
    return receiver === undefined ? run(context) : Reflect.apply(run, receiver, [context]);
  }
  // 新对象显式列公共字段，不能先spread host再delete World：那会把真实句柄交给getter/扩展。
  const context: ValidationRuleContext = {
    actorId: host.actorId,
    toolCall: host.toolCall,
    phase: host.phase,
    day: host.day,
    queries: createValidationQueries(host.world),
    wallId: host.wallId,
    itemInstanceId: host.itemInstanceId,
    debateId: host.debateId,
    abilityId: host.abilityId,
    actionWindow: host.actionWindow,
    allowSelfDestruct: host.allowSelfDestruct,
    duelWindow: host.duelWindow,
    allowKnightDuel: host.allowKnightDuel,
    sheriffCandidates: host.sheriffCandidates,
    exileCandidates: host.exileCandidates,
    badgeCandidates: host.badgeCandidates,
  };
  return receiver === undefined ? rule(context) : Reflect.apply(rule, receiver, [context]);
}

/** 原 reader 的成功参数与领域错误分开；undefined 表示保一般参数，不等空选择或失败。 */
export type RawAdmissionResult =
  | { readonly ok: true; readonly args?: Record<string, unknown> }
  | { readonly ok: false; readonly error: string };
export interface TrustedRequestAdmission {
  readonly owner: object;
  capture(world: World, request: import("../../domain/actions").ActionRequest): object | undefined;
  raw?(
    world: World,
    request: import("../../domain/actions").ActionRequest,
    tool: ToolCall["name"],
    rawArgs: unknown,
  ): RawAdmissionResult;
}
