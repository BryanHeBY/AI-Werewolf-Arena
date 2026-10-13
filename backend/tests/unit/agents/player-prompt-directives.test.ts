/**
 * 单元测试验证游戏侧提示说明的实际查询时点与字段归属。输入为字面候选、真实能力实例、
 * 原组件和普通对象 getter；手写 trace／原文／引用提供独立预期，不执行模型或完整对局。
 * 候选不是行动许可，绑定能力提示不消费次数；private 反射仅核保留的原队友查找顺序，
 * 已退休的 status／stage 私有方法不被测试伪装成新的兼容入口。
 */
import { expect, test } from "bun:test";
import {
  Camp,
  Phase,
  Role,
  type ActionRequest,
  type ReadonlyBoardConfig,
} from "@ai-werewolf-arena/game-contract";
import { World } from "../../../src/core/domain/world";
import { COMPONENT } from "../../../src/core/domain/components/names";
import {
  createRoleComponent,
  bindRolePresentation,
} from "../../../src/game/observation/role-presentation";
import {
  buildPlayerStageContextHint,
  buildPlayerStatusDirective,
  resolvePlayerPromptAbility,
  playerPromptRoleSkillBrief,
} from "../../../src/game/observation/player-prompt-directives";
import { installNativeAbility } from "../../../src/game/mechanisms/roles/ability_changes";
import { findNightAbility } from "../../../src/game/mechanisms/roles/abilities";
import {
  PlayerPromptPolicy,
  type PlayerPromptPolicyOptions,
} from "../../../src/ai/agents/player/player_prompt_policy";
import {
  getDefaultRoleCatalog,
  getDefaultToolSpecRegistry,
  getDefaultTargetHintRegistry,
  getDefaultPhaseStageLocalizationRegistry,
  getDefaultConfigRenderRegistry,
  type RoleCatalog,
} from "../../../src/game/mechanisms";

const request = (context: Partial<ActionRequest["context"]> = {}): ActionRequest => ({
  actorId: 1,
  phase: Phase.Day,
  allowedTools: ["speak"],
  context: { day: 1, stage: "day_speech", visible_events: [], ...context } as ActionRequest["context"],
});

test("candidate hint keeps two original context/getter reads around locale and never reads board policy", () => {
  const trace: string[] = [],
    context = {
      ...request().context,
      get fox_candidates() {
        trace.push("fox");
        return [2, 4];
      },
    };
  const req = {
    ...request(),
    get context() {
      trace.push("context");
      return context;
    },
  };
  const hint = buildPlayerStageContextHint(req, {
    locale() {
      trace.push("locale");
      return "en";
    },
    boardConfig() {
      throw Error("board_must_not_read");
    },
  });
  expect(trace).toEqual(["context", "fox", "locale", "context", "fox"]);
  expect(hint).toContain("2, 4");
});

test("first-day sheriff policy retains second board getter failure before language lookup", () => {
  const trace: string[] = [],
    failure = new Error("literal_second_board_failure");
  let reads = 0;
  expect(() =>
    buildPlayerStageContextHint(request({ stage: "sheriff_campaign_speech" }), {
      locale() {
        trace.push("locale");
        return "en";
      },
      boardConfig() {
        trace.push(`board:${reads}`);
        if (reads++ === 0) return { enableSheriff: true } as ReadonlyBoardConfig;
        throw failure;
      },
    }),
  ).toThrow(failure);
  expect(trace).toEqual(["board:0", "board:1"]);
});

test("bound prompt rule uses the original ability reference and three kind reads without consuming it", () => {
  const role = createRoleComponent(Role.Villager, Camp.Good);
  installNativeAbility(role, "guard", { lastTarget: null });
  const ability = findNightAbility(role, "guard")!,
    trace: string[] = [];
  Object.defineProperty(ability, "kind", {
    get() {
      trace.push("kind");
      return "guard";
    },
  });
  const result = resolvePlayerPromptAbility(request({ ability_id: ability.id }), role);
  expect(result.bound).toBe(ability);
  expect(result.targetRuleRole).toBe(Role.Guard);
  expect(trace).toEqual(["kind", "kind", "kind"]);
  expect(ability.uses).toBe(0);
  expect(ability.state.lastTarget).toBeNull();
});

test("ordinary board skill brief preserves catalog receiver/callee before locale and exact raw text", () => {
  const trace: string[] = [];
  const catalog = {
    get skillBrief() {
      trace.push("callee");
      return function (this: unknown, role: Role, locale: string) {
        expect(this).toBe(catalog);
        expect(role).toBe(Role.Villager);
        expect(locale).toBe("en");
        trace.push("callback");
        return "  RAW {role}\n原文  ";
      };
    },
  } as unknown as RoleCatalog;
  expect(
    playerPromptRoleSkillBrief(Role.Villager, {
      world() {
        throw Error("ordinary_role_must_not_read_world");
      },
      catalog() {
        trace.push("catalog");
        return catalog;
      },
      locale() {
        trace.push("locale");
        return "en";
      },
    }),
  ).toBe("  RAW {role}\n原文  ");
  expect(trace).toEqual(["catalog", "callee", "locale", "callback"]);
});

test("actual policy preserves ordinary getter order and calls role renderer after identity/teammates", () => {
  const world = new World(),
    actor = world.createEntity(),
    role = createRoleComponent(Role.Villager, Camp.Good);
  world.addComponent(actor, COMPONENT.Role, role);
  const trace: string[] = [],
    catalog = getDefaultRoleCatalog();
  const options: PlayerPromptPolicyOptions = {
    get roleCatalog() {
      trace.push("catalog");
      return catalog;
    },
    toolSpecRegistry: getDefaultToolSpecRegistry(),
    targetHintRegistry: getDefaultTargetHintRegistry(),
    phaseStageLocalizationRegistry: getDefaultPhaseStageLocalizationRegistry(),
    configRenderRegistry: getDefaultConfigRenderRegistry(),
  };
  const policy = new PlayerPromptPolicy(world, options);
  Object.defineProperty(policy, "locale", {
    get() {
      trace.push("locale");
      return "en";
    },
  });
  Object.defineProperty(policy, "wolfTeammates", {
    get() {
      trace.push("wolf:callee");
      return function (this: unknown, actorId: number) {
        expect(this).toBe(policy);
        expect(actorId).toBe(actor);
        trace.push("wolf:callback");
        return [];
      };
    },
  });
  bindRolePresentation(role, function (this: unknown, locale) {
    expect(this).toBeUndefined();
    expect(locale).toBe("en");
    trace.push("renderer");
    return "  原始CUSTOM {role}\nraw 🐺  ";
  });
  const req = {
    ...request(),
    get actorId() {
      trace.push("actor");
      return actor;
    },
  };
  const actual = policy.buildUser(req, {
    turnId: "literal-turn",
    allowedTools: ["speak"],
    actionSubmissionHint: "RAW SUBMIT",
  });
  const callee = trace.indexOf("wolf:callee");
  expect(trace.slice(callee, callee + 3)).toEqual(["wolf:callee", "actor", "wolf:callback"]);
  expect(trace.indexOf("catalog")).toBeLessThan(trace.indexOf("renderer"));
  expect(actual).toContain("原始CUSTOM {role}\nraw 🐺");
  expect(actual).toContain("RAW SUBMIT");
  expect(trace.filter((x) => x === "renderer")).toHaveLength(1);
});

test("late role renderer failure preserves previous knowledge reads without a new cleanup policy", () => {
  const world = new World(),
    role = createRoleComponent(Role.Villager, Camp.Good),
    trace: string[] = [];
  const failure = new Error("literal_renderer_failure");
  bindRolePresentation(role, () => {
    trace.push("renderer");
    throw failure;
  });
  expect(() =>
    buildPlayerStatusDirective(request(), role, {
      world() {
        trace.push("world");
        return world;
      },
      locale() {
        trace.push("locale");
        return "en";
      },
      catalog() {
        trace.push("catalog");
        return getDefaultRoleCatalog();
      },
      wolfTeammates(actorId) {
        trace.push(`wolf:${actorId()}`);
        return [];
      },
    }),
  ).toThrow(failure);
  expect(trace.at(-1)).toBe("renderer");
  expect(trace).toContain("wolf:1");
  expect(trace).toContain("catalog");
});
