/**
 * 负责觉醒女巫四夜三轮秘密协作的两语SDK/ACP/MCP真实协议验收；手写计划为独立oracle。
 * 核三轮和一次解药、六名不同协助者、普通狼与持爪狼的纯毒终局、逐玩家保密以及失败资源前缀。
 * 本地合成模型与真实传输不消费付费模型；驱动另核严格重放与所有会话/进程关闭。
 * 此为真实本地协议场景测试层级，不把stub窗口测试代替SDK/ACP端到端验证。
 */
import { expect, test } from "bun:test";
import { writeFile } from "node:fs/promises";
import { awakenedWitchScenario } from "../../../support/features/awakened-witch/builders/transport-plan";
import { runTransportGame } from "../../../support/drivers/transport/run-game";
for (const transport of ["llm", "acp", "mixed"] as const)
  test(`AwWitch四夜三轮真实两语私密协作/${transport}`, async () => {
    for (const locale of ["zh-CN", "en"] as const) {
      const scenario = awakenedWitchScenario(),
        run = await runTransportGame(scenario, transport, locale);
      expect(run.result.snapshot.result?.winner).toBe(scenario.winner);
      expect(run.manifest.players.filter((p) => p.alive).map((p) => p.player_id)).toEqual(
        scenario.alive,
      );
      expect(run.replay.events.filter((e) => e.type === "awakened_brew_chosen")).toHaveLength(4);
      expect(run.replay.events.filter((e) => e.type === "brew_started")).toHaveLength(3);
      expect(run.replay.events.filter((e) => e.type === "brew_discussion")).toHaveLength(6);
      expect(run.replay.events.filter((e) => e.type === "brew_approval")).toHaveLength(6);
      expect(
        run.replay.events.filter((e) => e.type === "brew_resolved").map((e) => e.payload.outcome),
      ).toEqual(["poison", "vetoed", "poison"]);
      expect(run.replay.events.filter((e) => e.type === "awakened_claw_spent")).toEqual([]);
      const state = run.record.checkpoints.at(-1)!.players.find((p) => p.id === scenario.witch)!
        .privateState.awakenedWitch as {
        nights: Array<{ mode: string; ordinal?: number; outcome?: string }>;
      };
      expect(state.nights.map((n) => [n.mode, n.ordinal ?? null, n.outcome ?? null])).toEqual([
        ["poison", 1, "poison"],
        ["poison", 2, "vetoed"],
        ["heal", null, null],
        ["poison", 3, "poison"],
      ]);
      for (const view of run.views) {
        const own = view.timeline.filter((r) => r.kind === "event").map((r) => r.event);
        expect(own.filter((e) => e.type === "brew_resolved")).toEqual([]);
        expect(own.filter((e) => e.type === "awakened_brew_chosen")).toHaveLength(
          view.player_id === scenario.witch ? 4 : 0,
        );
        const group = scenario.helpers.find((a) => a.includes(view.player_id));
        expect(own.filter((e) => e.type === "brew_started")).toHaveLength(group ? 1 : 0);
        expect(own.filter((e) => e.type === "brew_discussion")).toHaveLength(group?.length ?? 0);
        expect(own.filter((e) => e.type === "brew_approval")).toHaveLength(group ? 1 : 0);
      }
      expect(run.rejected.size).toBe(0);
      expect(run.acpTraces.every((r) => r.trace.rejected === 0)).toBe(true);
      if (transport === "llm") {
        await writeFile(
          `/tmp/awa-awakened-witch-${locale}.replay.json`,
          JSON.stringify(run.replay),
        );
        await writeFile(
          `/tmp/awa-awakened-witch-${locale}.reproduction.json`,
          JSON.stringify(run.record),
        );
      }
    }
  }, 120000);
for (const stage of ["awakened_witch", "brew_discussion", "brew_approval"] as const)
  for (const transport of ["llm", "acp"] as const)
    for (const failure of ["missing", "late"] as const)
      test(`AwWitch真实${stage}/${transport}/${failure}保准确消费前缀`, async () => {
        const scenario = awakenedWitchScenario(),
          entry = [...scenario.turns].find(([, turns]) =>
            turns.some((t) => t.day === 1 && t.stage === stage),
          )!,
          [actorId, turns] = entry,
          first = turns.find((t) => t.day === 1 && t.stage === stage)!;
        first.terminalFailure = failure;
        if (failure === "missing") {
          first.action = null;
          if (transport === "llm")
            turns.splice(
              turns.indexOf(first),
              1,
              ...Array.from({ length: 4 }, () => ({ ...first })),
            );
        }
        scenario.expectedFailure = { actorId, stage };
        const run = await runTransportGame(scenario, transport, "en"),
          cp = run.record.checkpoints.at(-1)!;
        expect(cp.complete).toBe(false);
        const state = cp.players.find((p) => p.id === scenario.witch)!.privateState
          .awakenedWitch as {
          nights: Array<{
            mode: string;
            outcome?: string;
            discussions?: unknown[];
            approvals?: unknown[];
          }>;
        };
        expect(state.nights).toHaveLength(stage === "awakened_witch" ? 0 : 1);
        if (stage !== "awakened_witch") {
          expect(state.nights[0]!.outcome).toBe("building");
          expect(state.nights[0]!.approvals).toEqual([]);
          expect(state.nights[0]!.discussions).toHaveLength(stage === "brew_approval" ? 1 : 0);
        }
        expect(run.record.events.some((e) => e.type === "brew_resolved")).toBe(false);
        if (stage === "brew_approval" && transport === "llm" && failure === "missing")
          await writeFile(
            "/tmp/awa-awakened-witch-approval-missing.reproduction.json",
            JSON.stringify(run.record),
          );
      }, 120000);

// 第二轮已有两名协助者：迟到者不能回滚另一名已付款的独立回执，也不能把building补成否决或毒药。
for (const transport of ["llm", "acp"] as const)
  test(`AwWitch第二轮多人批准/${transport}/late只保已付票`, async () => {
    const scenario = awakenedWitchScenario(),
      [paidActor, lateActor] = scenario.helpers[1]!,
      late = scenario.turns
        .get(lateActor!)!
        .find((t) => t.day === 2 && t.stage === "brew_approval")!;
    late.terminalFailure = "late";
    scenario.expectedFailure = { actorId: lateActor!, stage: "brew_approval" };
    const run = await runTransportGame(scenario, transport, "en"),
      cp = run.record.checkpoints.at(-1)!,
      state = cp.players.find((p) => p.id === scenario.witch)!.privateState.awakenedWitch as {
        nights: Array<{
          mode: string;
          ordinal?: number;
          outcome?: string;
          assistantIds?: number[];
          discussions?: unknown[];
          approvals?: Array<{ playerId: number; approve: boolean }>;
        }>;
      },
      second = state.nights[1]!;
    expect(cp.complete).toBe(false);
    expect(state.nights).toHaveLength(2);
    expect(state.nights[0]!.outcome).toBe("poison");
    expect(second).toMatchObject({
      mode: "poison",
      ordinal: 2,
      outcome: "building",
      assistantIds: scenario.helpers[1],
    });
    expect(second.discussions).toHaveLength(2);
    expect(second.approvals).toHaveLength(1);
    // 直接从实际归档核对演员，不以生产库存推导手写预期。
    const receipts = run.record.events.filter(
      (e) => e.type === "brew_approval" && e.payload.day === 2,
    );
    expect(receipts).toHaveLength(1);
    expect(receipts[0]!.payload.actorId).toBe(paidActor);
    expect(
      run.record.events.filter((e) => e.type === "brew_resolved" && e.payload.day === 2),
    ).toEqual([]);
    if (transport === "llm")
      await writeFile(
        "/tmp/awa-awakened-witch-approval-peer-late.reproduction.json",
        JSON.stringify(run.record),
      );
  }, 120000);
