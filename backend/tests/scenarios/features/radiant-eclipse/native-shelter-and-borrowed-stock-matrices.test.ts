/**
 * 辉光／夜仆场景验证真实庇护、借用和原生夜间矩阵。输入为公开板子、字面保护／死亡／库存选择及原库存变更；手写请求、死因及不写回结果是预期。公开样本字节和 URL 不变，不调用模型。
 */
import { expect, test } from "bun:test";
import { DeathCause, COMPONENT, type AliveComponent } from "../../../../src/domain";
import { radiantFixture } from "../../../support/features/radiant-eclipse/builders/runtime-game";
import {
  radiantProvider,
  type RadiantChoices,
} from "../../../support/features/radiant-eclipse/drivers/actions";
import {
  knownWolfTeammates,
  wolfChatParticipants,
} from "../../../../src/game/mechanisms/roles/wolf_team";
import { getDefaultRoleCatalog } from "../../../../src/game/mechanisms/roles/role-catalog-assembly";
import { getDefaultNightStageRegistry } from "../../../../src/rulesets/night-stage-plan";
import { findNightAbility, abilityStatus } from "../../../../src/game/mechanisms/roles/abilities";

const matrix: Array<{
  name: string;
  choices: RadiantChoices;
  lastDream?: [number, number];
  deaths: number[];
  sources?: Record<number, DeathCause[]>;
}> = [
  { name: "shelter blocks ordinary knife", choices: { shelter: 6, knife: 6 }, deaths: [] },
  {
    name: "shelter blocks poison",
    choices: { shelter: 6, potion: { target_id: 6, potion_type: "poison" } },
    deaths: [],
  },
  {
    name: "shelter blocks consecutive dream",
    lastDream: [6, 1],
    choices: { shelter: 6, dream: 6 },
    deaths: [],
  },
  {
    name: "shelter blocks caster death link",
    choices: { shelter: 6, dream: 6, knife: 5 },
    deaths: [5],
    sources: { 5: [DeathCause.WolfKill] },
  },
  {
    name: "borrowed shelter survives Maids backlash",
    choices: {
      swallow: 2,
      shelter: 10,
      dream: 9,
      potion: { target_id: 10, potion_type: "poison" },
    },
    deaths: [1],
    sources: { 1: [DeathCause.RadiantBacklash] },
  },
  {
    name: "swallowed sheltered Seer gets own check and backlash",
    choices: { swallow: 3, shelter: 3, dream: 9 },
    deaths: [1],
    sources: { 1: [DeathCause.RadiantBacklash] },
  },
  {
    name: "dream blocks separate backlash",
    choices: { swallow: 2, shelter: 6, dream: 1 },
    deaths: [],
  },
  {
    name: "dead dream caster still links after backlash filtered",
    choices: { swallow: 2, shelter: 6, dream: 1, knife: 5 },
    deaths: [5, 1],
    sources: { 5: [DeathCause.WolfKill], 1: [DeathCause.Dream] },
  },
  {
    name: "consecutive dream remains separate from blocked backlash",
    lastDream: [1, 1],
    choices: { swallow: 2, shelter: 6, dream: 1 },
    deaths: [1],
    sources: { 1: [DeathCause.Dream] },
  },
  {
    name: "sheltered dream caster has no false linked death",
    choices: { shelter: 5, dream: 6, knife: 5 },
    deaths: [],
  },
  {
    name: "borrowed dream is owned by Maid not original Dreamer",
    choices: { swallow: 5, dream: 6, knife: 5 },
    deaths: [5],
    sources: { 5: [DeathCause.WolfKill] },
  },
  {
    name: "borrowed caster death links despite closed authorization",
    choices: { swallow: 5, dream: 6, potion: { target_id: 1, potion_type: "poison" } },
    deaths: [1, 6],
    sources: { 1: [DeathCause.Poison], 6: [DeathCause.Dream] },
  },
  {
    name: "borrowed shelter and native dream jointly cover card17",
    choices: {
      swallow: 2,
      shelter: 5,
      dream: 1,
      knife: 5,
      potion: { target_id: 1, potion_type: "poison" },
    },
    deaths: [],
  },
];

test("exact public board runs first night without Count or Maid new requests", async () => {
  const f = await radiantFixture(),
    c = getDefaultRoleCatalog();
  expect(knownWolfTeammates(f.world, 1, c)).toEqual([10, 11, 12]);
  expect(knownWolfTeammates(f.world, 10, c)).not.toContain(1);
  expect(wolfChatParticipants(f.world, c)).toEqual([10, 11, 12]);
  const stages = getDefaultNightStageRegistry()
    .getStages(f.board.config, f.world)
    .map((s) => [s.id, s.priority]);
  expect(
    stages.filter(([s]) =>
      ["reset_night_role_state", "eclipse_swallow", "radiant_shelter", "dreamer_action"].includes(
        String(s),
      ),
    ),
  ).toEqual([
    ["reset_night_role_state", 100],
    ["eclipse_swallow", 110],
    ["radiant_shelter", 120],
    ["dreamer_action", 150],
  ]);
  const result = await f.pipeline.execute(f.board.config, radiantProvider(f.requests), 1);
  expect(result.interrupted).toBe(false);
  expect(
    f.requests.some((r) => ["eclipse_swallow", "radiant_shelter"].includes(r.context.stage)),
  ).toBe(false);
  expect(f.events.filter((e) => e.type === "eclipse_lease_closed").at(-1)?.payload).toMatchObject({
    day: 1,
    status: "committed",
    abilityId: null,
  });
});

for (const row of matrix)
  test(`literal night matrix: ${row.name}`, async () => {
    const f = await radiantFixture();
    const dream = findNightAbility(f.role(5), "dream")!;
    if (row.lastDream) {
      (dream.state as { lastTarget: number | null }).lastTarget = row.lastDream[0];
      (dream.state as { lastDay: number | null }).lastDay = row.lastDream[1];
      (
        dream.state.history as {
          day: number;
          targetId: import("@ai-werewolf-arena/game-contract").EntityId;
        }[]
      ).push({ day: row.lastDream[1], targetId: row.lastDream[0] });
    }
    const result = await f.pipeline.execute(
      f.board.config,
      radiantProvider(f.requests, row.choices),
      2,
    );
    if (result.interrupted) throw Error("unexpected_interrupt");
    expect([...result.damage.deaths].sort((a, b) => a - b)).toEqual(
      [...row.deaths].sort((a, b) => a - b),
    );
    if (row.sources) expect(result.damage.deathSources).toEqual(row.sources);
    expect(f.native(2).nightSuppression).toBeUndefined();
    expect(f.native(3).nightSuppression).toBeUndefined();
    expect(f.native(4).nightSuppression).toBeUndefined();
    expect(f.native(5).nightSuppression).toBeUndefined();
    if (f.borrowed()) expect(abilityStatus(f.borrowed()!, 2)).toBe("disabled");
    expect(f.events.filter((e) => e.type === "eclipse_lease_closed").at(-1)?.payload).toMatchObject(
      { status: "committed" },
    );
  });

for (const [heal, poison] of [
  [1, 1],
  [1, 0],
  [0, 1],
  [0, 0],
] as const)
  test(`borrowed stock (${heal},${poison}) never refreshes or writes back`, async () => {
    const f = await radiantFixture(),
      a = findNightAbility(f.role(4), "potion")!;
    (a.state as { heal: number }).heal = heal;
    (a.state as { poison: number }).poison = poison;
    const choice = poison
      ? { target_id: 6, potion_type: "poison" as const }
      : heal
        ? { target_id: 7, potion_type: "heal" as const }
        : undefined;
    const result = await f.pipeline.execute(
      f.board.config,
      radiantProvider(f.requests, { swallow: 4, knife: 7, potion: choice }),
      2,
    );
    expect(result.interrupted).toBe(false);
    expect([a.state.heal, a.state.poison]).toEqual([heal, poison]);
    expect(f.requests.filter((r) => r.context.stage === "witch").map((r) => r.actorId)).toEqual(
      heal || poison ? [1] : [],
    );
    const b = findNightAbility(f.role(1), "potion")!;
    expect([b.state.heal, b.state.poison]).toEqual(
      poison ? [heal, poison - 1] : heal ? [heal - 1, poison] : [0, 0],
    );
  });

test("night-start last wolf gets one knife together with borrowed skill and never chats", async () => {
  const f = await radiantFixture();
  for (const id of [10, 11, 12])
    f.world.getComponent(id, COMPONENT.Alive)!.alive = false;
  const result = await f.pipeline.execute(
    f.board.config,
    radiantProvider(f.requests, { swallow: 3, knife: 6 }, (r) =>
      r.context.stage === "seer" ? { name: "check_identity", args: { target_id: 1 } } : undefined,
    ),
    2,
  );
  if (result.interrupted) throw Error("interrupt");
  expect(result.damage.deaths).toEqual([6]);
  expect(f.requests.filter((r) => r.context.stage === "wolf_vote").map((r) => r.actorId)).toEqual([
    1,
  ]);
  expect(f.requests.some((r) => r.actorId === 1 && r.context.stage === "wolf_discussion")).toBe(
    false,
  );
  expect(f.requests.filter((r) => r.context.stage === "seer").map((r) => r.actorId)).toEqual([1]);
});
