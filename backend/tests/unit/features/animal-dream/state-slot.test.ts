/**
 * 单元测试验证动物梦境三族完整状态槽的真实安装、引用替换、失效与 JSON 时点。
 * 输入为手写状态、原内存 roster 和明确 descriptor／写入失败；字面快照、对象身份及已提交前缀为预期。
 * 使用实际 authority 的有界子狐窗口，不推进 PhaseManager、完整对局、传输或模型；不重生成归档 oracle。
 */
import { expect, test } from "bun:test";
import { COMPONENT } from "../../../../src/domain/components/names";
import {
  animalRosterFixture,
} from "../../../support/features/animal-dream/builders/roster";
import {
  installAnimalAuthority,
  beginAnimalNight,
  closeAnimalNight,
  openAnimalFoxChoice,
  animalAuthoritySnapshot,
} from "../../../../src/game/mechanisms/roles/animal_dream/authority";
import {
  FOX_STATE_SLOT,
  PUFFER_STATE_SLOT,
  CAT_STATE_SLOT,
  captureResource,
} from "../../../../src/game/mechanisms/roles/animal_dream/state-slot";
import {
  freshFoxCubState,
  freshPufferfishState,
  freshWhiteCatState,
  readFoxCubState,
  readPufferfishState,
  readWhiteCatState,
  type FoxCubState,
} from "../../../../src/game/mechanisms/roles/animal_dream/state";
import type { RoleComponent } from "../../../../src/domain/components/role";

const privateData = (role: RoleComponent) => role.privateState as Record<string, unknown>;
const fixture = () => animalRosterFixture(undefined, installAnimalAuthority);

test("[slot] three contracts retain the original factory and schema bindings; codec does not authorize", () => {
  expect(FOX_STATE_SLOT.create).toBe(freshFoxCubState);
  expect(PUFFER_STATE_SLOT.create).toBe(freshPufferfishState);
  expect(CAT_STATE_SLOT.create).toBe(freshWhiteCatState);
  expect(FOX_STATE_SLOT.schema).toBe(readFoxCubState);
  expect(PUFFER_STATE_SLOT.schema).toBe(readPufferfishState);
  expect(CAT_STATE_SLOT.schema).toBe(readWhiteCatState);
  expect(FOX_STATE_SLOT.create()).toEqual({ policy: "awa_animal_dream_v1", usedNight: null, history: [] });
  expect(PUFFER_STATE_SLOT.create()).toEqual({
    policy: "awa_animal_dream_v1", usedDay: null, knifeDeathDay: null, history: [],
  });
  expect(CAT_STATE_SLOT.create()).toEqual({ policy: "awa_animal_dream_v1", form: { kind: "veiled" } });
  const raw = FOX_STATE_SLOT.checkpoint.decode(() => '{"policy":"unknown"}');
  expect<unknown>(raw).toEqual({ policy: "unknown" });
  expect(() => FOX_STATE_SLOT.schema(raw)).toThrow();
});

test("[slot] all three decoders look up JSON.parse before the original JSON getter", () => {
  const trace: string[] = [], original = Object.getOwnPropertyDescriptor(JSON, "parse")!;
  try {
    // 明确构造 getter，只在同步 codec 调用期间观察查找顺序；随后恢复宿主方法再断言。
    Object.defineProperty(JSON, "parse", {
      configurable: true,
      get: () => { trace.push("parse-method"); return original.value; },
    });
    for (const slot of [FOX_STATE_SLOT, PUFFER_STATE_SLOT, CAT_STATE_SLOT])
      slot.checkpoint.decode(() => { trace.push("json-data"); return "{}"; });
  } finally {
    Object.defineProperty(JSON, "parse", original);
  }
  expect(trace).toEqual(["parse-method", "json-data", "parse-method", "json-data", "parse-method", "json-data"]);
});

test("[slot] real installation captures original states; accepted Fox pass replaces only its live reference", () => {
  const originals: unknown[] = [];
  const f = animalRosterFixture((world) => {
    for (const [id, key] of [[10, "foxCub"], [12, "pufferfish"], [9, "whiteCat"]] as const)
      originals.push(privateData(world.getComponent(id, COMPONENT.Role)!)[key]);
  }, installAnimalAuthority);
  expect(privateData(f.role(10)).foxCub).toBe(originals[0]);
  expect(privateData(f.role(12)).pufferfish).toBe(originals[1]);
  expect(privateData(f.role(9)).whiteCat).toBe(originals[2]);
  beginAnimalNight(f.world, 1, () => true);
  closeAnimalNight(f.world, 1, "normal");
  beginAnimalNight(f.world, 2, () => true);
  openAnimalFoxChoice(f.world, 2).commit(null);
  expect(privateData(f.role(10)).foxCub).not.toBe(originals[0]);
  expect(privateData(f.role(12)).pufferfish).toBe(originals[1]);
  expect(privateData(f.role(9)).whiteCat).toBe(originals[2]);
  expect(originals[0]).toEqual({ policy: "awa_animal_dream_v1", usedNight: null, history: [] });
  const snapshot = animalAuthoritySnapshot(f.world)!;
  expect(snapshot.fox).toEqual({ policy: "awa_animal_dream_v1", usedNight: null, history: [{ day: 2, targetId: null }] });
  snapshot.fox.history[0]!.targetId = 7;
  expect(animalAuthoritySnapshot(f.world)!.fox.history).toEqual([{ day: 2, targetId: null }]);
});

test("[slot] an observed replacement or nonwritable slot stops the real owner permanently", () => {
  for (const change of ["reference", "writable"] as const) {
    const f = fixture(), container = privateData(f.role(10)), original = container.foxCub;
    if (change === "reference") container.foxCub = structuredClone(original);
    else Object.defineProperty(container, "foxCub", { writable: false });
    expect(animalAuthoritySnapshot(f.world)).toBeNull();
    if (change === "reference") container.foxCub = original;
    else Object.defineProperty(container, "foxCub", { writable: true });
    expect(animalAuthoritySnapshot(f.world)).toBeNull();
    expect(animalAuthoritySnapshot(f.world, false)!.stopped).toBe(true);
  }
});

test("[slot] failed metadata writes preserve the exact private slot then state then JSON prefix", () => {
  for (const failed of ["state", "json"] as const) {
    const f = fixture(), slot = captureResource(f.world, "fox_cub", "foxCub", readFoxCubState, freshFoxCubState()),
      original = slot.state, previousJson = slot.json, failure = Error("literal_slot_write_failure"),
      next: FoxCubState = { policy: "awa_animal_dream_v1", usedNight: null, history: [{ day: 2, targetId: null }] };
    const old = failed === "state" ? original : previousJson;
    Object.defineProperty(slot, failed, { get: () => old, set: () => { throw failure; } });
    expect(() => FOX_STATE_SLOT.allowedWrites.commit(slot, next, '{"literal":"already_encoded"}')).toThrow(failure);
    expect(privateData(f.role(10)).foxCub).toBe(next);
    expect(slot.state).toBe(failed === "state" ? original : next);
    expect(slot.json).toBe(previousJson);
  }
});
