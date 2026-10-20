/**
 * 场景测试通过子狐、白猫和河豚分支、投票、语言及合成本地 SDK／ACP 传输执行完整动物梦境对局。
 * 输入为原脚本计划；手写死亡／胜负固定预期与精确的所有者／公开归档检查核对已提交单位和可见性。
 * 传输驱动拥有本地进程和录制状态；显式选用的 fixture 导出保留原边界，默认运行不重写固定归档，也不调用付费模型。
 */
import { expect, test } from "bun:test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { runTransportGame } from "../../../support/drivers/transport/run-game";
import { animalTransportScenario } from "../../../support/features/animal-dream/builders/transport-plan";
for (const name of [
  "fox_beauty",
  "cat_badge",
  "puffer_knife",
  "pk",
  "last_chain",
  "full_retaliation",
] as const)
  for (const skip of [false, true])
    for (const first of [false, true])
      for (const kind of ["llm", "acp", "mixed"] as const)
        test(`Animal actual SDK ACP mixed ${name}/${skip}/${first}/${kind}`, async () => {
          const scenario = await animalTransportScenario(name, skip, first);
          for (const locale of ["zh-CN", "en"] as const) {
            const r = await runTransportGame(scenario, kind, locale);
            expect(r.result.snapshot.result?.winner).toBe(scenario.golden.winner);
            expect(r.manifest.players.filter((p) => p.alive).map((p) => p.player_id)).toEqual(
              scenario.golden.alive,
            );
            expect(
              r.record.events
                .filter((e) => e.type === "night_resolved")
                .map((e) => (e.payload.deaths as number[]).toSorted((a, b) => a - b)),
            ).toEqual(scenario.golden.night);
            expect(r.rejected.size).toBe(0);
            const event = (type: string) => r.record.events.filter((e) => e.type === type);
            const map = (id: number) => scenario.mapping.get(id)!;
            if (name === "fox_beauty") {
              expect(
                r.record.decisions.filter((d) => d.day === 2 && d.stage === "fox_distract"),
              ).toHaveLength(1);
              expect(
                r.record.decisions.filter(
                  (d) => d.day === 2 && ["wolf_vote", "wolf_beauty"].includes(d.stage),
                ),
              ).toHaveLength(0);
              expect(event("animal_fox_effect").map((e) => e.payload)).toEqual([
                {
                  policy: "awa_animal_dream_v1",
                  actorId: map(10),
                  day: 2,
                  targetId: map(1),
                  knifeBlocked: true,
                  beautyBlocked: true,
                },
              ]);
            }
            if (name === "cat_badge") {
              expect(event("animal_cat_revealed").map((e) => e.payload.day)).toEqual([1]);
              expect(event("animal_cat_expiry_prepared").map((e) => e.payload.day)).toEqual([
                skip ? 1 : 2,
              ]);
              expect(
                r.record.decisions
                  .filter((d) => d.actorId === map(9) && d.stage === "sheriff_badge_choice")
                  .map((d) => d.day),
              ).toEqual([skip ? 1 : 2]);
              expect(
                r.record.decisions.filter((d) => d.actorId === map(9) && d.stage === "last_words"),
              ).toHaveLength(0);
            }
            if (name === "pk") {
              expect(
                r.record.decisions.filter((d) => d.day === 1 && d.stage === "puffer_reaction"),
              ).toHaveLength(first ? 1 : 0);
              expect(event("animal_puffer_targets").map((e) => e.payload.targetIds)).toEqual(
                first ? [[map(2), map(3)].sort((a, b) => a - b)] : [],
              );
            }
            if (name === "puffer_knife") {
              expect(event("animal_puffer_revealed").map((e) => e.payload)).toEqual([
                { policy: "awa_animal_dream_v1", day: 1, actorId: map(12), reason: "knife_death" },
              ]);
              expect(event("charm_death")).toHaveLength(0);
              for (const d of r.record.decisions.filter(
                (d) => d.day === 1 && d.stage === "sheriff_nomination",
              ))
                expect(
                  d.request.context.visible_events.some((e) => e.type === "animal_puffer_revealed"),
                ).toBe(false);
            }
            if (name === "last_chain")
              expect(r.record.events.findIndex((e) => e.type === "game_over")).toBeGreaterThan(
                r.record.events.findLastIndex((e) => e.type === "charm_death"),
              );

            for (const v of r.views)
              for (const row of v.timeline)
                if (row.kind === "event" && row.event.type.startsWith("animal_")) {
                  expect([
                    "animal_cat_revealed",
                    "animal_puffer_revealed",
                    "animal_fox_chosen",
                    "animal_knife_notified",
                    "animal_beauty_notified",
                    "animal_puffer_decided",
                  ]).toContain(row.event.type);
                  if (!row.event.type.endsWith("_revealed"))
                    expect(row.event.payload.actorId).toBe(v.player_id);
                }
            if (kind === "llm" && process.env.AWA_ANIMAL_FIXTURES) {
              const directory = process.env.AWA_ANIMAL_FIXTURES,
                fixture = `animal-${name}-${skip ? "skip" : "wait"}-${first ? "first" : "final"}-${locale}`;
              await mkdir(path.join(directory, "player-views"), { recursive: true });
              await writeFile(
                path.join(directory, fixture + ".replay.json"),
                JSON.stringify(r.replay, null, 2) + "\n",
              );
              for (const [label, id] of [
                ["fox", 10],
                ["cat", 9],
                ["puffer", 12],
                ["villager", 5],
              ] as const)
                await writeFile(
                  path.join(directory, "player-views", fixture + "-" + label + ".player.json"),
                  JSON.stringify(
                    r.views.find((v) => v.player_id === scenario.mapping.get(id)),
                    null,
                    2,
                  ) + "\n",
                );
            }
          }
        }, 120000);
