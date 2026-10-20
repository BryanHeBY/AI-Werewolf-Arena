/**
 * 复现场景测试：验证 pending 贵族／不死之身请求自动保存未结算录制前缀。输入为原夜周期、held provider 与临时 live／finalized store 的阶段矩阵；pending 结果、授权 feed 及精确复盘为字面预期，区分 provider 返回和领域结算，不重写归档。
 */
import { expect, test } from "bun:test";
import { readFile, writeFile, rm } from "node:fs/promises";
import { createTestTempDirectory } from "../../../support/drivers/temp-directories";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import {
  Role,
  COMPONENT,
  createRandom,
  type ActionRequest,
  type ToolCall,
} from "../../../../src/domain";
import { nobleSecretBodyTwelveConfig } from "../../../../src/rulesets/presets/noble-secret-body-twelve";
import { demonNightChoice } from "../../../support/features/demon-hunter/drivers/actions";
import { SessionRecordManager } from "../../../../src/recording/session/recorder";
import { runWithSessionRecorder } from "../../../../src/recording/session/context";
import {
  beginGameReproduction,
  captureCheckpoint,
  currentEngineVersion,
} from "../../../../src/app/simulation/reproduction-context";
import { parseReproductionRecord } from "../../../../src/recording/reproduction/format";
import { replayReproduction } from "../../../../src/app/simulation/replay-reproduction";
import { buildAgentVisibleEvent } from "../../../../src/agents/observation/event-feed";

for (const target of ["secret_body", "night_noble", "awakened_idiot_reveal_speech"])
  test(`real pending ${target}: live archive autosave, owner feed and finalized exact Tape`, async () => {
    const c = nobleSecretBodyTwelveConfig(),
      g = bootstrapGame(c, {
        locale: "en",
        fixedRoles: c.roleSetups.flatMap((r) => Array<Role>(r.count).fill(r.role)),
        random: createRandom(`noble-delivery-incremental:${target}`),
      });
    const root = await createTestTempDirectory(`awa-noble-pending-${target}-`);
    const manager = await SessionRecordManager.create(
      {
        sessionId: "game",
        board: "awa_noble_secret_body_12_v1",
        startedAtIso: new Date().toISOString(),
        locale: "en",
        random: g.random.metadata,
      },
      root,
    );
    let examined = 0;
    await runWithSessionRecorder(manager, async () => {
      const trace = beginGameReproduction(manager, g, {
        engine: await currentEngineVersion(),
        boardId: "awa_noble_secret_body_12_v1",
        ...(void c, {}),
        locale: "en",
        maxDays: 8,
      });
      for (let cycle = 1; cycle <= (target === "night_noble" ? 2 : 1); cycle++) {
        await g.phaseManager.runSingleCycle(
          {
            getAction: (q) =>
              trace.decide(q, {
                async getAction(r: ActionRequest): Promise<ToolCall | null> {
                  if (r.context.stage === target && examined === 0) {
                    examined++;
                    const prefix = trace.build(),
                      d = prefix.decisions.at(-1)!;
                    expect(prefix.finalized).toBe(false);
                    expect(prefix.operations).toEqual([]);
                    expect(d.outcome.kind).toBe("pending");
                    expect(d.openedAtEventCount).toBe(g.phaseManager.getEvents().length);
                    expect(prefix.checkpoints.at(-1)!.cycle).toBe(cycle - 1);
                    expect(prefix.events.length).toBeGreaterThan(
                      prefix.checkpoints.at(-1)!.eventCount,
                    );
                    expect(
                      d.request.context.visible_events.some(
                        (e) =>
                          e.type.startsWith("noble_body_") ||
                          e.type === "noble_contract_closed" ||
                          e.type === "secret_body_blocked",
                      ),
                    ).toBe(false);
                    if (target === "secret_body")
                      expect(d.request.context.visible_events).toEqual([
                        { seq: 1, type: "phase_changed", payload: { phase: "night", day: 1 } },
                        {
                          seq: 2,
                          type: "secret_body_night_notified",
                          payload: {
                            policy: "awa_noble_secret_body_v1",
                            actorId: 5,
                            day: 1,
                            protectionRepeatPolicy: "awa_nonconsecutive_nights_v1",
                            lastNotifiedNight: 1,
                            lastChoice: null,
                            resource: "intact",
                            publicRevealDay: null,
                          },
                        },
                      ]);
                    if (target === "night_noble")
                      expect(
                        d.request.context.visible_events
                          .filter((e) => e.type === "noble_night_notified")
                          .at(-1)?.payload,
                      ).toEqual({
                        policy: "awa_noble_secret_body_v1",
                        actorId: 1,
                        day: 2,
                        wolfActionPolicy: "standard",
                        lastNotifiedNight: 2,
                        lastChoice: null,
                        contracts: [],
                      });
                    if (target === "awakened_idiot_reveal_speech") {
                      expect(d.request.context.visible_events.at(-1)).toMatchObject({
                        type: "secret_body_revealed",
                        payload: { policy: "awa_noble_secret_body_v1", actorId: 5, day: 1 },
                      });
                      expect(g.world.getComponent(5, COMPONENT.Alive)!.alive).toBe(true);
                    }
                    await writeFile(root + "/pending-direct.json", JSON.stringify(prefix, null, 2));
                    // 让真实 provider 保持 pending，超过录制器 100ms 的防抖间隔；
                    // 不能靠新增 checkpoint 或终结操作制造此前缀。
                    await new Promise((resolve) => setTimeout(resolve, 350));
                    const disk = parseReproductionRecord(
                      JSON.parse(await readFile(manager.sessionDir + "/reproduction.json", "utf8")),
                    );
                    expect(disk.finalized).toBe(false);
                    expect(disk.decisions.at(-1)?.stage).toBe(target);
                    expect(disk.decisions.at(-1)?.outcome.kind).toBe("pending");
                    expect(disk.operations).toEqual([]);
                    await writeFile(
                      root + "/pending-autosaved.json",
                      JSON.stringify(disk, null, 2),
                    );
                  }
                  if (r.allowedTools.includes("protect_secret_body"))
                    return {
                      name: "protect_secret_body",
                      args: { target_id: r.context.day === 1 ? 6 : 7 },
                    };
                  if (r.allowedTools.includes("choose_servant"))
                    return { name: "choose_servant", args: { target_id: 6 } };
                  if (r.allowedTools.includes("check_identity"))
                    return { name: "check_identity", args: { target_id: 7 } };
                  if (r.allowedTools.includes("vote"))
                    return {
                      name: "vote",
                      args: {
                        target_id:
                          target === "awakened_idiot_reveal_speech"
                            ? 5
                            : r.context.day === 1
                              ? 10
                              : 11,
                        abstain: false,
                      },
                    };
                  if (r.allowedTools.includes("speak"))
                    return { name: "speak", args: { text: "Independent pending-prefix speech." } };
                  return demonNightChoice(r, 3, { knife: null, hunt: null });
                },
              }),
          },
          8,
        );
        trace.checkpoint(
          captureCheckpoint(
            g.world,
            g.phaseManager.getSnapshot(),
            cycle,
            true,
            g.phaseManager.getEvents().length,
          ),
          g.phaseManager.getEvents(),
        );
      }
      expect(examined).toBe(1);
      await manager.finalize({
        endedAtIso: new Date().toISOString(),
        winner: null,
        finishReason: "runtime_timeout",
        players: g.world.entityIds().map((id) => ({
          player_id: id,
          role: g.world.getComponent(id, COMPONENT.Role)!.role,
          camp: g.world.getComponent(id, COMPONENT.Camp)!.camp,
          alive: g.world.getComponent(id, COMPONENT.Alive)!.alive,
        })),
      });
    });
    const final = parseReproductionRecord(
      JSON.parse(await readFile(manager.sessionDir + "/reproduction.json", "utf8")),
    );
    const replay = await replayReproduction(final, root + "/tape");
    expect(replay.snapshot.gameOver).toBe(false);
    // 这里的生产投影是被测对象，绝不作为预期生成器：
    // 每个新增仅 God 可见的事实，在所有伪造受众分支下对全部席位仍为 null。
    for (const e of final.events.filter((e) => e.type.startsWith("noble_body_")))
      for (const audience of [[], [1], [5], [1, 5], undefined])
        for (let id = 1; id <= 12; id++)
          expect(buildAgentVisibleEvent(g.world, { ...e, audience } as any, id, 1)).toBeNull();
    await rm(root, { recursive: true, force: true });
  }, 15000);
