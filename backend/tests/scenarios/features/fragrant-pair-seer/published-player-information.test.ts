/**
 * Fragrant information scenarios verify actual published deaths and inherited knife hints agree with bounded player/gateway projections.
 * Input: Original locale matrix, literal linked-death plans and same production PM requests.
 * Output and oracle: Handwritten own-state/history/privacy/sequence assertions retain the original published-information boundary; no new expected data is generated.
 */
import { expect, test } from "bun:test";
import { Phase } from "../../../../src/core/domain/identity";
import { Role } from "../../../../src/core/domain/identity";
import { ActionValidator } from "../../../../src/game/gateway/action_validator";
import { COMPONENT } from "../../../../src/core/domain/components/names";
import type { AliveComponent } from "../../../../src/core/domain/components/alive";
import type { ActionRequest } from "../../../../src/core/domain/actions";
import { PlayerPromptPolicy } from "../../../../src/ai/agents/player/player_prompt_policy";
import { getDefaultRoleCatalog } from "../../../../src/game/mechanisms/roles/catalog";
import { getDefaultConfigRenderRegistry, getDefaultTargetHintRegistry, getDefaultToolSpecRegistry, getDefaultPhaseStageLocalizationRegistry, getDefaultScriptEventRenderRegistry } from "../../../../src/game/mechanisms";
import { buildAgentVisibleEventFeed } from "../../../../src/game/engine/agent_visible_event_feed";
import { fragrantAuthoritySnapshot } from "../../../../src/game/mechanisms/roles/fragrant_pair_seer/authority";
import { fragrantPairSeerTwelveConfig } from "../../../../src/runtime/scenarios/fragrant_pair_seer_twelve";
import {
  fragrantRuntimeGame,
  fragrantRuntimeAction,
} from "../../../support/fragrant_pair_seer_scenarios";
import {
  fragrantPairEventLabel,
  FRAGRANT_PAIR_EVENT_TYPES,
  text,
} from "@ai-werewolf-arena/game-text";

for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}: shared player view follows published deaths and contains no actual trigger or pack roster`, async () => {
    const g = fragrantRuntimeGame(locale),
      policy = new PlayerPromptPolicy(g.world, {
        boardConfig: fragrantPairSeerTwelveConfig,
        roleCatalog: getDefaultRoleCatalog(),
        toolSpecRegistry: getDefaultToolSpecRegistry(),
        targetHintRegistry: getDefaultTargetHintRegistry(),
        phaseStageLocalizationRegistry: getDefaultPhaseStageLocalizationRegistry(),
        configRenderRegistry: getDefaultConfigRenderRegistry(),
      });
    let before = false,
      after = false;
    const observation = (r: ActionRequest, actorId: number) => {
      const request: ActionRequest = {
        ...r,
        actorId,
        phase: Phase.Day,
        allowedTools: ["speak"],
        context: {
          ...r.context,
          stage: "day_speech",
          visible_events: buildAgentVisibleEventFeed(g.world, g.phaseManager.getEvents(), actorId),
        },
      };
      return {
        observed: policy.buildObservation(request),
        user: policy.buildUser(request, {
          turnId: "probe",
          allowedTools: ["speak"],
          actionSubmissionHint: "submit",
        }),
        system: policy.buildSystem(request, { supportsDebugReporting: false }),
      };
    };
    await g.phaseManager.runSingleCycle(
      {
        async getAction(r) {
          if (!before && r.context.stage === "sheriff_nomination") {
            before = true;
            expect(g.world.getComponent<AliveComponent>(5, COMPONENT.Alive)!.alive).toBe(true);
            expect(g.world.getComponent<AliveComponent>(6, COMPONENT.Alive)!.alive).toBe(true);
            const view = observation(r, 1);
            expect(view.observed.ownState.fragrantPhantom).toMatchObject({
              used: false,
              activeBinding: { pairIds: [5, 6] },
              canVoteForKill: false,
            });
            expect(view.observed.teammateIds).toHaveLength(1);
            expect(view.user).toContain('"used":false');
            expect(view.user).not.toContain('"trigger"');
            expect(view.system.configPrompt).toContain(
              locale === "en" ? "Slaughter-side" : "固定屠边",
            );
          }
          if (!after && r.context.stage === "last_words") {
            after = true;
            expect(g.world.getComponent<AliveComponent>(5, COMPONENT.Alive)!.alive).toBe(false);
            expect(g.world.getComponent<AliveComponent>(6, COMPONENT.Alive)!.alive).toBe(false);
            const f = observation(r, 1).observed,
              other = observation(r, 7).observed,
              pair = observation(r, 9).observed;
            expect(f.ownState.fragrantPhantom).toMatchObject({ used: true, activeBinding: null });
            expect(other.ownState.fragrantPhantom).toBeUndefined();
            expect(pair.abilities.find((a) => a.kind === "pair_check")?.state).toEqual({
              policy: "awa_fragrant_pair_seer_v1",
              history: [{ day: 1, targetIds: [2, 9], containsWerewolf: true }],
            });
            for (const view of [f, other, pair]) {
              const data = JSON.stringify({
                ownState: view.ownState,
                abilities: view.abilities,
                events: view.request.context.visible_events,
              });
              expect(data).not.toContain('"trigger"');
              expect(data).not.toContain('"rootId"');
              expect(data).not.toContain('"addedTargetId"');
              expect(data).not.toContain('"bindings"');
            }
          }
          return fragrantRuntimeAction(r, { bind: [5, 6], knife: 5 });
        },
      },
      8,
    );
    expect(before).toBe(true);
    expect(after).toBe(true);
    const events = g.phaseManager.getEvents(),
      f = buildAgentVisibleEventFeed(g.world, events, 1),
      s = buildAgentVisibleEventFeed(g.world, events, 9),
      other = buildAgentVisibleEventFeed(g.world, events, 7);
    expect(f.some((e) => e.type === "fragrant_pair_chosen")).toBe(true);
    expect(f.some((e) => e.type === "fragrant_pair_inspected")).toBe(false);
    expect(f.some((e) => e.type === "wolf_chat")).toBe(false);
    expect(s.some((e) => e.type === "fragrant_pair_inspected")).toBe(true);
    expect(other.some((e) => e.type.startsWith("fragrant_"))).toBe(false);
    for (const stream of [f, s, other])
      expect(stream.map((e) => e.seq)).toEqual(stream.map((_e, i) => i + 1));
    for (const event of events.filter((e) =>
      (FRAGRANT_PAIR_EVENT_TYPES as readonly string[]).includes(e.type),
    )) {
      expect(fragrantPairEventLabel(event.type, event.payload, locale)).not.toBeNull();
      expect(getDefaultScriptEventRenderRegistry().toLiveRender(event, false, locale)).toEqual([]);
      expect(getDefaultScriptEventRenderRegistry().toLiveRender(event, true, locale)).toHaveLength(
        1,
      );
    }
    expect(fragrantAuthoritySnapshot(g.world).known.used).toBe(true);
  });

for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}: inherited knife hint includes the same self target accepted by the real gateway`, async () => {
    const g = fragrantRuntimeGame(locale),
      catalog = getDefaultRoleCatalog(),
      targets = getDefaultTargetHintRegistry(),
      policy = new PlayerPromptPolicy(g.world, {
        boardConfig: fragrantPairSeerTwelveConfig,
        roleCatalog: catalog,
        targetHintRegistry: targets,
        toolSpecRegistry: getDefaultToolSpecRegistry(),
        phaseStageLocalizationRegistry: getDefaultPhaseStageLocalizationRegistry(),
        configRenderRegistry: getDefaultConfigRenderRegistry(),
      });
    await g.phaseManager.runSingleCycle(
      {
        async getAction(r) {
          return fragrantRuntimeAction(r, { bind: [2, 3], exile: 2 });
        },
      },
      8,
    );
    await g.phaseManager.runSingleCycle(
      {
        async getAction(r) {
          return fragrantRuntimeAction(r, { exile: 4 });
        },
      },
      8,
    );
    let hint: string | undefined,
      user = "",
      accepted = false;
    await g.phaseManager.runSingleCycle(
      {
        async getAction(r) {
          if (r.allowedTools.includes("kill_vote")) {
            expect(r.actorId).toBe(1);
            expect(r.context.day).toBe(3);
            accepted = new ActionValidator(undefined, false).validate(
              g.world,
              1,
              { name: "kill_vote", args: { target_id: 1, abstain: false } },
              { phase: Phase.Night, day: 3 },
            ).ok;
            hint = targets.buildActionableIdsHint({
              actorId: 1,
              day: 3,
              actorRole: Role.FragrantPhantom,
              allowedTools: ["kill_vote"],
              world: g.world,
              roleCatalog: catalog,
            });
            user = policy.buildUser(r, {
              turnId: "t1",
              allowedTools: ["kill_vote"],
              actionSubmissionHint: "submit",
            });
          }
          return fragrantRuntimeAction(r, { knife: 1 });
        },
      },
      8,
    );
    expect(accepted).toBe(true);
    expect(
      g.phaseManager
        .getEvents()
        .some(
          (e) =>
            e.type === "wolf_kill_vote_cast" && e.payload.actorId === 1 && e.payload.targetId === 1,
        ),
    ).toBe(true);
    const expected = text(locale, "prompt.targets.self", { ids: "1, 5, 6, 7, 8, 9, 10, 11, 12" });
    expect(hint).toBe(expected);
    expect(user).toContain(expected);
  });
