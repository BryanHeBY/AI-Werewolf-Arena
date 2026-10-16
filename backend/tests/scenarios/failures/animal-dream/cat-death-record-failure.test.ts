/**
 * 故障场景测试：验证动物梦境白猫必需录制故障保留延期／真实死亡状态及原失败前缀。输入为原受控周期、真实 session store 和两个死亡点的故障；白猫、身份、死亡与 checkpoint 及错误身份为明确预期，不重新生成归档。
 */
import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { createTestTempDirectory } from "../../../support/drivers/temp-directories";
import {
  animalGame,
  animalBoard,
} from "../../../support/features/animal-dream/builders/runtime-game";
import { animalAction } from "../../../support/features/animal-dream/drivers/actions";
import { SessionRecordManager } from "../../../../src/recording/session/recorder";
import { runWithSessionRecorder } from "../../../../src/recording/session/context";
import {
  beginGameReproduction,
  captureCheckpoint,
  currentEngineVersion,
} from "../../../../src/app/simulation/reproduction-context";
import { GameEventRecorder } from "../../../../src/app/game-event-recorder";
import {
  parseReproductionRecord,
  REPRODUCTION_SCHEMA_VERSION,
} from "../../../../src/recording/reproduction/format";
import { animalAuthoritySnapshot } from "../../../../src/features/animal-dream/authority";
import { animalCatKnowledge } from "../../../../src/features/animal-dream/facts";
import {
  COMPONENT,
  type ActionRequest,
  type ToolCall,
  type AliveComponent,
} from "../../../../src/domain";
import { aliveLifeVersion } from "../../../../src/domain/components/alive";
for (const point of ["deferred", "actually_dead"] as const)
  test(`R actual PM+Trace Cat ${point} publication-failure archive`, async () => {
    const g = animalGame(),
      root = await createTestTempDirectory("awa-animal-cat-" + point + "-"),
      life = g.world.getComponent(9, COMPONENT.Alive)!;
    const manager = await SessionRecordManager.create(
        {
          sessionId: "game",
          board: "animal_dream",
          locale: "zh-CN",
          startedAtIso: new Date().toISOString(),
          random: g.random.metadata,
        },
        root,
      ),
      recorder = new GameEventRecorder(
        { world: g.world, replayManager: manager },
        g.phaseManager.getSnapshot().phase,
      ),
      engine = await currentEngineVersion();
    await runWithSessionRecorder(manager, async () => {
      const trace = beginGameReproduction(manager, g, {
        engine,
        boardId: "animal_dream",
        ...(void animalBoard(), {}),
        locale: "zh-CN",
        maxDays: 8,
      });
      let fired = 0,
        failure: unknown;
      const define = Object.defineProperty;
      Object.defineProperty = function (
        target: object,
        key: PropertyKey,
        desc: PropertyDescriptor,
      ) {
        const event = desc.value;
        if (
          !fired &&
          Array.isArray(target) &&
          event &&
          typeof event === "object" &&
          (point === "deferred"
            ? event.type === "animal_cat_revealed"
            : event.type === "animal_wave_committed" &&
              event.payload.phase === "voting" &&
              event.payload.deaths.includes(9))
        ) {
          fired++;
          throw Error("R_EVENT_PUBLICATION_FAILED");
        }
        return define(target, key, desc);
      } as typeof Object.defineProperty;
      const choose = (r: ActionRequest): ToolCall | null => {
        if (r.allowedTools.includes("kill_vote"))
          return { name: "kill_vote", args: { target_id: 9, abstain: false } };
        if (r.allowedTools.includes("vote"))
          return { name: "vote", args: { target_id: null, abstain: true } };
        if (r.allowedTools.includes("charm")) return { name: "charm", args: { target_id: null } };
        return animalAction(r, "last_chain");
      };
      try {
        await g.phaseManager.runSingleCycle(
          { getAction: (r) => trace.decide(r, { getAction: async (q) => choose(q) }) },
          8,
        );
      } catch (e) {
        failure = e;
      } finally {
        Object.defineProperty = define;
      }
      expect(String(failure)).toContain("R_EVENT_PUBLICATION_FAILED");
      expect(fired).toBe(1);
      trace.noteFailure("cycle", failure);
      recorder.flush(g.phaseManager.getEvents());
      const cp = captureCheckpoint(
        g.world,
        g.phaseManager.getSnapshot(),
        1,
        false,
        g.phaseManager.getEvents().length,
        failure,
      );
      trace.checkpoint(cp, g.phaseManager.getEvents());
      const a = animalAuthoritySnapshot(g.world, false)!;
      expect(cp.players.find((p) => p.id === 9)!.alive).toBe(point === "deferred");
      expect(cp.players.find((p) => p.id === 9)!.privateState.whiteCat).toEqual(a.cat);
      expect(a.cat.form.kind).toBe(point === "deferred" ? "deferred" : "expired");
      expect(life.alive).toBe(point === "deferred");
      expect(aliveLifeVersion(life)).toBe(point === "deferred" ? 0 : 1);
      expect(a.stopped).toBe(true);
      expect(animalCatKnowledge(g.world, 9)).toEqual({ revealed: point !== "deferred" });
      const rawTrace = trace as any,
        input = (manager as any).aggregate.debugSummaryInput(),
        operations = (input.logicOps ?? [])
          .filter((op: any) => op.scope !== "llm_action_provider")
          .map(({ seq: _seq, timestamp: _timestamp, ...op }: any) => op);
      const raw = {
        // 当前 Trace 的匿名玩家合法归属 Tape3；故障前缀和死亡篡改仍按完整当前格式校验。
        schemaVersion: REPRODUCTION_SCHEMA_VERSION,
        finalized: true,
        metadata: rawTrace.metadata,
        decisions: rawTrace.decisions,
        checkpoints: rawTrace.checkpoints,
        events: g.phaseManager.getEvents(),
        operations,
        termination: { reason: "runtime_error", winner: null, errors: rawTrace.errors },
      };
      expect(() => parseReproductionRecord(raw)).not.toThrow();
      const mutant = structuredClone(raw) as any;
      mutant.checkpoints.at(-1).players.find((p: any) => p.id === 9).alive = point !== "deferred";
      expect(() => parseReproductionRecord(mutant)).toThrow();
      await manager.finalize({
        endedAtIso: new Date().toISOString(),
        winner: null,
        finishReason: "runtime_error",
        players: cp.players.map((p) => ({
          player_id: p.id,
          role: p.role,
          camp: p.camp,
          alive: p.alive,
        })),
      });
      expect(
        parseReproductionRecord(
          JSON.parse(await readFile(manager.sessionDir + "/reproduction.json", "utf8")),
        ).finalized,
      ).toBe(true);
    });
  });
