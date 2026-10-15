/**
 * Scenario tests drive complete controlled NightPipeline and PhaseManager cycles across borrowed/native stock. Inputs are original literal bottle/shelter/dream matrices from a public board fixture; handwritten unchanged native histories, expiry and resource outcomes are the oracle. The supporting board file/URL and test-only original stock mutations are retained; no model or generated expected result runs.
 */
import { PotionType } from "../../../../src/domain";
import { expect, test } from "bun:test";
import { Phase } from "../../../../src/domain";
import { findNightAbility } from "../../../../src/features/night-abilities/abilities";
import { radiantFixture } from "../../../support/features/radiant-eclipse/builders/runtime-game";
import { radiantProvider } from "../../../support/features/radiant-eclipse/drivers/actions";

const stockCases = [
  {
    name: "single heal, source keeps stock",
    initial: [1, 0],
    borrow: { target_id: 6, potion_type: PotionType.Heal },
    native: { target_id: 4, potion_type: PotionType.None },
    borrowedAt4: [1, 0],
  },
  {
    name: "single heal, source spent stock",
    initial: [1, 0],
    borrow: { target_id: 6, potion_type: PotionType.Heal },
    native: { target_id: 6, potion_type: PotionType.Heal },
    borrowedAt4: [0, 0],
  },
  {
    name: "double stock, source keeps poison",
    initial: [1, 1],
    borrow: { target_id: 7, potion_type: PotionType.Poison },
    native: { target_id: 4, potion_type: PotionType.None },
    borrowedAt4: [1, 1],
  },
  {
    name: "double stock, source spent poison",
    initial: [1, 1],
    borrow: { target_id: 7, potion_type: PotionType.Poison },
    native: { target_id: 7, potion_type: PotionType.Poison },
    borrowedAt4: [1, 0],
  },
] as const;

for (const row of stockCases)
  test(`literal original stock across N2/N3/N4: ${row.name}`, async () => {
    const f = await radiantFixture(),
      native = findNightAbility(f.role(4), "potion")!;
    (native.state as { heal: number }).heal = row.initial[0];
    (native.state as { poison: number }).poison = row.initial[1];
    await f.pipeline.execute(
      f.board.config,
      radiantProvider(f.requests, { swallow: 4, dream: 9, knife: 6, potion: row.borrow }),
      2,
    );
    expect([native.state.heal, native.state.poison]).toEqual([...row.initial]);
    await f.pipeline.execute(
      f.board.config,
      radiantProvider(f.requests, { swallow: null, dream: 8, knife: 6, potion: row.native }),
      3,
    );
    const seen: number[][] = [];
    await f.pipeline.execute(
      f.board.config,
      radiantProvider(f.requests, { swallow: 4, dream: 9 }, (r) => {
        if (r.context.stage === "witch" && r.actorId === 1) {
          const b = findNightAbility(f.role(1), "potion", r.context.ability_id)!;
          seen.push([b.state.heal, b.state.poison]);
        }
        return undefined;
      }),
      4,
    );
    const b = findNightAbility(f.role(1), "potion", "copy:eclipse:night:4")!;
    expect([b.state.heal, b.state.poison]).toEqual([...row.borrowedAt4]);
    expect([native.state.heal, native.state.poison]).toEqual([...row.borrowedAt4]);
    expect(seen).toEqual(row.borrowedAt4.some(Boolean) ? [[...row.borrowedAt4]] : []);
    expect(
      f.requests
        .filter((r) => r.context.day === 4 && r.context.stage === "witch")
        .map((r) => r.actorId),
    ).toEqual(row.borrowedAt4.some(Boolean) ? [1] : []);
  });

test("card16: N3 borrowed shelter never writes the original Counts last target", async () => {
  const f = await radiantFixture();
  await f.pipeline.execute(
    f.board.config,
    radiantProvider(f.requests, { shelter: 6, dream: 9 }),
    2,
  );
  await f.pipeline.execute(
    f.board.config,
    radiantProvider(f.requests, { swallow: 2, shelter: 7, dream: 8 }),
    3,
  );
  expect(findNightAbility(f.role(2), "shelter")!.state).toMatchObject({
    lastTarget: 6,
    lastDay: 2,
  });
  await f.pipeline.execute(
    f.board.config,
    radiantProvider(f.requests, { swallow: null, shelter: 7, dream: 9 }),
    4,
  );
  expect(findNightAbility(f.role(2), "shelter")!.state).toMatchObject({
    lastTarget: 7,
    lastDay: 4,
  });
  expect(
    f.requests
      .filter((r) => r.context.day === 3 && r.context.stage === "radiant_shelter")
      .map((r) => r.actorId),
  ).toEqual([1]);
});

test("cards8 and15: borrowed dream inherits N1 but does not write N2 back to original history", async () => {
  const f = await radiantFixture();
  await f.pipeline.execute(f.board.config, radiantProvider(f.requests, { dream: 6 }), 1);
  const second = await f.pipeline.execute(
    f.board.config,
    radiantProvider(f.requests, { swallow: 5, shelter: 6, dream: 6 }),
    2,
  );
  if (second.interrupted) throw Error("interrupt");
  expect(second.damage.deaths).toEqual([]);
  const native = findNightAbility(f.role(5), "dream")!;
  expect(native.state).toMatchObject({
    lastTarget: 6,
    lastDay: 1,
    history: [{ day: 1, targetId: 6 }],
  });
  expect(findNightAbility(f.role(1), "dream")!.state).toMatchObject({
    lastTarget: 6,
    lastDay: 2,
    history: [{ day: 2, targetId: 6 }],
  });
  const third = await f.pipeline.execute(
    f.board.config,
    radiantProvider(f.requests, { swallow: 7, dream: 6 }),
    3,
  );
  if (third.interrupted) throw Error("interrupt");
  expect(third.damage.deaths).toEqual([]);
  expect(
    f.events
      .filter((e) => e.type === "dream_applied")
      .map((e) => [e.payload.actorId, e.payload.day, e.payload.consecutive]),
  ).toEqual([
    [5, 1, false],
    [1, 2, true],
    [5, 3, false],
  ]);
  expect(native.state.history).toEqual([
    { day: 1, targetId: 6 },
    { day: 3, targetId: 6 },
  ]);
});

test("three complete actual PM cycles settle borrowed stock and card17 without virtual death", async () => {
  const f = await radiantFixture();
  const provider = radiantProvider(f.requests, {}, (r) => {
    const d = r.context.day;
    if (r.context.stage === "eclipse_swallow")
      return { name: "swallow_skill", args: { target_id: d === 2 ? 4 : 2 } };
    if (r.context.stage === "radiant_shelter")
      return { name: "cast_shelter", args: { target_id: d === 2 ? 7 : 5 } };
    if (r.context.stage === "dreamer")
      return { name: "dream", args: { target_id: d === 1 ? 6 : d === 2 ? 8 : 1 } };
    if (r.context.stage === "wolf_vote")
      return {
        name: "kill_vote",
        args: { target_id: d === 1 ? 10 : d === 2 ? 8 : 5, abstain: false },
      };
    if (r.context.stage === "witch")
      return {
        name: "use_potion",
        args:
          d === 1
            ? { target_id: 10, potion_type: PotionType.Heal }
            : d === 2
              ? { target_id: 7, potion_type: PotionType.Poison }
              : { target_id: 1, potion_type: PotionType.Poison },
      };
    return undefined;
  });
  for (let d = 1; d <= 3; d++) {
    const result = await f.phaseManager.runSingleCycle(provider);
    expect(result.gameOver).toBe(false);
    expect(
      f.phaseManager
        .getEvents()
        .filter((e) => e.type === "night_resolved")
        .at(-1)?.payload,
    ).toEqual({ deaths: [] });
    expect(f.world.getAliveEntityIds()).toHaveLength(12);
    const n = findNightAbility(f.role(4), "potion")!;
    expect([n.state.heal, n.state.poison]).toEqual(d === 3 ? [0, 0] : [0, 1]);
    expect(n.nightSuppression).toBeUndefined();
  }
  expect(
    f.requests.filter(
      (r) =>
        r.context.day === 1 &&
        r.phase === Phase.Night &&
        ["eclipse_swallow", "radiant_shelter"].includes(r.context.stage),
    ),
  ).toHaveLength(0);
  expect(
    f.requests
      .filter((r) => r.context.day === 2 && r.context.stage === "witch")
      .map((r) => r.actorId),
  ).toEqual([1]);
  expect(
    f.requests
      .filter((r) => r.context.day === 3 && r.context.stage === "radiant_shelter")
      .map((r) => r.actorId),
  ).toEqual([1]);
  expect(f.phaseManager.getEvents().some((e) => e.type === "dream_death")).toBe(false);
});
