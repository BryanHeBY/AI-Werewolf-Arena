/**
 * 负责狼王夜间／放逐死亡及原目标／交换目标的双语 SDK、ACP 与混合对局场景。
 * 输入为脚本魔术师计划及复制的复现变体；输出由字面枪链顺序、死因、身份、可见性和终局断言核对。
 * 传输驱动拥有子进程和记录清理；可选显式归档导出保留原范围，默认不调用计费模型或重生 golden。
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "bun:test";
import { Phase, DeathCause, createRandom, type ActionRequest } from "../../../../src/domain";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import { captureCheckpoint } from "../../../../src/app/simulation/reproduction-context";
import { ReproductionTrace } from "../../../../src/recording/reproduction/trace";
import { magicianScenario } from "../../../support/features/magician/builders/transport-plan";
import { runTransportGame } from "../../../support/drivers/transport/run-game";
import { validateMagicianRecord } from "../../../../src/recording/verification/magician/validate";
import type { RecordedDecision, ReproductionRecord } from "../../../../src/recording/reproduction/format";

const records = new Map<string, ReproductionRecord>();
for (const mapping of ["original", "exchanged"] as const)
  for (const death of ["night", "exile"] as const)
    for (const transport of ["llm", "acp", "mixed"] as const)
      test(`Wolf King day eligibility, independent mapping and actual gun chain/${mapping}/${death}/${transport}`, async () => {
        const scenario = magicianScenario(mapping, { dayOnly: true, kingDeath: death });
        const runs: Awaited<ReturnType<typeof runTransportGame>>[] = [];
        for (const locale of ["zh-CN", "en"] as const) {
          const run = await runTransportGame(scenario, transport, locale);
          runs.push(run);
          if (transport === "llm") records.set(mapping + ":" + death + ":" + locale, run.record);
          expect(run.result.snapshot.result?.winner).toBe(scenario.winner);
          expect(run.manifest.players.filter((p) => p.alive).map((p) => p.player_id)).toEqual(
            scenario.alive,
          );
          const guns = run.record.decisions.filter((d) => d.request.allowedTools.includes("shoot"));
          expect(guns.map((d) => d.actorId)).toEqual(
            death === "night" ? [] : [scenario.king, scenario.hunter],
          );
          if (death === "exile") {
            expect(guns.map((d) => d.request.context.death_phase)).toEqual([
              Phase.Voting,
              Phase.Voting,
            ]);
            expect(guns.map((d) => d.request.context.death_sources)).toEqual([
              [DeathCause.Exile],
              [DeathCause.Shot],
            ]);
            expect(
              run.replay.events.find((e) => e.type === "wolf_king_shot")?.payload.targetId,
            ).toBe(scenario.hunter);
          }
          expect(run.replay.events.some((e) => e.type === "death_shot_missed")).toBe(false);
          expect(run.rejected.size).toBe(0);
          expect(run.acpTraces.every((row) => row.trace.rejected === 0)).toBe(true);
          expect(run.replay.events.filter((e) => e.type === "game_over")).toHaveLength(1);
          if (transport === "llm" && process.env.AWA_DAY_KING_FIXTURES) {
            const directory = process.env.AWA_DAY_KING_FIXTURES;
            await mkdir(directory, { recursive: true });
            const base = join(directory, `day-king-${mapping}-${death}-${locale}`);
            await writeFile(base + ".replay.json", JSON.stringify(run.replay, null, 2) + "\n");
            await writeFile(
              base + ".checkpoint.txt",
              JSON.stringify(run.record.checkpoints.at(-1), null, 2) + "\n",
            );
          }
        }
        expect(runs[0]!.result).toEqual(runs[1]!.result);
        expect(runs[0]!.record.checkpoints).toEqual(runs[1]!.record.checkpoints);
      }, 120000);

async function record(death: "night" | "exile") {
  const key = "exchanged:" + death + ":en";
  if (!records.has(key))
    records.set(
      key,
      (
        await runTransportGame(
          magicianScenario("exchanged", { dayOnly: true, kingDeath: death }),
          "llm",
          "en",
        )
      ).record,
    );
  return structuredClone(records.get(key)!);
}
for (const outcome of ["shot", "pass", "error", "pending"] as const)
  test(`independent Tape rejects an invented forbidden night gun even without an emitted shot/${outcome}`, async () => {
    const r = await record("night"),
      king = r.metadata.players.find((p) => p.role === "wolf_king")!.id;
    const fake = structuredClone(
      r.decisions.find((d) => d.actorId === king && d.stage === "last_words")!,
    );
    fake.stage = "death_shot";
    fake.request.allowedTools = ["shoot"];
    fake.request.context.stage = "death_shot";
    fake.request.context.death_phase = Phase.Night;
    fake.request.context.death_sources = [DeathCause.WolfKill];
    fake.outcome =
      outcome === "error"
        ? { kind: "error", code: "decision_failed", name: "Error" }
        : outcome === "pending"
          ? { kind: "pending" }
          : {
              kind: "action",
              action: {
                name: "shoot",
                args: {
                  target_id:
                    outcome === "pass"
                      ? null
                      : r.metadata.players.find((p) => p.role === "hunter")!.id,
                },
              },
            };
    r.decisions.push(fake);
    expect(() => validateMagicianRecord(r)).toThrow("reproduction_magician_state_invalid");
  }, 120000);

const mutations: Array<[string, (r: ReproductionRecord, d: RecordedDecision) => void]> = [
  [
    "origin omitted",
    (_r, d) => {
      delete d.request.context.death_origin_phase;
    },
  ],
  [
    "origin forged",
    (_r, d) => {
      d.request.context.death_origin_phase = Phase.Night;
    },
  ],
  [
    "before exile ballot",
    (r, d) => {
      d.openedAfterSettlement = Math.max(
        ...r.decisions
          .filter((row) => row.day === 1 && (row.stage === "seer" || row.stage === "witch"))
          .map((row) => row.settleOrder!),
      );
    },
  ],
  [
    "before parent gun",
    (r, d) => {
      r.decisions.find((row) => row.stage === "hunter_shot")!.openedAfterSettlement =
        d.openedAfterSettlement;
    },
  ],
  [
    "request phase game_over",
    (_r, d) => {
      d.request.phase = Phase.GameOver;
    },
  ],
  [
    "request phase night",
    (_r, d) => {
      d.request.phase = Phase.Night;
    },
  ],
  [
    "gift ability",
    (_r, d) => {
      d.request.context.ability_id = "gift-gun:invented";
    },
  ],
  [
    "origin",
    (_r, d) => {
      d.request.context.death_phase = Phase.Night;
    },
  ],
  [
    "source",
    (_r, d) => {
      d.request.context.death_sources = [DeathCause.WolfKill];
    },
  ],
  [
    "request identity",
    (_r, d) => {
      d.request.actorId = 999;
    },
  ],
  [
    "policy omitted",
    (r) => {
      for (const cp of r.checkpoints) {
        const p = cp.players.find((p) => p.role === "wolf_king")!;
        delete (p.privateState.wolf_king as Record<string, unknown>).deathActionPolicy;
      }
    },
  ],
  [
    "policy changed",
    (r) => {
      r.metadata.normalizedBoard.wolfKing!.deathActionPolicy = "awa_qualified_sources_v1";
    },
  ],
];
for (const [name, mutate] of mutations)
  test(`independent day gun Tape rejects ${name}`, async () => {
    const r = await record("exile"),
      d = r.decisions.find((d) => d.stage === "death_shot")!;
    mutate(r, d);
    expect(() => validateMagicianRecord(r)).toThrow("reproduction_magician_state_invalid");
  }, 120000);

for (const transport of ["llm", "acp"] as const)
  for (const locale of ["zh-CN", "en"] as const)
    test(`explicit daytime empty gun spends once and strict Tape rejects repeating it/${transport}/${locale}`, async () => {
      const scenario = magicianScenario("exchanged", {
        dayOnly: true,
        kingDeath: "exile",
        pass: true,
      });
      const run = await runTransportGame(scenario, transport, locale);
      expect(run.result.snapshot.result?.winner).toBe(scenario.winner);
      expect(run.manifest.players.filter((p) => p.alive).map((p) => p.player_id)).toEqual(
        scenario.alive,
      );
      const guns = run.record.decisions.filter((d) => d.request.allowedTools.includes("shoot"));
      expect(guns).toHaveLength(1);
      expect(guns[0]!.outcome).toEqual({
        kind: "action",
        action: { name: "shoot", args: { target_id: null } },
      });
      expect(
        run.record.checkpoints.at(-1)!.players.find((p) => p.id === scenario.king)!.privateState
          .wolf_king,
      ).toEqual({ canShoot: false, deathActionPolicy: "awa_day_deaths_v1" });
      expect(
        run.replay.events.some((e) => e.type === "wolf_king_shot" || e.type === "hunter_shot"),
      ).toBe(false);
      const altered = structuredClone(run.record);
      altered.decisions.push(structuredClone(guns[0]!));
      expect(() => validateMagicianRecord(altered)).toThrow("reproduction_magician_state_invalid");
    }, 120000);

/**
 * 捕获真实 pending／失败轨迹快照，不保留未来决定。
 */
async function gunPrefix(
  mode:
    | "day"
    | "day-child"
    | "night"
    | "default-night"
    | "default-night-child"
    | "weighted"
    | "badge-null"
    | "vote-retry"
    | "blast",
) {
  const scenario = magicianScenario(
    mode === "default-night-child" ? "original" : "exchanged",
    ["day", "day-child", "weighted", "badge-null", "vote-retry"].includes(mode)
      ? { dayOnly: true, kingDeath: "exile" }
      : mode === "night"
        ? { dayOnly: true, kingDeath: "night" }
        : {},
  );
  const metadata = structuredClone(
    (
      await record(
        ["day", "day-child", "weighted", "badge-null", "vote-retry"].includes(mode)
          ? "exile"
          : "night",
      )
    ).metadata,
  );
  metadata.normalizedBoard = scenario.board.config;
  const game = bootstrapGame(scenario.board.config, {
    locale: "en",
    random: createRandom(scenario.seed),
    playerNames: Object.fromEntries(metadata.players.map((p) => [p.id, p.name])),
  });
  const trace = new ReproductionTrace(metadata, () => {});
  const checkpoint = (cycle: number, complete: boolean) =>
    trace.checkpoint(
      captureCheckpoint(
        game.world,
        game.phaseManager.getSnapshot(),
        cycle,
        complete,
        game.phaseManager.getEvents().length,
        new Error("fixture_gun_prefix"),
      ),
      game.phaseManager.getEvents(),
    );
  checkpoint(0, true);
  const turns = new Map([...scenario.turns].map(([id, rows]) => [id, [...rows]]));
  let incremental: ReproductionRecord | undefined;
  const boundary = mode === "night" || mode === "blast" ? "last_words" : "death_shot";
  const knifeVictim = scenario.roles.findIndex((role) => role === "villager") + 1;
  const poisonVictim = scenario.roles.findIndex((role) => role === "wolf") + 1;
  const alive = scenario.roles
    .map((_, i) => i + 1)
    .filter((id) => id !== knifeVictim && id !== poisonVictim);
  const alternative = alive.find((id) => scenario.roles[id - 1] === "villager")!;
  const voters = alive.filter((id) => id !== scenario.king && id !== alternative);
  const supporters = [scenario.hunter, ...voters.filter((id) => id !== scenario.hunter)].slice(
    0,
    4,
  );
  let invalidVotes = 0;
  const provider = {
    async getAction(request: ActionRequest) {
      const stage = request.context.stage;
      if (mode === "default-night-child") {
        if (stage === "last_words" && request.actorId === scenario.hunter)
          return { name: "speak" as const, args: { text: "Words" } };
        if (stage === "hunter_shot")
          return { name: "shoot" as const, args: { target_id: scenario.king } };
        if (stage === "death_shot" && request.actorId === scenario.king) {
          incremental = structuredClone(trace.build());
          throw new Error("fixture_gun_prefix");
        }
      }
      if (["weighted", "badge-null"].includes(mode)) {
        if (stage === "sheriff_campaign_speech")
          return { name: "speak" as const, args: { text: "Campaign" } };
        if (stage === "sheriff_withdraw")
          return mode === "weighted"
            ? null
            : { name: "run_for_sheriff" as const, args: { run: true } };
        if (stage === "sheriff_choose_direction")
          return { name: "choose_direction" as const, args: { direction: "clockwise" as const } };
        if (stage === "sheriff_badge_choice") return null;
      }
      if (mode === "vote-retry" && request.actorId === scenario.king && stage === "voting") {
        if (invalidVotes++ === 0) expect(turns.get(request.actorId)?.shift()?.stage).toBe("voting");
        return { name: "vote" as const, args: { target_id: 999, abstain: false } };
      }
      if (mode === "blast" && stage === "last_words")
        while (turns.get(request.actorId)?.[0]?.stage === "sheriff_nomination")
          turns.get(request.actorId)!.shift();
      const turn = turns.get(request.actorId)?.shift();
      expect(turn?.day).toBe(request.context.day);
      expect(turn?.stage).toBe(request.context.stage);
      if (
        request.actorId ===
          (mode === "day-child"
            ? scenario.hunter
            : mode === "blast"
              ? poisonVictim
              : scenario.king) &&
        request.context.stage === (mode === "day-child" ? "hunter_shot" : boundary)
      ) {
        incremental = structuredClone(trace.build());
        throw new Error("fixture_gun_prefix");
      }
      if (mode === "weighted" && stage === "sheriff_nomination")
        return {
          name: "run_for_sheriff" as const,
          args: { run: request.actorId === scenario.hunter },
        };
      if (mode === "badge-null" && stage === "sheriff_nomination")
        return { name: "run_for_sheriff" as const, args: { run: request.actorId === knifeVictim } };
      if (mode === "weighted" && stage === "voting") {
        const abstain = request.actorId === scenario.king || request.actorId === alternative;
        return {
          name: "vote" as const,
          args: {
            target_id: abstain
              ? null
              : supporters.includes(request.actorId)
                ? scenario.king
                : alternative,
            abstain,
          },
        };
      }
      if (mode === "blast" && stage === "on_pre_election" && request.actorId === scenario.king)
        return { name: "self_destruct" as const, args: { reason: "blast", confirm: true } };
      if (mode === "default-night-child" && stage === "wolf_vote")
        return { name: "kill_vote" as const, args: { target_id: scenario.king, abstain: false } };
      return turn!.action;
    },
  };
  await expect(
    game.phaseManager.runSingleCycle({ getAction: (r) => trace.decide(r, provider) }, 8),
  ).rejects.toThrow("fixture_gun_prefix");
  checkpoint(1, false);
  const failed = structuredClone(trace.build());
  expect(incremental).toBeDefined();
  expect(incremental!.checkpoints.at(-1)!.cycle).toBe(0);
  expect(incremental!.decisions.every((d) => d.day === 1)).toBe(true);
  if (mode === "vote-retry") expect(invalidVotes).toBe(4);
  return { incremental: incremental!, failed, king: scenario.king, hunter: scenario.hunter };
}
for (const outcome of ["pending", "error", "pass"] as const)
  test(`known forbidden night death rejects a gun even without its effect/${outcome}`, async () => {
    const { failed: r, king } = await gunPrefix("night");
    expect(() => validateMagicianRecord(r)).not.toThrow();
    const fake = structuredClone(
      r.decisions.find((d) => d.actorId === king && d.stage === "last_words")!,
    );
    fake.stage = fake.request.context.stage = "death_shot";
    fake.request.allowedTools = ["shoot"];
    fake.request.context.death_phase = Phase.Night;
    fake.request.context.death_sources = [DeathCause.WolfKill];
    fake.outcome =
      outcome === "pending"
        ? { kind: "pending" }
        : outcome === "error"
          ? { kind: "error", code: "decision_failed", name: "Error" }
          : { kind: "action", action: { name: "shoot", args: { target_id: null } } };
    r.decisions.push(fake);
    expect(() => validateMagicianRecord(r)).toThrow("reproduction_magician_state_invalid");
    fake.request.context.death_phase = Phase.Day;
    expect(() => validateMagicianRecord(r)).toThrow("reproduction_magician_state_invalid");
  }, 120000);
for (const mode of ["day", "default-night"] as const)
  test(`actual unpublished gun prefix keeps legal requests and rejects false authority/${mode}`, async () => {
    const { incremental: r, king } = await gunPrefix(mode);
    expect(() => validateMagicianRecord(r)).not.toThrow();
    const gun = r.decisions.find((d) => d.actorId === king && d.stage === "death_shot")!;
    expect(gun.outcome.kind).toBe("pending");
    for (const mutate of [
      (d: RecordedDecision) => {
        d.request.phase = Phase.GameOver;
      },
      (d: RecordedDecision) => {
        d.request.context.ability_id = "gift-gun:invented";
      },
      (d: RecordedDecision) => {
        d.openedAfterSettlement = 0;
      },
      (d: RecordedDecision) => {
        d.request.context.visible_events = [];
      },
    ]) {
      const altered = structuredClone(r);
      mutate(altered.decisions.find((d) => d.actorId === king && d.stage === "death_shot")!);
      expect(() => validateMagicianRecord(altered)).toThrow("reproduction_magician_state_invalid");
    }
    if (mode === "day") {
      for (const sources of [[DeathCause.WolfKill], [DeathCause.Shot]]) {
        const altered = structuredClone(r);
        altered.decisions.find(
          (d) => d.actorId === king && d.stage === "death_shot",
        )!.request.context.death_sources = sources;
        expect(() => validateMagicianRecord(altered)).toThrow(
          "reproduction_magician_state_invalid",
        );
      }
      gun.request.context.death_phase = Phase.Night;
      gun.request.context.death_sources = [DeathCause.WolfKill];
      expect(() => validateMagicianRecord(r)).toThrow("reproduction_magician_state_invalid");
    }
  }, 120000);

for (const mode of ["day", "default-night", "day-child"] as const)
  test(`unpublished gun death must follow the actual ballot, knife or parent target/${mode}`, async () => {
    const { incremental: r, king, hunter } = await gunPrefix(mode);
    expect(() => validateMagicianRecord(r)).not.toThrow();
    const pending = r.decisions.find(
      (d) => d.outcome.kind === "pending" && d.request.allowedTools.includes("shoot"),
    )!;
    const alternative = r.metadata.players.find(
      (p) => p.role === "villager" && pending.request.context.shoot_candidates?.includes(p.id),
    )!.id;
    const altered = structuredClone(r);
    if (mode === "day-child") {
      const parent = altered.decisions.find((d) => d.actorId === king && d.stage === "death_shot")!;
      expect(parent.outcome.kind).toBe("action");
      if (parent.outcome.kind === "action" && parent.outcome.action?.name === "shoot")
        parent.outcome.action.args.target_id = alternative;
    } else
      for (const d of altered.decisions.filter(
        (d) => d.stage === (mode === "day" ? "voting" : "wolf_vote"),
      )) {
        expect(d.outcome.kind).toBe("action");
        if (
          d.outcome.kind !== "action" ||
          (d.outcome.action?.name !== "vote" && d.outcome.action?.name !== "kill_vote")
        )
          throw new Error("fixture_vote_action_invalid");
        d.outcome.action!.args.target_id =
          mode === "day" && d.actorId === alternative ? null : alternative;
        d.outcome.action!.args.abstain = mode === "day" && d.actorId === alternative;
      }
    expect(() => validateMagicianRecord(altered)).toThrow("reproduction_magician_state_invalid");
    if (mode === "day") {
      const fake = structuredClone(r),
        request = fake.decisions.find((d) => d.actorId === king && d.stage === "death_shot")!;
      request.actorId = request.request.actorId = hunter;
      request.stage = request.request.context.stage = "hunter_shot";
      for (const e of request.request.context.visible_events)
        if (e.type === "voted_out") e.payload.target = hunter;
      expect(() => validateMagicianRecord(fake)).toThrow("reproduction_magician_state_invalid");
    }
  }, 120000);

for (const mode of ["weighted", "badge-null", "vote-retry"] as const)
  test(`actual soft public replies preserve legal gun prefixes/${mode}`, async () => {
    const { incremental: r, failed, king } = await gunPrefix(mode);
    expect(() => validateMagicianRecord(r)).not.toThrow();
    expect(() => validateMagicianRecord(failed)).not.toThrow();
    expect(
      r.decisions.find((d) => d.actorId === king && d.stage === "death_shot")!.outcome.kind,
    ).toBe("pending");
  }, 120000);
test("a committed pre-election blast cannot be omitted from a mixed night death gun", async () => {
  const { incremental: r, king } = await gunPrefix("blast");
  expect(() => validateMagicianRecord(r)).not.toThrow();
  expect(
    r.decisions.some(
      (d) =>
        d.actorId === king &&
        d.outcome.kind === "action" &&
        d.outcome.action?.name === "self_destruct",
    ),
  ).toBe(true);
  const fake = r.decisions.find((d) => d.outcome.kind === "pending")!;
  fake.actorId = fake.request.actorId = king;
  fake.stage = fake.request.context.stage = "death_shot";
  fake.request.allowedTools = ["shoot"];
  fake.request.context.death_phase = Phase.Night;
  fake.request.context.death_sources = [DeathCause.WolfKill];
  fake.request.context.turn_constraints.required_any_tools = ["shoot"];
  expect(() => validateMagicianRecord(r)).toThrow("reproduction_magician_state_invalid");
}, 120000);

test("default night Hunter to King keeps legacy Day and its anonymous shot DTO readable", async () => {
  const { incremental: r, king } = await gunPrefix("default-night-child");
  const gun = r.decisions.find((d) => d.actorId === king && d.stage === "death_shot")!;
  expect(gun.request.context.death_phase).toBe(Phase.Day);
  expect(gun.request.context.death_origin_phase).toBeUndefined();
  expect(
    gun.request.context.visible_events.some(
      (e) => e.type === "player_shot" && e.payload.targetId === king,
    ),
  ).toBe(true);
  expect(() => validateMagicianRecord(r)).not.toThrow();
  for (const mutate of [
    (d: RecordedDecision) => {
      d.request.context.death_phase = Phase.Night;
    },
    (d: RecordedDecision) => {
      d.request.context.death_origin_phase = Phase.Day;
    },
  ]) {
    const fake = structuredClone(r);
    mutate(fake.decisions.find((d) => d.actorId === king && d.stage === "death_shot")!);
    expect(() => validateMagicianRecord(fake)).toThrow("reproduction_magician_state_invalid");
  }
}, 120000);
