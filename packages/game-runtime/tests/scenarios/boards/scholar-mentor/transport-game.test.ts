/**
 * 场景测试通过合成 SDK、真实 ACP 子进程及注入 MCP 执行完整白昼学者／寂夜导师对局。
 * 输入为强化、同好人及双狼计划和两种语言；字面选择、加成、冲突／胜方与受众断言构成独立预期。
 * 传输驱动拥有本地进程和录制资源；可选显式归档导出保留现有输出边界，默认不调用付费模型或重新生成固定预期。
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "bun:test";
import { scholarMentorScenario } from "../../../support/features/scholar-mentor/builders/transport-plan";
import { runTransportGame } from "../../../support/drivers/transport/run-game";
for (const variant of ["enhance", "same-good", "both-wolves"] as const)
  for (const transport of ["llm", "acp", "mixed"] as const)
    test(
      "Scholar Mentor bilingual real transport/" + variant + "/" + transport,
      async () => {
        const scenario = scholarMentorScenario(variant),
          runs: Awaited<ReturnType<typeof runTransportGame>>[] = [];
        for (const locale of ["zh-CN", "en"] as const) {
          const run = await runTransportGame(scenario, transport, locale);
          runs.push(run);
          expect(run.result.snapshot.result?.winner).toBe(scenario.winner);
          expect(run.manifest.players.filter((p) => p.alive).map((p) => p.player_id)).toEqual(
            scenario.alive,
          );
          const choices = run.replay.events.filter((e) => e.type === "modifier_choice_committed");
          expect(choices).toHaveLength(variant === "both-wolves" ? 3 : 4);
          expect(choices.map((e) => e.payload.mode)).toEqual(
            variant === "both-wolves"
              ? ["enhance", "enhance", "weaken"]
              : ["enhance", "enhance", "weaken", "weaken"],
          );
          const bonuses = run.replay.events.filter((e) => e.type === "modifier_bonus_resolved");
          expect(bonuses.map((e) => e.payload.kind)).toEqual(
            variant === "enhance" ? ["kill", "check"] : [],
          );
          if (variant === "enhance") expect(bonuses[1]!.payload.isWerewolf).toBe(true);
          const conflicts = run.replay.events.filter(
            (e) => e.type === "modifier_conflict_resolved",
          );
          expect(conflicts).toHaveLength(variant === "enhance" ? 0 : 1);
          if (variant !== "enhance") {
            expect(conflicts[0]!.payload.kind).toBe(
              variant === "same-good" ? "same_good" : "both_wolves",
            );
            expect(conflicts[0]!.payload.targetId).toBe(
              variant === "same-good" ? scenario.seer : scenario.mentor,
            );
          }
          for (const view of run.views) {
            const mine = view.timeline.filter(
              (row) => row.kind === "event" && row.event.type === "modifier_choice_committed",
            );
            expect(mine).toHaveLength(
              view.player_id === scenario.scholar
                ? 2
                : view.player_id === scenario.mentor
                  ? variant === "both-wolves"
                    ? 1
                    : 2
                  : 0,
            );
            expect(
              view.timeline.some(
                (row) => row.kind === "event" && row.event.type === "modifier_conflict_resolved",
              ),
            ).toBe(false);
            const bonus = view.timeline.filter(
              (row) => row.kind === "event" && row.event.type === "modifier_bonus_resolved",
            );
            expect(bonus).toHaveLength(
              variant === "enhance" &&
                (view.player_id === scenario.seer || view.player_id === scenario.knifeActor)
                ? 1
                : 0,
            );
          }
          expect(run.rejected.size).toBe(0);
          expect(run.acpTraces.every((row) => row.trace.rejected === 0)).toBe(true);
          if (transport === "llm" && process.env.AWA_SCHOLAR_MENTOR_FIXTURES) {
            const directory = process.env.AWA_SCHOLAR_MENTOR_FIXTURES;
            await mkdir(directory, { recursive: true });
            const base = join(
              directory,
              "scholar-mentor-" + (variant === "enhance" ? "" : variant + "-") + locale,
            );
            await writeFile(base + ".replay.json", JSON.stringify(run.replay, null, 2) + "\n");
            await writeFile(
              base + ".checkpoint.txt",
              JSON.stringify(run.record.checkpoints.at(-1), null, 2) + "\n",
            );
          }
        }
        expect(runs[0]!.result).toEqual(runs[1]!.result);
        expect(runs[0]!.record.checkpoints).toEqual(runs[1]!.record.checkpoints);
      },
      120000,
    );
