/**
 * Unit tests verify bilingual rule explanations, gateway rejection codes and generic failure callbacks preserve original resources.
 * Input: Literal malformed calls, fresh in-memory worlds/registries, error dictionaries and the original refusal matrix.
 * Output and oracle: Exact messages, unchanged state and injected-error behavior remain literal; one explicit test-owned mutable Guard view seeds the same original slot while production reads stay readonly.
 */
import { expect, test } from "bun:test";
import { RuleError, type Locale } from "@ai-werewolf-arena/game-catalog";
import {
  dictionaries,
  errorMessage,
  placeholders,
  toolFailure,
} from "@ai-werewolf-arena/game-text";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import {
  COMPONENT,
  Phase,
  PotionType,
  Role,
  type ToolCall,
  type RoleComponent,
  type AliveComponent,
  type VotingRightComponent,
} from "../../../../src/core";
import { twelvePlayerStandardConfig } from "../../../../src/runtime/scenarios/twelve_player_standard";
import { ToolGateway } from "../../../../src/game/gateway/tool_gateway";
import { ActionValidator } from "../../../../src/game/gateway/action_validator";
import { ToolValidationRuleRegistry } from "../../../../src/game/mechanisms/validation/tool_validation_rule_registry";
import { getGuardState } from "../../../../src/game/mechanisms/roles/guard/ports";
import { getHunterState } from "../../../../src/game/mechanisms/roles/hunter/ports";
import { getWitchState } from "../../../../src/game/mechanisms/roles/witch/ports";
import { sixPlayerMvpConfig } from "../../../../src/runtime/scenarios/six_player_mvp";
import { AcpTurnRegistry } from "../../../../src/ai/integrations/acp/acp_turn_registry";

const twelveRoles = [
  Role.Wolf,
  Role.Wolf,
  Role.Wolf,
  Role.Wolf,
  Role.Seer,
  Role.Witch,
  Role.Hunter,
  Role.Idiot,
  Role.Villager,
  Role.Villager,
  Role.Villager,
  Role.Villager,
];

const han = /[\u4e00-\u9fff]/;

test("every declared rule code has an explicit bilingual explanation", () => {
  expect(Object.isFrozen(RuleError)).toBe(true);
  expect(new Set(Object.values(RuleError)).size).toBe(Object.values(RuleError).length);
  for (const code of Object.values(RuleError)) {
    expect(errorMessage("zh-CN", code)).toMatch(han);
    expect(errorMessage("en", code)).not.toMatch(han);
    expect(errorMessage("en", code)).not.toContain("Tool call failed:"); // Reject missing translations, not a fallback pass.
  }
});

test("generic failure builders need no turn context and old error-only ACP callbacks gain a local explanation", () => {
  for (const [locale, dictionary] of Object.entries(dictionaries)) {
    for (const [key, value] of Object.entries(dictionary))
      if (key.startsWith("error.")) expect(placeholders(value)).toEqual([]);
    const lang = locale as Locale;
    const generic = toolFailure(lang, "turn_id_mismatch");
    expect(generic).toMatchObject({ ok: false, error: "turn_id_mismatch" });
    expect(generic.message).toContain("turn_id");
    if (lang === "en") expect(generic.message).not.toMatch(han);
    expect(toolFailure(lang, "unknown").message).toContain("unknown");
    const registry = new AcpTurnRegistry(
      bootstrapGame(sixPlayerMvpConfig, { locale: lang }).world,
      () => ({ ok: false, error: "invalid_report_bug_category" }),
    );
    const turn = registry.openTurn(
      {
        actorId: 1,
        phase: Phase.Day,
        allowedTools: ["speak"],
        context: { turn_constraints: {}, day: 1, stage: "day_speech", visible_events: [] },
      },
      "own-session",
    );
    const report = registry.reportBug("own-session", {
      turn_id: turn.turnId,
      category: "flow",
      severity: "high",
      message: "Original report",
    });
    expect(report).toEqual({
      ok: false,
      error: "invalid_report_bug_category",
      message:
        lang === "en"
          ? "Invalid report_bug.category. Use a category declared in the tool schema."
          : "report_bug.category无效；请使用工具schema声明的类别。",
    });
    registry.close();
  }
});

test("gateway refusals have language-neutral codes and never change private resources or state", () => {
  const cases: Array<{
    actor: number;
    tool: ToolCall;
    code: string;
    phase?: Phase;
    prepare?: (game: ReturnType<typeof bootstrapGame>) => void;
  }> = [
    { actor: 999, tool: { name: "speak", args: { text: "original" } }, code: "actor_missing" },
    {
      actor: 9,
      tool: { name: "speak", args: { text: "original" } },
      code: "actor_dead",
      prepare: (game) => {
        game.world.getComponent<AliveComponent>(9, COMPONENT.Alive)!.alive = false;
      },
    },
    {
      actor: 6,
      tool: { name: "use_potion", args: { target_id: 6, potion_type: PotionType.Heal } },
      code: "self_heal",
    },
    {
      actor: 6,
      tool: { name: "use_potion", args: { target_id: 9, potion_type: PotionType.Heal } },
      code: "heal_unavailable",
      prepare: (game) => {
        (
          getWitchState(game.world.getComponent<RoleComponent>(6, COMPONENT.Role)!)! as {
            heal: number;
          }
        ).heal = 0;
      },
    },
    {
      actor: 6,
      tool: { name: "use_potion", args: { target_id: 9, potion_type: PotionType.Poison } },
      code: "two_potions",
      prepare: (game) => {
        (
          getWitchState(game.world.getComponent<RoleComponent>(6, COMPONENT.Role)!)! as {
            healUsedThisNight: boolean;
          }
        ).healUsedThisNight = true;
      },
    },
    {
      actor: 6,
      tool: { name: "use_potion", args: { target_id: 999, potion_type: PotionType.Poison } },
      code: "poison_target",
    },
    { actor: 5, tool: { name: "check_identity", args: { target_id: 999 } }, code: "check_target" },
    {
      actor: 7,
      tool: { name: "shoot", args: { target_id: 9 } },
      code: "shoot_unavailable",
      prepare: (game) => {
        (
          getHunterState(game.world.getComponent<RoleComponent>(7, COMPONENT.Role)!)! as {
            canShoot: boolean;
          }
        ).canShoot = false;
      },
    },
    {
      actor: 8,
      tool: { name: "vote", args: { target_id: 1, abstain: false } },
      code: "vote_right",
      prepare: (game) => {
        game.world.getComponent<VotingRightComponent>(8, COMPONENT.VotingRight)!.canVote = false;
      },
    },
    {
      actor: 1,
      tool: { name: "self_destruct", args: { reason: "raw original", confirm: true } },
      code: "blast_phase",
      phase: Phase.Night,
    },
    {
      actor: 9,
      tool: { name: "choose_direction", args: { direction: "clockwise" } },
      code: "sheriff_direction_only",
    },
    {
      actor: 9,
      tool: {
        name: "report_bug",
        args: { category: "invalid", severity: "high", message: "original" },
      } as unknown as ToolCall,
      code: "invalid_report_bug_category",
    },
  ];
  // Functions are deliberately excluded from the private-state snapshot.
  const facts = (game: ReturnType<typeof bootstrapGame>) =>
    game.world.entityIds().map((id) => ({
      id,
      state: structuredClone(
        game.world.getComponent<RoleComponent>(id, COMPONENT.Role)!.privateState,
      ),
      alive: game.world.getComponent<AliveComponent>(id, COMPONENT.Alive)?.alive,
      vote: {
        canVote: game.world.getComponent<VotingRightComponent>(id, COMPONENT.VotingRight)?.canVote,
        weight: game.world.getComponent<VotingRightComponent>(id, COMPONENT.VotingRight)?.weight,
      },
    }));
  for (const item of cases)
    for (const locale of ["zh-CN", "en"] as const) {
      const game = bootstrapGame(twelvePlayerStandardConfig, { locale, fixedRoles: twelveRoles });
      item.prepare?.(game);
      const before = facts(game);
      const result = new ToolGateway().validateAndSanitize(game.world, item.actor, item.tool, {
        phase:
          item.phase ??
          (["use_potion", "check_identity", "guard"].includes(item.tool.name)
            ? Phase.Night
            : Phase.Day),
      });
      expect(result.ok).toBe(false);
      expect(result.error).toBe(item.code);
      expect(result.message).toBeDefined();
      if (locale === "en") expect(result.message).not.toMatch(han);
      expect(facts(game)).toEqual(before);
    }
  for (const locale of ["zh-CN", "en"] as const) {
    const game = bootstrapGame(sixPlayerMvpConfig, {
      locale,
      fixedRoles: [Role.Wolf, Role.Seer, Role.Villager, Role.Wolf, Role.Guard, Role.Villager],
    });
    (
      getGuardState(game.world.getComponent<RoleComponent>(5, COMPONENT.Role)!)! as {
        lastTarget: number | null;
      }
    ).lastTarget = 2;
    const rejected = new ToolGateway().validateAndSanitize(
      game.world,
      5,
      { name: "guard", args: { target_id: 2, abstain: false } },
      { phase: Phase.Night },
    );
    expect(rejected.error).toBe("guard_repeat");
    expect(
      getGuardState(game.world.getComponent<RoleComponent>(5, COMPONENT.Role)!)!.lastTarget,
    ).toBe(2);
  }
});

test("explicit injected rule errors stay raw; an empty custom error keeps its existing accept behavior", () => {
  for (const locale of ["zh-CN", "en"] as const) {
    const game = bootstrapGame(sixPlayerMvpConfig, { locale });
    const custom = new ToolGateway(
      new ActionValidator(new ToolValidationRuleRegistry({ speak: () => "自定规则 {id}" })),
    );
    expect(
      custom.validateAndSanitize(
        game.world,
        1,
        { name: "speak", args: { text: "raw" } },
        { phase: Phase.Day },
      ),
    ).toEqual({ ok: false, error: "custom_rule_error", message: "自定规则 {id}" });
    const shaped = new ToolGateway(
      new ActionValidator(new ToolValidationRuleRegistry({ speak: () => "guard_repeat" })),
    );
    expect(
      shaped.validateAndSanitize(
        game.world,
        1,
        { name: "speak", args: { text: "raw" } },
        { phase: Phase.Day },
      ),
    ).toEqual({ ok: false, error: "custom_rule_error", message: "guard_repeat" });
    const empty = new ToolGateway(
      new ActionValidator(new ToolValidationRuleRegistry({ speak: () => "" })),
    );
    expect(
      empty.validateAndSanitize(
        game.world,
        1,
        { name: "speak", args: { text: "raw" } },
        { phase: Phase.Day },
      ).ok,
    ).toBe(true);
  }
});
