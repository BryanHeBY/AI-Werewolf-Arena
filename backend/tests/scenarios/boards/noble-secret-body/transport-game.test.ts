/**
 * 完整真实传输场景验证夜之贵族／秘密之身死亡、到期及跨夜玩家知识。
 * 输入为合成 SDK／ACP／混合 Agent 和两种语言上的字面命名场景。
 * 输出与独立预期为独立终局／死亡／警徽固定结果、手写知识锚点及实际序列化前缀。
 * 测试不调用付费模型，也不重写预期 fixture／Tape 字节。
 */
import { expect, test } from "bun:test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { nobleTransportScenario } from "../../../support/features/noble-secret-body/builders/transport-plan";
import { runTransportGame } from "../../../support/drivers/transport/run-game";
import { assertNobleTransportWire } from "../../../support/features/noble-secret-body/oracles/wire";
import { assertNobleBadgeRules } from "../../../support/features/noble-secret-body/oracles/badge-prompt";
import { assertNobleTransportGolden } from "../../../support/features/noble-secret-body/oracles/transport-golden";
import { assertNobleKnownAnchors } from "../../../support/features/noble-secret-body/oracles/known-anchors";
for (const name of [
  "expiry",
  "new_and_old_clear",
  "two_sources",
  "pending_last_wolf",
  "badge_reveal",
  "pending_at_end",
  "caster_death",
  "healed_target_fallback_then_exile",
  "self_poison_expiry",
  "toxin_immunity",
  "toxin_immunity_backlash",
  "dead_noble_expiry",
  "day_target_death_reopens",
  "first_night_death_pending_end",
  "clear_preserves_poison",
] as const)
  for (const kind of ["llm", "acp", "mixed"] as const)
    test(`actual Noble SDK ACP MCP complete ${name}/${kind}`, async () => {
      const scenario = nobleTransportScenario(name);
      for (const locale of ["en", "zh-CN"] as const) {
        const run = await runTransportGame(scenario, kind, locale);
        assertNobleTransportWire(run);
        assertNobleBadgeRules(run, locale);
        assertNobleTransportGolden(run.record, scenario);
        assertNobleKnownAnchors(run, scenario);
        if (kind === "llm" && process.env.AWA_NOBLE_FIXTURES) {
          const directory = process.env.AWA_NOBLE_FIXTURES,
            fixture = `noble-${name}-${locale}`;
          await mkdir(path.join(directory, "player-views"), { recursive: true });
          await writeFile(
            path.join(directory, `${fixture}.replay.json`),
            JSON.stringify(run.replay, null, 2) + "\n",
          );
          await writeFile(
            path.join(directory, `${fixture}.checkpoint.txt`),
            JSON.stringify(run.record.checkpoints.at(-1), null, 2) + "\n",
          );
          for (const [label, old] of [
            ["noble", 1],
            ["body", 5],
            ["demon", 4],
            ["pack", 10],
            ["villager", 9],
          ] as const)
            await writeFile(
              path.join(directory, "player-views", `${fixture}-${label}.player.json`),
              JSON.stringify(
                run.views.find((v) => v.player_id === scenario.mapping.get(old)),
                null,
                2,
              ) + "\n",
            );
        }
        expect(run.result.snapshot.result?.winner).toBe(scenario.winner);
        expect(run.manifest.players.filter((p) => p.alive).map((p) => p.player_id)).toEqual(
          scenario.alive,
        );
        expect(
          run.record.events.filter((e) => e.type === "night_resolved").map((e) => e.payload.deaths),
        ).toEqual(scenario.nightDeaths);
        expect(
          run.record.checkpoints
            .slice(1)
            .map((c) => c.players.filter((p) => p.alive).map((p) => p.id)),
        ).toEqual(scenario.cycleAlive);
        expect(run.rejected.size).toBe(0);
        if (name === "pending_at_end") {
          expect(run.record.checkpoints.at(-1)!.nobleBody!.noble.contracts).toEqual([
            {
              id: "servant:night:2",
              targetId: scenario.mapping.get(7)!,
              createdNight: 2,
              expiresNight: 3,
              status: { kind: "pending" },
            },
          ]);
          expect(run.record.events.some((e) => e.type === "noble_contract_closed")).toBe(false);
          expect(run.record.decisions.some((d) => d.day > 2)).toBe(false);
        }
        for (const v of run.views)
          for (const row of v.timeline)
            if (row.kind === "event") {
              expect(
                row.event.type.startsWith("noble_body_") ||
                  ["noble_contract_closed", "secret_body_blocked"].includes(row.event.type),
              ).toBe(false);
              if (["noble_servant_chosen", "noble_night_notified"].includes(row.event.type))
                expect(v.player_id).toBe(scenario.mapping.get(1)!);
              if (["secret_body_chosen", "secret_body_night_notified"].includes(row.event.type))
                expect(v.player_id).toBe(scenario.mapping.get(5)!);
            }
      }
    }, 120000);
