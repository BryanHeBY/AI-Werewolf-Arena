// Independent readonly reviewer cases; original inputs retained.
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../src/app/bootstrap";
import {
  Phase,
  Role,
  COMPONENT,
  createRandom,
  type ActionRequest,
  type RoleComponent,
} from "../../../src/core";
import { nobleSecretBodyTwelveConfig } from "../../../src/runtime/scenarios/noble_secret_body_twelve";
import { demonNightChoice } from "../../support/demon_hunter_scenarios";
import { PlayerPromptPolicy } from "../../../src/ai/agents/player/player_prompt_policy";
import {
  getDefaultConfigRenderRegistry,
  getDefaultPhaseStageLocalizationRegistry,
  getDefaultRoleCatalog,
  getDefaultTargetHintRegistry,
  getDefaultToolSpecRegistry,
} from "../../../src/game/mechanisms";
import { ActionReception } from "../../../src/ai/agents/player/action_reception";
import { gameToolProtocol } from "../../../src/ai/agents/game_tool_protocol";
import { AcpTurnRegistry } from "../../../src/ai/integrations/acp/acp_turn_registry";
import {
  buildAgentVisibleEvent,
  buildAgentVisibleEventFeed,
} from "../../../src/game/engine/agent_visible_event_feed";
import { AgentEventVisibilityRegistry } from "../../../src/game/mechanisms/broadcast/agent_event_visibility_registry";
import { snapshotNobleBodyAuthority } from "../../../src/game/mechanisms/roles/noble_secret_body/authority";
import {
  NOBLE_SECRET_BODY_EVENT_TYPES,
  readNobleSecretBodyFact,
  NOBLE_SECRET_BODY_POLICY,
} from "@ai-werewolf-arena/game-text";

function setup(locale: "zh-CN" | "en") {
  const config = nobleSecretBodyTwelveConfig();
  const g = bootstrapGame(config, {
    locale,
    fixedRoles: config.roleSetups.flatMap((r) => Array<Role>(r.count).fill(r.role)),
    random: createRandom("noble-delivery-private"),
  });
  const policy = new PlayerPromptPolicy(g.world, {
    boardConfig: config,
    roleCatalog: getDefaultRoleCatalog(),
    toolSpecRegistry: getDefaultToolSpecRegistry(),
    targetHintRegistry: getDefaultTargetHintRegistry(),
    phaseStageLocalizationRegistry: getDefaultPhaseStageLocalizationRegistry(),
    configRenderRegistry: getDefaultConfigRenderRegistry(),
  });
  return { ...g, config, policy };
}
async function run(locale: "zh-CN" | "en", kind: "body" | "noble", changed: boolean) {
  const g = setup(locale),
    samples: any[] = [];
  const provider = {
    async getAction(r: ActionRequest) {
      if (
        r.actorId === (kind === "body" ? 5 : 1) &&
        r.context.stage === "day_speech" &&
        r.context.day === (kind === "body" ? 1 : 2)
      ) {
        const observation = g.policy.buildObservation(r),
          user = g.policy.buildUser(r, {
            turnId: "review-turn",
            allowedTools: r.allowedTools,
            actionSubmissionHint: "REVIEW_STATIC",
          }),
          system = g.policy.buildSystem(r, { supportsDebugReporting: true }),
          role = g.world.getComponent<RoleComponent>(r.actorId, COMPONENT.Role)!;
        const name = kind === "body" ? "protect_secret_body" : "choose_servant",
          stage = kind === "body" ? "secret_body" : "night_noble",
          reception = new ActionReception(g.world);
        const disallowed = reception.validate(r, name, { target_id: 6 });
        const unqualified = reception.validate(
          { ...r, phase: Phase.Night, allowedTools: [name], context: { ...r.context, stage } },
          name,
          { target_id: 6 },
        );
        const mcp = new AcpTurnRegistry(g.world),
          schema = mcp.getSchema();
        mcp.close();
        expect(observation.abilities).toEqual([]);
        expect(role.privateState.abilities ?? []).toEqual([]);
        expect(disallowed).toMatchObject({ ok: false, error: "tool_not_allowed_in_this_turn" });
        expect(unqualified.ok).toBe(false);
        if (locale === "en")
          expect(
            system.systemPrompt + user + role.renderPrompt() + JSON.stringify(schema),
          ).not.toMatch(/[\u4e00-\u9fff]/);
        samples.push({
          observation,
          user,
          system,
          brief: role.renderPrompt(),
          disallowed,
          unqualified,
          schema,
          toolSchemas: gameToolProtocol(locale).specs,
        });
      }
      if (r.allowedTools.includes("protect_secret_body"))
        return {
          name: "protect_secret_body",
          args: { target_id: r.context.day === 1 ? 6 : 7 },
        } as const;
      if (r.allowedTools.includes("choose_servant"))
        return { name: "choose_servant", args: { target_id: 6 } } as const;
      if (r.allowedTools.includes("check_identity"))
        return { name: "check_identity", args: { target_id: 6 } } as const;
      if (r.allowedTools.includes("vote"))
        return {
          name: "vote",
          args: { target_id: r.context.day === 1 ? 10 : 11, abstain: false },
        } as const;
      return demonNightChoice(r, 3, {
        knife: kind === "body" && changed ? 6 : null,
        hunt: kind === "noble" && changed && r.context.day === 2 ? 6 : null,
      });
    },
  };
  for (let day = 1; day <= (kind === "body" ? 1 : 2); day++)
    await g.phaseManager.runSingleCycle(provider, 8);
  expect(samples).toHaveLength(1);
  const events = g.phaseManager.getEvents();
  for (const e of events)
    if ((NOBLE_SECRET_BODY_EVENT_TYPES as readonly string[]).includes(e.type))
      expect(readNobleSecretBodyFact(e.type, e.payload)).not.toBeNull();
  return { g, sample: samples[0], actual: snapshotNobleBodyAuthority(g.world) };
}
for (const locale of ["zh-CN", "en"] as const) {
  test(`real PM ${locale}: spent/intact same legal-day prompt, observation, ability lists, schemas, unqualified errors`, async () => {
    const a = await run(locale, "body", false),
      b = await run(locale, "body", true);
    expect(a.actual.body.body).toEqual({ kind: "intact" });
    expect(b.actual.body.body).toEqual({
      kind: "night_spent",
      day: 1,
      targetId: 6,
      cause: "wolf_kill",
    });
    expect(b.sample).toEqual(a.sample);
    expect(b.sample.observation.ownState.secretBody).toMatchObject({
      resource: "intact",
      lastNotifiedNight: 1,
      awaitingNightReport: true,
    });
  });
  test(`real PM ${locale}: pending/cleared same day owner prompt and receiver errors`, async () => {
    const a = await run(locale, "noble", false),
      b = await run(locale, "noble", true);
    expect(a.actual.noble.contracts[0]!.status).toEqual({ kind: "pending" });
    expect(b.actual.noble.contracts[0]!.status).toEqual({ kind: "cleared", day: 2 });
    expect(b.sample).toEqual(a.sample);
    expect(b.sample.observation.ownState.nightNoble.contracts[0].status).toEqual({
      kind: "pending",
    });
  });
}
test("God facts remain null even with forged owner/team/target audience and later-world rebuild", async () => {
  const { g } = await run("en", "body", true),
    registry = new AgentEventVisibilityRegistry();
  const facts = [
    {
      type: "secret_body_blocked",
      payload: {
        policy: NOBLE_SECRET_BODY_POLICY,
        actorId: 5,
        day: 1,
        targetId: 6,
        cause: "poison",
      },
    },
    {
      type: "noble_contract_closed",
      payload: {
        policy: NOBLE_SECRET_BODY_POLICY,
        actorId: 1,
        day: 3,
        contractId: "servant:night:2",
        targetId: 6,
        createdNight: 2,
        expiresNight: 3,
        status: "expired",
        proposedCause: "servant_expiry",
      },
    },
  ];
  for (const f of facts)
    for (const audience of [undefined, [], [1], [5], [6], [1, 5, 6, 10, 11, 12]])
      for (let actor = 1; actor <= 12; actor++) {
        const e = { ...f, timestamp: 1, ...(audience === undefined ? {} : { audience }) } as any;
        expect(readNobleSecretBodyFact(e.type, e.payload)).not.toBeNull();
        expect(registry.canView(g.world, e, actor)).toBe(false);
        expect(buildAgentVisibleEvent(g.world, e, actor, 1)).toBeNull();
        expect(buildAgentVisibleEventFeed(g.world, [e], actor)).toEqual([]);
      }
});
test("flat nested known contract is accepted; private snapshots whitelist source and authorization", () => {
  const g = setup("en"),
    registry = new AgentEventVisibilityRegistry();
  const e = {
    timestamp: 1,
    type: "noble_night_notified",
    payload: {
      policy: NOBLE_SECRET_BODY_POLICY,
      actorId: 1,
      day: 3,
      wolfActionPolicy: "standard",
      lastNotifiedNight: 3,
      lastChoice: { day: 2, targetId: 6 },
      contracts: [
        {
          id: "servant:night:2",
          targetId: 6,
          createdNight: 2,
          expiresNight: 3,
          status: { kind: "cleared", day: 2 },
        },
      ],
    },
    audience: [1],
  } as any;
  expect(readNobleSecretBodyFact(e.type, e.payload)).not.toBeNull();
  expect(buildAgentVisibleEvent(g.world, e, 1, 1)?.payload).toEqual(e.payload);
  for (const actor of [2, 4, 5, 6, 10]) {
    expect(registry.canView(g.world, e, actor)).toBe(false);
    expect(buildAgentVisibleEvent(g.world, e, actor, 1)).toBeNull();
  }
  for (const audience of [[], [6], [1, 6], [1, 1]])
    expect(buildAgentVisibleEvent(g.world, { ...e, audience }, 1, 1)).toBeNull();
  for (const key of ["cause", "camp", "source", "rawUses", "lastUsedDay"]) {
    const f = structuredClone(e);
    f.payload.contracts[0].status[key] = "CANARY";
    expect(readNobleSecretBodyFact(f.type, f.payload)).toBeNull();
    expect(buildAgentVisibleEvent(g.world, f, 1, 1)).toBeNull();
  }
  let getters = 0;
  const f = structuredClone(e);
  Object.defineProperty(f.payload.contracts[0].status, "kind", {
    enumerable: true,
    get() {
      getters++;
      return "cleared";
    },
  });
  expect(buildAgentVisibleEvent(g.world, f, 1, 1)).toBeNull();
  expect(getters).toBe(0);
});
