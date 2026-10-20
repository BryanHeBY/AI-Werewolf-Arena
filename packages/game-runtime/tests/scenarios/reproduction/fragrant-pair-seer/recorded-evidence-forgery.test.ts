/**
 * 复现场景验证真实寻香配对板录制拒绝伪造来源、请求、知识及死亡波证据。
 * 输入为原三个 beforeAll 录制、记录副本及字面重复／共同删除／退款篡改。
 * 输出与预期为明确原记录接收、精确拒绝及已付前缀断言，保留真实因果来源；生成录制不成为独立预期状态。
 */
import { beforeAll, expect, test } from "bun:test";
import {
  parseReproductionRecord,
  type ReproductionRecord,
} from "../../../../src/recording/reproduction/format";
import { recordFragrantLiteral } from "../../../support/features/fragrant-pair-seer/drivers/recording";
const records: Record<string, ReproductionRecord> = {};
beforeAll(async () => {
  for (const [alias, name] of [
    ["inherited", "inherited_gun"],
    ["first", "first_link"],
    ["expiry", "expiry"],
  ])
    records[alias!] = (await recordFragrantLiteral(name!)).record;
});
const load = (name = "inherited"): any => structuredClone(records[name]!);
const fseq = (r: any) => r.decisions[0].request.context.visible_events;
const append = (feed: any[], e: any) =>
  feed.push({ seq: feed.length + 1, type: e.type, payload: structuredClone(e.payload) });
for (const name of ["inherited", "first", "expiry"])
  test(`unchanged actual record ${name} accepted`, () =>
    expect(() => parseReproductionRecord(load(name))).not.toThrow());
const attacks: Record<string, (r: any) => void> = {
  "God wave added to initial Phantom feed": (r) =>
    append(
      fseq(r),
      r.events.find((e: any) => e.type === "fragrant_wave_committed"),
    ),
  "God real opening added to initial Phantom feed": (r) =>
    append(
      fseq(r),
      r.events.find((e: any) => e.type === "fragrant_night_opened"),
    ),
  "future own N3 binding added to N1 feed": (r) =>
    append(
      fseq(r),
      r.events.find((e: any) => e.type === "fragrant_pair_chosen" && e.payload.day === 3),
    ),
  "foreign AS aggregate private result added to Phantom feed": (r) =>
    append(
      fseq(r),
      r.events.find((e: any) => e.type === "fragrant_pair_inspected"),
    ),
  "initial owner notice removed and visible seq repaired": (r) => {
    r.decisions[0].request.context.visible_events = fseq(r)
      .filter((e: any) => e.type !== "fragrant_night_notified")
      .map((e: any, i: number) => ({ ...e, seq: i + 1 }));
  },
  "visible sequence repeated": (r) => {
    fseq(r)[1].seq = 1;
  },
  "visible sequence reordered": (r) => {
    r.decisions[0].request.context.visible_events = fseq(r)
      .toReversed()
      .map((e: any, i: number) => ({ ...e, seq: i + 1 }));
  },
  "pair request lies about phase despite original night opening": (r) => {
    r.decisions.find((d: any) => d.stage === "pair_inspection").request.phase = "day";
  },
  "CP native pair ability permanently disabled": (r) => {
    r.checkpoints.at(-1).players.find((p: any) => p.id === 9).privateState.abilities[
      "native:pair_check"
    ].disabled = true;
  },
  "CP native pair ability maxUses changed": (r) => {
    r.checkpoints.at(-1).players.find((p: any) => p.id === 9).privateState.abilities[
      "native:pair_check"
    ].maxUses = 0;
  },
};
for (const [name, mutate] of Object.entries(attacks))
  test(`reject ${name}`, () => {
    const r = load();
    mutate(r);
    expect(() => {
      parseReproductionRecord(r);
    }).toThrow();
  });
for (const outcome of ["error", "pending"])
  test(`reject duplicate ${outcome} pair request after own pair result`, () => {
    const r = load(),
      first = r.decisions.find((d: any) => d.stage === "pair_inspection"),
      eventIndex = r.events.findIndex((e: any) => e.type === "fragrant_pair_inspected");
    const fake = structuredClone(first);
    fake.turn = 2;
    fake.openedAtEventCount = eventIndex + 1;
    fake.openedAfterSettlement = first.settleOrder;
    fake.settleOrder = first.settleOrder + 1;
    append(fake.request.context.visible_events, r.events[eventIndex]);
    fake.outcome =
      outcome === "error"
        ? { kind: "error", code: "decision_failed", name: "Error" }
        : { kind: "pending" };
    if (outcome === "pending") delete fake.settleOrder;
    for (const d of r.decisions) {
      if (d.settleOrder > first.settleOrder) d.settleOrder++;
      if (d.openedAfterSettlement >= first.settleOrder) d.openedAfterSettlement++;
    }
    r.decisions.splice(r.decisions.indexOf(first) + 1, 0, fake);
    for (const cp of r.checkpoints)
      if (cp.eventCount >= fake.openedAtEventCount) {
        cp.decisionCount++;
        cp.settlementCount++;
      }
    expect(() => {
      parseReproductionRecord(r);
    }).toThrow();
  });
test("reject full-night pair decision+event+operations+checkpoint co-delete", () => {
  const r = load(),
    d = r.decisions.find((d: any) => d.stage === "pair_inspection"),
    at = r.events.findIndex((e: any) => e.type === "fragrant_pair_inspected"),
    order = d.settleOrder;
  const opIndexes = r.operations.flatMap((o: any, i: number) =>
    o.op === "fragrant_pair_inspected" || o.input?.tool === "check_pair" ? [i] : [],
  );
  r.operations = r.operations.filter((_: any, i: number) => !opIndexes.includes(i));
  r.events.splice(at, 1);
  r.decisions = r.decisions.filter((x: any) => x !== d);
  for (const q of r.decisions) {
    if (q.openedAtEventCount > at) q.openedAtEventCount--;
    if (q.openedAfterSettlement >= order) q.openedAfterSettlement--;
    if (q.settleOrder > order) q.settleOrder--;
    q.request.context.visible_events = q.request.context.visible_events
      .filter((e: any) => e.type !== "fragrant_pair_inspected")
      .map((e: any, i: number) => ({ ...e, seq: i + 1 }));
  }
  for (const o of r.operations) if (o.event_count > at) o.event_count--;
  for (const cp of r.checkpoints) {
    cp.operationCount -= opIndexes.filter((i: number) => i < cp.operationCount).length;
    if (cp.eventCount > at) {
      cp.eventCount--;
      cp.decisionCount--;
      cp.settlementCount--;
      cp.fragrantPair.pairSeer.history = [];
      cp.fragrantPair.nights[0].pairCommitted = false;
      const s = cp.players.find((p: any) => p.id === 9);
      s.privateState.pairSeer.history = [];
      const a = s.privateState.abilities["native:pair_check"];
      a.state.history = [];
      a.uses = 0;
      a.lastUsedDay = null;
    }
  }
  expect(() => {
    parseReproductionRecord(r);
  }).toThrow();
});

const fresh = () => load();
test("pair request cannot claim Voting phase while paid Night result survives", () => {
  const r = fresh();
  r.decisions.find((d: any) => d.stage === "pair_inspection").request.phase = "voting";
  expect(() => {
    parseReproductionRecord(r);
  }).toThrow();
});
test("pair request cannot open before prior Witch and bind decisions", () => {
  const r = fresh();
  const q = r.decisions.find((d: any) => d.stage === "pair_inspection");
  q.openedAtEventCount = 4;
  q.openedAfterSettlement = 0;
  expect(() => {
    parseReproductionRecord(r);
  }).toThrow();
});
test("gun wave cannot claim Voting origin when actually executed in Day", () => {
  const r = fresh();
  for (const e of r.events) {
    if (
      e.type === "fragrant_wave_committed" &&
      e.payload.day === 3 &&
      e.payload.initialWave === false
    ) {
      e.payload.deathPhases = { "1": "voting", "12": "voting" };
    }
    if (e.type === "fragrant_link_triggered") e.payload.rootPhase = "voting";
  }
  for (const o of r.operations) {
    if (o.op === "fragrant_wave_committed" && o.output?.day === 3 && o.output.initialWave === false)
      o.output.deathPhases = { "1": "voting", "12": "voting" };
    if (o.op === "fragrant_link_triggered") o.output.rootPhase = "voting";
  }
  expect(() => {
    parseReproductionRecord(r);
  }).toThrow();
});
test("known winner cannot grant faction outcome to an eliminated Wolf", () => {
  const r = fresh();
  const fake = {
    kind: "victory",
    primary: { kind: "faction", faction: "good", winningPlayerIds: [2] },
    additional: [],
    winningPlayerIds: [2],
  };
  r.events.find((e: any) => e.type === "game_over").payload.outcome = fake;
  for (const cp of r.checkpoints)
    if (cp.snapshot.result) cp.snapshot.result.outcome = structuredClone(fake);
  expect(() => {
    parseReproductionRecord(r);
  }).toThrow();
});
test("resolved mandatory wolf chat decision cannot be deleted while keeping its facts", () => {
  const r = fresh();
  const lost = r.decisions.find((d: any) => d.stage === "wolf_discussion" && d.day === 1);
  r.decisions = r.decisions.filter((d: any) => d !== lost);
  for (const d of r.decisions) {
    if (d.settleOrder > lost.settleOrder) d.settleOrder--;
    if (d.openedAfterSettlement >= lost.settleOrder) d.openedAfterSettlement--;
  }
  for (const cp of r.checkpoints) {
    if (cp.cycle >= 1) {
      cp.decisionCount--;
      cp.settlementCount--;
    }
  }
  expect(() => {
    parseReproductionRecord(r);
  }).toThrow();
});
test("Witch checkpoint cannot refund poison after real N1 poison", () => {
  const r = fresh();
  for (const cp of r.checkpoints) {
    if (cp.cycle > 0) {
      const a = cp.players.find((p: any) => p.id === 10).privateState.abilities["native:potion"];
      a.state.poison = 1;
      a.state.poisonUsedThisNight = false;
      a.uses = 0;
    }
  }
  expect(() => {
    parseReproductionRecord(r);
  }).toThrow();
});
test("Hunter checkpoint cannot refund gun after actual terminal shot", () => {
  const r = fresh();
  r.checkpoints.at(-1).players.find((p: any) => p.id === 11).privateState.hunter.canShoot = true;
  expect(() => {
    parseReproductionRecord(r);
  }).toThrow();
});

const mutations: Record<string, (r: any) => void> = {
  "final checkpoint cannot be omitted": (r) => {
    r.checkpoints.pop();
  },
  "terminal checkpoint cycle must equal real completed cycle": (r) => {
    r.checkpoints.at(-1).cycle++;
  },
  "settlement orders cannot all be the same future ordinal": (r) => {
    for (const d of r.decisions) d.settleOrder = 5000;
  },
  "failed checkpoint cannot undercount completed operations": (r) => {
    const c = r.checkpoints.at(-1);
    c.complete = false;
    c.failure = { name: "Error", code: "cycle_failed" };
    c.operationCount = 0;
  },
  "failed checkpoint cannot undercount settled decisions": (r) => {
    const c = r.checkpoints.at(-1);
    c.complete = false;
    c.failure = { name: "Error", code: "cycle_failed" };
    c.settlementCount = 0;
  },
  "required committed operation cannot claim error phase or scope": (r) => {
    const o = r.operations.find((o: any) => o.op === "fragrant_pair_chosen");
    o.status = "error";
    o.phase = "game_over";
    o.scope = "foreign";
  },
  "night-open operation cannot substitute a different private notice": (r) => {
    r.operations[0].output.notice.known.knownWolfId = 2;
  },
  "orphan domain operation cannot append a fictitious successful binding": (r) => {
    const o = structuredClone(r.operations.find((o: any) => o.op === "fragrant_pair_chosen"));
    o.event_count = r.events.length;
    o.output.pairIds = [3, 4];
    r.operations.push(o);
    r.checkpoints.at(-1).operationCount++;
  },
};
for (const [name, mutate] of Object.entries(mutations))
  test(name, () => {
    const r = fresh();
    mutate(r);
    expect(() => {
      parseReproductionRecord(r);
    }).toThrow();
  });
