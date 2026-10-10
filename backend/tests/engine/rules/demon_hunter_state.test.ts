import { expect, test } from "bun:test";
import {
  freshDemonHunterState,
  readDemonHunterState,
  readDemonHuntTool,
} from "../../../src/game/mechanisms/roles/demon_hunter/state";
import { isDemonHunterPreset } from "../../../src/game/mechanisms/roles/demon_hunter/preset";
function board(size: 6 | 12, goal: "slaughter_city" | "slaughter_side") {
  const deck =
    size === 6
      ? { wolf: 2, villager: 1, seer: 1, witch: 1, demon_hunter: 1 }
      : { wolf: 3, villager: 4, seer: 1, witch: 1, hunter: 1, guard: 1, demon_hunter: 1 };
  return {
    boardSize: size,
    enableSheriff: size === 12,
    roleSetups: Object.entries(deck).map(([role, count]) => ({ role, count })),
    winConditions: [goal],
    demonHunter: { policy: "awa_netease_demon_hunter_v1" },
    seer: { targetPolicy: "awa_alive_v1", actionPolicy: "awa_required_when_legal_v1" },
    witch: {
      canSelfHeal: "disabled",
      knifeVisibility: "awa_with_heal_v1",
      potionPolicy: "awa_one_native_v1",
    },
    ...(size === 12
      ? {
          sheriff: {
            electionPolicy: "awa_final_candidates_v1",
            badgePolicy: "awa_next_seat_v1",
            voteWeight: 1.5,
          },
          hunter: { deathActionPolicy: "awa_knife_or_exile_v1" },
          guard: { repeatPolicy: "netease_consecutive_nights_v1" },
        }
      : {}),
    tieBreaker: {
      wolfKillVote: "min_id",
      exileVote: "min_id",
      ...(size === 12 ? { sheriffVote: "min_seat" } : {}),
    },
    voting: { exilePolicy: "awa_direct_v1" },
    disclosure: { deathRevealPolicy: "awa_hidden_v1" },
    lastWords: { policy: "awa_initial_wave_v1" },
    hooks: { onPreElection: true, onPreVote: true, onDaybreak: false, onPerSpeechGap: false },
    selfDestruct: { enabledWindows: ["on_pre_election", "on_pre_vote"] },
  };
}
for (const size of [6, 12] as const)
  for (const goal of ["slaughter_city", "slaughter_side"] as const)
    test(`${size}/${goal}: exact normalized board is accepted with no extra role or inactive configuration`, () => {
      const b = board(size, goal);
      expect(isDemonHunterPreset(b)).toBe(true);
      b.roleSetups.reverse();
      b.selfDestruct.enabledWindows.reverse();
      expect(isDemonHunterPreset(b)).toBe(true);
    });
for (const patch of [
  (b: any) => (b.boardSize = 7),
  (b: any) => (b.roleSetups.find((e: any) => e.role === "wolf").count = 1),
  (b: any) => b.roleSetups.push({ role: "idiot", count: 1 }),
  (b: any) => b.roleSetups.push({ role: "demon_hunter", count: 0 }),
  (b: any) => (b.roleSetups[0].extra = true),
  (b: any) => (b.winConditions = ["wolf_reach_half"]),
  (b: any) => (b.winConditions = ["slaughter_city", "slaughter_side"]),
  (b: any) => (b.winConditions = null),
  (b: any) => (b.winCondition = "slaughter_side"),
  (b: any) => (b.demonHunter.policy = "any_immunity"),
  (b: any) => (b.events = { pack: "wall_notes" }),
  (b: any) => (b.initialSheriffSeat = 1),
  (b: any) => (b.witch.canSelfHeal = "always"),
  (b: any) => (b.witch.potionPolicy = "awa_both_native_experimental_v1"),
  (b: any) => (b.seer.actionPolicy = "awa_optional_v1"),
  (b: any) => (b.selfDestruct.enabledWindows = ["on_pre_vote", "on_pre_vote"]),
  (b: any) => (b.disclosure.deathRevealPolicy = "netease_2017_open_v1"),
  (b: any) => (b.hooks.onDaybreak = true),
  (b: any) => (b.enableSheriff = false),
  (b: any) => (b.guard.repeatPolicy = "awa_last_action_v1"),
  (b: any) => (b.hunter.deathActionPolicy = "awa_qualified_sources_v1"),
  (b: any) => (b.sheriff.voteWeight = 2),
  (b: any) => (b.tieBreaker.wolfKillVote = "min_seat"),
])
  test("noncanonical twelve-board variant is rejected", () => {
    const b = board(12, "slaughter_city");
    patch(b);
    expect(isDemonHunterPreset(b)).toBe(false);
  });
for (const field of ["guard", "hunter", "sheriff"] as const)
  test(`six-board rejects inactive ${field} parameters`, () => {
    const b: any = board(6, "slaughter_city");
    b[field] = (board(12, "slaughter_city") as any)[field];
    expect(isDemonHunterPreset(b)).toBe(false);
  });
test("state preserves ordered choices and explicit abstentions without fake inventory or truth", () => {
  const s = freshDemonHunterState();
  s.history = [
    { day: 2, targetId: 1 },
    { day: 3, targetId: null },
    { day: 4, targetId: 1 },
  ];
  expect(readDemonHunterState(s)).toEqual(s);
  for (const bad of [
    { ...s, remaining: 1 },
    { ...s, history: [{ day: 1, targetId: 1 }] },
    {
      ...s,
      history: [
        { day: 2, targetId: 1 },
        { day: 2, targetId: null },
      ],
    },
    {
      ...s,
      history: [
        { day: 3, targetId: 1 },
        { day: 2, targetId: null },
      ],
    },
    { ...s, history: [{ day: 2, targetId: 1, camp: "wolf" }] },
  ])
    expect(readDemonHunterState(bad)).toBeNull();
});
for (const args of [
  { target_id: 1, abstain: false },
  { target_id: null, abstain: true },
])
  test("canonical choice and abstention preserve literal args", () => {
    expect(readDemonHuntTool({ name: "demon_hunt", args })).toEqual({ name: "demon_hunt", args });
  });
for (const args of [
  { target_id: null, abstain: false },
  { target_id: 1, abstain: true },
  { target_id: "1", abstain: false },
  { target_id: 0, abstain: false },
  { target_id: 1 },
  { target_id: 1, abstain: false, camp: "wolf" },
])
  test("noncanonical hunt args rejected", () => {
    expect(readDemonHuntTool({ name: "demon_hunt", args })).toBeNull();
  });
for (const kind of ["getter", "proxy"] as const)
  test(`${kind}: state/tool/preset readers execute zero foreign code`, () => {
    let reads = 0;
    const wrap = (value: object): object => {
      if (kind === "proxy")
        return new Proxy(value, {
          getPrototypeOf() {
            reads++;
            return Object.prototype;
          },
          ownKeys() {
            reads++;
            return [];
          },
        });
      Object.defineProperty(value, "foreign", {
        enumerable: true,
        get() {
          reads++;
          return 1;
        },
      });
      return value;
    };
    expect(readDemonHunterState(wrap(freshDemonHunterState()))).toBeNull();
    expect(
      readDemonHuntTool(wrap({ name: "demon_hunt", args: { target_id: 1, abstain: false } })),
    ).toBeNull();
    expect(isDemonHunterPreset(wrap(board(12, "slaughter_city")))).toBe(false);
    expect(reads).toBe(0);
  });
