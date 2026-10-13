/**
 * Failure scenarios verify Animal Dream Fox and Puffer paid effects remain committed when required recording fails.
 * Input: Original controlled PhaseManager cycles, real session stores and injected post-payment record faults.
 * Output and oracle: Explicit paid stock/effect, failure-prefix and persisted-finalization assertions retain original commit order; no refund, new golden or repaired action is introduced.
 */
import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { createTestTempDirectory } from "../../../support/drivers/temp-directories";
import { animalGame, animalBoard } from "../../../support/features/animal-dream/builders/runtime-game";
import { animalAction } from "../../../support/features/animal-dream/drivers/actions";
import { SessionRecordManager } from "../../../../src/recording/session_recorder";
import { runWithSessionRecorder } from "../../../../src/recording/recording_context";
import {
  beginGameReproduction,
  captureCheckpoint,
  currentEngineVersion,
} from "../../../../src/runtime/simulation/reproduction_context";
import { GameEventRecorder } from "../../../../src/runtime/game_event_recorder";
import { parseReproductionRecord } from "../../../../src/recording/reproduction";
import { animalAuthoritySnapshot } from "../../../../src/game/mechanisms/roles/animal_dream/authority";
import {
  animalFoxKnowledge,
  animalPufferKnowledge,
} from "../../../../src/game/mechanisms/roles/animal_dream/facts";
import { COMPONENT, type ActionRequest, type ToolCall } from "../../../../src/core";
import { getWolfBeautyState } from "../../../../src/game/mechanisms/roles/private_state";

for (const skill of ["fox", "puffer"] as const)
  test(`R actual PM+Trace ${skill}: settlement recording failure preserves paid resource without publication`, async () => {
    const g = animalGame(),
      root = await createTestTempDirectory("awa-animal-paid-" + skill + "-");
    const manager = await SessionRecordManager.create(
      {
        sessionId: "game",
        board: "animal_dream",
        locale: "zh-CN",
        startedAtIso: new Date().toISOString(),
        random: g.random.metadata,
      },
      root,
    );
    const recorder = new GameEventRecorder(
      { world: g.world, replayManager: manager },
      g.phaseManager.getSnapshot().phase,
    );
    const engine = await currentEngineVersion();
    let fired = 0,
      failure: unknown;
    await runWithSessionRecorder(manager, async () => {
      const trace = beginGameReproduction(manager, g, {
        engine,
        boardId: "animal_dream",
        ...(void animalBoard(), {}),
        locale: "zh-CN",
        maxDays: 8,
      });
      // Test-only recording sink failure at the actual ReproductionTrace settle notification.
      // Domain owner, action, votes, lives and append logic remain production implementations.
      const sink = manager as unknown as { scheduleFlush(): void };
      const original = sink.scheduleFlush;
      sink.scheduleFlush = function () {
        const a = animalAuthoritySnapshot(g.world, false)!;
        if (!fired && (skill === "fox" ? a.fox.usedNight === 2 : a.puffer.usedDay === 1)) {
          fired++;
          throw Error("R_SETTLEMENT_RECORD_SINK_FAILED");
        }
        return original.call(this);
      };
      const choose = (r: ActionRequest): ToolCall | null => {
        if (r.allowedTools.includes("vote"))
          return {
            name: "vote",
            args: { target_id: skill === "puffer" ? 12 : null, abstain: skill !== "puffer" },
          };
        return animalAction(r, skill === "fox" ? "fox_beauty" : "full_retaliation");
      };
      const cycles = skill === "fox" ? 2 : 1;
      for (let cycle = 1; cycle <= cycles; cycle++) {
        try {
          await g.phaseManager.runSingleCycle(
            { getAction: (r) => trace.decide(r, { getAction: async (q) => choose(q) }) },
            8,
          );
        } catch (e) {
          failure = e;
          trace.noteFailure("cycle", e);
        }
        recorder.flush(g.phaseManager.getEvents());
        trace.checkpoint(
          captureCheckpoint(
            g.world,
            g.phaseManager.getSnapshot(),
            cycle,
            !failure,
            g.phaseManager.getEvents().length,
            failure,
          ),
          g.phaseManager.getEvents(),
        );
        if (failure) break;
      }
      sink.scheduleFlush = original;
      expect(String(failure)).toContain("R_SETTLEMENT_RECORD_SINK_FAILED");
      expect(fired).toBe(1);
      const a = animalAuthoritySnapshot(g.world, false)!;
      expect(a.stopped).toBe(true);
      expect(g.world.getAliveEntityIds()).toEqual(Array.from({ length: 12 }, (_, i) => i + 1));
      expect(g.phaseManager.getEvents().some((e) => e.type === "game_over")).toBe(false);
      expect(g.phaseManager.getEvents().filter((e) => e.type === "night_resolved")).toHaveLength(1);
      expect(
        g.phaseManager
          .getEvents()
          .some(
            (e) => e.type === (skill === "fox" ? "animal_fox_chosen" : "animal_puffer_decided"),
          ),
      ).toBe(false);
      if (skill === "fox") {
        expect(a.fox).toEqual({
          policy: "awa_animal_dream_v1",
          usedNight: 2,
          history: [{ day: 2, targetId: 1 }],
        });
        expect(a.effect).toEqual({ day: 2, targetId: 1, knifeBlocked: true, beautyBlocked: true });
        expect(a.night!.status).toBe("aborted");
        expect(animalFoxKnowledge(g.world, 10)).toEqual({ remaining: 1, lastChoice: null });
        expect(getWolfBeautyState(g.world.getComponent(1, COMPONENT.Role)!)!.history).toEqual([
          { day: 1, targetId: 5 },
        ]);
        expect(getWolfBeautyState(g.world.getComponent(1, COMPONENT.Role)!)!.targetId).toBeNull();
      } else {
        expect(a.puffer).toEqual({
          policy: "awa_animal_dream_v1",
          usedDay: 1,
          knifeDeathDay: null,
          history: [
            { day: 1, activate: true, targetIds: Array.from({ length: 12 }, (_, i) => i + 1) },
          ],
        });
        expect(a.unit!.status).toBe("aborted");
        expect(a.unit!.puffer!.paid).toBe(true);
        expect(a.unit!.puffer!.activated).toBe(true);
        expect(a.cat.form.kind).toBe("veiled");
        expect(animalPufferKnowledge(g.world, 12)).toEqual({ remaining: 1, lastDecision: null });
      }
      const rawTrace = trace as unknown as {
        metadata: unknown;
        decisions: unknown[];
        checkpoints: unknown[];
        errors: unknown[];
      };
      // Save the true trace before validation: this is not a fabricated replay fixture.
      const input = (manager as any).aggregate.debugSummaryInput();
      const operations = (input.logicOps ?? [])
        .filter((op: any) => op.scope !== "llm_action_provider")
        .map(({ seq: _seq, timestamp: _timestamp, ...op }: any) => op);
      const raw = {
        schemaVersion: 2,
        finalized: true,
        metadata: rawTrace.metadata,
        decisions: rawTrace.decisions,
        checkpoints: rawTrace.checkpoints,
        events: g.phaseManager.getEvents(),
        operations,
        termination: { reason: "runtime_error", winner: null, errors: rawTrace.errors },
      };
      expect(() => parseReproductionRecord(raw)).not.toThrow();
      if (skill === "fox") {
        const changed = structuredClone(raw) as any,
          last = changed.decisions.at(-1),
          cp = changed.checkpoints.at(-1);
        last.outcome.action.args.target_id = 999;
        cp.animalDream.fox.history[0].targetId = 999;
        cp.animalDream.effect = {
          day: 2,
          targetId: 999,
          knifeBlocked: false,
          beautyBlocked: false,
        };
        cp.players.find((p: any) => p.id === 10).privateState.foxCub.history[0].targetId = 999;
        expect(() => parseReproductionRecord(changed)).toThrow();
      }
      const snapshot = g.phaseManager.getSnapshot();
      await manager.finalize({
        endedAtIso: new Date().toISOString(),
        winner: null,
        finishReason: "runtime_error",
        players: captureCheckpoint(
          g.world,
          snapshot,
          0,
          false,
          g.phaseManager.getEvents().length,
        ).players.map((p) => ({ player_id: p.id, role: p.role, camp: p.camp, alive: p.alive })),
      });
      expect(
        JSON.parse(await readFile(manager.sessionDir + "/reproduction.json", "utf8")).finalized,
      ).toBe(true);
    });
  });
