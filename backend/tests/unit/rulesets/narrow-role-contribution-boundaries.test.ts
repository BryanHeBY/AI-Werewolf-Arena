/**
 * 单元测试负责角色贡献公开参数与完整内建程序的真实调用边界。输入为手写三席组件、
 * 自定义贡献、原派生基线及带记录的宿主 getter；独立字面字段、引用、顺序和同一 Error 为预期。
 * 查询复制不授写权，初始化仅保 ownRole／initialCamp；角色、真实 Camp、胜利归属不能互相替代。
 * 只调用实际 Catalog、狼队／查验／自爆／熊采样与特权基线，不执行模型、完整对局或归档。
 */
import { expect, test } from "bun:test";
import { Camp, Role, Phase, type ActionRequest } from "@ai-werewolf-arena/game-contract";
import { createRoleComponent } from "../../../src/domain/components/role";
import { createAliveComponent } from "../../../src/agents/observation/component-presentation";
import { COMPONENT } from "../../../src/domain/components/names";
import { World } from "../../../src/domain/world";
import { RoleCatalog } from "../../../src/rulesets/roles/catalog";
import {
  createRoleCatalog,
  getDefaultRoleCatalog,
} from "../../../src/rulesets/roles/role-catalog-assembly";
import { activeNightAbility } from "../../../src/features/night-abilities/inventory-ports";
import type {
  RoleProfile,
  RoleQueries,
  RoleRuntimeContribution,
} from "../../../src/rulesets/roles/contracts";
import { ownRoleCallback } from "../../../src/rulesets/roles/owned-bindings";
import { renderRolePrompt } from "../../../src/agents/observation/role-presentation";
import {
  wolfTeamPermissions,
  knownWolfTeammates,
} from "../../../src/features/wolf-team/permissions";
import { canRoleSelfDestruct } from "../../../src/features/self-destruct/capability";
import { resolveInspection } from "../../../src/engine/inspection";
import { BearNightFrame } from "../../../src/features/bear/night-frame";
import { BaselineBotActionProvider } from "../../../src/agents/baseline/privileged";
import { ORDINARY_WOLF_CONTRIBUTIONS } from "../../../src/features/wolf/ability-ports";
import { WOLF_BEAUTY_ROLE_PROFILE } from "../../../src/features/wolf-beauty/profile";

/** 编译负例不执行：公开查询与归属声明没有原组件／World 通道，init 的指定写权另行保留。 */
function publicInputsCannotRecoverWorld(
  queries: RoleQueries,
  context: import("../../../src/rulesets/roles/contracts").RoleInitContext,
  membership: import("../../../src/rulesets/roles/contracts").RoleValueContext,
) {
  // @ts-expect-error 查询不携带 World。
  queries.world;
  // @ts-expect-error 查询不携带角色的原可写私态。
  queries.privateState;
  // @ts-expect-error init 不能取得任意 World。
  context.world;
  // @ts-expect-error 胜利归属声明不是 Camp 安装写端口。
  membership.initialCamp;
}
void publicInputsCannotRecoverWorld;

function worldFixture(actorRole: Role = Role.Wolf) {
  const world = new World("en");
  for (const kind of [actorRole, Role.Wolf, Role.Bear]) {
    const id = world.createEntity(),
      role = createRoleComponent(kind);
    Object.assign(
      role.privateState,
      kind === Role.Bear ? { bear: { history: [] } } : { marker: { count: 7 } },
    );
    world.addComponent(id, COMPONENT.Role, role);
    world.addComponent(id, COMPONENT.Camp, { camp: kind === Role.Bear ? Camp.Good : Camp.Wolf });
    world.addComponent(id, COMPONENT.Alive, createAliveComponent());
  }
  return {
    world,
    role: world.getComponent(1, COMPONENT.Role)!,
    camp: world.getComponent(1, COMPONENT.Camp)!,
  };
}
const request = (): ActionRequest => ({
  actorId: 1,
  phase: Phase.Night,
  allowedTools: ["kill_vote"],
  context: { day: 1, stage: "wolf_vote", visible_events: [], turn_constraints: {} },
});

test("custom role contributions expose scalar queries and detached data while init retains only its owned writes", async () => {
  const f = worldFixture(),
    callbacks: string[] = [];
  let saved: RoleQueries | undefined;
  const inspect = (queries: RoleQueries, name: string) => {
    callbacks.push(name);
    expect(queries.actorRole()).toBe(Role.Wolf);
    expect(Object.keys(queries).sort()).toEqual([
      "actorRole",
      "aliveIds",
      "campValue",
      "currentCamp",
      "entityIds",
      "isAlive",
      "roleValue",
      "stateData",
    ]);
    expect("world" in queries).toBe(false);
    expect("privateState" in queries).toBe(false);
    const data = queries.stateData() as { marker: { count: number } };
    expect(data.marker.count).toBe(7);
    data.marker.count = 999;
    expect((f.role.privateState as { readonly marker: { count: number } }).marker.count).toBe(7);
  };
  const profile: RoleProfile = {
    role: Role.Wolf,
    label: "raw wolf",
    skillBrief: "raw rules",
    init(ownRole, ctx) {
      expect(this).toBe(profile);
      expect<unknown>(ownRole).toBe(f.role);
      expect(ctx.initialCamp).toBe(f.camp);
      expect("world" in ctx).toBe(false);
      expect(ctx.currentCamp()).toBe(Camp.Wolf);
      ownRole.privateState.extension = "custom owned init";
      ctx.initialCamp.camp = Camp.Wolf;
    },
    participation(queries) {
      inspect(queries, "participation");
      return { canVote: true, canBeExiled: false, canBeSheriff: true };
    },
    wolfTeam(queries) {
      inspect(queries, "wolfTeam");
      saved = queries;
      return { recognizedByPack: true, recognizes: "all", canChat: false, canVoteForKill: true };
    },
    knownTeammates(queries) {
      inspect(queries, "known");
      return queries.entityIds().filter((id) => queries.campValue(id) === Camp.Wolf);
    },
    canSelfDestruct(queries) {
      inspect(queries, "self");
      return true;
    },
    inspectionLabels(queries) {
      inspect(queries, "labels");
      return { camp: Camp.Good, role: Role.Villager };
    },
    detectableByBear(queries) {
      inspect(queries, "bear");
      return false;
    },
    baselineAction(queries, _request, _pick, pickCamp, locale) {
      inspect(queries, "baseline");
      expect(locale).toBe("en");
      return { name: "kill_vote", args: { target_id: pickCamp("good"), abstain: false } };
    },
    renderPrompt(queries, locale) {
      inspect(queries, "render");
      expect(this).toBe(profile);
      expect(locale).toBe("en");
      return "exact custom text";
    },
  };
  const catalog = createRoleCatalog([profile]);
  catalog.applyRuntime(f.role, {
    world: f.world,
    initialCamp: f.camp,
    currentCamp: () => f.world.getComponent(1, COMPONENT.Camp),
    locale: "en",
  });
  expect((f.role.privateState as { readonly extension?: unknown }).extension).toBe(
    "custom owned init",
  );
  expect(renderRolePrompt(f.role)).toBe("exact custom text");
  expect(catalog.participation(f.role)).toEqual({
    canVote: true,
    canBeExiled: false,
    canBeSheriff: true,
  });
  expect(wolfTeamPermissions(f.role, catalog, () => f.camp, f.world).canVoteForKill).toBe(true);
  expect(knownWolfTeammates(f.world, 1, catalog)).toEqual([2]);
  expect(canRoleSelfDestruct(f.role, catalog, () => f.camp)).toBe(true);
  expect(resolveInspection(f.world, 1, "combined", catalog)).toEqual({
    kind: "combined",
    camp: Camp.Good,
    role: Role.Villager,
  });
  expect(BearNightFrame.capture(f.world, 1, catalog)).not.toBeNull();
  expect(await new BaselineBotActionProvider(f.world, catalog).getAction(request())).toEqual({
    name: "kill_vote",
    args: { target_id: 3, abstain: false },
  });
  expect(callbacks).toContain("bear");
  expect(callbacks).toContain("baseline");
  expect(saved!.roleValue(2)).toBe(Role.Wolf);
  expect(saved!.isAlive(2)).toBe(true);
  f.world.getComponent(2, COMPONENT.Alive)!.alive = false;
  f.camp.camp = Camp.Good;
  expect(saved!.isAlive(2)).toBe(false);
  expect(saved!.currentCamp()).toBe(Camp.Good);
  expect(f.world.getComponent(1, COMPONENT.Role)).toBe(f.role);
});

test("native callbacks keep original refs and late errors while replaced wolf delegation and injected renderers stay narrow", async () => {
  const f = worldFixture(Role.WolfBeauty),
    trace: string[] = [],
    sameError = new Error("literal_owned_render_error");
  const nativeProfile: RoleProfile = {
    role: Role.WolfBeauty,
    label: "raw",
    skillBrief: "raw",
    renderPrompt: ownRoleCallback("renderPrompt", {
      renderPrompt: function (this: RoleProfile, role, _locale, world, currentCamp) {
        expect(this).toBe(nativeProfile);
        expect(role).toBe(f.role);
        expect(world).toBe(f.world);
        expect(currentCamp()).toBe(f.camp);
        trace.push("owned-render");
        throw sameError;
      },
    }),
  };
  const nativeCatalog = createRoleCatalog([nativeProfile]);
  nativeCatalog.applyRuntime(f.role, {
    initialCamp: f.camp,
    currentCamp: () => f.camp,
    get world() {
      trace.push("world");
      return f.world;
    },
    get locale(): "en" {
      trace.push("locale");
      return "en";
    },
  });
  expect(trace).toEqual(["locale"]);
  expect(() => renderRolePrompt(f.role)).toThrow(sameError);
  expect(trace).toEqual(["locale", "world", "owned-render"]);
  const injected = new RoleCatalog(
    {
      contributions: [
        {
          metadata: { role: Role.WolfBeauty, label: "raw", skillBrief: "raw" },
          runtime: {},
          presentation: { kind: "native", id: "wolf_beauty" },
        },
      ],
      renderNative(id, queries, locale) {
        expect(id).toBe("wolf_beauty");
        expect(queries.actorRole()).toBe(Role.WolfBeauty);
        expect(locale).toBe("en");
        expect("world" in queries).toBe(false);
        return "injected text";
      },
    },
    [],
  );
  injected.applyRuntime(f.role, {
    initialCamp: f.camp,
    currentCamp: () => f.camp,
    world: f.world,
    locale: "en",
  });
  expect(renderRolePrompt(f.role)).toBe("injected text");

  // 表仍公开可写；实际派生完整程序在原点晚取 runtime／方法，不缓存并不把旧私参交给替换函数。
  const descriptor = Object.getOwnPropertyDescriptor(ORDINARY_WOLF_CONTRIBUTIONS, "runtime")!;
  const replacement: RoleRuntimeContribution = {
    get baselineAction() {
      trace.push("method");
      return function (this: RoleRuntimeContribution, queries: RoleQueries) {
        expect(this).toBe(replacement);
        expect(arguments.length).toBe(5);
        expect(queries.actorRole()).toBe(Role.WolfBeauty);
        expect("world" in queries).toBe(false);
        trace.push("custom-call");
        return { name: "kill_vote" as const, args: { target_id: 3, abstain: false } };
      };
    },
  };
  Object.defineProperty(ORDINARY_WOLF_CONTRIBUTIONS, "runtime", {
    configurable: true,
    get() {
      trace.push("runtime");
      return replacement;
    },
  });
  try {
    trace.length = 0;
    const catalog = createRoleCatalog({ contributions: [WOLF_BEAUTY_ROLE_PROFILE] });
    expect(await new BaselineBotActionProvider(f.world, catalog).getAction(request())).toEqual({
      name: "kill_vote",
      args: { target_id: 3, abstain: false },
    });
    expect(trace).toEqual(["runtime", "method", "custom-call"]);
  } finally {
    Object.defineProperty(ORDINARY_WOLF_CONTRIBUTIONS, "runtime", descriptor);
  }
});

// 真正原生安装含 abilities→metadata→state→history 深树；不以平面 marker 代替合法机制数据。
test("custom role state query copies an actual installed Seer ability tree without returning stock references", () => {
  const world = new World("en"),
    id = world.createEntity(),
    role = createRoleComponent(Role.Seer),
    initialCamp = { camp: Camp.Good };
  world.addComponent(id, COMPONENT.Role, role);
  world.addComponent(id, COMPONENT.Camp, initialCamp);
  world.addComponent(id, COMPONENT.Alive, createAliveComponent());
  getDefaultRoleCatalog().applyRuntime(role, {
    world,
    initialCamp,
    currentCamp: () => world.getComponent(id, COMPONENT.Camp),
    locale: "en",
  });
  const native = activeNightAbility(role, "seer_check", 1)!;
  expect(native.id).toBe("native:seer_check");
  expect(native.state.history).toEqual([]);
  let captured: unknown;
  const custom = createRoleCatalog([
    {
      role: Role.Seer,
      label: "raw seer",
      skillBrief: "raw rules",
      inspectionLabels(queries) {
        captured = queries.stateData();
        return { camp: Camp.Good, role: Role.Seer };
      },
    },
  ]);
  expect(resolveInspection(world, id, "combined", custom)).toEqual({
    kind: "combined",
    camp: Camp.Good,
    role: Role.Seer,
  });
  const copied = captured as {
      abilities: Record<string, { uses: number; state: { history: unknown[] } }>;
    },
    ability = copied.abilities["native:seer_check"]!;
  expect(ability).not.toBe(native);
  expect<unknown>(ability.state).not.toBe(native.state);
  expect(ability.state.history).toEqual([]);
  ability.state.history.push({ day: 1, targetId: 2, isWerewolf: false });
  ability.uses = 99;
  expect(native.state.history).toEqual([]);
  expect(native.uses).toBe(0);
  expect(Object.isFrozen(role.privateState)).toBe(false);
  expect(world.getComponent(id, COMPONENT.Role)).toBe(role);
  expect(world.getComponent(id, COMPONENT.Camp)).toBe(initialCamp);
});
