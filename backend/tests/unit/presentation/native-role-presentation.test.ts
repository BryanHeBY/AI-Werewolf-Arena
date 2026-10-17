/**
 * 单元测试：验证内建角色展示与受信任自定义贡献的实际边界。输入为字面角色、原生与赠予药瓶、
 * 带记录的上下文 getter 和非法语言；手写文字／引用／调用顺序为预期。只测试展示绑定、
 * 具体查询和片段格式化，不运行完整对局、模型、归档或资源结算；文案不授予权限。
 */
import { type OwnedRoleInitContext } from "../../../src/rulesets/roles/owned-bindings";
import { expect, test } from "bun:test";
import {
  Camp,
  Role,
  WitchSelfHealRule,
  type NativeRolePresentationPart,
} from "@ai-werewolf-arena/game-contract";
import { formatNativeRolePart } from "@ai-werewolf-arena/game-presentation";
import type { Locale } from "@ai-werewolf-arena/game-contract";
import {
  createRoleComponent,
  renderRolePrompt,
} from "../../../src/agents/observation/role-presentation";
import { captureNativeRolePresentation } from "../../../src/agents/observation/native-role-presentation-capture";
import {
  getDefaultRoleCatalog,
  getDefaultRoleContributions,
  createRoleCatalog,
} from "../../../src/rulesets/roles/role-catalog-assembly";
import type {
  RoleProfile,
  RoleQueries,
  RoleContributions,
} from "../../../src/rulesets/roles/contracts";
import { World } from "../../../src/domain/world";
import { COMPONENT } from "../../../src/domain/components/names";
import { grantNightAbility } from "../../../src/features/night-abilities/night-ability-grants";
import { getWitchState } from "../../../src/features/witch/ports";
import type { RoleComponent } from "../../../src/domain/components/role";

// worldless贡献持有自己的Camp，World参数仅在原展示点读取，不回退目录或索引Role。
const initialCamp = { camp: Camp.Good };
const currentCamp = () => initialCamp;

function deniedRuntimeHandles(role: RoleComponent) {
  const part: NativeRolePresentationPart = {
    kind: "message",
    key: "role.witch.state",
    // @ts-expect-error 已知文案的药瓶参数只接标量，不接原角色句柄。
    parameters: { heal: role, poison: 1 },
  };
  // @ts-expect-error 闭合展示 key 不接受任意字符串。
  formatNativeRolePart({ kind: "message", key: "unknown.role", parameters: undefined }, "en");
  void part;
}
void deniedRuntimeHandles;

test("standalone role keeps saved default locale and reads its current role without native initialization", () => {
  const en = createRoleComponent(Role.Wolf, "en"),
    zh = createRoleComponent(Role.Wolf);
  expect(renderRolePrompt(en)).toBe("Your role is Werewolf.");
  expect(renderRolePrompt(zh)).toBe("你的底牌是【狼人】。");
  en.role = Role.Seer;
  expect(renderRolePrompt(en)).toBe("Your role is Seer.");
  expect(renderRolePrompt(en, "zh-CN")).toBe("你的底牌是【预言家】。");
  expect(Object.keys(en)).toEqual(["role", "privateState"]);
});

test("custom contribution preserves init receiver and two late renderer getters before World", () => {
  const trace: string[] = [],
    world = new World(),
    role = createRoleComponent(Role.Villager);
  const profile: RoleProfile = {
    role: Role.Villager,
    label: "raw {label}",
    skillBrief: "raw {brief}",
    init(actual, ctx) {
      expect(this).toBe(profile);
      expect<unknown>(actual).toBe(role);
      expect(ctx).not.toBe(context);
      expect(Object.hasOwn(ctx, "world")).toBe(false);
      expect(ctx.initialCamp).toBe(initialCamp);
      trace.push("init");
      actual.privateState.custom = "kept";
    },
  };
  Object.defineProperty(profile, "renderPrompt", {
    get() {
      trace.push("renderer");
      return function (this: RoleProfile, queries: RoleQueries, locale?: Locale) {
        expect(this).toBe(profile);
        expect(queries.actorRole()).toBe(Role.Villager);
        expect(locale).toBe("en");
        expect(Object.hasOwn(queries, "world")).toBe(false);
        trace.push("call");
        return "  raw {state}\n  ";
      };
    },
  });
  const context: OwnedRoleInitContext = {
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
  catalog.applyRuntime(role, context);
  expect(trace).toEqual(["init", "locale"]);
  expect(renderRolePrompt(role)).toBe("  raw {state}\n  ");
  expect(trace).toEqual(["init", "locale", "renderer", "renderer", "world", "call"]);
  expect(catalog.label(Role.Villager, "en")).toBe("raw {label}");
  expect(catalog.skillBrief(Role.Villager, "en")).toBe("raw {brief}");
});

test("native Witch prose keeps native-first stock even when the current action binds a gifted potion", () => {
  const world = new World("en"),
    role = createRoleComponent(Role.Witch, "en"),
    id = world.createEntity();
  world.addComponent(id, COMPONENT.Role, role);
  world.addComponent(id, COMPONENT.Camp, initialCamp);
  getDefaultRoleCatalog().applyRuntime(role, {
    world,
    locale: "en",
    initialCamp,
    currentCamp: () => world.getComponent(id, COMPONENT.Camp),
  });
  grantNightAbility(
    world,
    id,
    {
      id: "gift:potion:1",
      kind: "potion",
      source: { kind: "gift", actorId: id },
      startsOnDay: 1,
      maxUses: 1,
      state: {
        heal: 0,
        poison: 0,
        selfHealRule: WitchSelfHealRule.Disabled,
        canSelfHeal: false,
        healUsedThisNight: false,
        poisonUsedThisNight: false,
      },
    },
    [],
  );
  expect(getWitchState(role, "gift:potion:1")!.heal).toBe(0);
  expect(getWitchState(role)!.heal).toBe(1);
  // 原生库存与同守同救／毒药说明一并精确核对，不借当前赠药能力替换展示来源。
  expect(renderRolePrompt(role)).toBe(
    "Your role is Witch. Antidote:1 Poison:1. Ordinary Guard protection and your antidote on the same target cancel each other, so the wolf knife may still kill that target. Ordinary protection does not block poison. AWA native knife disclosure: reveal the wolf target only while heal is usable tonight. AWA native potion policy: at most one potion per night.",
  );
});

test("Guard formatting failure happens before its late private-state read", () => {
  const role = createRoleComponent(Role.Guard),
    failure = new Error("late_state_read"),
    reads: string[] = [];
  Object.defineProperty(role, "privateState", {
    get() {
      reads.push("private");
      throw failure;
    },
  });
  expect(() =>
    captureNativeRolePresentation("guard", role, "unknown" as Locale, undefined, currentCamp),
  ).toThrow("i18n_locale_invalid");
  expect(reads).toEqual([]);
  expect(() => captureNativeRolePresentation("guard", role, "en", undefined, currentCamp)).toThrow(
    failure,
  );
  expect(reads).toEqual(["private"]);
});

test("Seer keeps its state read before formatting instead of borrowing the Guard failure order", () => {
  const failure = new Error("original_seer_read"),
    reads: string[] = [],
    role = createRoleComponent(Role.Seer);
  Object.defineProperty(role, "privateState", {
    get() {
      reads.push("private");
      throw failure;
    },
  });
  expect(() =>
    captureNativeRolePresentation("seer", role, "unknown" as Locale, undefined, currentCamp),
  ).toThrow(failure);
  expect(reads).toEqual(["private"]);
});

test("Witch formats native stock before reading disclosure and never prefetches the potion policy", () => {
  const role = createRoleComponent(Role.Witch),
    reads: string[] = [],
    failure = new Error("late_disclosure_read");
  getDefaultRoleCatalog().applyRuntime(role, { locale: "en", initialCamp, currentCamp });
  const state = getWitchState(role)!;
  Object.defineProperties(state, {
    heal: { get: () => (reads.push("heal"), 2) },
    poison: { get: () => (reads.push("poison"), 3) },
    knifeVisibility: {
      get() {
        reads.push("knife");
        throw failure;
      },
    },
    potionPolicy: {
      get() {
        reads.push("potion");
        throw new Error("unused_potion_policy");
      },
    },
  });
  expect(() =>
    captureNativeRolePresentation("witch", role, "unknown" as Locale, undefined, currentCamp),
  ).toThrow("i18n_locale_invalid");
  expect(reads).toEqual(["heal", "poison"]);
  reads.length = 0;
  expect(() => captureNativeRolePresentation("witch", role, "en", undefined, currentCamp)).toThrow(
    failure,
  );
  expect(reads).toEqual(["heal", "poison", "knife"]);
});

test("dispatch does not execute an unused camp source and Wild Child calls it at each actual field read", () => {
  const reads: string[] = [],
    failure = new Error("original_current_camp_read"),
    role = createRoleComponent(Role.WildChild),
    source = () => {
      reads.push("camp");
      throw failure;
    };
  expect(captureNativeRolePresentation("wolf", role, "en", undefined, source)).toBe(
    "Your role is Werewolf. You may join night tactics and the collective kill vote.",
  );
  expect(reads).toEqual([]);
  // 原 camp 字段在语言格式化之前读取；重复显示仍晚调用同一 source，不保存初始阵营或读取结果。
  for (const locale of ["unknown" as Locale, "en"] as const)
    expect(() =>
      captureNativeRolePresentation("wild_child", role, locale, undefined, source),
    ).toThrow(failure);
  expect(reads).toEqual(["camp", "camp"]);
  expect(() =>
    captureNativeRolePresentation("wild_child", role, "en", undefined, () => undefined),
  ).toThrow("role_current_camp_missing");
});

test("Ghost Bride locates the original Role through late World methods with their original receiver", () => {
  const world = new World("en"),
    role = createRoleComponent(Role.GhostBride),
    reads: string[] = [];
  Object.defineProperties(world, {
    entityIds: {
      get() {
        reads.push("entityIds:get");
        return function (this: World) {
          expect(this).toBe(world);
          reads.push("entityIds:call");
          return [11, 7];
        };
      },
    },
    getComponent: {
      get() {
        reads.push("getComponent:get");
        return function (this: World, id: number, name: string) {
          expect(this).toBe(world);
          expect(name).toBe("RoleComponent");
          reads.push(`getComponent:call:${id}`);
          return id === 7 ? role : undefined;
        };
      },
    },
  });
  expect(captureNativeRolePresentation("ghost_bride", role, "en", world, currentCamp)).toBe(
    "Your Ghost Bride opening resource: null. Groom and Witness retain their native roles and stocks without disclosing them to you.",
  );
  expect(reads).toEqual([
    "entityIds:get",
    "entityIds:call",
    "getComponent:get",
    "getComponent:call:11",
    "getComponent:get",
    "getComponent:call:7",
  ]);
});

test("legacy custom fallback does not read an unused native descriptor getter", () => {
  const reads: string[] = [],
    role = createRoleComponent(Role.Villager, "en");
  const profile = {
    role: Role.Villager,
    label: "raw label",
    skillBrief: "raw brief",
    get renderPrompt() {
      reads.push("renderer");
      return undefined;
    },
    get nativePresentation(): { id: string } {
      reads.push("native");
      throw new Error("unused_native_descriptor");
    },
  };
  const catalog = createRoleCatalog([profile]);
  catalog.applyRuntime(role, { locale: "en", initialCamp, currentCamp });
  expect(renderRolePrompt(role)).toBe("Your role is raw label. Follow the rules of this board.");
  expect(reads).toEqual(["renderer"]);
});

test("native contribution survives copied and inherited profiles without binding a requested ability", () => {
  const original = getDefaultRoleContributions().find((item) => item.metadata.role === Role.Witch)!;
  for (const profile of [{ ...original }, Object.create(original) as RoleContributions]) {
    const role = createRoleComponent(Role.Witch, "en");
    createRoleCatalog({ contributions: [profile] }).applyRuntime(role, {
      locale: "en",
      initialCamp,
      currentCamp,
    });
    expect(renderRolePrompt(role)).toBe(
      "Your role is Witch. Antidote:1 Poison:1. Ordinary Guard protection and your antidote on the same target cancel each other, so the wolf knife may still kill that target. Ordinary protection does not block poison. AWA native knife disclosure: reveal the wolf target only while heal is usable tonight. AWA native potion policy: at most one potion per night.",
    );
  }
});

test("a copied native contribution with an explicitly empty raw renderer keeps generic fallback", () => {
  const original = getDefaultRoleContributions().find((item) => item.metadata.role === Role.Witch)!;
  const profile: RoleContributions = {
    ...original,
    presentation: { kind: "custom", renderPrompt: undefined },
  };
  const role = createRoleComponent(Role.Witch, "en");
  createRoleCatalog({ contributions: [profile] }).applyRuntime(role, {
    locale: "en",
    initialCamp,
    currentCamp,
  });
  expect(renderRolePrompt(role)).toBe("Your role is Witch. Follow the rules of this board.");
});

test("native contribution proxy reads its explicit presentation before late World without flat fields", () => {
  const trace: string[] = [];
  const original = getDefaultRoleContributions().find((item) => item.metadata.role === Role.Witch)!;
  const profile = new Proxy(original, {
    get(target, property, receiver) {
      if (property === "presentation") trace.push("presentation");
      if (property === "renderPrompt" || property === "nativePresentation")
        throw new Error("retired_flat_presentation");
      return Reflect.get(target, property, receiver);
    },
  });
  const role = createRoleComponent(Role.Witch, "en");
  const world = new World("en");
  createRoleCatalog({ contributions: [profile] }).applyRuntime(role, {
    initialCamp,
    currentCamp,
    locale: "en",
    get world() {
      trace.push("world");
      return world;
    },
  });
  expect(trace).toEqual([]);
  expect(renderRolePrompt(role)).toBe(
    "Your role is Witch. Antidote:1 Poison:1. Ordinary Guard protection and your antidote on the same target cancel each other, so the wolf knife may still kill that target. Ordinary protection does not block poison. AWA native knife disclosure: reveal the wolf target only while heal is usable tonight. AWA native potion policy: at most one potion per night.",
  );
  expect(trace).toEqual(["presentation", "world"]);
});

for (const mode of ["frozen", "setter"] as const)
  test(`off-domain binding does not recreate the retired Role renderer write/${mode}`, () => {
    const role = createRoleComponent(Role.Villager, "en");
    const trace: string[] = [];
    // 旧领域方法已退出：字面冻结／拒绝 setter 明确记录新 API 不写此属性。
    if (mode === "setter")
      Object.defineProperty(role, "renderPrompt", {
        set() {
          trace.push("retired-setter");
          throw new Error("retired_domain_renderer_setter");
        },
      });
    const profile: RoleProfile = {
      role: Role.Villager,
      label: "custom",
      skillBrief: "custom brief",
      init(actual) {
        trace.push("init");
        if (mode === "frozen") Object.freeze(actual);
      },
      renderPrompt() {
        return "custom actor";
      },
    };
    createRoleCatalog([profile]).applyRuntime(role, {
      initialCamp,
      currentCamp,
      get locale(): Locale {
        trace.push("locale");
        return "en";
      },
    });
    expect(trace).toEqual(["init", "locale"]);
    expect(renderRolePrompt(role)).toBe("custom actor");
    expect(trace).toEqual(["init", "locale"]);
  });
