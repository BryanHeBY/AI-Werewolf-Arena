/**
 * Package unit contract for Ghost Bride serialized wedding shapes and defaults.
 * Literal templates, witness votes and tool data independently check original
 * key/status/null correlations. freshGhostBrideState is a JSON default factory;
 * these tests install no domain stock, actor, relationship or knife authority.
 */
import { expect, test } from "bun:test";
import {
  GHOST_BRIDE_POLICY,
  freshGhostBrideState,
  readGhostBrideState,
  readWeddingSetup,
  readWeddingPair,
  readWeddingGroup,
  readWeddingTool,
  readWeddingKnifeCapture,
} from "@ai-werewolf-arena/game-contract/facts/ghost-bride";
test("fresh template remains detached plain data and not owned stock", () => {
  const first = freshGhostBrideState(),
    second = freshGhostBrideState();
  expect<unknown>(first).toEqual({
    policy: "awa_melbourne_ghost_bride_v1",
    remaining: 1,
    groomId: null,
  });
  expect(first).not.toBe(second);
  expect(Object.getPrototypeOf(first)).toBe(Object.prototype);
  first.remaining = 0;
  expect(second.remaining).toBe(1);
  expect(
    readGhostBrideState({ policy: GHOST_BRIDE_POLICY, remaining: 0, groomId: null }),
  ).not.toBeNull();
  expect(readGhostBrideState({ policy: GHOST_BRIDE_POLICY, remaining: 1, groomId: 2 })).toBeNull();
});
test("pair/group and complete setup keep IDs, vote order and null correlations", () => {
  const pair = {
    policy: GHOST_BRIDE_POLICY,
    groupId: "ghost-bride:1:1",
    brideId: 1,
    groomId: 2,
    day: 1,
  };
  expect<unknown>(readWeddingPair(pair)).toEqual(pair);
  expect(readWeddingGroup({ ...pair, witnessId: 3 })).not.toBeNull();
  expect(readWeddingGroup({ ...pair, witnessId: 2 })).toBeNull();
  const setup = {
    policy: GHOST_BRIDE_POLICY,
    status: "complete",
    actorId: 1,
    groomId: 2,
    witnessId: 3,
    witnessVotes: [
      { actorId: 1, targetId: 3 },
      { actorId: 2, targetId: 3 },
    ],
  };
  expect<unknown>(readWeddingSetup(setup)).toEqual(setup);
  expect(
    readWeddingSetup({ ...setup, witnessVotes: [...setup.witnessVotes].reverse() }),
  ).toBeNull();
  expect(readWeddingSetup({ ...setup, status: "pending" })).toBeNull();
});
test("knife capture cardinality and tool null-pass stay descriptive", () => {
  const capture = {
    policy: GHOST_BRIDE_POLICY,
    groupId: "ghost-bride:1:1",
    day: 1,
    owner: "pair",
    actorIds: [1, 2],
  };
  expect<unknown>(readWeddingKnifeCapture(capture)).toEqual(capture);
  expect(readWeddingKnifeCapture({ ...capture, actorIds: [1] })).toBeNull();
  expect(
    readWeddingTool({ name: "wedding_kill_vote", args: { target_id: null, abstain: true } }),
  ).not.toBeNull();
  expect(
    readWeddingTool({ name: "wedding_kill_vote", args: { target_id: null, abstain: false } }),
  ).toBeNull();
  expect(
    readWeddingTool({ name: "choose_bridegroom", args: { target_id: Number.MAX_SAFE_INTEGER } }),
  ).not.toBeNull();
});
