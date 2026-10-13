/**
 * Interaction scenarios verify Demon Hunter native night receipts and stocks remain bound across strict delivery and source revocation.
 * Input: Original native Guard/Seer matrices, controlled SDK/ACP providers, target/mark replacements and actual phase cycles.
 * Output and oracle: Explicit stock, mark, receipt and zero-fallback assertions retain the executed night prefix; same-target dynamic import rebasing changes only module paths.
 */
import { expect, test, spyOn } from "bun:test";
import {
  COMPONENT,
  StatusMark,
  PotionType,
  createAliveComponent,
  deferRequestDelivery,
  type ActionRequest,
  type RoleComponent,
  type StatusMarksComponent,
} from "../../../../src/core";
import { demonHunterFixture } from "../../../support/features/demon-hunter/builders/candidate-world";
import { demonNightChoice } from "../../../support/features/demon-hunter/drivers/actions";
import { demonHunterAuditPlayer } from "../../../../src/game/mechanisms/roles/demon_hunter/authority";
import { inheritDemonWitchDeadlineRequest } from "../../../../src/game/mechanisms/roles/demon_hunter/native_potion_requests";
const audit = (f: ReturnType<typeof demonHunterFixture>, id: number) =>
  demonHunterAuditPlayer(f.world, id)!;
for (const name of ["guard", "check_identity"] as const)
  for (const variant of [
    "valid",
    "null",
    "string",
    "extra",
    "missing",
    "late",
    "copy",
    "clone",
  ] as const)
    test(`actual strict native ${name}/${variant}: owned receipts and stock`, async () => {
      const f = demonHunterFixture(12),
        id = name === "guard" ? 11 : 8,
        before = audit(f, id),
        receipts: boolean[] = [];
      let reads = 0;
      const run = f.phaseManager.runSingleCycle(
        {
          getAction: async (r: ActionRequest) => {
            if (!r.allowedTools.includes(name)) return demonNightChoice(r, 9);
            expect(r.context.allow_fallback).toBe(false);
            expect(r.context.action_failure_policy).toBe("error");
            expect(r.context.turn_constraints).toMatchObject({
              min_valid_actions: 1,
              max_valid_actions: 1,
              required_any_tools: [name],
            });
            expect(deferRequestDelivery(r, (accepted) => receipts.push(accepted))).toBe(true);
            if (variant === "late") r.deadlineAtMs = Date.now() - 1;
            if (variant === "copy" || variant === "clone") {
              const clone = { ...r, deadlineAtMs: Date.now() + 1000 };
              if (variant === "clone") inheritDemonWitchDeadlineRequest(r, clone);
              const { ActionReception } =
                await import("../../../../src/ai/agents/player/action_reception");
              const reception = new ActionReception(f.world);
              const result = reception.validate(
                clone,
                name,
                name === "guard" ? { target_id: 12, abstain: false } : { target_id: 1 },
              );
              expect(result.ok).toBe(variant === "clone");
              if (variant === "copy") return null;
            }
            if (variant === "missing") return null;
            const args: Record<string, unknown> =
              name === "guard" ? { target_id: 12, abstain: false } : { target_id: 1 };
            if (variant === "string") args.target_id = String(args.target_id);
            if (variant === "null") {
              args.target_id = null;
              if (name === "guard") args.abstain = true;
            }
            if (variant === "extra")
              Object.defineProperty(args, "camp", {
                get() {
                  reads++;
                  throw new Error("getter");
                },
                enumerable: true,
              });
            return { name, args } as import("../../../../src/core").ToolCall;
          },
        },
        10,
      );
      const success =
        ["valid", "clone"].includes(variant) || (variant === "null" && name === "guard");
      if (success) await run;
      else await expect(run).rejects.toThrow();
      expect(receipts).toEqual([success]);
      expect(reads).toBe(0);
      if (!success) expect(audit(f, id)).toEqual(before);
    });
for (const position of ["seer", "after_damage"] as const)
  for (const heal of [false, true])
    test(`actual native Guard source revocation ${position}/${heal}: ordinary collision recomputes`, async () => {
      const f = demonHunterFixture(12);
      await f.phaseManager.runSingleCycle({ getAction: async (r) => demonNightChoice(r, 9) }, 10);
      let replaced = false;
      const revoke = () => {
        if (!replaced) {
          replaced = true;
          f.world.addComponent(11, COMPONENT.Alive, createAliveComponent());
        }
      };
      const original = f.damage.resolve.bind(f.damage),
        damage = spyOn(f.damage, "resolve").mockImplementation((world, effects) => {
          const result = original(world, effects);
          if (position === "after_damage") revoke();
          return result;
        });
      try {
        await f.phaseManager.runSingleCycle(
          {
            getAction: async (r) => {
              if (position === "seer" && r.allowedTools.includes("check_identity")) revoke();
              return demonNightChoice(r, 9, {
                knife: 12,
                guard: 12,
                hunt: 1,
                ...(heal ? { potion: { target: 12, type: PotionType.Heal } } : {}),
              });
            },
          },
          10,
        );
        const night = f.phaseManager
          .getEvents()
          .filter((e) => e.type === "night_resolved")
          .at(-1)!;
        expect(night.payload.deaths.includes(12)).toBe(!heal);
        expect(audit(f, 11)).toMatchObject({
          abilities: { "native:guard": { uses: 1, lastUsedDay: 2, state: { lastTarget: 12 } } },
        });
      } finally {
        damage.mockRestore();
      }
    });
for (const position of ["before_native", "after_native", "after_damage"] as const)
  test(`unknown Guard survives native source revocation ${position}`, async () => {
    const f = demonHunterFixture(12);
    await f.phaseManager.runSingleCycle({ getAction: async (r) => demonNightChoice(r, 9) }, 10);
    const marks = f.world.getComponent<StatusMarksComponent>(12, COMPONENT.StatusMarks)!;
    const original = f.damage.resolve.bind(f.damage),
      damage = spyOn(f.damage, "resolve").mockImplementation((world, effects) => {
        const result = original(world, effects);
        if (position === "after_damage") marks.add(StatusMark.GuardMark);
        return result;
      });
    try {
      await f.phaseManager.runSingleCycle(
        {
          getAction: async (r) => {
            if (position === "before_native" && r.allowedTools.includes("guard"))
              marks.add(StatusMark.GuardMark);
            if (r.allowedTools.includes("check_identity")) {
              if (position === "after_native") marks.add(StatusMark.GuardMark);
              f.world.addComponent(11, COMPONENT.Alive, createAliveComponent());
            }
            return demonNightChoice(r, 9, { knife: 12, guard: 12, hunt: 1 });
          },
        },
        10,
      );
      expect(
        f.phaseManager
          .getEvents()
          .filter((e) => e.type === "night_resolved")
          .at(-1)!.payload.deaths,
      ).toEqual([1]);
    } finally {
      damage.mockRestore();
    }
  });

for (const transport of ["sdk", "acp"] as const)
  for (const locale of ["zh-CN", "en"] as const)
    for (const name of ["guard", "check_identity"] as const)
      for (const outcome of ["valid", "invalid", "missing"] as const)
        test(`actual ${transport} provider class/${locale}/${name}/${outcome}: strict native delivery fallback zero`, async () => {
          const f = demonHunterFixture(12, undefined, locale),
            id = name === "guard" ? 11 : 8;
          const { LlmActionProvider } =
              await import("../../../../src/ai/agents/llm/llm_action_provider"),
            { AcpActionProvider } = await import("../../../../src/ai/agents/acp/acp_action_provider");
          let fallbackCalls = 0,
            submits = 0;
          const fallbackProvider = {
            getAction: async () => {
              fallbackCalls++;
              return null;
            },
          };
          const args = () =>
            name === "guard"
              ? { target_id: outcome === "valid" ? 12 : "12", abstain: false }
              : { target_id: outcome === "valid" ? 1 : "1" };
          const client: import("../../../../src/ai/integrations/llm/transport").ChatModelClient = {
            async chat() {
              throw new Error("unexpected_chat");
            },
            async runToolLoop<T>(
              _messages: import("../../../../src/ai/integrations/llm/transport").ChatMessage[],
              _tools: import("../../../../src/ai/integrations/llm/transport").ToolSchema[],
              callbacks: import("../../../../src/ai/integrations/llm/transport").ToolLoopCallbacks<T>,
            ) {
              if (outcome !== "missing")
                for (let i = 0; i < (outcome === "valid" ? 1 : 3); i++) {
                  const result = await callbacks.onToolCall({
                    id: `native-${i}`,
                    name: "submit_action",
                    rawArgs: "{}",
                    args: { turn_id: "t1", action: name, arguments: args() },
                  });
                  submits++;
                  if (result.finalAction)
                    return { finalAction: result.finalAction, assistantText: "Done" };
                }
              return { finalAction: null, assistantText: "Done" };
            },
          };
          const provider =
            transport === "sdk"
              ? new LlmActionProvider(f.world, client, {
                  boardConfig: f.config,
                  fallbackProvider,
                  maxConcurrentRequests: 1,
                  printLlmIo: false,
                  printThinking: false,
                  trace: false,
                  llmTimeoutMs: 1000,
                })
              : new AcpActionProvider(f.world, {
                  boardConfig: f.config,
                  fallbackProvider,
                  maxConcurrentRequests: 1,
                  turnTimeoutMs: 1000,
                  printLlmIo: false,
                  printThinking: false,
                  trace: false,
                  sessionFactory: {
                    async createSession(input) {
                      return {
                        sessionId: "demon-native-stub",
                        async prompt() {
                          if (outcome !== "missing")
                            for (let i = 0; i < (outcome === "valid" ? 1 : 3); i++) {
                              input.registry.submitAction("demon-native-stub", {
                                turn_id: "t1",
                                action: name,
                                arguments: args(),
                              });
                              submits++;
                            }
                        },
                        async cancel() {},
                        async close() {},
                      };
                    },
                  },
                });
          try {
            const run = f.phaseManager.runSingleCycle(
              {
                getAction: async (r) =>
                  r.allowedTools.includes(name) ? provider.getAction(r) : demonNightChoice(r, 9),
              },
              10,
            );
            if (outcome === "valid") await run;
            else await expect(run).rejects.toThrow();
            expect(fallbackCalls).toBe(0);
            expect(submits).toBe(outcome === "valid" ? 1 : outcome === "invalid" ? 3 : 0);
            expect(audit(f, id)).toMatchObject({
              abilities: {
                [`native:${name === "guard" ? "guard" : "seer_check"}`]: {
                  uses: outcome === "valid" ? 1 : 0,
                  lastUsedDay: outcome === "valid" ? 1 : null,
                },
              },
            });
          } finally {
            await provider.close();
          }
        });

for (const mark of [StatusMark.GuardMark, StatusMark.HealMark])
  for (const replacement of [false, true])
    test(`late unknown ${mark}/${replacement} survives with no native protection claim`, async () => {
      const { createStatusMarksComponent } = await import("../../../../src/core");
      const f = demonHunterFixture(12);
      await f.phaseManager.runSingleCycle({ getAction: async (r) => demonNightChoice(r, 9) }, 10);
      const original = f.damage.resolve.bind(f.damage),
        damage = spyOn(f.damage, "resolve").mockImplementation((world, effects) => {
          const result = original(world, effects);
          const marks = replacement
            ? createStatusMarksComponent()
            : world.getComponent<StatusMarksComponent>(12, COMPONENT.StatusMarks)!;
          if (replacement) world.addComponent(12, COMPONENT.StatusMarks, marks);
          marks.add(mark);
          return result;
        });
      try {
        await f.phaseManager.runSingleCycle(
          { getAction: async (r) => demonNightChoice(r, 9, { knife: 12 }) },
          10,
        );
        expect(
          f.phaseManager
            .getEvents()
            .filter((e) => e.type === "night_resolved")
            .at(-1)!.payload.deaths,
        ).toEqual([]);
      } finally {
        damage.mockRestore();
      }
    });
