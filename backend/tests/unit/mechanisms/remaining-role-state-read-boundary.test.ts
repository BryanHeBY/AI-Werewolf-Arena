/**
 * Unit tests for remaining ordinary role-slot read outputs and detached modifier data.
 * Inputs are hand-written Cupid, Magician and Scholar records; original references,
 * descriptor getter traces and independently written normalized values are the oracle.
 * Compile-only writes target valid stock, choice, history and nested tuple fields.
 * This boundary does not run a game, mutate authority through a reader or call a model.
 */
import "../../../src/app/bootstrap";
import { expect, test } from "bun:test";
import {
  Camp,
  Role,
  type CupidState,
  type MagicianState,
  type ModifierState,
} from "@ai-werewolf-arena/game-contract";
import { createRoleComponent } from "../../../src/core/domain/components/role";
import type { RoleInitializationComponent } from "../../../src/game/mechanisms/roles/contracts";
import { getCupidState } from "../../../src/game/mechanisms/roles/cupid/state";
import { getHybridState } from "../../../src/game/mechanisms/roles/hybrid/state";
import { getWildChildState } from "../../../src/game/mechanisms/roles/wild_child/state";
import { getThiefState } from "../../../src/game/mechanisms/roles/thief/state";
import { getShapeshifterState } from "../../../src/game/mechanisms/roles/shapeshifter/state";
import { getDebaterState } from "../../../src/game/mechanisms/roles/debater/state";
import { getEvilKnightState } from "../../../src/game/mechanisms/roles/evil_knight/state";
import { getNightmareShadowState } from "../../../src/game/mechanisms/roles/nightmare_shadow/state";
import {
  getMagicianState,
  projectMagicianState,
} from "../../../src/game/mechanisms/roles/magician/state";
import { getTricksterState } from "../../../src/game/mechanisms/roles/trickster/state";
import { getWolfSorcererState } from "../../../src/game/mechanisms/roles/wolf_sorcerer/state";
import { getTimeConsortState } from "../../../src/game/mechanisms/roles/time_wolf_consort/state";
import { scholarMentorStateForRole } from "../../../src/game/mechanisms/roles/scholar_mentor/night_frame";
import { readModifierState } from "../../../src/game/mechanisms/roles/scholar_mentor/state";
import { getLonelyGirlState } from "../../../src/game/mechanisms/roles/lonely_girl/state";
import { getRedMoonState } from "../../../src/game/mechanisms/roles/red_moon_apostle/state";

function forbiddenLiveWrites(
  cupid: NonNullable<ReturnType<typeof getCupidState>>,
  hybrid: NonNullable<ReturnType<typeof getHybridState>>,
  wild: NonNullable<ReturnType<typeof getWildChildState>>,
  thief: NonNullable<ReturnType<typeof getThiefState>>,
  shape: NonNullable<ReturnType<typeof getShapeshifterState>>,
  debate: NonNullable<ReturnType<typeof getDebaterState>>,
  evil: NonNullable<ReturnType<typeof getEvilKnightState>>,
  nightmare: NonNullable<ReturnType<typeof getNightmareShadowState>>,
  magician: NonNullable<ReturnType<typeof getMagicianState>>,
  trickster: NonNullable<ReturnType<typeof getTricksterState>>,
  sorcerer: NonNullable<ReturnType<typeof getWolfSorcererState>>,
  consort: NonNullable<ReturnType<typeof getTimeConsortState>>,
  scholar: NonNullable<ReturnType<typeof scholarMentorStateForRole>>,
  lonely: NonNullable<ReturnType<typeof getLonelyGirlState>>,
  red: NonNullable<ReturnType<typeof getRedMoonState>>,
) {
  // @ts-expect-error A live stock read is not an accepted Cupid command.
  cupid.remaining = 0;
  if (cupid.choice) {
    // @ts-expect-error Nested pair identity stays read-only through the live getter.
    cupid.choice.pairIds[0] = 2;
  }
  if (hybrid.choice) {
    // @ts-expect-error Exemplar choice remains owned by its actual stage.
    hybrid.choice.targetId = 2;
  }
  // @ts-expect-error Wild Child eligibility belongs to its lifecycle writer.
  wild.eligibleNight = 2;
  // @ts-expect-error Initial identity choice is not a read permission.
  thief.choice = 0;
  // @ts-expect-error Shapeshifter stock is committed by the initial identity owner.
  shape.remaining = 0;
  if (debate.choice) {
    // @ts-expect-error Debate target stays read-only below the slot.
    debate.choice.targetId = 2;
  }
  // @ts-expect-error Reflection stock is consumed only after the existing authorization.
  evil.reflectionRemaining = 0;
  // @ts-expect-error Fear history has no reader append operation.
  nightmare.history.push({ day: 1, targetId: null });
  if (magician.history[0]?.pair) {
    // @ts-expect-error Exchange tuples stay read-only within stored history.
    magician.history[0].pair[0] = 2;
  }
  // @ts-expect-error Trickster history is owned by its frame command.
  trickster.history.push({ day: 1, pair: null });
  if (sorcerer.history[0]?.pair) {
    // @ts-expect-error Sorcerer stored pair IDs cannot be reassigned through a read.
    sorcerer.history[0].pair[1] = 3;
  }
  if (consort.history[0]) {
    // @ts-expect-error Consort history entries are deeply read-only.
    consort.history[0].targetId = 2;
  }
  // @ts-expect-error Live Scholar stock remains separate from a detached normalized DTO.
  scholar.remaining.enhance = 0;
  if (scholar.history[0]) {
    // @ts-expect-error Stored Scholar history entries remain read-only.
    scholar.history[0].mode = "enhance";
  }
  if (lonely.choice) {
    // @ts-expect-error Lonely Girl source choice stays read-only below the slot.
    lonely.choice.targetId = 2;
  }
  // @ts-expect-error Red Moon settlement flags belong to their guarded authority.
  red.expirySettled = true;
}
void forbiddenLiveWrites;

function roleWithSlot(role: Role, key: string, state: unknown) {
  const result = createRoleComponent(role, Camp.Good);
  (result as RoleInitializationComponent).privateState[key] = state;
  return result;
}

test("Cupid read output retains its stored record and tuple without freezing the input", () => {
  const state: CupidState = {
    policy: "lui_meme_lovers_only_v1",
    remaining: 0,
    choice: { day: 1, pairIds: [2, 3] },
  };
  const role = roleWithSlot(Role.Cupid, "cupid", state),
    read = getCupidState(role)!;
  expect(read).toBe(state);
  expect(read.choice!.pairIds).toBe(state.choice!.pairIds);
  expect(Object.isFrozen(state)).toBe(false);
  state.choice!.pairIds[0] = 4;
  expect(getCupidState(role)!.choice!.pairIds[0]).toBe(4);
});

test("Magician validation keeps the original live record and a separately copied player projection", () => {
  const state: MagicianState = {
    policy: "awa_magician_wolf_king_v1",
    firstNight: 1,
    deathShotTargetPolicy: "original",
    history: [{ day: 1, pair: [2, 3] }],
  };
  const role = roleWithSlot(Role.Magician, "magician", state);
  expect(getMagicianState(role)).toBe(state);
  const projected = projectMagicianState(role)!;
  expect(projected).not.toBe(state);
  expect(projected.history[0]!.pair).not.toBe(state.history[0]!.pair);
  projected.history[0]!.pair![0] = 4;
  expect(state.history[0]!.pair![0]).toBe(2);
  let reads = 0;
  Object.defineProperty(state, "history", {
    get() {
      reads++;
      return [];
    },
  });
  expect(getMagicianState(role)).toBeUndefined();
  expect(reads).toBe(0);
});

test("Scholar normalized DTO remains detached and writable while its live slot read keeps identity", () => {
  const state: ModifierState = {
    policy: "awa_scholar_mentor_twelve_v1",
    caster: "day_scholar",
    remaining: { enhance: 0, weaken: 1 },
    history: [{ day: 2, mode: "enhance", targetId: 2 }],
  };
  const role = roleWithSlot(Role.DayScholar, "scholarMentor", state);
  expect(scholarMentorStateForRole(role)).toBe(state);
  const normalized = readModifierState(state)!;
  expect(normalized).toEqual(state);
  expect(normalized).not.toBe(state);
  expect(normalized.remaining).not.toBe(state.remaining);
  expect(normalized.history[0]).not.toBe(state.history[0]);
  normalized.remaining.weaken = 0;
  normalized.history[0]!.targetId = 3;
  expect(state.remaining.weaken).toBe(1);
  expect(state.history[0]!.targetId).toBe(2);
});
