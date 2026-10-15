/**
 * Failure scenario tests check missing/wrong-tool actions and interruption in actual Radiant/Eclipse nights. Inputs are original stage/mode choices and currentness changes from the public board fixture; literal committed prefix, closed lease, disabled borrow and cleanup facts are the oracle. Failures retain original stock and do not generate an alternate expected replay.
 */
import { expect, test } from "bun:test";
import { radiantFixture } from "../../../support/features/radiant-eclipse/builders/runtime-game";
import { radiantProvider } from "../../../support/features/radiant-eclipse/drivers/actions";
import { findNightAbility, abilityStatus } from "../../../../src/features/night-abilities/abilities";

for (const stage of [
  "eclipse_swallow",
  "radiant_shelter",
  "dreamer",
  "wolf_discussion",
  "wolf_vote",
  "witch",
  "seer",
] as const)
  for (const mode of ["missing", "wrong_tool"] as const)
    test(`strict ${stage} ${mode} stores prefix and closes lease`, async () => {
      const f = await radiantFixture();
      const provider = radiantProvider(
        f.requests,
        {
          swallow:
            stage === "radiant_shelter" ? 2 : stage === "dreamer" ? 5 : stage === "witch" ? 4 : 3,
        },
        (r) =>
          r.context.stage === stage
            ? mode === "missing"
              ? null
              : { name: "vote", args: { target_id: 6, abstain: false } }
            : undefined,
      );
      await expect(f.pipeline.execute(f.board.config, provider, 2)).rejects.toThrow();
      expect(f.native(2).nightSuppression).toBeUndefined();
      expect(f.native(3).nightSuppression).toBeUndefined();
      expect(f.native(4).nightSuppression).toBeUndefined();
      expect(f.native(5).nightSuppression).toBeUndefined();
      if (f.borrowed()) expect(abilityStatus(f.borrowed()!, 2)).toBe("disabled");
      expect(f.events.at(-1)?.type).toBe("eclipse_lease_closed");
      expect(f.events.at(-1)?.payload).toMatchObject({ status: "aborted" });
      expect(
        f.events.some((e) =>
          ["eclipse_native_restored", "night_resolved", "game_over"].includes(e.type),
        ),
      ).toBe(false);
      await expect(f.pipeline.execute(f.board.config, provider, 2)).rejects.toThrow(
        "radiant_night_reentry",
      );
    });

test("interruption after submitted borrowing closes only authorization and retains actual stock", async () => {
  const f = await radiantFixture();
  let current = true;
  const provider = radiantProvider(
    f.requests,
    { swallow: 4, potion: { target_id: 6, potion_type: "poison" } },
    (r) => {
      if (r.context.stage === "seer") current = false;
      return undefined;
    },
  );
  const result = await f.pipeline.execute(f.board.config, provider, 2, {
    isCurrent: () => current,
  });
  expect(result.interrupted).toBe(true);
  expect(f.events.at(-1)?.payload).toMatchObject({ status: "aborted" });
  expect(findNightAbility(f.role(1), "potion")!.state.poison).toBe(0);
  expect(findNightAbility(f.role(4), "potion")!.state.poison).toBe(1);
});
