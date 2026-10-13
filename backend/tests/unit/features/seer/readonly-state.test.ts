/**
 * Unit tests verify Seer's public deep-read contract and live reference identity.
 * Compiler-negative assignments cover nested result/history and installation
 * outputs; they are never executed. The literal runtime oracle proves reads keep
 * the installed slot unfrozen while only the explicit owner command writes it.
 * No World, role stage, transport, game cycle or historical fixture is executed.
 */
import type { SeerReadState } from "@ai-werewolf-arena/game-contract";

import { expect, test } from "bun:test";
import { Camp, Role } from "@ai-werewolf-arena/game-contract";
import { createRoleComponent } from "../../../../src/core/domain/components/role";
import { getSeerState as publicRead } from "../../../../src/game/mechanisms/roles/seer/ports";
import {
  getSeerState,
  setSeerState,
  recordSeerInspection,
} from "../../../../src/game/mechanisms/roles/seer/state";

function rejectedWrites(state: SeerReadState): void {
  // @ts-expect-error A read view grants no scalar write.
  state.lastTarget = 5;
  // @ts-expect-error A read view grants no history append.
  state.history.push({ targetId: 5, isWerewolf: true });
  // @ts-expect-error History row fields remain readonly.
  state.history[0]!.targetId = 5;
  // @ts-expect-error Last result fields remain readonly.
  state.lastResult!.kind = "camp";
  // @ts-expect-error Nested history results remain readonly.
  state.history[0]!.result!.kind = "camp";
}
void rejectedWrites;

test("public Seer reads and owner writes keep one unfrozen ability slot", () => {
  const role = createRoleComponent(Role.Seer, Camp.Good);
  const installed = setSeerState(role, { lastTarget: null, lastIsWerewolf: null, history: [] });
  expect(publicRead).toBe(getSeerState);
  expect(publicRead(role)).toBe(installed);
  expect(Object.isFrozen(installed)).toBe(false);
  recordSeerInspection(installed, 7, true, { kind: "camp", camp: "wolf" });
  expect(publicRead(role)).toBe(installed);
  expect(installed).toEqual({
    lastTarget: 7,
    lastIsWerewolf: true,
    lastResult: { kind: "camp", camp: "wolf" },
    history: [{ targetId: 7, isWerewolf: true, result: { kind: "camp", camp: "wolf" } }],
  });
});
