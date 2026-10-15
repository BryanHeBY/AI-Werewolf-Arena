/**
 * 单元测试：验证角色三贡献的实际登记与消费边界。输入为字面原文 profile、带日志的 getter
 * 和显式原生贡献；原对象引用、读取次序、标量文案及有限支持集合为独立预期。
 * 不执行完整对局、模型或归档，不把资料和展示登记视为行动授权。
 */
import { expect, test } from "bun:test";
import { Camp, Role, WinCondition } from "@ai-werewolf-arena/game-contract";
import type { Locale } from "@ai-werewolf-arena/game-contract";
import { RoleCatalog } from "../../../src/rulesets/roles/catalog";
import {
  createRoleCatalog,
  getDefaultRoleContributions,
} from "../../../src/rulesets/roles/role-catalog-assembly";
import type {
  RoleContributions,
  RoleProfile,
  RoleInitContext,
} from "../../../src/rulesets/roles/contracts";
import {
  createRoleComponent,
  renderRolePrompt,
} from "../../../src/agents/observation/role-presentation";
import { World } from "../../../src/domain/world";

// 编译约束限定各 facet 的消费权限，不执行这些反例。
// 自定义展示测试自持原当前阵营；ctx引用和晚回调顺序仍是字面oracle。
const initialCamp = { camp: Camp.Good };
const currentCamp = () => initialCamp;

function denyCrossFacetRead(contribution: RoleContributions) {
  // @ts-expect-error 资料不能代替运行初始化贡献。
  contribution.metadata.init;
  // @ts-expect-error 运行不能拥有展示的名字资料。
  contribution.runtime.label;
  // @ts-expect-error 展示声明不能携带初始化权限。
  contribution.presentation.init;
}
void denyCrossFacetRead;

test("builtin registrations contain exactly three independently consumed facets", () => {
  const contributions = getDefaultRoleContributions();
  expect(contributions).toHaveLength(55);
  expect(contributions.map((entry) => entry.metadata.role).sort()).toEqual(
    Object.values(Role).sort(),
  );
  for (const entry of contributions) {
    expect(Object.keys(entry)).toEqual(["metadata", "runtime", "presentation"]);
    expect(Object.keys(entry.presentation).sort()).toEqual(["id", "kind"]);
    expect(entry.presentation.kind).toBe("native");
    expect("renderPrompt" in entry).toBe(false);
    expect("nativePresentation" in entry).toBe(false);
  }
  const catalog = createRoleCatalog();
  for (const entry of contributions) {
    expect(catalog.requireMetadata(entry.metadata.role)).toBe(entry.metadata);
    expect(catalog.requireRuntime(entry.metadata.role)).toBe(entry.runtime);
  }
});

test("custom flat input remains its original receiver and queries never eagerly read fields", () => {
  const trace: string[] = [],
    world = new World("en");
  const role = createRoleComponent(Role.Villager, "en");
  const profile: RoleProfile = {
    role: Role.Villager,
    label: "custom raw label",
    skillBrief: "custom raw rules",
    init(actual, context) {
      expect(this).toBe(profile);
      expect<unknown>(actual).toBe(role);
      expect(context).toBe(ctx);
      trace.push("init-call");
    },
  };
  Object.defineProperty(profile, "renderPrompt", {
    get() {
      trace.push("render-get");
      return function (this: RoleProfile, actual: typeof role, locale: Locale, passedWorld: World) {
        expect(this).toBe(profile);
        expect(actual).toBe(role);
        expect(locale).toBe("en");
        expect(passedWorld).toBe(world);
        trace.push("render-call");
        return "raw {user} text";
      };
    },
  });
  Object.defineProperty(profile, "metadata", {
    get() {
      throw new Error("foreign_metadata_probe");
    },
  });
  Object.defineProperty(profile, "nativePresentation", {
    get() {
      throw new Error("foreign_native_probe");
    },
  });
  const ctx: RoleInitContext = {
    initialCamp,
    currentCamp,
    get locale(): Locale {
      trace.push("locale");
      return "en";
    },
    get world() {
      trace.push("world");
      return world;
    },
  };
  const catalog = createRoleCatalog([profile]);
  expect(catalog.requireMetadata(Role.Villager)).toBe(profile);
  expect(catalog.requireRuntime(Role.Villager)).toBe(profile);
  expect(catalog.allRuntime()[0]!.metadata).toBe(profile);
  expect(catalog.allRuntime()[0]!.runtime).toBe(profile);
  expect(trace).toEqual([]);
  catalog.applyRuntime(role, ctx);
  expect(trace).toEqual(["init-call", "locale"]);
  expect(renderRolePrompt(role)).toBe("raw {user} text");
  expect(trace).toEqual([
    "init-call",
    "locale",
    "render-get",
    "render-get",
    "world",
    "render-call",
  ]);
});

test("native assembly observes current role and calls the supplied renderer only at display", () => {
  const trace: string[] = [],
    role = createRoleComponent(Role.Witch, "en");
  const witch: RoleContributions = {
    metadata: { role: Role.Witch, camp: Camp.Good, label: "Witch", skillBrief: "witch rules" },
    runtime: {
      init() {
        trace.push("init");
      },
    },
    presentation: { kind: "native", id: "witch" },
  };
  const guard: RoleContributions = {
    metadata: { role: Role.Guard, camp: Camp.Good, label: "Guard", skillBrief: "guard rules" },
    runtime: {},
    presentation: { kind: "native", id: "guard" },
  };
  const catalog = new RoleCatalog(
    {
      contributions: [witch, guard],
      renderNative(id, actual, locale, world) {
        expect(actual).toBe(role);
        expect(locale).toBe("en");
        expect(world).toBeUndefined();
        trace.push(id);
        return `native ${id}`;
      },
    },
    [],
  );
  catalog.applyRuntime(role, { locale: "en", initialCamp, currentCamp });
  expect(trace).toEqual(["init"]);
  role.role = Role.Guard;
  expect(renderRolePrompt(role)).toBe("native guard");
  expect(trace).toEqual(["init", "guard"]);
});

test("new custom presentation callback keeps its own receiver and late World access", () => {
  const trace: string[] = [],
    world = new World("en"),
    role = createRoleComponent(Role.Villager, "en");
  const presentation: Extract<RoleContributions["presentation"], { kind: "custom" }> = {
    kind: "custom",
  };
  Object.defineProperty(presentation, "renderPrompt", {
    get() {
      trace.push("renderer");
      return function (
        this: typeof presentation,
        _role: typeof role,
        _locale: Locale,
        actualWorld: World,
      ) {
        expect(this).toBe(presentation);
        expect(actualWorld).toBe(world);
        trace.push("call");
        return "exact custom contribution";
      };
    },
  });
  const catalog = new RoleCatalog(
    {
      contributions: [
        {
          metadata: { role: Role.Villager, label: "raw", skillBrief: "raw" },
          runtime: {},
          presentation,
        },
      ],
      renderNative() {
        throw new Error("unexpected_native_renderer");
      },
    },
    [],
  );
  catalog.applyRuntime(role, {
    initialCamp,
    currentCamp,
    locale: "en",
    get world() {
      trace.push("world");
      return world;
    },
  });
  expect(trace).toEqual([]);
  expect(renderRolePrompt(role)).toBe("exact custom contribution");
  expect(trace).toEqual(["renderer", "renderer", "world", "call"]);
});

test("shared mechanism defaults retain their original metadata and configuration ownership", () => {
  const catalog = createRoleCatalog();
  for (const role of [Role.WhiteCat, Role.FoxCub, Role.Pufferfish]) {
    const metadata = catalog.requireMetadata(role);
    expect(metadata.camp).toBe(Camp.Good);
    expect(metadata.goodSide).toBe("god");
    expect(metadata.maxCount).toBe(1);
    expect(metadata.supportedWinConditions).toEqual([WinCondition.SlaughterSide]);
  }
  for (const role of [Role.FragrantPhantom, Role.AwakenedSeer]) {
    expect(catalog.requireMetadata(role).maxCount).toBe(1);
    expect(catalog.requireRuntime(role).configuration!.schema.parse({})).toEqual({
      policy: "awa_fragrant_pair_seer_v1",
    });
  }
  for (const role of [Role.NightNoble, Role.AwakenedIdiot, Role.RadiantCount, Role.EclipseMaid])
    expect(catalog.requireMetadata(role).maxCount).toBe(1);
});
