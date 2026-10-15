/**
 * 单元测试负责动物梦境白猫延期、实际放逐单元到期和生命提交边界。
 * 输入为既有内存 fixture、原回调和明确非法修改；原字面预期、身份快照及拒绝断言保持独立预期。
 * 仅调用真实 owner／frame／reader，原样保留请求和资源规则，不运行完整对局、模型或真实传输。
 */
import { expect, test } from "bun:test";
import { animalRosterFixture } from "../../../support/features/animal-dream/builders/roster";
import { aliveLifeVersion } from "../../../../src/domain/components/alive";
import {
  installAnimalAuthority,
  beginAnimalNight,
  closeAnimalNight,
  openAnimalFoxChoice,
  beginAnimalExileUnit,
  prepareAnimalCatExpiry,
  closeAnimalExileUnit,
  filterAnimalLethalWave,
  animalAuthoritySnapshot,
} from "../../../../src/features/animal-dream/authority";
import { recordAnimalBallotRound, sealAnimalBallots } from "../../../../src/features/animal-dream/accepted-ballots";
const fixture = (skip = false) => {
  const f = animalRosterFixture(undefined, (world, raw) =>
    installAnimalAuthority(world, {
      ...raw,
      whiteCat: {
        skippedVotePolicy: skip ? "awa_expire_on_skipped_day_v1" : "awa_wait_for_actual_exile_v1",
      },
    }),
  );
  return { ...f, token: null as object | null };
};
function unit(
  f: ReturnType<typeof fixture>,
  day: number,
  kind: "exile" | "skipped_day",
  current = () => true,
) {
  f.token = beginAnimalExileUnit(f.world, day, kind, current);
  if (kind === "exile") {
    recordAnimalBallotRound(
      f.world,
      f.token,
      1,
      f.world.getAliveEntityIds().map((actorId) => ({
        actorId,
        targetId: null,
        abstain: true,
        weight: 0,
      })),
    );
    sealAnimalBallots(f.world, f.token);
  }
  return f.token;
}
function night(f: ReturnType<typeof fixture>, day: number) {
  beginAnimalNight(f.world, day, () => true);
  f.token = null;
  if (day >= 2 && f.life(10).alive) openAnimalFoxChoice(f.world, day).commit(null);
  closeAnimalNight(f.world, day, "normal");
}
const wave = (
  f: ReturnType<typeof fixture>,
  day: number,
  phase: "night" | "day" | "voting",
  sources = ["wolf_kill"],
) => filterAnimalLethalWave(f.world, day, phase, [9], { 9: sources }, f.token ?? (() => true));
test("first lethal Cat proposal preserves original Alive, version and reveal exactly once", () => {
  const f = fixture();
  night(f, 1);
  const life = f.life(9),
    version = aliveLifeVersion(life);
  expect(wave(f, 1, "night")).toEqual({ deaths: [], revealedCatId: 9, blockedCatId: 9 });
  expect(f.life(9)).toBe(life);
  expect(life.alive).toBe(true);
  expect(aliveLifeVersion(life)).toBe(version);
  expect(wave(f, 1, "day", ["charm"])).toEqual({
    deaths: [],
    revealedCatId: null,
    blockedCatId: 9,
  });
  expect(animalAuthoritySnapshot(f.world)!.cat.form).toEqual({
    kind: "deferred",
    deferred: {
      day: 1,
      phase: "night",
      firstSources: ["wolf_kill"],
      firstUnit: null,
      expiresAfterUnit: 1,
    },
  });
});
test("prior-night deferral expires in the first real exile unit; owner never writes death", () => {
  const f = fixture();
  night(f, 1);
  wave(f, 1, "night");
  const token = unit(f, 1, "exile");
  expect(prepareAnimalCatExpiry(f.world, token)).toBe(9);
  expect(f.life(9).alive).toBe(true);
  expect(wave(f, 1, "voting", ["white_cat_expiry"])).toEqual({
    deaths: [9],
    revealedCatId: null,
    blockedCatId: null,
  });
  // 此样本手写首次生命提交以验证原到期条件；真实对局仍由 DeathResolution 提交。
  f.life(9).alive = false;
  closeAnimalExileUnit(f.world, token);
  expect(animalAuthoritySnapshot(f.world)!.completedUnits).toBe(1);
  expect(() => closeAnimalExileUnit(f.world, token)).toThrow();
  expect(() => beginAnimalExileUnit(f.world, 1, "exile", () => true)).toThrow();
});
test("first deferral from the current final exile waits through this whole unit including PK", () => {
  const f = fixture();
  night(f, 1);
  const first = unit(f, 1, "exile");
  wave(f, 1, "voting", ["exile"]);
  expect(() => beginAnimalExileUnit(f.world, 1, "exile", () => true)).toThrow();
  expect(prepareAnimalCatExpiry(f.world, first)).toBeNull();
  closeAnimalExileUnit(f.world, first);
  night(f, 2);
  const second = unit(f, 2, "exile");
  expect(wave(f, 2, "voting", ["puffer_retaliation"]).deaths).toEqual([]);
  expect(prepareAnimalCatExpiry(f.world, second)).toBe(9);
  expect(animalAuthoritySnapshot(f.world)!.cat.form).toEqual({
    kind: "expired",
    deferred: {
      day: 1,
      phase: "voting",
      firstSources: ["exile"],
      firstUnit: 1,
      expiresAfterUnit: 2,
    },
    day: 2,
    unit: 2,
    unitKind: "exile",
  });
});
test("default skips do not advance actual exile count or renew a pending clock", () => {
  const f = fixture();
  night(f, 1);
  wave(f, 1, "night");
  for (const day of [1, 2, 3]) {
    if (day > 1) night(f, day);
    const token = unit(f, day, "skipped_day");
    expect(prepareAnimalCatExpiry(f.world, token)).toBeNull();
    closeAnimalExileUnit(f.world, token);
    expect(animalAuthoritySnapshot(f.world)!.completedUnits).toBe(0);
  }
  night(f, 4);
  expect(prepareAnimalCatExpiry(f.world, unit(f, 4, "exile"))).toBe(9);
});
test("default new combined-wave Cat expires after the next actual exile rather than an extra unit", () => {
  const f = fixture();
  night(f, 1);
  const skip = unit(f, 1, "skipped_day");
  wave(f, 1, "night");
  expect(prepareAnimalCatExpiry(f.world, skip)).toBeNull();
  closeAnimalExileUnit(f.world, skip);
  expect(animalAuthoritySnapshot(f.world)!.cat.form).toEqual({
    kind: "deferred",
    deferred: {
      day: 1,
      phase: "night",
      firstSources: ["wolf_kill"],
      firstUnit: null,
      expiresAfterUnit: 1,
    },
  });
  night(f, 2);
  expect(prepareAnimalCatExpiry(f.world, unit(f, 2, "exile"))).toBe(9);
});
test("normal unit closure waits for the prepared expiry actual original death", () => {
  const f = fixture();
  night(f, 1);
  wave(f, 1, "night");
  const token = unit(f, 1, "exile");
  expect(prepareAnimalCatExpiry(f.world, token)).toBe(9);
  expect(() => closeAnimalExileUnit(f.world, token)).toThrow("animal_exile_unit_not_complete");
  expect(() => beginAnimalNight(f.world, 2, () => true)).toThrow();
  expect(animalAuthoritySnapshot(f.world)!.completedUnits).toBe(0);
  f.life(9).alive = false;
  closeAnimalExileUnit(f.world, token);
  expect(animalAuthoritySnapshot(f.world)!.completedUnits).toBe(1);
});
test("closed earlier-day unit cannot authorize a new voting proposal without current unit", () => {
  const f = fixture();
  night(f, 1);
  const token = unit(f, 1, "exile");
  prepareAnimalCatExpiry(f.world, token);
  closeAnimalExileUnit(f.world, token);
  night(f, 2);
  expect(() => wave(f, 2, "voting", ["exile"])).toThrow();
  expect(animalAuthoritySnapshot(f.world)!.cat.form.kind).toBe("veiled");
});
test("only the current token uses the captured unit guard; a fresh callback cannot bypass it", () => {
  const f = fixture();
  night(f, 1);
  let current = true;
  unit(f, 1, "exile", () => current);
  current = false;
  expect(() =>
    filterAnimalLethalWave(f.world, 1, "voting", [9], { 9: ["exile"] }, () => true),
  ).toThrow();
  expect(() => wave(f, 1, "voting", ["exile"])).toThrow();
  expect(animalAuthoritySnapshot(f.world, false)!.cat.form.kind).toBe("veiled");
});
for (const kind of ["exile", "skipped_day"] as const)
  test(`a new clock after empty ${kind} preparation requires fresh settlement`, () => {
    const f = fixture(true);
    night(f, 1);
    const token = unit(f, 1, kind);
    expect(prepareAnimalCatExpiry(f.world, token)).toBeNull();
    wave(f, 1, "night");
    expect(() => closeAnimalExileUnit(f.world, token)).toThrow("animal_exile_unit_not_complete");
    expect(prepareAnimalCatExpiry(f.world, token)).toBe(kind === "exile" ? null : 9);
    if (kind === "skipped_day") {
      expect(() => closeAnimalExileUnit(f.world, token)).toThrow("animal_exile_unit_not_complete");
      f.life(9).alive = false;
    }
    closeAnimalExileUnit(f.world, token);
    expect(animalAuthoritySnapshot(f.world)!.completedUnits).toBe(1);
  });
for (const combined of [false, true])
  test(`alternate skip expires ${combined ? "new combined-wave" : "earlier night"} Cat`, () => {
    const f = fixture(true);
    night(f, 1);
    if (!combined) wave(f, 1, "night");
    const token = unit(f, 1, "skipped_day");
    if (combined) wave(f, 1, "night");
    expect(prepareAnimalCatExpiry(f.world, token)).toBe(9);
    f.life(9).alive = false;
    closeAnimalExileUnit(f.world, token);
    expect(animalAuthoritySnapshot(f.world)!.completedUnits).toBe(1);
  });
test("forged, foreign, prior unit and incomplete tokens cannot grant expiry or another night", () => {
  const f = fixture(),
    foreign = fixture();
  night(f, 1);
  night(foreign, 1);
  const token = unit(f, 1, "exile"),
    other = beginAnimalExileUnit(foreign.world, 1, "exile", () => true);
  expect(() => prepareAnimalCatExpiry(f.world, {})).toThrow();
  expect(() => prepareAnimalCatExpiry(f.world, other)).toThrow();
  expect(() => closeAnimalExileUnit(f.world, token)).toThrow("animal_exile_unit_not_complete");
  expect(() => beginAnimalNight(f.world, 2, () => true)).toThrow();
  prepareAnimalCatExpiry(f.world, token);
  closeAnimalExileUnit(f.world, token);
  expect(() => prepareAnimalCatExpiry(f.world, token)).toThrow();
  night(f, 2);
  const next = unit(f, 2, "exile");
  expect(() => prepareAnimalCatExpiry(f.world, token)).toThrow();
  expect(prepareAnimalCatExpiry(f.world, next)).toBeNull();
});
test("last callback revocation retains canonical veiled Cat and no Alive change", () => {
  const f = fixture();
  night(f, 1);
  let reads = 0;
  expect(() =>
    filterAnimalLethalWave(f.world, 1, "night", [9], { 9: ["wolf_kill"] }, () => {
      Object.defineProperty(f.role(9).privateState, "whiteCat", {
        enumerable: true,
        get() {
          reads++;
          return {};
        },
      });
      return true;
    }),
  ).toThrow();
  expect(reads).toBe(0);
  expect(animalAuthoritySnapshot(f.world, false)!.cat.form).toEqual({ kind: "veiled" });
  expect(f.life(9).alive).toBe(true);
});
test("unit opening callback cannot change a life or reenter expiry even if it swallows errors", () => {
  for (const action of ["death", "reentry"] as const) {
    const f = fixture();
    night(f, 1);
    expect(() =>
      beginAnimalExileUnit(f.world, 1, "exile", () => {
        if (action === "death") f.life(5).alive = false;
        else {
          try {
            filterAnimalLethalWave(f.world, 1, "night", [9], { 9: ["wolf_kill"] }, () => true);
          } catch {}
        }
        return true;
      }),
    ).toThrow();
    expect(animalAuthoritySnapshot(f.world, false)!.unit!.status).toBe("aborted");
    expect(animalAuthoritySnapshot(f.world, false)!.cat.form).toEqual({ kind: "veiled" });
  }
});
test("unit expiry canonical stays expired after abort and detached failure snapshots cannot refund it", () => {
  const f = fixture();
  night(f, 1);
  wave(f, 1, "night");
  const token = unit(f, 1, "exile");
  prepareAnimalCatExpiry(f.world, token);
  closeAnimalNight(f.world, 1, "aborted");
  const saved = animalAuthoritySnapshot(f.world, false)!;
  expect(saved.cat.form.kind).toBe("expired");
  saved.cat.form = { kind: "veiled" };
  expect(animalAuthoritySnapshot(f.world, false)!.cat.form.kind).toBe("expired");
  expect(f.life(9).alive).toBe(true);
});
test("invalid source and getters reject before any deferral", () => {
  const f = fixture();
  night(f, 1);
  expect(() => wave(f, 1, "night", ["self_destruct"])).toThrow();
  let calls = 0;
  const sources = Object.defineProperty({}, "9", {
    enumerable: true,
    get() {
      calls++;
      return ["wolf_kill"];
    },
  });
  expect(() => filterAnimalLethalWave(f.world, 1, "night", [9], sources, () => true)).toThrow();
  expect(calls).toBe(0);
  expect(animalAuthoritySnapshot(f.world)!.cat.form).toEqual({ kind: "veiled" });
});
