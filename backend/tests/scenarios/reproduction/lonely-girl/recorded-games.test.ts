/**
 * 负责孤独少女完整录制对局中秘密胜利归属及私有倾慕历史的隔离。
 * 输入为原六人／十二人场景、传输与语言矩阵及同前缀归档变体；输出由原身份、归属、生存和胜利字面断言核对。
 * 复制的归档只作为变体，不充当独立规则 golden。
 */
import { expect, test } from "bun:test";
import { promises as fs } from "node:fs";
import { Role, Camp, type GameEvent } from "../../../../src/domain";
import { LONELY_GIRL_CASES, lonelyGirlScenario } from "../../../support/features/lonely-girl/builders/scenario";
import { runTransportGame } from "../../../support/drivers/transport/run-game";
import { parseReproductionRecord } from "../../../../src/recording/reproduction/format";
import { ReproductionTrace } from "../../../../src/recording/reproduction/trace";
for (const size of [6, 12] as const)
  for (const kind of LONELY_GIRL_CASES.filter(
    (k) => size === 6 || ["good_alive", "wolf_alive", "wolf_win"].includes(k),
  ))
    for (const transport of ["llm", "acp", "mixed"] as const)
      test(`${size}/${kind}/${transport}: actual bilingual isolated affiliation, private archives and strict Tape`, async () => {
        for (const locale of ["zh-CN", "en"] as const) {
          const scenario = lonelyGirlScenario(kind, size, locale),
            run = await runTransportGame(scenario, transport, locale),
            record = run.record,
            final = record.checkpoints.at(-1)!;
          expect(record.metadata.players.map((p) => p.role)).toEqual([...scenario.roles]);
          expect(record.metadata.initialDeal).toBeUndefined();
          if (size === 6 && kind === "good_alive" && transport === "llm" && locale === "zh-CN") {
            const trace = new ReproductionTrace(record.metadata, () => {}),
              first = record.checkpoints[0]!;
            trace.checkpoint(first, record.events.slice(0, first.eventCount) as GameEvent[]);
            const decision = record.decisions[0]!;
            await trace.decide(decision.request, {
              async getAction() {
                return { name: "choose_admired_player", args: { target_id: scenario.targetId } };
              },
            });
            await trace.decide(record.decisions[1]!.request, {
              async getAction() {
                return null;
              },
            });
            expect(trace.build().finalized).toBe(false);
            expect(() =>
              trace.build({
                operations: [],
                termination: { reason: "strict_failure", winner: null },
              }),
            ).toThrow("reproduction_lonely_girl_state_invalid");
          }

          expect(record.decisions.filter((d) => d.stage === "lonely_girl")).toHaveLength(1);
          expect(
            record.events
              .filter((e) => e.type === "lonely_girl_admired_chosen")
              .map((e) => e.payload),
          ).toEqual([
            {
              policy: "awa_netease_lonely_girl_v1",
              actorId: scenario.actorId,
              day: 1,
              targetId: scenario.targetId,
              camp: scenario.faction,
            },
          ]);
          expect(final.snapshot.result?.winner).toBe(scenario.winner);
          const outcome = final.snapshot.result?.outcome;
          if (outcome?.kind !== "victory") throw new Error("expected_victory");
          expect(outcome.winningPlayerIds).toEqual(scenario.winners);
          expect(final.players.filter((p) => p.alive).map((p) => p.id)).toEqual(scenario.alive);
          expect(final.players.find((p) => p.id === scenario.actorId)).toMatchObject({
            role: Role.LonelyGirl,
            camp: Camp.Good,
            victory: { affiliations: [{ kind: "faction", faction: scenario.faction }] },
          });
          expect(final.lonelyGirlSetup).toEqual({
            policy: "awa_netease_lonely_girl_v1",
            status: "complete",
            actorId: scenario.actorId,
          });
          expect(
            record.decisions.some(
              (d) =>
                d.actorId === scenario.actorId &&
                ["wolf_discussion", "wolf_vote"].includes(d.stage),
            ),
          ).toBe(false);
          for (const view of run.views) {
            const own = view.timeline.filter(
              (e) => e.kind === "event" && e.event.type === "lonely_girl_admired_chosen",
            );
            expect(own).toHaveLength(view.player_id === scenario.actorId ? 1 : 0);
            if (own.length) {
              const e = own[0]!;
              if (e.kind !== "event") throw new Error("expected_choice");
              expect(e.event.payload).toEqual({
                policy: "awa_netease_lonely_girl_v1",
                actorId: scenario.actorId,
                day: 1,
                targetId: scenario.targetId,
              });
              expect(view.role).toBe(Role.LonelyGirl);
              expect(view.camp).toBe(Camp.Good);
            }
          }
          if (transport === "llm" && locale === "zh-CN") {
            await fs.writeFile(
              `/tmp/awa-p9-lonely-girl-${size}-${kind}.record.json`,
              JSON.stringify(record),
            );
            await fs.writeFile(
              `/tmp/awa-p9-lonely-girl-${size}-${kind}.replay.json`,
              JSON.stringify(run.replay),
            );
            await fs.writeFile(
              `/tmp/awa-p9-lonely-girl-${size}-${kind}.player.json`,
              JSON.stringify(run.views.find((v) => v.player_id === scenario.actorId)),
            );
          }
          if (size === 6 && kind === "good_alive" && transport === "llm" && locale === "zh-CN")
            for (const mutate of [
              (r: typeof record) => {
                r.decisions[0]!.request.actorId = 999;
              },
              (r: typeof record) => {
                r.decisions[0]!.request.context.stage = "seer";
              },
              (r: typeof record) => {
                r.decisions[0]!.request.context.day = 2;
              },
              (r: typeof record) => {
                const d = r.decisions[0]!;
                if (d.outcome.kind === "action")
                  d.outcome.action!.args = { ...(d.outcome.action!.args as any), extra: true };
              },
              (r: typeof record) => {
                r.checkpoints[0]!.lonelyGirlSetup!.status = "failed";
                (
                  r.checkpoints[0]!.players.find((p) => p.id === scenario.actorId)!.privateState
                    .lonelyGirl as any
                ).remaining = 0;
              },
              (r: typeof record) => {
                r.checkpoints[1]!.lonelyGirlSetup!.status = "pending";
                r.checkpoints[1]!.players.find(
                  (p) => p.id === scenario.actorId,
                )!.privateState.lonelyGirl = {
                  policy: "awa_netease_lonely_girl_v1",
                  remaining: 1,
                  choice: null,
                };
                r.checkpoints[1]!.players.find(
                  (p) => p.id === scenario.actorId,
                )!.victory.affiliations = [];
              },
              (r: typeof record) => {
                r.metadata.players.find((p) => p.id === scenario.targetId)!.camp = Camp.Wolf;
                const e = r.events.find((e) => e.type === "lonely_girl_admired_chosen")!;
                (e.payload as any).camp = Camp.Wolf;
                for (const cp of r.checkpoints.slice(1))
                  cp.players.find((p) => p.id === scenario.actorId)!.victory.affiliations = [
                    { kind: "faction", faction: Camp.Wolf },
                  ];
              },
              (r: typeof record) => {
                r.events.push({
                  timestamp: 1,
                  type: "hybrid_exemplar_chosen",
                  payload: { actorId: scenario.actorId, day: 1, targetId: scenario.targetId },
                });
              },
              (r: typeof record) => {
                r.checkpoints[0]!.players[0]!.privateState.hybrid = { remaining: 1, choice: null };
              },
            ]) {
              const bad = structuredClone(record);
              mutate(bad);
              expect(() => parseReproductionRecord(bad)).toThrow();
            }
        }
      }, 120000);
