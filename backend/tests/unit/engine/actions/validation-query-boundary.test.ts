/**
 * 单元测试负责公开验证回调的实际窄对象和绑定网关求值边界。
 * 输入为手写三实体 World、自定义合法 profile 与访问器；输出采用固定字段集合、Camp 值及 getter／同 Error 轨迹。
 * 回调只得值查询，不得 World／Catalog／原 scope；绑定仍按原 gateway、callee、World、三个参数次序晚读。
 * 这是公开接口收窄测试，不声称抵御任意 monkeypatch 或 外来候选人为埋入的对象图。
 */
import { expect, test } from "bun:test";
import { Camp, Phase, Role, RuleError, type ToolCall } from "@ai-werewolf-arena/game-contract";
import { World } from "../../../../src/domain/world";
import { COMPONENT } from "../../../../src/domain/components/names";
import { createAliveComponent } from "../../../../src/domain/components/alive";
import { createRoleComponent } from "../../../../src/domain/components/role";
import { RoleCatalog } from "../../../../src/rulesets/roles/catalog";
import { ToolValidationRuleRegistry } from "../../../../src/engine/actions/tool-validation-rule-registry";
import {
  ActionValidator,
  type ValidationContext,
} from "../../../../src/engine/actions/action-validator";
import { ToolGateway, createBoundToolGateway } from "../../../../src/engine/actions/tool-gateway";
import { ownedToolRules } from "../../../../src/engine/actions/validation-queries";
import type { ValidationRuleContext } from "../../../../src/engine/actions/validation-contracts";

function world(camp: Camp) {
  const value = new World();
  for (let index = 0; index < 3; index++) {
    const id = value.createEntity();
    value.addComponent(id, COMPONENT.Role, createRoleComponent(Role.Villager));
    value.addComponent(id, COMPONENT.Camp, { camp });
    value.addComponent(id, COMPONENT.Alive, createAliveComponent());
  }
  return value;
}

test("自定义规则只得当前绑定值查询，网关保 receiver 和不可调用 callee 的原参数错误时点", () => {
  const trace: string[] = [];
  const seen: ValidationRuleContext[] = [];
  const catalog = new RoleCatalog(
    [
      {
        role: Role.Villager,
        camp: Camp.Good,
        label: "literal",
        skillBrief: "literal",
        validationRules: {
          speak(context) {
            seen.push(context);
            expect(Object.hasOwn(context, "world")).toBe(false);
            expect(Object.hasOwn(context, "role")).toBe(false);
            expect(Object.hasOwn(context, "roleCatalog")).toBe(false);
            expect(Object.hasOwn(context, "scope")).toBe(false);
            expect(Object.hasOwn(context, "requestScopes")).toBe(false);
            expect(Object.keys(context.queries).sort()).toEqual([
              "aliveIds",
              "currentCampValue",
              "hasRole",
              "isAlive",
              "roleValue",
            ]);
            expect("getComponent" in context.queries).toBe(false);
            expect(context.queries.aliveIds()).toEqual([1, 2, 3]);
            expect(context.queries.isAlive(2)).toBe(true);
            expect(context.queries.hasRole(999)).toBe(false);
            expect(context.queries.roleValue(1)).toBe(Role.Villager);
            return null;
          },
        },
      },
    ],
    [],
  );
  const first = world(Camp.Good),
    second = world(Camp.Wolf);
  const gateway = new ToolGateway(
    new ActionValidator(new ToolValidationRuleRegistry(undefined, catalog), false),
  );
  const original = gateway.validateAndSanitize;
  Object.defineProperty(gateway, "validateAndSanitize", {
    configurable: true,
    get() {
      trace.push("callee");
      return function (this: ToolGateway, ...args: Parameters<ToolGateway["validateAndSanitize"]>) {
        expect(this).toBe(gateway);
        trace.push("invoke");
        return Reflect.apply(original, this, args);
      };
    },
  });
  const bound = createBoundToolGateway(
    () => {
      trace.push("gateway");
      return gateway;
    },
    () => {
      trace.push("world");
      return first;
    },
  );
  function actor() {
    trace.push("actor");
    return 1;
  }
  function call(): ToolCall {
    trace.push("call");
    return { name: "speak", args: { text: "literal" } };
  }
  function options(): ValidationContext {
    trace.push("options");
    return { phase: Phase.Day, scope: { isCurrent: () => true } };
  }
  expect(bound.validateAndSanitize(actor(), call(), options()).ok).toBe(true);
  expect(trace).toEqual(["gateway", "callee", "world", "actor", "call", "options", "invoke"]);
  expect(seen[0]!.queries.currentCampValue(1)).toBe(Camp.Good);
  const other = createBoundToolGateway(
    () => gateway,
    () => second,
  );
  expect(
    other.validateAndSanitize(1, { name: "speak", args: { text: "literal" } }, { phase: Phase.Day })
      .ok,
  ).toBe(true);
  expect(seen[1]!.queries.currentCampValue(1)).toBe(Camp.Wolf);
  expect(seen[0]!.queries.currentCampValue(1)).toBe(Camp.Good);
  expect(Object.keys(bound)).toEqual(["validateAndSanitize"]);
  // 非可调用 callee 在真正调用时才报错，不能在绑定属性读取时掩盖原参数 getter 的同 Error。
  Object.defineProperty(gateway, "validateAndSanitize", { configurable: true, get: () => null });
  const failure = new Error("literal_actor_argument_failure");
  expect(() =>
    bound.validateAndSanitize(
      (() => {
        throw failure;
      })(),
      call(),
      options(),
    ),
  ).toThrow(failure);
  // Partial 原表允许自有 undefined，用于显式覆盖／回退；保这个键，不在静态登记时误当函数抛错。
  const partial = ownedToolRules({ speak: undefined });
  expect(Object.keys(partial)).toEqual(["speak"]);
  expect(partial.speak).toBeUndefined();
  const noRule = new ActionValidator(new ToolValidationRuleRegistry(partial, catalog), false);
  expect(
    noRule.validate(first, 1, { name: "speak", args: { text: "literal" } }, { phase: Phase.Day }),
  ).toMatchObject({ ok: false, error: RuleError.UnknownTool });
});
