import { findNightAbility } from "../../../src/game/mechanisms/roles/abilities";
import { PotionType } from "../../../src/core";
import { expect, test } from "bun:test";
import { radiantFixture, radiantProvider } from "../../support/radiant_eclipse";
import type { ToolCall } from "../../../src/core";
const rows: [string, number | null, ToolCall, string][] = [
  [
    "eclipse_swallow",
    null,
    { name: "swallow_skill", args: { target_id: 10 } },
    "eclipse_swallow_action_invalid",
  ],
  [
    "radiant_shelter",
    2,
    { name: "cast_shelter", args: { target_id: 1 } },
    "radiant_shelter_action_invalid",
  ],
  ["dreamer", 5, { name: "dream", args: { target_id: 1 } }, "radiant_eclipse_dream_action_invalid"],
  [
    "witch",
    4,
    { name: "use_potion", args: { target_id: 1, potion_type: PotionType.Heal } },
    "radiant_eclipse_witch_action_invalid",
  ],
  [
    "seer",
    3,
    { name: "check_identity", args: { target_id: 99 } },
    "radiant_eclipse_seer_action_invalid",
  ],
];
for (const [stage, swallow, call, error] of rows)
  test(`same permitted tool with illegal domain arguments: ${stage}`, async () => {
    const f = await radiantFixture();
    const provider = radiantProvider(f.requests, { swallow, knife: 1 }, (r) =>
      r.context.stage === stage ? call : undefined,
    );
    await expect(f.pipeline.execute(f.board.config, provider, 2)).rejects.toThrow(error);
    expect(
      f.events.filter((e) => e.type === "eclipse_lease_closed").map((e) => e.payload.status),
    ).toEqual(["aborted"]);
    expect(
      f.events.some((e) =>
        ["eclipse_native_restored", "night_resolved", "game_over"].includes(e.type),
      ),
    ).toBe(false);
    for (const id of [2, 3, 4, 5]) expect(f.native(id).nightSuppression).toBeUndefined();
    if (f.borrowed()) {
      expect(f.borrowed()!.disabled).toBe(true);
      expect(f.borrowed()!.uses).toBe(0);
    }
    const native = findNightAbility(f.role(4), "potion")!;
    expect([native.state.heal, native.state.poison]).toEqual([1, 1]);
  });
