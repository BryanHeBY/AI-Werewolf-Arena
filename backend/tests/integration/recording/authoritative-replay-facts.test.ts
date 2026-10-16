/**
 * 集成测试负责普通局权威事实 producer→Tape／God回放→严格复现的真实接线。输入为固定角色、
 * 狼刀4／解药4与可选同守4，预期是独立字面事实、药量和生命；不从结算器输出反造预期。
 * 玩家投影、原事件序号与失败前缀分别核对，不调用模型、网络或长矩阵。
 */
import { expect, test } from "bun:test";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { readReplayArchive, readReplayPlayerView } from "@ai-werewolf-arena/replay-contract";
import {
  Role,
  WinCondition,
  PotionType,
  type ActionRequest,
  type ToolCall,
} from "../../../src/domain";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { sixPlayerMvpConfig } from "../../../src/rulesets/presets/six-player-mvp";
import { GameEventRecorder } from "../../../src/app/game-event-recorder";
import { SessionRecordManager } from "../../../src/recording/session/recorder";
import { runWithSessionRecorder } from "../../../src/recording/session/context";
import {
  beginGameReproduction,
  captureCheckpoint,
  currentEngineVersion,
} from "../../../src/app/simulation/reproduction-context";
import {
  readReproduction,
  replayReproduction,
} from "../../../src/app/simulation/replay-reproduction";
import { replayFactLog } from "../../../src/domain/replay-fact-log";
import { createTestTempDirectory } from "../../support/drivers/temp-directories";

async function recordGame(guard: boolean) {
  const roles = [Role.Wolf, Role.Seer, Role.Witch, Role.Villager, Role.Guard, Role.Villager];
  const game = bootstrapGame(
    {
      ...sixPlayerMvpConfig,
      winConditions: [WinCondition.SlaughterCity],
      roleSetups: [...new Set(roles)].map((role) => ({
        role,
        count: roles.filter((value) => value === role).length,
      })),
    },
    { fixedRoles: roles },
  );
  const root = await createTestTempDirectory("awa-authoritative-facts-");
  const manager = await SessionRecordManager.create(
    { sessionId: "facts", board: "literal_guard_witch", startedAtIso: "2026-10-17T00:00:00Z" },
    root,
  );
  const recorder = new GameEventRecorder(
    { world: game.world, replayManager: manager },
    game.phaseManager.getSnapshot().phase,
  );
  await runWithSessionRecorder(manager, async () => {
    const trace = beginGameReproduction(manager, game, {
      engine: await currentEngineVersion(),
      boardId: "literal_guard_witch",
      locale: "zh-CN",
      maxDays: 8,
    });
    const action = (r: ActionRequest): ToolCall | null => {
      if (r.allowedTools.includes("speak_to_wolves"))
        return { name: "speak_to_wolves", args: { text: "狼队讨论原文", end_chat: true } };
      if (r.allowedTools.includes("kill_vote"))
        return { name: "kill_vote", args: { target_id: 4, abstain: false } };
      if (r.allowedTools.includes("check_identity"))
        return { name: "check_identity", args: { target_id: 1 } };
      if (r.allowedTools.includes("guard"))
        return { name: "guard", args: { target_id: guard ? 4 : null, abstain: !guard } };
      if (r.allowedTools.includes("use_potion"))
        return { name: "use_potion", args: { target_id: 4, potion_type: PotionType.Heal } };
      if (r.allowedTools.includes("speak"))
        return { name: "speak", args: { text: "独立场景发言" } };
      if (r.allowedTools.includes("vote"))
        return { name: "vote", args: { target_id: null, abstain: true } };
      return null;
    };
    await game.phaseManager.runSingleCycle(
      { getAction: (r) => trace.decide(r, { getAction: async (q) => action(q) }) },
      8,
    );
    recorder.flush(game.phaseManager.getEvents());
    trace.checkpoint(
      captureCheckpoint(
        game.world,
        game.phaseManager.getSnapshot(),
        1,
        true,
        game.phaseManager.getEvents().length,
      ),
      game.phaseManager.getEvents(),
    );
    const cp = captureCheckpoint(
      game.world,
      game.phaseManager.getSnapshot(),
      1,
      true,
      game.phaseManager.getEvents().length,
    );
    await manager.finalize({
      endedAtIso: "2026-10-17T00:01:00Z",
      winner: null,
      finishReason: "runtime_timeout",
      players: cp.players.map((p) => ({
        player_id: p.id,
        role: p.role,
        camp: p.camp,
        alive: p.alive,
        name: p.name,
      })),
    });
  });
  const replay = readReplayArchive(
    JSON.parse(await readFile(path.join(manager.sessionDir, "replay.json"), "utf8")),
  ).replay;
  const tape = await readReproduction(path.join(manager.sessionDir, "reproduction.json"));
  return { game, replay, tape, manager };
}

for (const guarded of [false, true])
  test(`God权威事实精确区分${guarded ? "同守同救相消死亡" : "解药阻断狼伤害"}并严格重放`, async () => {
    const { game, replay, tape, manager } = await recordGame(guarded);
    expect(replay.factCoverage).toEqual({ committedDeaths: 1 });
    expect(replay.facts).toEqual(tape.facts);
    expect(replay.facts).toEqual(replayFactLog(game.phaseManager.getEvents())!.facts);
    expect(
      replay
        .facts!.filter((f) => f.kind === "wolf_knife_committed")
        .map(({ seq, afterSeq, ...fact }) => fact),
    ).toEqual([
      {
        kind: "wolf_knife_committed",
        day: 1,
        participantIds: [1],
        requestedTargetId: 4,
        effectiveTargetId: 4,
      },
    ]);
    expect(
      replay
        .facts!.filter((f) => f.kind === "potion_stock")
        .map(({ seq, afterSeq, ...fact }) => fact),
    ).toEqual([
      { kind: "potion_stock", day: 1, actorId: 3, abilityId: "native:potion", heal: 1, poison: 1 },
      { kind: "potion_stock", day: 1, actorId: 3, abilityId: "native:potion", heal: 0, poison: 1 },
    ]);
    expect(
      replay
        .facts!.filter((f) => f.kind === "night_protection_resolved")
        .map(({ seq, afterSeq, ...fact }) => fact),
    ).toEqual(
      guarded
        ? [
            {
              kind: "night_protection_resolved",
              day: 1,
              targetId: 4,
              interaction: "guard_heal_cancelled",
            },
          ]
        : [
            {
              kind: "night_protection_resolved",
              day: 1,
              targetId: 4,
              interaction: "wolf_attack_blocked",
              protection: "heal",
            },
          ],
    );
    expect(
      replay
        .facts!.filter((f) => f.kind === "life_committed")
        .map(({ seq, afterSeq, ...fact }) => fact),
    ).toEqual(
      guarded
        ? [
            {
              kind: "life_committed",
              day: 1,
              playerId: 4,
              alive: false,
              causes: ["wolf_kill"],
              waveId: 1,
            },
          ]
        : [],
    );
    expect(replay.events.map((e) => e.seq)).toEqual(
      Array.from({ length: replay.events.length }, (_, i) => i + 1),
    );
    const player = readReplayPlayerView(
      JSON.parse(await readFile(path.join(manager.sessionDir, "players/player_6.json"), "utf8")),
    );
    expect(player).not.toHaveProperty("facts");
    expect(JSON.stringify(player)).not.toContain("potion_stock");
    expect(
      (await replayReproduction(tape, await createTestTempDirectory("awa-fact-exact-replay-")))
        .snapshot,
    ).toEqual(game.phaseManager.getSnapshot());
    const forged = structuredClone(tape);
    const stock = forged.facts!.find((f) => f.kind === "potion_stock")!;
    if (stock.kind === "potion_stock") stock.heal = 99;
    await expect(
      replayReproduction(forged, await createTestTempDirectory("awa-fact-forged-replay-")),
    ).rejects.toThrow("reproduction_facts_mismatch");
    if (guarded) {
      // 新档明确wave编号必须逐值重现；历史缺该可选字段只失去波证据，不失去生命/死因精确比对。
      const oldTape = structuredClone(tape);
      for (const fact of oldTape.facts ?? [])
        if (fact.kind === "life_committed") delete fact.waveId;
      expect(
        (await replayReproduction(oldTape, await createTestTempDirectory("awa-legacy-life-wave-")))
          .snapshot,
      ).toEqual(game.phaseManager.getSnapshot());
      const changedWave = structuredClone(tape);
      const life = changedWave.facts!.find((f) => f.kind === "life_committed")!;
      if (life.kind === "life_committed") life.waveId = 99;
      await expect(
        replayReproduction(changedWave, await createTestTempDirectory("awa-forged-life-wave-")),
      ).rejects.toThrow("reproduction_facts_mismatch");
    }
  });
