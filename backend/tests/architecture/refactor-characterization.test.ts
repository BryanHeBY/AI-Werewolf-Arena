/**
 * P0 architecture characterization: lock the existing F01 decision privilege and
 * F02 request restoration behavior before structural migration. These are small
 * in-process boundary tests, not role acceptance or complete-game scenarios.
 * Oracles are literal target IDs, identity comparisons, rejection codes and
 * unchanged authority snapshots. Noble uses the existing explicit subsystem
 * fixture; Animal provides a second, independently implemented envelope contrast.
 * Unsafe baseline expectations are intentionally named and must change only in
 * the separately documented F01/C33a or F02/C18a behavior correction.
 */
import { describe, expect, test } from "bun:test";
import { bootstrapGame } from "../../src/app/bootstrap";
import {
  Camp,
  COMPONENT,
  Phase,
  Role,
  createRandom,
  type ActionRequest,
  type RoleComponent,
} from "../../src/core";
import { assertRequestDelivery } from "../../src/core/domain/request_delivery";
import { BaselineBotActionProvider } from "../../src/ai/agents/providers/action_providers";
import { ObservedPlayersActionProvider } from "../../src/ai/agents/providers/observed_players";
import { ObservedBot } from "../../src/ai/agents/providers/observed_bot";
import type { PlayerObservation } from "../../src/ai/agents/player/observation";
import { LlmObserver } from "../../src/ai/agents/player/player_observer";
import { FallbackActionPolicy } from "../../src/ai/agents/llm/fallback_action_policy";
import { AcpTurnRegistry } from "../../src/ai/integrations/acp/acp_turn_registry";
import { sixPlayerMvpConfig } from "../../src/runtime/scenarios/six_player_mvp";
import { nobleBodyAuthorityFixture } from "../support/features/noble-secret-body/drivers/authority";
import {
  beginNobleBodyNight,
  nobleBodyChoiceTargets,
  snapshotNobleBodyAuthority,
} from "../../src/game/mechanisms/roles/noble_secret_body/authority";
import {
  canSubmitNobleBodyChoice,
  closeNobleBodyRequest,
  commitNobleBodyChoice,
  inheritNobleBodyDeadlineRequest,
  nobleBodyRequestScope,
  openNobleBodyRequest,
} from "../../src/game/mechanisms/roles/noble_secret_body/requests";
import {
  animalRequestEnvelopeCurrent,
  captureAnimalRequestEnvelope,
  inheritAnimalRequestEnvelope,
} from "../../src/game/mechanisms/roles/animal_dream/request_envelope";
import { animalRosterFixture } from "../support/features/animal-dream/builders/roster";

function wolfRequest(): ActionRequest {
  return {
    actorId: 1,
    phase: Phase.Night,
    allowedTools: ["kill_vote"],
    context: {
      day: 1,
      stage: "wolf_vote",
      visible_events: [],
      turn_constraints: {
        min_valid_actions: 1,
        max_valid_actions: 1,
        required_any_tools: ["kill_vote"],
      },
    },
  };
}

describe("F01 current production fallback privilege", () => {
  test("literal hidden camp changes baseline knife while player observation and observed decision stay identical", async () => {
    const config = {
      ...sixPlayerMvpConfig,
      roleSetups: [
        { role: Role.Wolf, count: 1 },
        { role: Role.HiddenWolf, count: 1 },
        { role: Role.Villager, count: 2 },
        { role: Role.Seer, count: 1 },
        { role: Role.Guard, count: 1 },
      ],
    };
    const game = bootstrapGame(config, {
      fixedRoles: [Role.Wolf, Role.HiddenWolf, Role.Villager, Role.Villager, Role.Seer, Role.Guard],
      random: createRandom("f01-hidden-camp"),
    });
    const request = wolfRequest();
    const observations: PlayerObservation[] = [];
    const observed = new ObservedPlayersActionProvider(
      game.world,
      new Map([
        [
          1,
          {
            decide: async (o: PlayerObservation) => {
              observations.push(o);
              return null;
            },
          },
        ],
      ]),
      config,
    );
    const baseline = new BaselineBotActionProvider(game.world);
    const fallback = new FallbackActionPolicy(
      baseline,
      new LlmObserver({ trace: false, printLlmIo: false, printThinking: false }),
    );
    await observed.getAction(request);
    expect(observations[0]!.teammateIds).toEqual([]);
    expect(await baseline.getAction(request)).toEqual({
      name: "kill_vote",
      args: { target_id: 3, abstain: false },
    });
    expect(await fallback.resolve(request, "runtime_error")).toEqual({
      name: "kill_vote",
      args: { target_id: 3, abstain: false },
    });

    // God-only intervention, not a legal conversion scenario: alter just the
    // field baseline reads. HiddenWolf remains absent from pack recognition.
    game.world.getComponent<RoleComponent>(2, COMPONENT.Role)!.camp = Camp.Good;
    await observed.getAction(request);
    expect(observations[1]).toEqual(observations[0]);
    expect(await baseline.getAction(request)).toEqual({
      name: "kill_vote",
      args: { target_id: 2, abstain: false },
    });
    expect(await fallback.resolve(request, "runtime_error")).toEqual({
      name: "kill_vote",
      args: { target_id: 2, abstain: false },
    });
    const decide = (o: PlayerObservation) =>
      new ObservedBot(createRandom("f01-equal-observation").fork("actor:1"), "competitive").decide(
        o,
      );
    expect(await decide(observations[1]!)).toEqual(await decide(observations[0]!));
  });

  test("strict request never invokes the privileged fallback or invents its required action", async () => {
    const request = wolfRequest();
    request.context.allow_fallback = false;
    request.context.action_failure_policy = "error";
    let calls = 0;
    const fallback = new FallbackActionPolicy(
      {
        getAction: async () => {
          calls++;
          return { name: "kill_vote", args: { target_id: 3, abstain: false } };
        },
      },
      new LlmObserver({ trace: false, printLlmIo: false, printThinking: false }),
    );
    expect(await fallback.resolve(request, "runtime_error")).toBeNull();
    expect(calls).toBe(0);
  });
});

function nobleRequestFixture() {
  const fixture = nobleBodyAuthorityFixture();
  beginNobleBodyNight(fixture.world, 1, () => true);
  const request: ActionRequest = {
    actorId: 2,
    phase: Phase.Night,
    allowedTools: ["protect_secret_body"],
    context: {
      day: 1,
      stage: "secret_body",
      visible_events: [],
      allow_fallback: false,
      action_failure_policy: "error",
      secret_body_candidates: [...nobleBodyChoiceTargets(fixture.world, 1, "body")],
      turn_constraints: {
        min_valid_actions: 1,
        max_valid_actions: 1,
        required_any_tools: ["protect_secret_body"],
      },
    },
  };
  const scope = openNobleBodyRequest(fixture.world, 1, "body", request);
  return { ...fixture, request, scope };
}
const bodyAction = { name: "protect_secret_body", args: { target_id: 3 } } as const;

describe("F02 existing Noble restoration semantics, not target revocation policy", () => {
  for (const mutation of ["context-field", "context-reference", "body", "deadline"] as const)
    test(`unsafe baseline: original ${mutation} rejects current read then restoration revives the same lease`, () => {
      const f = nobleRequestFixture();
      const before = snapshotNobleBodyAuthority(f.world);
      const context = f.request.context;
      const tools = f.request.allowedTools;
      if (mutation === "context-field") context.day = 2;
      if (mutation === "context-reference") f.request.context = { ...context };
      if (mutation === "body") f.request.allowedTools = ["speak"];
      if (mutation === "deadline") f.request.deadlineAtMs = Date.now() + 60_000;
      expect(nobleBodyRequestScope(f.world, f.request)).toBeUndefined();
      expect(() => assertRequestDelivery(f.request)).toThrow(
        "action_request_delivery_authority_revoked",
      );
      expect(canSubmitNobleBodyChoice(f.world, 2, Phase.Night, 1, f.scope, bodyAction)).toBe(false);
      expect(() => commitNobleBodyChoice(f.world, f.scope, bodyAction)).toThrow(
        "noble_body_request_unavailable",
      );
      expect(snapshotNobleBodyAuthority(f.world)).toEqual(before);
      context.day = 1;
      f.request.context = context;
      f.request.allowedTools = tools;
      delete f.request.deadlineAtMs;
      expect(nobleBodyRequestScope(f.world, f.request)).toBe(f.scope);
      expect(() => assertRequestDelivery(f.request)).not.toThrow();
      expect(canSubmitNobleBodyChoice(f.world, 2, Phase.Night, 1, f.scope, bodyAction)).toBe(true);
      expect(() => commitNobleBodyChoice(f.world, f.scope, bodyAction)).not.toThrow();
      expect(snapshotNobleBodyAuthority(f.world).body.lastChoice).toEqual({ day: 1, targetId: 3 });
      expect(nobleBodyRequestScope(f.world, f.request)).toBeUndefined();
      expect(() => commitNobleBodyChoice(f.world, f.scope, bodyAction)).toThrow();
    });

  for (const mutation of ["context-reference", "body", "deadline"] as const)
    test(`unsafe baseline: registered alias ${mutation} failure neither revokes original nor latches alias rejection`, () => {
      const f = nobleRequestFixture();
      const deadline = Date.now() + 60_000;
      const alias: ActionRequest = { ...f.request, deadlineAtMs: deadline };
      inheritNobleBodyDeadlineRequest(f.request, alias);
      expect(nobleBodyRequestScope(f.world, alias)).toBe(f.scope);
      if (mutation === "context-reference") alias.context = { ...alias.context };
      if (mutation === "body") alias.allowedTools = ["speak"];
      if (mutation === "deadline") alias.deadlineAtMs = deadline + 1;
      expect(nobleBodyRequestScope(f.world, alias)).toBeUndefined();
      expect(() => assertRequestDelivery(alias)).toThrow(
        "action_request_delivery_authority_revoked",
      );
      expect(nobleBodyRequestScope(f.world, f.request)).toBe(f.scope);
      expect(() => assertRequestDelivery(f.request)).not.toThrow();
      expect(snapshotNobleBodyAuthority(f.world).body.lastChoice).toBeNull();
      alias.context = f.request.context;
      alias.allowedTools = f.request.allowedTools;
      alias.deadlineAtMs = deadline;
      expect(nobleBodyRequestScope(f.world, alias)).toBe(f.scope);
      expect(() => assertRequestDelivery(alias)).not.toThrow();
      closeNobleBodyRequest(f.scope);
      expect(nobleBodyRequestScope(f.world, f.request)).toBeUndefined();
      expect(nobleBodyRequestScope(f.world, alias)).toBeUndefined();
    });

  test("unregistered alias, foreign World and unknown/missing token reject only that input", () => {
    const f = nobleRequestFixture();
    const other = nobleBodyAuthorityFixture();
    const unregistered: ActionRequest = {
      ...f.request,
      context: { ...f.request.context },
      deadlineAtMs: Date.now() + 60_000,
    };
    inheritNobleBodyDeadlineRequest(f.request, unregistered);
    expect(nobleBodyRequestScope(f.world, unregistered)).toBeUndefined();
    expect(nobleBodyRequestScope(other.world, f.request)).toBeUndefined();
    expect(canSubmitNobleBodyChoice(other.world, 2, Phase.Night, 1, f.scope, bodyAction)).toBe(
      false,
    );
    expect(canSubmitNobleBodyChoice(f.world, 2, Phase.Night, 1, undefined, bodyAction)).toBe(false);
    expect(canSubmitNobleBodyChoice(f.world, 2, Phase.Night, 1, {}, bodyAction)).toBe(false);
    expect(nobleBodyRequestScope(f.world, f.request)).toBe(f.scope);
    expect(() => commitNobleBodyChoice(f.world, f.scope, bodyAction)).not.toThrow();
  });

  test("invalid target rejection preserves the still-valid Noble choice and changes no inventory", () => {
    const f = nobleRequestFixture();
    const before = snapshotNobleBodyAuthority(f.world);
    const invalid = { name: "protect_secret_body", args: { target_id: 999 } } as const;
    expect(canSubmitNobleBodyChoice(f.world, 2, Phase.Night, 1, f.scope, invalid)).toBe(false);
    expect(() => commitNobleBodyChoice(f.world, f.scope, invalid)).toThrow(
      "noble_body_request_unavailable",
    );
    expect(snapshotNobleBodyAuthority(f.world)).toEqual(before);
    expect(nobleBodyRequestScope(f.world, f.request)).toBe(f.scope);
    expect(() => commitNobleBodyChoice(f.world, f.scope, bodyAction)).not.toThrow();
    expect(snapshotNobleBodyAuthority(f.world).body.lastChoice).toEqual({ day: 1, targetId: 3 });
  });

  test("foreign session and repeated wrong turn IDs do not consume valid ACP action retries", async () => {
    const f = nobleRequestFixture();
    const request: ActionRequest = {
      actorId: 3,
      phase: Phase.Day,
      allowedTools: ["speak"],
      context: {
        day: 1,
        stage: "day_speech",
        visible_events: [],
        action_failure_policy: "error",
        turn_constraints: {
          min_valid_actions: 1,
          max_valid_actions: 1,
          required_any_tools: ["speak"],
        },
      },
    };
    const registry = new AcpTurnRegistry(f.world);
    try {
      const pending = registry.openTurn(request, "valid-session");
      expect(
        registry.submitAction("foreign-session", {
          turn_id: pending.turnId,
          action: "speak",
          arguments: { text: "wrong session" },
        }),
      ).toMatchObject({ ok: false, error: "turn_not_open_or_session_invalid" });
      for (let i = 0; i < 4; i++)
        expect(
          registry.submitAction("valid-session", {
            turn_id: "wrong-turn",
            action: "speak",
            arguments: { text: "wrong turn" },
          }),
        ).toMatchObject({ ok: false, error: "turn_id_mismatch" });
      expect(pending.outcome).toEqual({ rejectedActions: 0, failureCode: null });
      expect(registry.snapshot).toEqual({ closed: false, pending: 1 });
      expect(
        registry.submitAction("valid-session", {
          turn_id: pending.turnId,
          action: "speak",
          arguments: { text: "literal correct action" },
        }),
      ).toEqual({ ok: true, accepted: true, applied: false, action: "speak" });
      expect(await pending.action).toEqual({
        name: "speak",
        args: { text: "literal correct action" },
      });
      expect(nobleBodyRequestScope(f.world, f.request)).toBe(f.scope);
    } finally {
      registry.close();
      closeNobleBodyRequest(f.scope);
    }
  });
});

function animalEnvelopeFixture() {
  const fixture = animalRosterFixture();
  const request = {
    phase: "night",
    actorId: 10,
    allowedTools: ["fox_distract"],
    context: {
      day: 2,
      stage: "fox_distract",
      visible_events: [],
      allow_fallback: false,
      action_failure_policy: "error",
      turn_constraints: {
        min_valid_actions: 1,
        max_valid_actions: 1,
        required_any_tools: ["fox_distract"],
      },
      fox_candidates: Array.from({ length: 12 }, (_, i) => i + 1),
    },
  };
  return { request, envelope: captureAnimalRequestEnvelope(fixture.world, request) };
}

describe("F02 existing Animal monotonic contrast", () => {
  test("original body mismatch latches withdrawal even after restoring the original field", () => {
    const { request, envelope } = animalEnvelopeFixture();
    expect(animalRequestEnvelopeCurrent(envelope)).toBe(true);
    request.context.day = 3;
    expect(animalRequestEnvelopeCurrent(envelope)).toBe(false);
    request.context.day = 2;
    expect(animalRequestEnvelopeCurrent(envelope)).toBe(false);
  });
  test("registered alias mismatch latches the shared envelope while rejected external alias does not", () => {
    const { request, envelope } = animalEnvelopeFixture();
    const deadline = Date.now() + 60_000;
    expect(() =>
      inheritAnimalRequestEnvelope(envelope, request, {
        ...request,
        context: { ...request.context },
        deadlineAtMs: deadline,
      }),
    ).toThrow("animal_request_envelope_alias_invalid");
    expect(animalRequestEnvelopeCurrent(envelope)).toBe(true);
    const alias = { ...request, deadlineAtMs: deadline };
    inheritAnimalRequestEnvelope(envelope, request, alias);
    alias.allowedTools = ["speak"];
    expect(animalRequestEnvelopeCurrent(envelope)).toBe(false);
    alias.allowedTools = request.allowedTools;
    expect(animalRequestEnvelopeCurrent(envelope)).toBe(false);
  });
});
