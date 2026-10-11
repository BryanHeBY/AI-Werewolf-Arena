import { expect, test } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { bootstrapGame } from "../../src/app/bootstrap";
import {
  parseBoardDefinition,
  type BoardDefinition,
} from "../../src/runtime/config/board_definition";
import { configDiagnostic } from "../../src/runtime/config/error_codes";
import { PlayerPromptPolicy } from "../../src/ai/agents/player/player_prompt_policy";
import { Phase, Role, type ActionRequest } from "../../src/core";
import {
  getDefaultConfigRenderRegistry,
  getDefaultRoleCatalog,
  getDefaultToolSpecRegistry,
  getDefaultTargetHintRegistry,
  getDefaultPhaseStageLocalizationRegistry,
} from "../../src/game/mechanisms";
const folder = new URL("../../../configs.example/boards/", import.meta.url);
function raw(id: string): BoardDefinition {
  return JSON.parse(readFileSync(new URL(id + ".json", folder), "utf8"));
}
for (const kind of ["roster", "ballot"] as const)
  test("Order Prince rejects unsupported " + kind + " at both public and internal entry", () => {
    const input = raw("awa_order_prince_12_v1"),
      config = parseBoardDefinition(input).config;
    if (kind === "roster") {
      input.board.size = config.boardSize = 6;
      input.roles = { order_prince: input.roles.order_prince! };
      input.board.roleSetups = config.roleSetups = [
        { role: Role.Wolf, count: 2 },
        { role: Role.Villager, count: 3 },
        { role: Role.OrderPrince, count: 1 },
      ];
    } else if (kind === "ballot")
      input.mechanisms.voting.exilePolicy = config.voting!.exilePolicy = "awa_direct_v1";

    expect(() => bootstrapGame(config)).toThrow("order_prince_preset_invalid");
    expect(() => parseBoardDefinition(input)).toThrow("board_config_order_prince_preset_invalid");
    try {
      parseBoardDefinition(input);
    } catch (error) {
      expect(configDiagnostic(error)).toEqual({
        code: "board_config_order_prince_preset_invalid",
        path: "board",
      });
    }
  });
test("Order Prince native board keeps configurable sheriff and hooks; supported paired boards keep their own validator", () => {
  const input = raw("awa_order_prince_12_v1");
  input.mechanisms.sheriff.voteWeight = 2;
  expect(() => bootstrapGame(parseBoardDefinition(input).config)).not.toThrow();
  input.mechanisms.sheriff = {
    enabled: false,
    voteWeight: 1.5,
    tieBreaker: "min_seat",
    electionPolicy: "awa_final_candidates_v1",
    badgePolicy: "awa_next_seat_v1",
  };
  input.mechanisms.selfDestruct.enabledWindows = [];
  input.rules.hooks = {
    onDaybreak: false,
    onPreElection: false,
    onPreVote: false,
    onPerSpeechGap: false,
  };
  expect(() => bootstrapGame(parseBoardDefinition(input).config)).not.toThrow();
  const config = parseBoardDefinition(input).config;
  delete config.orderPrince;
  expect(() => bootstrapGame(config)).not.toThrow();
  for (const [id, error] of [
    ["awa_trickster_12_v1", "trickster"],
    ["awa_time_consort_12_v1", "time_consort"],
  ]) {
    const paired = raw(id!);
    expect(() => bootstrapGame(parseBoardDefinition(paired).config)).not.toThrow();
    paired.mechanisms.sheriff.voteWeight = 2;
    expect(() => parseBoardDefinition(paired)).toThrow("board_config_" + error + "_preset_invalid");
  }
});
for (const locale of ["zh-CN", "en"] as const)
  test(
    "Every public finite board describes actual first-night settlement timing in " + locale,
    () => {
      let early = 0,
        late = 0;
      for (const name of readdirSync(folder).filter((name) => name.endsWith(".json"))) {
        const input = JSON.parse(readFileSync(new URL(name, folder), "utf8"));
        const board = parseBoardDefinition(input).config;
        if (!board.enableSheriff) continue;
        // Independent role inventory oracle; do not call the production timing helper.
        const before = board.roleSetups.some(
          (r) =>
            [Role.PureWhiteGirl, Role.EvilKnight, Role.DemonHunter, Role.GhostBride].includes(
              r.role,
            ) && r.count > 0,
        );
        before ? early++ : late++;
        const summary = getDefaultConfigRenderRegistry().renderBoardConfigPrompt(board, locale);
        const first =
          locale === "en" ? "resolves night deaths before daytime" : "先完成夜间死亡结算";
        const after =
          locale === "en"
            ? "After the sheriff vote, night_resolved"
            : "警长投票结束后，才由 night_resolved";
        expect(summary.includes(first), name).toBe(before);
        expect(summary.includes(after), name).toBe(!before);
        const game = bootstrapGame(board, { locale });
        const policy = new PlayerPromptPolicy(game.world, {
          boardConfig: board,
          roleCatalog: getDefaultRoleCatalog(),
          toolSpecRegistry: getDefaultToolSpecRegistry(),
          targetHintRegistry: getDefaultTargetHintRegistry(),
          phaseStageLocalizationRegistry: getDefaultPhaseStageLocalizationRegistry(),
          configRenderRegistry: getDefaultConfigRenderRegistry(),
        });
        const request: ActionRequest = {
          actorId: game.playerIds[0]!,
          phase: Phase.Day,
          allowedTools: ["run_for_sheriff"],
          context: {
            day: 1,
            stage: "sheriff_nomination",
            visible_events: [],
            turn_constraints: {},
          },
        };
        const prompt = policy.buildUser(request, {
          turnId: "timing",
          allowedTools: request.allowedTools,
          actionSubmissionHint: "submit",
        });
        const privateLate =
          locale === "en"
            ? "The first-day sheriff election occurs before the night outcome"
            : "首日警长流程发生在昨夜结果公开之前";
        expect(prompt.includes(privateLate), name).toBe(!before);
      }
      expect(early).toBeGreaterThanOrEqual(13);
      expect(late).toBeGreaterThan(0);
    },
  );
const variants = [
  [
    "awa_magician_12_n1_original_v1",
    "魔术师从第1夜起",
    "Magician exchanges are available starting on night 1.",
    "魔术师的交换不影响",
    "Magician exchanges do not affect",
  ],
  [
    "awa_magician_12_n2_exchanged_v1",
    "魔术师从第2夜起",
    "Magician exchanges are available starting on night 2.",
    "魔术师的夜间交换影响",
    "Magician exchanges affect",
  ],
  [
    "awa_wolf_sorcerer_12_v1",
    "狼术师从第2夜起可以交换",
    "Wolf Sorcerer exchanges are available starting on night 2.",
  ],
  ["awa_time_consort_12_v1", "蚀时狼妃采用整夜范围", "Time Wolf Consort keeps reflecting"],
  [
    "awa_red_moon_12_ends_game_v1",
    "赤月板允许最后一名狼人自爆",
    "The Red Moon board allows the last living wolf",
  ],
  [
    "awa_red_moon_12_forbidden_v1",
    "赤月板禁止最后一名狼人自爆",
    "The Red Moon board forbids the last living wolf",
  ],
  [
    "awa_nightmare_12_optional_standard_v1",
    "噩梦之影可以明确弃用恐惧",
    "Nightmare Shadow may explicitly pass fear",
    "噩梦之影可以按普通狼人规则自爆",
    "Nightmare Shadow may self-destruct",
  ],
  [
    "awa_nightmare_12_required_when_legal_no_blast_no_self_knife_v1",
    "噩梦之影有合法恐惧目标时必须选择",
    "Nightmare Shadow must choose",
    "噩梦之影不能自爆",
    "Nightmare Shadow cannot self-destruct",
  ],
  [
    "awa_evil_knight_12_night_shot_immune_disabled_v1",
    "恶夜骑士免疫夜间死亡连锁的猎人枪",
    "Dark Knight is immune to Hunter shots",
  ],
  [
    "awa_evil_knight_12_hunter_shot_bypasses_disabled_v1",
    "恶夜骑士可被合格的猎人枪杀死",
    "Dark Knight can be killed by an eligible Hunter shot",
  ],
];
for (const [id, ...markers] of variants)
  for (const locale of ["zh-CN", "en"] as const)
    test(id + " public policy names its role in " + locale, () => {
      const config = parseBoardDefinition(raw(id!)).config;
      const summary = getDefaultConfigRenderRegistry().renderBoardConfigPrompt(config, locale);
      for (let i = locale === "en" ? 1 : 0; i < markers.length; i += 2)
        expect(summary).toContain(markers[i]!);
      expect(summary).not.toMatch(
        /本板禁止你自爆|杀死你|你的首次交换|You cannot self-destruct|Your first exchange night|can kill you/,
      );
      if (locale === "en") expect(summary).not.toMatch(/\p{Script=Han}/u);
    });
