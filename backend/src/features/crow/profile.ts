/**
 * 负责声明乌鸦资料、严格配置和实际工具/夜阶段/值查询展示贡献。
 * 输入为板子公开参数、原初始化角色和受限查询；输出角色组合约束、唯一状态安装与真实校验贡献。
 * 资料或提示登记不授予运行许可，运行请求仍由本族窗口复验；新展示不加入中央原生角色捕获。
 */
import { z } from "zod";
import { Camp, Role, Phase, WinCondition, RuleError } from "@ai-werewolf-arena/game-contract";
import { roleName, text } from "@ai-werewolf-arena/game-text";
import type { RoleContributions } from "../../rulesets/roles/contracts";
import { ownRoleCallback } from "../../rulesets/roles/owned-bindings";
import { ownedToolRules } from "../../engine/actions/validation-queries";
import { crowPromptState } from "./presentation";
import { readCrowStateData } from "./state";
import { CROW_DEFAULTS, initializeCrow } from "./state";
import { crowChoiceAllowed, crowCandidates } from "./authority";
import { CROW_NIGHT_STAGE } from "./night-stage";
const parameters = z.strictObject({
  policy: z.literal("awa_netease_crow_v1").default(CROW_DEFAULTS.policy),
  ballotPolicy: z.enum(["initial_ballot_only", "all_ballots"]).default(CROW_DEFAULTS.ballotPolicy),
  actionPolicy: z.enum(["optional", "required_when_legal"]).default(CROW_DEFAULTS.actionPolicy),
  selfTarget: z.boolean().default(false),
});
export const CROW_ROLE_PROFILE: RoleContributions = {
  metadata: {
    role: Role.Crow,
    camp: Camp.Good,
    goodSide: "god",
    maxCount: 1,
    label: roleName("crow"),
    skillBrief: text("zh-CN", "role.crow.brief"),
    supportedWinConditions: [WinCondition.SlaughterSide],
    supportedBoardRoles: [Role.Wolf, Role.Villager, Role.Seer, Role.Witch, Role.Hunter, Role.Crow],
  },
  runtime: {
    init: ownRoleCallback("init", {
      init: (role, ctx) => initializeCrow(role, parameters.parse(ctx.boardConfig?.crow ?? {})),
    }),
    configuration: {
      schema: parameters,
      defaults: { ...CROW_DEFAULTS },
      apply: (config, value) => ({ ...config, crow: parameters.parse(value) }),
      serialize: (config) => parameters.parse(config.crow ?? {}),
    },
    toolSpecs: [
      {
        name: "curse_exile",
        parameters: {
          type: "object",
          properties: { target_id: { type: ["integer", "null"], minimum: 1 } },
          required: ["target_id"],
          additionalProperties: false,
        },
        argHint: 'curse_exile args: {"target_id":number|null}',
        userPromptHintKey: "action.curse_exile.hint",
      },
    ],
    stageDirectives: [
      {
        match: (tools) => tools.length === 1 && tools[0] === "curse_exile",
        messageKey: "action.curse_exile.directive",
        text: text("zh-CN", "action.curse_exile.directive"),
      },
    ],
    validationRules: ownedToolRules({
      curse_exile: ({ world, actorId, day, phase, toolCall }) =>
        phase === Phase.Night &&
        day !== undefined &&
        toolCall.name === "curse_exile" &&
        crowChoiceAllowed(world, actorId, day, toolCall.args.target_id)
          ? null
          : { code: RuleError.CustomRuleError },
    }),
    nightStages: [CROW_NIGHT_STAGE],
    baselineAction: ownRoleCallback("baselineAction", {
      baselineAction: (_role, request, _pick, _camp, _locale, world) =>
        request.allowedTools.includes("curse_exile")
          ? {
              name: "curse_exile",
              args: {
                target_id: world
                  ? (crowCandidates(world, request.actorId, request.context.day)[0] ?? null)
                  : (request.context.crow_candidates?.[0] ?? null),
              },
            }
          : null,
    }),
  },
  presentation: {
    kind: "custom",
    renderPrompt: (queries, locale = "zh-CN") =>
      crowPromptState(readCrowStateData(queries.stateData()), locale),
  },
};
